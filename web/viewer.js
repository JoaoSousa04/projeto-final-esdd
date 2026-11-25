"use strict";

const fileInput = document.getElementById("trace-file");
const viewer = document.getElementById("viewer");
const bars = document.getElementById("bars");
const error = document.getElementById("error");
const statusLabel = document.getElementById("status");
const origin = document.getElementById("origin");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const play = document.getElementById("play");
let replay;
let timer;
let loadSequence = 0;
const speed = document.getElementById("playback-speed");
const progress = document.getElementById("playback-progress");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const barNodes = new Map();
let highlighted = new Set();

function stepDelay() {
  return 240 / Number(speed.value);
}

function stop() {
  clearTimeout(timer);
  timer = undefined;
}

function eventLabel(event) {
  if (!event) return "Initial state";
  if (event.type === "compare") return `Compare item #${event.leftId} with #${event.rightId}`;
  if (event.type === "move") return `Move item #${event.id} from position ${event.from + 1} to ${event.to + 1}`;
  return `Swap positions ${event.from + 1} and ${event.to + 1}`;
}

function setupBars() {
  barNodes.clear();
  highlighted = new Set();
  const scale = 36 / replay.items.reduce((max, item) => Math.max(max, Math.abs(item.value)), 1);
  const fragment = document.createDocumentFragment();
  for (const item of replay.items) {
    const bar = document.createElement("li");
    bar.className = "bar";
    bar.dataset.id = item.id;
    bar.dataset.value = item.value;
    bar.title = `Item #${item.id}`;
    bar.style.setProperty("--height", `${Math.abs(item.value) * scale}%`);
    bar.style.setProperty("--bottom", `${50 + Math.min(item.value, 0) * scale}%`);
    const label = document.createElement("span");
    label.textContent = item.value;
    bar.append(label);
    barNodes.set(item.id, bar);
    fragment.append(bar);
  }
  bars.replaceChildren(fragment);
}

function reorderBars(event) {
  if (!event || event.type === "compare") return;
  const start = Math.min(event.from, event.to);
  const end = Math.max(event.from, event.to);
  const affected = replay.items.slice(start, end + 1).map(item => barNodes.get(item.id));
  const positions = reducedMotion.matches ? [] : affected.map(bar => bar.getBoundingClientRect().left);
  const fragment = document.createDocumentFragment();
  const anchor = bars.children[end + 1] ?? null;
  for (const bar of affected) {
    for (const animation of bar.getAnimations()) animation.cancel();
    fragment.append(bar);
  }
  bars.insertBefore(fragment, anchor);
  if (positions.length) {
    const offsets = affected.map((bar, index) => positions[index] - bar.getBoundingClientRect().left);
    affected.forEach((bar, index) => {
      if (offsets[index] !== 0) {
        bar.animate([{ transform: `translateX(${offsets[index]}px)` }, { transform: "none" }],
          { duration: Math.min(240, stepDelay() * 0.85), easing: "cubic-bezier(.2,.65,.35,1)" });
      }
    });
  }
}

function render() {
  const event = replay.highlight;
  const selected = new Set();
  if (event?.type === "compare") {
    selected.add(event.leftId).add(event.rightId);
  } else if (event?.type === "move") {
    selected.add(event.id);
  } else if (event?.type === "swap") {
    selected.add(replay.items[event.from].id).add(replay.items[event.to].id);
  }
  for (const id of highlighted) {
    if (!selected.has(id)) barNodes.get(id).classList.remove("selected");
  }
  for (const id of selected) {
    if (!highlighted.has(id)) barNodes.get(id).classList.add("selected");
  }
  highlighted = selected;
  const count = replay.trace.events.length;
  const atEnd = replay.cursor === count;
  progress.max = Math.max(1, count);
  progress.value = count === 0 ? 1 : replay.cursor;
  statusLabel.textContent = `Step ${replay.cursor} of ${count} · ${eventLabel(event)}${atEnd ? " · Finished" : ""}`;
  previous.disabled = replay.cursor === 0;
  next.disabled = atEnd;
  play.disabled = atEnd;
  play.textContent = timer === undefined ? "Play" : "Pause";
}

function showTrace(trace, label) {
  const loaded = new TraceReplay(trace);
  ++loadSequence;
  stop();
  replay = loaded;
  origin.textContent = `${label} · ${trace.algorithm} sort · ${trace.structure}`;
  setupBars();
  viewer.hidden = false;
  error.hidden = true;
  render();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  const sequence = ++loadSequence;
  stop();
  viewer.hidden = true;
  error.hidden = true;
  if (!file) return;
  try {
    const trace = JSON.parse(await file.text());
    if (sequence !== loadSequence) return;
    showTrace(trace, file.name);
    viewer.scrollIntoView({ block: "nearest" });
  } catch (problem) {
    if (sequence !== loadSequence) return;
    error.textContent = `Could not load ${file.name}. ${problem.message}`;
    error.hidden = false;
  }
});

function forward() {
  if (replay.next()) reorderBars(replay.highlight);
  if (replay.cursor === replay.trace.events.length) {
    stop();
  } else if (timer !== undefined) {
    timer = setTimeout(forward, stepDelay());
  }
  render();
}

next.addEventListener("click", () => {
  stop();
  forward();
});
previous.addEventListener("click", () => {
  stop();
  const event = replay.highlight;
  if (replay.undo()) reorderBars(event);
  render();
});
play.addEventListener("click", () => {
  if (timer === undefined) {
    timer = setTimeout(forward, stepDelay());
  } else {
    stop();
  }
  render();
});

speed.addEventListener("change", () => {
  if (timer === undefined) return;
  stop();
  timer = setTimeout(forward, stepDelay());
});

const form = document.getElementById("comparison-form");
const inputSize = document.getElementById("vector-size");
const valuesField = document.getElementById("values");
const preview = document.getElementById("preview");
const compare = document.getElementById("compare");
const comparisonStatus = document.getElementById("comparison-status");
const comparisonError = document.getElementById("comparison-error");
const resultPanel = document.getElementById("comparison-results");
const resultInput = document.getElementById("result-input");
const resultRows = document.getElementById("result-rows");
const chartMetric = document.getElementById("chart-metric");
const chartBars = document.getElementById("chart-bars");
let currentResults = [];
const algorithmLabels = { insertion: "Insertion Sort", merge: "Merge Sort" };

function readValues() {
  const size = inputSize.valueAsNumber;
  if (!Number.isInteger(size) || size < 0 || size > 256) {
    throw new Error("Input size must be an integer from 0 to 256.");
  }
  const text = valuesField.value.trim();
  const parts = text === "" ? [] : text.split(/\s*,\s*|\s+/);
  const values = parts.map(Number);
  if (parts.some((part, index) => !/^[+-]?\d+$/.test(part) ||
      values[index] < -2147483648 || values[index] > 2147483647)) {
    throw new Error("Enter only 32-bit integers separated by commas or spaces.");
  }
  if (values.length !== size) {
    throw new Error(`Input size is ${size}, but ${values.length} values were entered.`);
  }
  return values;
}

function updatePreview() {
  try {
    const values = readValues();
    preview.textContent = `[${values.join(", ")}]`;
  } catch (problem) {
    preview.textContent = problem.message;
  }
}

function showComparisonError(message) {
  comparisonError.textContent = message;
  comparisonError.hidden = false;
}

function selectedAlgorithms() {
  return Array.from(form.querySelectorAll('input[name="algorithms"]:checked'),
    checkbox => checkbox.value);
}

form.addEventListener("input", () => {
  comparisonError.hidden = true;
  compare.textContent = selectedAlgorithms().length === 1 ? "Run algorithm" : "Compare";
  updatePreview();
});

document.getElementById("generate").addEventListener("click", () => {
  if (!inputSize.reportValidity()) return;
  const randomValues = Array.from({ length: inputSize.valueAsNumber },
    () => Math.floor(Math.random() * 201) - 100);
  valuesField.value = randomValues.join(", ");
  comparisonError.hidden = true;
  updatePreview();
});

function renderChart() {
  const metric = chartMetric.value;
  const maximum = Math.max(0, ...currentResults.map(row => row.metrics[metric]));
  const fragment = document.createDocumentFragment();
  for (const { trace, metrics } of currentResults) {
    const value = metrics[metric];
    const row = document.createElement("li");
    row.className = "metric-row";
    const name = document.createElement("span");
    name.textContent = algorithmLabels[trace.algorithm];
    const track = document.createElement("span");
    track.className = "metric-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "metric-fill";
    fill.style.width = maximum === 0 ? "0%" : `${value / maximum * 100}%`;
    track.append(fill);
    const label = document.createElement("strong");
    label.textContent = metric === "medianMs" ? `${value.toFixed(6)} ms`
      : metric.endsWith("Bytes") ? `${value} B` : String(value);
    row.append(name, track, label);
    fragment.append(row);
  }
  chartBars.replaceChildren(fragment);
}

chartMetric.addEventListener("change", renderChart);

function showResults(result) {
  const rows = document.createDocumentFragment();
  for (const { metrics, trace } of result.results) {
    const label = algorithmLabels[trace.algorithm];
    const row = document.createElement("tr");
    row.dataset.algorithm = trace.algorithm;
    const header = document.createElement("th");
    header.scope = "row";
    header.textContent = label;
    row.append(header);
    for (const value of [metrics.medianMs.toFixed(6), metrics.comparisons,
      metrics.structureBytes, metrics.auxiliaryBytes, metrics.peakBytes]) {
      row.insertCell().textContent = value;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Replay";
    button.setAttribute("aria-label", `Replay ${label}`);
    button.addEventListener("click", () => {
      showTrace(trace, "Native C comparison");
      viewer.scrollIntoView({ block: "nearest" });
    });
    row.insertCell().append(button);
    rows.append(row);
  }
  showTrace(result.results[0].trace, "Native C comparison");
  currentResults = result.results;
  document.getElementById("results-heading").textContent = currentResults.length === 1 ? "Run result" : "Comparison results";
  renderChart();
  resultRows.replaceChildren(rows);
  resultInput.textContent = `${result.structure} · ${result.repetitions} repetitions · [${result.input.join(", ")}]`;
  resultPanel.hidden = false;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  comparisonError.hidden = true;
  comparisonStatus.textContent = "";
  try {
    const values = readValues();
    const algorithms = selectedAlgorithms();
    if (algorithms.length === 0) throw new Error("Choose at least one algorithm.");
    if (location.protocol === "file:") {
      throw new Error("Start the local service with node web/serve.mjs and open the address it prints.");
    }
    const structure = document.getElementById("structure").value;
    const repetitions = document.getElementById("repetitions").valueAsNumber;
    compare.disabled = true;
    resultPanel.hidden = true;
    comparisonStatus.textContent = "Running the C comparison…";
    let response;
    try {
      response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure, algorithms, repetitions, values }),
      });
    } catch {
      throw new Error("Could not reach the local comparison service.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showResults(result);
    comparisonStatus.textContent = "Comparison complete.";
  } catch (problem) {
    showComparisonError(problem.message);
    comparisonStatus.textContent = "";
  } finally {
    compare.disabled = false;
  }
});

updatePreview();
