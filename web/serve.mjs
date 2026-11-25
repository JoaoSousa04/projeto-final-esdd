import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const host = "127.0.0.1";
const algorithms = new Set(["insertion", "merge"]);
const structures = new Set(["vector", "singly", "doubly", "circular"]);
const defaultExecutable = fileURLToPath(new URL(
  process.platform === "win32" ? "../build/platform.exe" : "../build/platform", import.meta.url,
));
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/replay.js", ["replay.js", "text/javascript; charset=utf-8"]],
  ["/viewer.js", ["viewer.js", "text/javascript; charset=utf-8"]],
]);

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readInput(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes <= 8192) chunks.push(chunk);
  }
  if (bytes > 8192) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validInput(input) {
  return input && structures.has(input.structure) &&
    Array.isArray(input.algorithms) && input.algorithms.length >= 1 &&
    input.algorithms.every(name => algorithms.has(name)) &&
    new Set(input.algorithms).size === input.algorithms.length &&
    Number.isInteger(input.repetitions) && input.repetitions >= 1 && input.repetitions <= 100 &&
    Array.isArray(input.values) && input.values.length <= 256 &&
    input.values.every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);
}

export function createComparisonServer({ executable = defaultExecutable } = {}) {
  let busy = false;
  const server = createServer(async (request, response) => {
    const authority = `${host}:${server.address().port}`;
    if (request.headers.host !== authority) {
      return json(response, 400, { error: "Open the local address shown by the server." });
    }

    const asset = assets.get(request.url);
    if (request.method === "GET" && asset) {
      try {
        const [name, type] = asset;
        const content = await readFile(new URL(name, import.meta.url));
        response.writeHead(200, { "Content-Type": type });
        return response.end(content);
      } catch {
        return json(response, 500, { error: "Could not load the page asset." });
      }
    }
    if (request.method !== "POST" || request.url !== "/api/compare") {
      return json(response, 404, { error: "Route not found." });
    }
    if (request.headers.origin && request.headers.origin !== `http://${authority}`) {
      return json(response, 403, { error: "Use the local comparison page." });
    }
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
      return json(response, 415, { error: "Send a JSON comparison request." });
    }

    let input;
    try {
      input = await readInput(request);
    } catch {
      return json(response, 400, { error: "Invalid JSON request." });
    }
    if (!validInput(input)) {
      return json(response, 400, { error: "Invalid comparison settings." });
    }
    if (busy) {
      return json(response, 429, { error: "A comparison is already running. Try again shortly." });
    }

    const { structure, algorithms: selected, repetitions, values } = input;
    busy = true;
    try {
      const args = ["compare", structure, String(repetitions), selected.join(","), ...values.map(String)];
      const { stdout } = await run(executable, args, {
        timeout: 15000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      });
      return json(response, 200, JSON.parse(stdout));
    } catch (error) {
      if (error.code === "ENOENT") {
        return json(response, 503, { error: "Build the C executable before comparing." });
      }
      if (error.killed && error.signal === "SIGTERM") {
        return json(response, 504, { error: "The C comparison did not finish in time." });
      }
      return json(response, 500, { error: "The C executable could not complete the comparison." });
    } finally {
      busy = false;
    }
  });
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const executable = process.argv[2] ? resolve(process.argv[2]) : undefined;
  const server = createComparisonServer({ executable });
  server.listen(8080, host, () => {
    console.log(`Open http://${host}:${server.address().port} in your browser.`);
  });
}
