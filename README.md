# Sorting and Data Structure Analysis Platform

See the [requirements](plan.md), [architecture](docs/architecture.md), and [AI log](AI_LOG.md).

Install GCC and GNU Make. On Windows with MSYS2 UCRT64 tools on PATH, run:

~~~powershell
mingw32-make
mingw32-make test
./build/platform.exe --help
~~~

On Linux or macOS with GCC and GNU Make, use `make`, `make test`, and `./build/platform --help`.
## Benchmark and batch

Run all eight combinations or submit one task per line:

~~~powershell
./build/platform.exe benchmark 1000 random 42 5
./build/platform.exe batch examples/batch.txt
~~~

A task line contains algorithm, structure, size, profile, seed, and repetition count. Algorithms are `insertion` and `merge`. Structures are `vector`, `singly`, `doubly`, and `circular`. Profiles are `random`, `sorted`, `reverse`, and `duplicates`. Use sizes from 0 to 1,000,000, unsigned 32-bit seeds, and 1 to 1,000 repetitions. Start with small inputs because insertion sort can take quadratic time.

The report contains task settings, per-run milliseconds, estimated heap bytes, value comparisons, and median milliseconds for successful runs. Match rows by task ID. An invalid task produces an error row and a nonzero process exit status. Subsequent tasks still run.

## Trace and viewer

Export a trace and open the local viewer:

~~~powershell
./build/platform.exe trace merge circular trace.json 4 -2 4 0 -3 1 0
Invoke-Item ./web/index.html
~~~

Choose `trace.json` in the file picker. Use **Next**, **Undo**, or **Play**. The viewer displays the file name, algorithm, structure, and current event. Run the C stepper with the same data:

~~~powershell
./build/platform.exe step merge circular 4 -2 4 0 -3 1 0
~~~

Enter `n` to advance, `u` to undo, or `q` to quit. The trace commands accept up to 256 integers, including empty input.

Use Node.js 18 or newer for the CLI-to-JavaScript integration test. With Playwright installed and its Chromium browser available, the browser test opens the local HTML page and loads files exported by C:

~~~powershell
mingw32-make test-integration
node tests/test_browser.mjs build/platform.exe
~~~

The browser script also accepts an installed Chromium-based browser path as its second argument. On other platforms, use `make` and omit the executable's `.exe` suffix.

## Validation and debugging

See [validation.md](docs/validation.md) for requirement evidence, published increments, measured results, and debugger entry points. To run GCC's static analyzer with a separate build directory on Windows:

~~~powershell
mingw32-make test BUILD=build-analysis CFLAGS="-O0 -g -Werror -fanalyzer"
~~~

On a GCC installation with both sanitizer runtimes available:

~~~sh
make test-integration BUILD=build-sanitized CFLAGS="-O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer"
~~~

## Local comparison service

Build the native executable once with `mingw32-make` on Windows or `make` on Linux or macOS. Rebuild after changing the C sources. Start the local service with Node.js 18 or newer and open the address it prints:

~~~powershell
node web/serve.mjs
~~~

The service listens at `http://127.0.0.1:8080` for the session. If you built into another directory, pass the executable path, for example `node web/serve.mjs build-compare/platform.exe`. The API runs the C executable for each request and returns a comparison envelope containing the original trace v1 objects and the native metrics.

Open **Compare algorithms**, set the size, and type integers or select **Generate random values**. The preview shows the exact input. Select a single structure and one or more algorithms, then select **Run algorithm** or **Compare**. The chart shows the selected metric for every run. The table shows all native C metrics and a **Replay** button for each trace. Use the speed selector to change playback from 0.5× to 4×. The same page still opens exported trace files directly.

The interactive comparison accepts 0–256 signed 32-bit integers and 1–100 timed repetitions. The controller keeps the generated values until you edit or regenerate them. For a direct diagnostic of the same native JSON response:

~~~powershell
./build/platform.exe compare vector 5 insertion,merge 4 -2 4 0 -3 1 0
~~~
