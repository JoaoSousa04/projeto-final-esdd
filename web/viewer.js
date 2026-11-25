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
let scale = 1;

function stop() {
  clearInterval(timer);
  timer = undefined;
}

function eventLabel(event) {
  if (!event) return "Initial state";
  if (event.type === "compare") return `Compare item #${event.leftId} with #${event.rightId}`;
  if (event.type === "move") return `Move item #${event.id} from position ${event.from + 1} to ${event.to + 1}`;
  return `Swap positions ${event.from + 1} and ${event.to + 1}`;
}

function render() {
  const event = replay.highlight;
  const highlighted = new Set();
  if (event?.type === "compare") {
    highlighted.add(event.leftId).add(event.rightId);
  } else if (event?.type === "move") {
    highlighted.add(event.id);
  } else if (event?.type === "swap") {
    highlighted.add(replay.items[event.from].id).add(replay.items[event.to].id);
  }
  const previousBars = new Map(Array.from(bars.children, bar => [Number(bar.dataset.id), bar]));
  const before = new Map(Array.from(previousBars, ([id, bar]) => [id, bar.getBoundingClientRect().left]));
  const fragment = document.createDocumentFragment();
  for (const item of replay.items) {
    const bar = previousBars.get(item.id) ?? document.createElement("li");
    for (const animation of bar.getAnimations()) animation.cancel();
    bar.className = highlighted.has(item.id) ? "bar selected" : "bar";
    bar.dataset.id = item.id;
    bar.dataset.value = item.value;
    bar.title = `Item #${item.id}`;
    bar.style.setProperty("--height", `${Math.abs(item.value) * scale}%`);
    bar.style.setProperty("--bottom", `${50 + Math.min(item.value, 0) * scale}%`);
    if (!bar.firstElementChild) {
      const value = document.createElement("span");
      value.textContent = item.value;
      bar.append(value);
    }
    fragment.append(bar);
  }
  bars.replaceChildren(fragment);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const offsets = Array.from(previousBars, ([id, bar]) => [bar, before.get(id) - bar.getBoundingClientRect().left]);
    for (const [bar, offset] of offsets) {
      if (offset !== 0) {
        bar.animate([{ transform: `translateX(${offset}px)` }, { transform: "none" }],
          { duration: 140, easing: "ease-out" });
      }
    }
  }
  const count = replay.trace.events.length;
  const atEnd = replay.cursor === count;
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
  const largest = trace.initial.reduce((max, item) => Math.max(max, Math.abs(item.value)), 1);
  scale = 36 / largest;
  origin.textContent = `${label} · ${trace.algorithm} sort · ${trace.structure}`;
  bars.replaceChildren();
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
  replay.next();
  if (replay.cursor === replay.trace.events.length) stop();
  render();
}

next.addEventListener("click", () => {
  stop();
  forward();
});
previous.addEventListener("click", () => {
  stop();
  replay.undo();
  render();
});
play.addEventListener("click", () => {
  if (timer === undefined) {
    timer = setInterval(forward, 200);
  } else {
    stop();
  }
  render();
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

form.addEventListener("input", () => {
  comparisonError.hidden = true;
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
    const algorithms = Array.from(form.querySelectorAll('input[name="algorithms"]:checked'),
      checkbox => checkbox.value);
    if (algorithms.length < 2) throw new Error("Choose at least two distinct algorithms.");
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
