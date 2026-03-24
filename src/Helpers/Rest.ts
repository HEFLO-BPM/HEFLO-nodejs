import axios, { AxiosRequestConfig } from 'axios';
import { Context } from '../Context';
import { Sleep } from './Timer';

export async function PostAsync(context: Context,endpoint: string, payload: any, config: AxiosRequestConfig) {
    return postAsync(context, endpoint, payload, config, 1);
}

export async function GetAsync(context: Context,endpoint: string, config: AxiosRequestConfig) {
    return getAsync(context, endpoint, config, 1, null, false);
}

const maxRetry = 50;
const defaultIncrementDelay = 2000;

async function postAsync(context: Context, endpoint: string, payload: any, config: AxiosRequestConfig, counter: number, waitTime?: number, refreshToken: boolean = false) {

    if (counter !== 1) {
        if (refreshToken) {
            await context.Refresh();
            config.headers["Authorization"] = `Bearer ${context.AuthorizationHeader}`;
        } else {
            const currentWaitTime = waitTime ?? counter * defaultIncrementDelay;
            if (process.env.DEBUG === "true") console.log(`Too many calls for the endpoint ${endpoint}. Waiting ${currentWaitTime}ms for the next call.`);
            await Sleep(currentWaitTime);
        }
    }

    return axios.post(endpoint, payload, config).catch((err) => {
        if (process.env.DEBUG === "true") console.log(err);
        if (err.response.status == 429 && counter < maxRetry) {
            counter++;
            let waitTime = undefined;
            if (err.response.headers["x-rate-limit-remaining"])
                waitTime = +err.response.headers["x-rate-limit-remaining"] + 100;            
            return postAsync(context, endpoint, payload, config, counter, waitTime);
        } if (err.response.status == 401 && counter < maxRetry) {
            counter++;
            return postAsync(context, endpoint, payload, config, counter, null, true);
        } else
            return Promise.reject(err);
    })
}

async function getAsync(context: Context, endpoint: string, config: AxiosRequestConfig, counter: number, waitTime?: number, refreshToken: boolean = false) {

    if (counter !== 1) {
        if (refreshToken) {
            await context.Refresh();
            config.headers["Authorization"] = `Bearer ${context.AuthorizationHeader}`;
        } else {
            const currentWaitTime = waitTime ?? counter * defaultIncrementDelay;
            if (process.env.DEBUG === "true") console.log(`Too many calls for the endpoint ${endpoint}. Waiting ${currentWaitTime}ms for the next call.`);
            await Sleep(currentWaitTime);
        }
    }

    return axios.get(endpoint, config).catch((err) => {
        if (process.env.DEBUG === "true") console.log(err);
        if (err.response.status == 429 && counter < maxRetry) {
            counter++;
            let waitTime = undefined;
            if (err.response.headers["x-rate-limit-remaining"])
                waitTime = +err.response.headers["x-rate-limit-remaining"] + 100;            
            return getAsync(context, endpoint, config, counter, waitTime);
        } if (err.response.status == 401 && counter < maxRetry) {
            counter++;
            return getAsync(context, endpoint, config, counter, null, true);
        } else
            return Promise.reject(err);
    })
}