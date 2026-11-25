import assert from "node:assert/strict";
import { once } from "node:events";
import { resolve } from "node:path";
import { createComparisonServer } from "../web/serve.mjs";

async function withServer(executable, test) {
  const server = createComparisonServer({ executable });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await test(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
}

const values = [4, -2, 4, 0, -3, 1, 0];
const input = { structure: "vector", algorithms: ["insertion", "merge"], repetitions: 3, values };
const post = (url, body, headers = {}) => fetch(url + "/api/compare", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

await withServer(resolve(process.argv[2]), async url => {
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<script defer src="viewer.js">/);
  assert.equal((await fetch(url + "/serve.mjs")).status, 404);

  const comparison = await post(url, input);
  assert.equal(comparison.status, 200, await comparison.clone().text());
  const result = await comparison.json();
  assert.deepEqual(result.input, values);
  assert.deepEqual(result.results.map(row => row.metrics.comparisons), [16, 12]);
  for (const { trace, metrics } of result.results) {
    assert.deepEqual(trace.initial.map(item => item.value), values);
    assert.deepEqual(trace.final.map(item => item.value), [-3, -2, 0, 0, 1, 4, 4]);
    assert.equal(metrics.comparisons, trace.events.filter(event => event.type === "compare").length);
  }

  const single = await post(url, { ...input, algorithms: ["merge"] });
  assert.equal(single.status, 200);
  const singleRows = (await single.json()).results;
  assert.equal(singleRows.length, 1);
  assert.equal(singleRows[0].trace.algorithm, "merge");
  assert.equal(singleRows[0].metrics.comparisons, 12);

  for (const invalid of [
    "{", { ...input, algorithms: [] }, { ...input, values: [1.5] }, { ...input, values: [2147483648] },
    { ...input, algorithms: ["merge", "merge"] }, { ...input, structure: "other" },
    { ...input, repetitions: 101 }, { ...input, values: Array(257).fill(0) },
    " ".repeat(8200),
  ]) {
    assert.equal((await post(url, invalid)).status, 400);
  }
  assert.equal((await post(url, input, { Origin: "http://localhost:9000" })).status, 403);
  assert.equal((await post(url, input, { "Content-Type": "text/plain" })).status, 415);
});

await withServer(resolve("missing-platform-for-test.exe"), async url => {
  const response = await post(url, input);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Build the C executable/);
});
console.log("Local API passed: native results, input rejection, origin and missing executable.");
