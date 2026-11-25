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
    replay = new TraceReplay(trace);
    const largest = trace.initial.reduce((max, item) => Math.max(max, Math.abs(item.value)), 1);
    scale = 36 / largest;
    origin.textContent = `${file.name} · ${trace.algorithm} sort · ${trace.structure}`;
    bars.replaceChildren();
    viewer.hidden = false;
    render();
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
