import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve("web/index.html")).href);
  await page.getByRole("heading", { name: "Sorting Trace Viewer" }).waitFor();
  const file = page.locator("#trace-file");
  const next = page.getByRole("button", { name: "Next" });
  const undo = page.getByRole("button", { name: "Undo" });
  const status = page.getByRole("status");
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
  assert.deepEqual(errors, []);
  console.log("Browser passed: eight C traces, comparison highlights, move undo, autoplay, and file validation.");
} finally {
  await browser.close();
  rmSync(directory, { recursive: true, force: true });
}
