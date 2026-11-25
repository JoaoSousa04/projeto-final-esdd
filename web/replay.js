"use strict";

const algorithmLabels = Object.freeze({
  bubble: "Bubble Sort",
  heap: "Heap Sort",
  insertion: "Insertion Sort",
  merge: "Merge Sort",
  quick: "Quick Sort",
  selection: "Selection Sort",
});

class TraceReplay {
  constructor(trace) {
    if (!trace || trace.schemaVersion !== 1) {
      throw new Error("Unsupported trace version.");
    }
    if (!Object.hasOwn(algorithmLabels, trace.algorithm) ||
        !["vector", "singly", "doubly", "circular"].includes(trace.structure) ||
        !Array.isArray(trace.initial) || !Array.isArray(trace.events) || !Array.isArray(trace.final)) {
      throw new Error("Invalid trace metadata.");
    }
    this.trace = trace;
    this.reset();
    this.ids = new Set();
    for (const item of this.items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id < 0 ||
          !Number.isSafeInteger(item.value) || this.ids.has(item.id)) {
        throw new Error("Invalid or duplicate initial item.");
      }
      this.ids.add(item.id);
    }
    while (this.next()) {
      // Validate every event before enabling playback.
    }
    if (trace.final.length !== this.items.length ||
        !this.items.every((item, index) => {
          const expected = trace.final[index];
          return expected && item.id === expected.id && item.value === expected.value &&
            (index === 0 || this.items[index - 1].value <= item.value);
        })) {
      throw new Error("Replay does not match the final sorting result.");
    }
    this.reset();
  }

  reset() {
    this.items = this.trace.initial.slice();
    this.cursor = 0;
  }

  get highlight() {
    return this.trace.events[this.cursor - 1];
  }

  validate(event) {
    if (!event || event.step !== this.cursor + 1) {
      throw new Error("Invalid event sequence.");
    }
    if (event.type === "compare") {
      if (!this.ids.has(event.leftId) || !this.ids.has(event.rightId) || event.leftId === event.rightId) {
        throw new Error("Invalid comparison IDs.");
      }
      return;
    }
    const validIndex = index => Number.isInteger(index) && index >= 0 && index < this.items.length;
    if (!["swap", "move"].includes(event.type) || !validIndex(event.from) ||
        !validIndex(event.to) || event.from === event.to ||
        (event.type === "move" && this.items[event.from].id !== event.id)) {
      throw new Error("Invalid movement event.");
    }
  }

  apply(event, inverse) {
    if (event.type === "swap") {
      [this.items[event.from], this.items[event.to]] = [this.items[event.to], this.items[event.from]];
    } else if (event.type === "move") {
      const from = inverse ? event.to : event.from;
      const to = inverse ? event.from : event.to;
      const [item] = this.items.splice(from, 1);
      this.items.splice(to, 0, item);
    }
  }

  next() {
    if (this.cursor === this.trace.events.length) return false;
    const event = this.trace.events[this.cursor];
    this.validate(event);
    this.apply(event, false);
    this.cursor++;
    return true;
  }

  undo() {
    if (this.cursor === 0) return false;
    this.cursor--;
    this.apply(this.trace.events[this.cursor], true);
    return true;
  }
}

if (typeof module !== "undefined") {
  module.exports = TraceReplay;
  module.exports.algorithmLabels = algorithmLabels;
}
