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
