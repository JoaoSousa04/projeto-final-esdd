import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import TraceReplay from "../web/replay.js";

const executable = resolve(process.argv[2]);
const directory = mkdtempSync(join(tmpdir(), "sorting-platform-"));
const input = ["4", "-2", "4", "0", "-3", "1", "0"];

function run(args, options = {}) {
  const result = spawnSync(executable, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

try {
  for (const algorithm of ["insertion", "merge"]) {
    for (const structure of ["vector", "singly", "doubly", "circular"]) {
      for (const values of [[], ["-3"], input]) {
        const file = join(directory, "trace.json");
        const result = run(["trace", algorithm, structure, file, ...values]);
        assert.equal(result.status, 0, result.stderr);
        const trace = JSON.parse(readFileSync(file, "utf8"));
        const replay = new TraceReplay(trace);
        assert.equal(replay.undo(), false);
        while (replay.next()) {
          const advanced = replay.items.slice();
          const event = replay.highlight;
          assert.equal(replay.undo(), true);
          assert.equal(replay.next(), true);
          assert.deepEqual(replay.items, advanced);
          assert.equal(replay.highlight, event);
        }
        const reference = values.map((value, id) => ({ value: Number(value), id }))
          .sort((first, second) => first.value - second.value || first.id - second.id);
        assert.deepEqual(replay.items, reference);
        assert.deepEqual(replay.items, trace.final);
        while (replay.undo()) {}
        assert.deepEqual(replay.items, trace.initial);
        assert.throws(() => new TraceReplay({ ...trace, schemaVersion: 2 }), /version/);
        assert.throws(() => new TraceReplay({ ...trace, events: [{ step: 2 }] }), /sequence/);
      }
    }
  }

  for (const structure of ["vector", "singly", "doubly", "circular"]) {
    const compared = run(["compare", structure, "3", "merge,insertion", ...input]);
    assert.equal(compared.status, 0, compared.stderr);
    const result = JSON.parse(compared.stdout);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.structure, structure);
    assert.equal(result.repetitions, 3);
    assert.deepEqual(result.input, input.map(Number));
    assert.deepEqual(result.results.map(row => row.trace.algorithm), ["merge", "insertion"]);
    for (const { metrics, trace } of result.results) {
      const replay = new TraceReplay(trace);
      assert.deepEqual(trace.initial, input.map((value, id) => ({ id, value: Number(value) })));
      while (replay.next()) {}
      assert.deepEqual(replay.items.map(item => item.value), [-3, -2, 0, 0, 1, 4, 4]);
      assert.equal(metrics.comparisons, trace.events.filter(event => event.type === "compare").length);
      assert.equal(metrics.peakBytes, metrics.structureBytes + metrics.auxiliaryBytes);
      assert.ok(metrics.medianMs >= 0);
    }
  }
  const single = run(["compare", "vector", "2", "merge", ...input]);
  assert.equal(single.status, 0, single.stderr);
  const [singleRow, ...otherRows] = JSON.parse(single.stdout).results;
  assert.deepEqual(otherRows, []);
  assert.equal(singleRow.trace.algorithm, "merge");
  assert.equal(singleRow.metrics.comparisons, 12);
  const empty = run(["compare", "vector", "1", "insertion,merge"]);
  assert.equal(empty.status, 0, empty.stderr);
  assert.deepEqual(JSON.parse(empty.stdout).input, []);
  for (const options of [
    ["vector", "1", ""], ["vector", "1", "merge,merge"],
    ["vector", "0", "merge,insertion"], ["vector", "101", "merge,insertion"],
    ["vector", "1", "merge,insertion", "2147483648"], ["other", "1", "merge,insertion"],
    ["vector", "1", "merge,insertion,"],
  ]) {
    const invalid = run(["compare", ...options]);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
  }

  const steps = run(["step", "insertion", "vector", "2", "1"], {
    input: ["u", "n", "n", "u", "n", "n", "q", ""].join("\n"),
  });
  assert.equal(steps.status, 0, steps.stderr);
  assert.match(steps.stdout, /Already at the initial state/);
  assert.match(steps.stdout, /End of trace/);
  const snapshots = steps.stdout.split(/\r?\n/).filter(line => line.startsWith("Step"));
  assert.equal(snapshots[2], snapshots[4]);
  assert.equal(snapshots[3], snapshots[5]);

  const valid = run(["batch", "examples/batch.txt"]);
  assert.equal(valid.status, 0, valid.stderr);
  const rows = valid.stdout.split(/\r?\n/);
  assert.equal(rows.filter(row => row.startsWith("task,")).length, 8);
  assert.equal(rows.filter(row => /^\d+,\d+,ok,/.test(row)).length, 40);
  assert.equal(rows.filter(row => /^median,\d+,5,/.test(row)).length, 8);
  for (const row of rows.filter(row => /^\d+,\d+,ok,/.test(row))) {
    const [, , , ms, before, auxiliary, peak, comparisons] = row.split(",");
    assert.ok(Number(ms) >= 0 && Number(comparisons) > 0);
    assert.equal(Number(before) + Number(auxiliary), Number(peak));
  }

  const invalidBatch = join(directory, "invalid.txt");
  writeFileSync(invalidBatch, "merge vector 10 sorted 1 1\ninvalid\nmerge circular 10 reverse 2 1\n");
  const invalid = run(["batch", invalidBatch]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /task,1,merge,vector[\s\S]*task,2,invalid[\s\S]*task,3,merge,circular/);
  assert.equal(run(["trace", "merge", "vector", join(directory, "invalid.json"), "abc"]).status, 1);
  console.log("Integration passed: 24 C exports, JS replay and undo, CLI steps, and FIFO reports.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
