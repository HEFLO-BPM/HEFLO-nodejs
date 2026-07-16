const assert = require('assert');

const axios = require('axios');
const Timer = require('../dist/Helpers/Timer');
const Rest = require('../dist/Helpers/Rest');

function createContext() {
    return {
        AuthorizationHeader: 'original-token',
        refreshCount: 0,
        async Refresh() {
            this.refreshCount += 1;
            this.AuthorizationHeader = `refreshed-token-${this.refreshCount}`;
        }
    };
}

async function runTest(name, testFn) {
    try {
        await testFn();
        console.log(`PASS ${name}`);
    } catch (err) {
        console.error(`FAIL ${name}`);
        throw err;
    }
}

async function main() {
    const originalPost = axios.post;
    const originalGet = axios.get;
    const originalSleep = Timer.Sleep;

    Timer.Sleep = async () => undefined;

    try {
        await runTest('PostAsync retries on 429 with headers', async () => {
            const context = createContext();
            const config = { headers: {} };
            const transportError = {
                response: {
                    status: 429,
                    headers: {
                        'x-rate-limit-remaining': '0'
                    }
                }
            };
            let callCount = 0;

            axios.post = async () => {
                callCount += 1;
                if (callCount === 1) throw transportError;
                return { data: { ok: true } };
            };

            const response = await Rest.PostAsync(context, 'http://example.test', { value: 1 }, config);

            assert.deepStrictEqual(response.data, { ok: true });
            assert.strictEqual(callCount, 2);
            assert.strictEqual(context.refreshCount, 0);
        });

        await runTest('GetAsync refreshes token and retries on 401', async () => {
            const context = createContext();
            const config = { headers: { Authorization: 'Bearer original-token' } };
            const authError = {
                response: {
                    status: 401,
                    headers: {}
                }
            };
            let callCount = 0;

            axios.get = async (endpoint, requestConfig) => {
                callCount += 1;
                if (callCount === 1) {
                    assert.strictEqual(requestConfig.headers.Authorization, 'Bearer original-token');
                    throw authError;
                }

                assert.strictEqual(requestConfig.headers.Authorization, 'Bearer refreshed-token-1');
                return { data: { ok: true } };
            };

            const response = await Rest.GetAsync(context, 'http://example.test', config);

            assert.deepStrictEqual(response.data, { ok: true });
            assert.strictEqual(callCount, 2);
            assert.strictEqual(context.refreshCount, 1);
        });

        await runTest('PostAsync rejects original error when axios has no response', async () => {
            const context = createContext();
            const config = { headers: {} };
            const networkError = new Error('socket hang up');

            axios.post = async () => {
                throw networkError;
            };

            await assert.rejects(
                () => Rest.PostAsync(context, 'http://example.test', { value: 1 }, config),
                (err) => err === networkError
            );
            assert.strictEqual(context.refreshCount, 0);
        });

        await runTest('GetAsync handles response without headers', async () => {
            const context = createContext();
            const config = { headers: {} };
            const throttledError = {
                response: {
                    status: 429
                }
            };
            let callCount = 0;

            axios.get = async () => {
                callCount += 1;
                if (callCount === 1) throw throttledError;
                return { data: { ok: true } };
            };

            const response = await Rest.GetAsync(context, 'http://example.test', config);

            assert.deepStrictEqual(response.data, { ok: true });
            assert.strictEqual(callCount, 2);
            assert.strictEqual(context.refreshCount, 0);
        });
    } finally {
        axios.post = originalPost;
        axios.get = originalGet;
        Timer.Sleep = originalSleep;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
