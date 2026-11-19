const http = require('node:http');
const https = require('node:https');
const { performance } = require('node:perf_hooks');

function readOption(name, fallback) {
    const prefix = `--${name}=`;
    const argument = process.argv.find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : fallback;
}

const target = new URL(readOption('url', 'http://127.0.0.1:3000/api/v1'));
const requests = Number(readOption('requests', '20'));

if (!Number.isInteger(requests) || requests < 1) {
    throw new Error('--requests must be a positive integer');
}

function requestOnce() {
    const transport = target.protocol === 'https:' ? https : http;
    const started = performance.now();

    return new Promise((resolve) => {
        const request = transport.get(target, (response) => {
            response.resume();
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode ?? 0,
                    durationMs: performance.now() - started,
                });
            });
        });
        request.on('error', () => {
            resolve({ statusCode: 0, durationMs: performance.now() - started });
        });
    });
}

async function main() {
    const started = performance.now();
    const results = await Promise.all(
        Array.from({ length: requests }, () => requestOnce()),
    );
    const elapsedMs = performance.now() - started;
    const successful = results.filter(
        ({ statusCode }) => statusCode >= 200 && statusCode < 400,
    );
    const durations = results.map(({ durationMs }) => durationMs);
    const averageMs =
        durations.reduce((total, duration) => total + duration, 0) / durations.length;

    console.log(`Performance smoke: ${target.href}`);
    console.log(`Requests: ${requests}  Successful: ${successful.length}`);
    console.log(
        `Latency ms: avg=${averageMs.toFixed(1)} min=${Math.min(...durations).toFixed(1)} max=${Math.max(...durations).toFixed(1)}`,
    );
    console.log(`Throughput: ${(requests / (elapsedMs / 1000)).toFixed(1)} req/s`);

    if (successful.length !== requests) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});