import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { createComparisonServer } from "../web/serve.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLATFORM_PLAYWRIGHT || "playwright");
const executable = resolve(process.argv[2]);
const browser = await chromium.launch({ executablePath: process.argv[3] });
const directory = mkdtempSync(join(tmpdir(), "sorting-browser-"));
let server;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve("web/index.html")).href);
  await page.getByRole("heading", { name: "Sorting Trace Viewer" }).waitFor();
  const file = page.locator("#trace-file");
  const next = page.getByRole("button", { name: "Next" });
  const undo = page.getByRole("button", { name: "Undo" });
  const status = page.locator("#status");
  const bars = page.locator(".bar");
  const items = () => bars.evaluateAll(nodes => nodes.map(node => ({
    id: Number(node.dataset.id),
    value: Number(node.dataset.value),
  })));

  async function load(algorithm, structure, values) {
    const path = join(directory, `${algorithm}-${structure}.json`);
    const result = spawnSync(executable, ["trace", algorithm, structure, path, ...values], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const trace = JSON.parse(readFileSync(path, "utf8"));
    await file.setInputFiles(path);
    await page.locator("#viewer").waitFor({ state: "visible" });
    assert.match(await page.locator("#origin").innerText(), new RegExp(`${algorithm}.*${structure}`));
    assert.deepEqual(await items(), trace.initial);
    return trace;
  }

  for (const algorithm of ["insertion", "merge"]) {
    for (const structure of ["vector", "singly", "doubly", "circular"]) {
      const trace = await load(algorithm, structure, ["3", "-1", "3", "0"]);
      assert.equal(await undo.isDisabled(), true);
      assert.equal(await next.isEnabled(), true);
      await next.click();
      assert.equal(await page.locator(".selected").count(), 2);
      const firstStep = await status.innerText();
      await undo.click();
      assert.deepEqual(await items(), trace.initial);
      await next.click();
      assert.equal(await status.innerText(), firstStep);
      await next.click();
      const moved = await items();
      assert.equal(await page.locator(".selected").count(), 1);
      await undo.click();
      assert.deepEqual(await items(), trace.initial);
      await next.click();
      assert.deepEqual(await items(), moved);
      for (let step = 2; step < trace.events.length; step++) await next.click();
      assert.deepEqual(await items(), trace.final);
      assert.equal(await next.isDisabled(), true);
      assert.match(await status.innerText(), /Finished/);
    }
  }

  const animated = await load("insertion", "vector", ["2", "1"]);
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForFunction(() => document.querySelector("#next").disabled);
  assert.deepEqual(await items(), animated.final);
  await load("merge", "vector", []);
  assert.equal(await next.isDisabled(), true);
  assert.match(await status.innerText(), /Finished/);

  const alert = page.getByRole("alert");
  for (const [buffer, message] of [["{", /Could not load/], ['{"schemaVersion":2}', /Unsupported trace version/]]) {
    await file.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(buffer) });
    await alert.waitFor();
    assert.match(await alert.innerText(), message);
    assert.equal(await page.locator("#viewer").isHidden(), true);
  }
  server = createComparisonServer({ executable });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const size = page.getByLabel("Input size");
  const values = page.getByLabel(/Input values/);
  const compare = page.getByRole("button", { name: "Compare", exact: true });
  await size.fill("3");
  await compare.click();
  assert.match(await page.locator("#comparison-error").innerText(), /3.*7/);
  await values.fill("1, nope, -4");
  await compare.click();
  assert.match(await page.locator("#comparison-error").innerText(), /32-bit integers/);
  await values.fill("3 1 -4");
  await page.getByRole("checkbox", { name: "Merge Sort" }).uncheck();
  await compare.click();
  assert.match(await page.locator("#comparison-error").innerText(), /at least two/);
  await page.getByRole("checkbox", { name: "Merge Sort" }).check();

  async function compareFromPage(expectedInput, expectedStructure) {
    const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/compare"));
    await compare.click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, await response.text());
    const responseData = await response.json();
    assert.deepEqual(response.request().postDataJSON().values, expectedInput);
    assert.deepEqual(responseData.input, expectedInput);
    assert.equal(responseData.structure, expectedStructure);
    await page.getByRole("table", { name: "Native C results" }).waitFor();
    for (const { trace, metrics } of responseData.results) {
      assert.equal(trace.structure, expectedStructure);
      assert.deepEqual(trace.initial, expectedInput.map((value, id) => ({ value, id })));
      const metricCells = await page.locator(`tr[data-algorithm="${trace.algorithm}"] td`).allTextContents();
      assert.deepEqual(metricCells.slice(0, 5), [
        metrics.medianMs.toFixed(6), String(metrics.comparisons), String(metrics.structureBytes),
        String(metrics.auxiliaryBytes), String(metrics.peakBytes),
      ]);
      const name = trace.algorithm === "insertion" ? "Insertion Sort" : "Merge Sort";
      await page.getByRole("button", { name: `Replay ${name}` }).click();
      assert.deepEqual(await items(), trace.initial);
      for (const event of trace.events) await next.click();
      assert.deepEqual(await items(), trace.final);
      assert.deepEqual(trace.final.map(item => item.value), [...expectedInput].sort((a, b) => a - b));
      if (trace.events.length > 0) {
        await undo.click();
        assert.equal(await next.isEnabled(), true);
      }
    }
    return responseData;
  }

  await size.fill("7");
  await values.fill("4, -2, 4, 0, -3, 1, 0");
  assert.equal(await page.locator("#preview").textContent(), "[4, -2, 4, 0, -3, 1, 0]");
  const manual = await compareFromPage([4, -2, 4, 0, -3, 1, 0], "vector");
  assert.deepEqual(manual.results.map(row => row.metrics.comparisons), [16, 12]);

  await size.fill("4");
  await page.getByRole("combobox", { name: "Structure", exact: true }).selectOption("circular");
  await page.getByRole("button", { name: "Generate random values" }).click();
  const generated = JSON.parse(await page.locator("#preview").textContent());
  assert.equal(generated.length, 4);
  assert.ok(generated.every(value => Number.isInteger(value) && value >= -100 && value <= 100));
  await compareFromPage(generated, "circular");

  assert.deepEqual(errors, []);
  console.log("Browser comparison passed: manual and random input, matching native metrics and traces.");
  console.log("Browser passed: eight C traces, comparison highlights, move undo, autoplay, and file validation.");
} finally {
  await browser.close();
  if (server) {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
  rmSync(directory, { recursive: true, force: true });
}
