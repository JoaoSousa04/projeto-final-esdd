# Architecture

The C11 CLI in `src/main.c` is the entry point. The implementation follows the dependencies in [the plan](../plan.md). Structures own storage, sorting operates on those structures, and benchmarking measures each combination in isolation. The static viewer consumes optional JSON events produced by C.

GNU Make builds the project and runs the CLI smoke test.
