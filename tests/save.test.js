const assert = require('assert');

const axios = require('axios');
const heflo = require('../dist/Index');

const PERSON_OID = 4242;
const GROUP_OID = 777;
const WORKITEM_OID = 9001;

function personRequest(entity) {
    return {
        body: {
            Bearer: 'token',
            UserId: 'user',
            Domain: 'b1bfc0b5-d3a5-4fca-a132-8c2e443a6379',
            CacheTTL: 60,
            IsTest: false,
            StorageRelational: 'http://data.test/',
            CacheRelational: 'http://data.test/',
            StorageNoSQL: 'http://nosql.test/',
            CacheNoSQL: 'http://nosql.test/',
            Metadata: {},
            Entity: entity
        }
    };
}

function captureBatches() {
    const batches = [];
    axios.post = async (endpoint, payload) => {
        batches.push({ endpoint, payload });
        return { data: { responses: [{ status: 204 }] } };
    };
    return batches;
}

function batchJson(batch) {
    const line = batch.payload.split('\r\n').find(l => l.startsWith('{'));
    assert.ok(line, `no JSON body found in batch payload:\n${batch.payload}`);
    return JSON.parse(line);
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

    axios.get = async (endpoint) => { throw new Error(`unexpected GET ${endpoint}`); };

    try {
        await runTest('Person.SaveAsync sends Name, Email, Enabled and custom fields', async () => {
            const context = new heflo.Events.Person.OnChanged(personRequest({
                Oid: PERSON_OID, Name: 'Old', Email: 'old@x.test', Enabled: true, cp_color: 'red'
            }));
            const batches = captureBatches();
            const person = context.Person;

            person.Name = 'New Name';
            person.Email = 'new@x.test';
            person.Set('cp_color', 'blue');
            person.Set('Enabled', !Boolean(person.Get('Enabled')));
            await person.SaveAsync(context);

            assert.strictEqual(batches.length, 1, `expected one $batch call, got ${batches.length}`);
            assert.ok(batches[0].payload.includes(`PATCH http://data.test/odata/Person(${PERSON_OID}) HTTP/1.1`),
                `expected a PATCH of Person(${PERSON_OID}), got:\n${batches[0].payload}`);
            assert.deepStrictEqual(batchJson(batches[0]),
                { Name: 'New Name', Email: 'new@x.test', cp_color: 'blue', Enabled: false },
                'PATCH body must carry every change logged on the person');
        });

        await runTest('Person parses Enabled from the entity and the Enabled setter is saved', async () => {
            const context = new heflo.Events.Person.OnChanged(personRequest({ Oid: PERSON_OID, Enabled: false }));
            const person = context.Person;
            assert.strictEqual(person.Get('Enabled'), false, `Get("Enabled") should read the entity value, got ${person.Get('Enabled')}`);
            assert.strictEqual(person.Enabled, false, `Enabled should read the entity value, got ${person.Enabled}`);

            const batches = captureBatches();
            person.Enabled = true;
            await person.SaveAsync(context);
            assert.deepStrictEqual(batchJson(batches[0]), { Enabled: true }, 'Enabled setter change must be in the PATCH body');
        });

        await runTest('SaveAsync removes only the saved changes from the log', async () => {
            const context = new heflo.Events.Person.OnChanged(personRequest({ Oid: PERSON_OID, Enabled: true }));
            const batches = captureBatches();

            context.addChange(heflo.WorkItem.ClassOid, 'cp_pending', WORKITEM_OID, 'keep me');
            context.addChange(heflo.WorkItem.ClassOid, 'cp_pending2', WORKITEM_OID, 'keep me too');
            context.Person.Name = 'A';
            context.Person.Email = 'a@x.test';
            await context.Person.SaveAsync(context);

            const remaining = context.GetModifiedData().Changes.map(c => `${c.Key}.${c.PropertyName}`).sort();
            assert.deepStrictEqual(remaining, [`${WORKITEM_OID}.cp_pending`, `${WORKITEM_OID}.cp_pending2`],
                `unsaved changes must survive and saved ones must be cleared, got ${JSON.stringify(remaining)}`);

            await context.Person.SaveAsync(context);
            assert.strictEqual(batches.length, 1, `a second SaveAsync with nothing pending must not resend, got ${batches.length} batches`);
        });

        await runTest('Group.SaveAsync sends Name and Email', async () => {
            const context = new heflo.Context(personRequest(null));
            const group = heflo.Group.Parse(context, { Oid: GROUP_OID, Name: 'G', Email: 'g@x.test' });
            const batches = captureBatches();

            group.Name = 'Group 2';
            group.Email = 'g2@x.test';
            await group.SaveAsync(context);

            assert.strictEqual(batches.length, 1, `expected one $batch call, got ${batches.length}`);
            assert.deepStrictEqual(batchJson(batches[0]), { Name: 'Group 2', Email: 'g2@x.test' },
                'PATCH body must carry the group Name and Email');
        });

        await runTest('Batch body escapes quotes, backslashes and newlines', async () => {
            const context = new heflo.Events.Person.OnChanged(personRequest({ Oid: PERSON_OID }));
            const batches = captureBatches();
            const value = 'He said "hi" \\ C:\\path\nline2';

            context.Person.Name = value;
            context.Person.Set('cp_count', 12);
            context.Person.Set('cp_flag', true);
            await context.Person.SaveAsync(context);

            const body = batchJson(batches[0]);
            assert.strictEqual(body.Name, value, `Name must round-trip through the batch JSON, got ${JSON.stringify(body.Name)}`);
            assert.strictEqual(body.cp_count, 12, `numbers stay unquoted, got ${JSON.stringify(body.cp_count)}`);
            assert.strictEqual(body.cp_flag, true, `booleans stay unquoted, got ${JSON.stringify(body.cp_flag)}`);
        });

        await runTest('Person.FindAsync selects Enabled', async () => {
            const context = new heflo.Context(personRequest(null));
            const urls = [];
            axios.get = async (endpoint) => {
                urls.push(endpoint);
                if (endpoint.includes('GetClassByOid'))
                    return { data: { Name: 'Person', Properties: [] } };
                return { data: { Oid: PERSON_OID, Name: 'P', Email: 'p@x.test', Enabled: false } };
            };

            const person = await heflo.Person.FindAsync(context, PERSON_OID);
            const personUrl = urls.find(u => u.includes(`odata/Person(${PERSON_OID})`));
            assert.ok(personUrl && /\$select=[^&]*\bEnabled\b/.test(personUrl), `$select must include Enabled, got ${personUrl}`);
            assert.strictEqual(person.Enabled, false, `FindAsync person Enabled should be false, got ${person.Enabled}`);
        });

        await runTest('File.Parse maps Url and Filename to the matching fields', async () => {
            const context = new heflo.Context(personRequest(null));
            const file = heflo.File.Parse(context, { Oid: 1, Url: 'https://bucket/ECM/k/report.pdf', Filename: 'report.pdf' });
            assert.strictEqual(file.Url, 'https://bucket/ECM/k/report.pdf', `Url mismatch, got ${file.Url}`);
            assert.strictEqual(file.Filename, 'report.pdf', `Filename mismatch, got ${file.Filename}`);
        });
    } finally {
        axios.post = originalPost;
        axios.get = originalGet;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
