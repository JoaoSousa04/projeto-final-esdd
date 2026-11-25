"use strict";

const fileInput = document.getElementById("trace-file");
const viewer = document.getElementById("viewer");
const bars = document.getElementById("bars");
const plots = document.getElementById("comparison-plots");
const error = document.getElementById("error");
const statusLabel = document.getElementById("status");
const origin = document.getElementById("origin");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const play = document.getElementById("play");
const restart = document.getElementById("restart");
const speed = document.getElementById("playback-speed");
const progress = document.getElementById("playback-progress");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let players = [];
let step = 0;
let total = 0;
let timer;
let loadSequence = 0;

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

class TracePlot {
  constructor(trace, list, status = null) {
    this.replay = new TraceReplay(trace);
    this.list = list;
    this.status = status;
    this.nodes = new Map();
    this.setupBars();
  }

  setupBars() {
    this.nodes.clear();
    this.renderedCursor = -1;
    this.highlighted = new Set();
    const { items } = this.replay;
    const scale = 36 / items.reduce((max, item) => Math.max(max, Math.abs(item.value)), 1);
    this.list.classList.toggle("dense-bars", items.length > 15);
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const bar = document.createElement("li");
      bar.className = "bar";
      bar.dataset.id = item.id;
      bar.dataset.value = item.value;
      bar.title = `${item.value} · Item #${item.id}`;
      bar.setAttribute("aria-label", bar.title);
      bar.style.setProperty("--height", `${Math.abs(item.value) * scale}%`);
      bar.style.setProperty("--bottom", `${50 + Math.min(item.value, 0) * scale}%`);
      const label = document.createElement("span");
      label.textContent = item.value;
      bar.append(label);
      this.nodes.set(item.id, bar);
      fragment.append(bar);
    }
    this.list.replaceChildren(fragment);
  }

  prepareReorder(event) {
    if (!event || event.type === "compare") return null;
    const start = Math.min(event.from, event.to);
    const end = Math.max(event.from, event.to);
    const { items } = this.replay;
    const affected = (event.type === "swap" ? [items[start], items[end]] : items.slice(start, end + 1))
      .map(item => this.nodes.get(item.id));
    const positions = reducedMotion.matches ? [] : affected.map(bar => bar.getBoundingClientRect().left);
    const anchor = this.list.children[end + 1] ?? null;
    return () => {
      for (const bar of affected) {
        for (const animation of bar.getAnimations()) animation.cancel();
      }
      if (event.type === "swap") {
        this.list.insertBefore(affected[1], anchor);
        this.list.insertBefore(affected[0], this.list.children[start]);
      } else {
        const fragment = document.createDocumentFragment();
        fragment.append(...affected);
        this.list.insertBefore(fragment, anchor);
      }
      if (!positions.length) return null;
      return () => {
        const offsets = affected.map((bar, index) => positions[index] - bar.getBoundingClientRect().left);
        return () => affected.forEach((bar, index) => {
          if (offsets[index] !== 0) {
            bar.animate([{ transform: `translateX(${offsets[index]}px)` }, { transform: "none" }],
              { duration: Math.min(240, stepDelay() * 0.85), easing: "cubic-bezier(.2,.65,.35,1)" });
          }
        });
      };
    };
  }

  render() {
    const { highlight: event, items, cursor, trace } = this.replay;
    if (cursor === this.renderedCursor) return;
    this.renderedCursor = cursor;
    const selected = new Set();
    if (event?.type === "compare") {
      selected.add(event.leftId).add(event.rightId);
    } else if (event?.type === "move") {
      selected.add(event.id);
    } else if (event?.type === "swap") {
      selected.add(items[event.from].id).add(items[event.to].id);
    }
    for (const id of this.highlighted) {
      if (!selected.has(id)) this.nodes.get(id).classList.remove("selected");
    }
    for (const id of selected) {
      if (!this.highlighted.has(id)) this.nodes.get(id).classList.add("selected");
    }
    this.highlighted = selected;
    if (this.status) {
      const finished = cursor === trace.events.length;
      this.status.textContent = `${cursor} / ${trace.events.length}${finished ? " · Finished" : ""}`;
      this.status.title = eventLabel(event);
      this.status.classList.toggle("finished", finished);
    }
  }
}

function renderControls() {
  for (const player of players) player.render();
  const atEnd = step === total;
  const detail = players.length === 1 ? ` · ${eventLabel(players[0].replay.highlight)}` : "";
  progress.max = Math.max(1, total);
  progress.value = total === 0 ? 1 : step;
  statusLabel.textContent = `Step ${step} of ${total}${detail}${atEnd ? " · Finished" : ""}`;
  previous.disabled = step === 0;
  next.disabled = atEnd;
  restart.disabled = step === 0 && timer === undefined;
  play.disabled = atEnd;
  play.textContent = timer === undefined ? "Play" : "Pause";
}

function startSession(newPlayers, label, autoplay) {
  ++loadSequence;
  stop();
  players = newPlayers;
  step = 0;
  total = Math.max(...players.map(player => player.replay.trace.events.length));
  origin.textContent = label;
  viewer.hidden = false;
  error.hidden = true;
  if (autoplay && total > 0) timer = setTimeout(forward, stepDelay());
  renderControls();
}

function showTrace(trace, label) {
  const player = new TracePlot(trace, bars);
  plots.replaceChildren();
  plots.hidden = true;
  bars.parentElement.hidden = false;
  startSession([player], `${label} · ${trace.algorithm} sort · ${trace.structure}`, false);
}

function showComparisonPlots(results) {
  const fragment = document.createDocumentFragment();
  const newPlayers = results.map(({ trace }) => {
    const panel = document.createElement("section");
    panel.className = "comparison-plot";
    panel.dataset.algorithm = trace.algorithm;
    const label = algorithmLabels[trace.algorithm];
    const title = document.createElement("h3");
    title.textContent = label;
    const plot = document.createElement("div");
    plot.className = "plot";
    const list = document.createElement("ol");
    list.className = "bars";
    list.setAttribute("aria-label", `${label} value sequence`);
    plot.append(list);
    const status = document.createElement("p");
    status.className = "plot-status";
    panel.append(title, plot, status);
    fragment.append(panel);
    return new TracePlot(trace, list, status);
  });

  bars.replaceChildren();
  bars.parentElement.hidden = true;
  plots.replaceChildren(fragment);
  plots.style.setProperty("--plot-count", String(newPlayers.length));
  plots.style.setProperty("--plot-count-medium", String(Math.min(3, newPlayers.length)));
  plots.style.setProperty("--plot-count-small", String(Math.min(2, newPlayers.length)));
  plots.hidden = false;
  startSession(newPlayers, newPlayers.length === 1 ? "Algorithm playback" : "Synchronized playback", true);
  viewer.scrollIntoView({ block: "nearest" });
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

function advancePlots(backward) {
  const changes = [];
  for (const player of players) {
    const { replay } = player;
    let event;
    if (backward) {
      if (replay.cursor !== step) continue;
      event = replay.highlight;
      replay.undo();
    } else if (replay.next()) {
      event = replay.highlight;
    }
    const change = player.prepareReorder(event);
    if (change) changes.push(change);
  }
  // Batch geometry reads and DOM updates across plots.
  const readOffsets = changes.map(change => change()).filter(Boolean);
  const animate = readOffsets.map(read => read());
  for (const start of animate) start();
  step += backward ? -1 : 1;
}

function forward() {
  if (step < total) advancePlots(false);
  if (step === total) {
    stop();
  } else if (timer !== undefined) {
    timer = setTimeout(forward, stepDelay());
  }
  renderControls();
}

next.addEventListener("click", () => {
  stop();
  forward();
});
previous.addEventListener("click", () => {
  stop();
  if (step > 0) advancePlots(true);
  renderControls();
});
restart.addEventListener("click", () => {
  stop();
  step = 0;
  for (const player of players) {
    player.replay.reset();
    player.setupBars();
  }
  renderControls();
});
play.addEventListener("click", () => {
  if (timer === undefined) {
    timer = setTimeout(forward, stepDelay());
  } else {
    stop();
  }
  renderControls();
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
    rows.append(row);
  }

  currentResults = result.results;
  document.getElementById("results-heading").textContent = currentResults.length === 1 ? "Run result" : "Comparison results";
  renderChart();
  resultRows.replaceChildren(rows);
  resultInput.textContent = `${result.structure} · ${result.repetitions} repetitions · [${result.input.join(", ")}]`;
  resultPanel.hidden = false;
  showComparisonPlots(result.results);
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
    stop();
    viewer.hidden = true;
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
