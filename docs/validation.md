# Validation and debugging

## Requirement evidence

| ID | Evidence |
| --- | --- |
| RF-01 | Structure and allocator tests verify growth, preserved vector pointer and capacity after a failed realloc, cleanup after failed allocations, and zero outstanding blocks tracked by the test allocator. |
| RF-02 | Structure tests exercise all four layouts and check contents, backward links, and circular closure. |
| RF-03 | The C sorting matrix runs 48 cases. It checks stable IDs against qsort, original node addresses, sequence length, and invariants. |
| RF-04 | The sample batch completes 40 runs with eight medians. The integration test checks nonnegative time, positive comparisons, and the peak byte sum. Each run checks the output against qsort outside the timed region. |
| RF-05 | C tests advance, undo, and re-advance comparisons and moves, check highlight restoration, and rewind to the initial state. Integration also drives the interactive CLI through both endpoints. |
| RF-06 | C and integration tests exercise three FIFO tasks with an invalid middle record. The allocator test also fails the middle enqueue and checks that reporting stays ordered and the following task completes. |
| RF-07 | The Node test verifies 24 C exports. The Chrome test loads all eight combinations and checks displayed final values and IDs, highlights, move undo, autoplay, empty input, malformed JSON, and incompatible versions. |
| RF-08 | Optional hash index deferred. |
| RNF-01 | The plan, architecture, tests, and implementation are tracked in Git. The project branch was published incrementally to GitHub. |
| RNF-02 | README, comments, and identifiers are in English. |
| RNF-03 | AI_LOG.md contains the initial prompt, implementation decisions, changes, and observed verification. |
| RNF-04 | The implementation was reviewed against the repository plan. Course-specific conventions, independent reproduction and debugging, and individual defense remain with the team. |

## Published increments

| Commit | Scope | Verification |
| --- | --- | --- |
| `9b5271c` | C11 CLI, build, architecture and AI log | GCC strict build and CLI help smoke test |
| `ca65d26` | RF-01, RF-02 | Structure tests, including 100 inserts per structure |
| `73cd797` | RF-03 | 48 sorting cases with stability and node identity |
| `aec9471` | RF-04, RF-06 | FIFO and invalid-record tests, eight-task sample batch |
| `22600dd` | RF-05, RF-07 | C replay tests, Node integration and Chrome browser tests |

## Benchmark example

On Windows x64 with MSYS2 UCRT64 GCC 15.2.0, the example used `-O2 -Werror -std=c11 -Wall -Wextra -Wpedantic`. The input was 1,000 integers from the random profile, seed 42, with five repetitions per combination.

| Algorithm | Structure | Median (ms) | Initial bytes | Auxiliary bytes | Peak bytes | Comparisons per run |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Insertion | Vector | 2.3629 | 16,384 | 0 | 16,384 | 265,328 |
| Insertion | Singly | 2.5643 | 24,000 | 0 | 24,000 | 236,159 |
| Insertion | Doubly | 2.9781 | 32,000 | 0 | 32,000 | 236,159 |
| Insertion | Circular | 2.5802 | 24,000 | 0 | 24,000 | 236,159 |
| Merge | Vector | 0.5024 | 16,384 | 16,000 | 32,384 | 8,679 |
| Merge | Singly | 0.3906 | 24,000 | 0 | 24,000 | 8,679 |
| Merge | Doubly | 0.3931 | 32,000 | 0 | 32,000 | 8,679 |
| Merge | Circular | 0.3968 | 24,000 | 0 | 24,000 | 8,679 |

Timings vary between runs. Vector insertion scans backward from the end of the sorted prefix, while linked insertion scans forward from its head. The two traversal directions explain their different comparison counts.

## Debugging points

- **Allocation and invariants** — [data.c](../src/structures/data.c), `vector_grow`, `data_append`, `data_valid` and `data_destroy`.
- **Sorting** — [sort.c](../src/sorting/sort.c), `insertion_vector`, `insertion_list`, `merge_vector`, `merge_list`, `merge_lists` and `restore_list_links`. Watch item IDs, list head and tail, and previous links during restoration.
- **FIFO** — [queue.c](../src/structures/queue.c), `queue_push` and `queue_pop`, then [benchmark.c](../src/benchmark/benchmark.c), `benchmark_batch`, `run_queue` and `measure`. Watch task IDs and queue endpoints.
- **Undo** — [history.c](../src/structures/history.c), `replay_next`, `replay_undo` and `apply_event`. Watch the cursor, top frame, previous highlight, and item IDs. Follow the event through [trace.c](../src/trace/trace.c) and [replay.js](../web/replay.js) to the browser.

For the team review, reproduce the commands from the README in a clean checkout. Confirm course conventions and report any defect with the command or action, input and seed, expected and actual results, and the first relevant source location. Each member should practice explaining the invariants, a pointer relink, FIFO versus LIFO, the benchmark measurement, and an event followed from C through the viewer.

## Verification environment

- Clean source copy on Windows x64. `mingw32-make -j4 test-integration CFLAGS="-O2 -Werror"` passed with MSYS2 UCRT64 GCC 15.2.0 and Node.js. The clean copy also passed the headless Chrome suite and generated the circular merge demonstration trace.
- `mingw32-make -j4 test BUILD=build-analysis CFLAGS="-O0 -g -Werror -fanalyzer"` passed.
- All five C test executables passed with the Windows Application Verifier Heaps layer enabled on temporary uniquely named copies. Verification settings were removed after each run. [Microsoft Application Verifier commands](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/application-verifier-testing-applications)
- GCC could not link ASan and UBSan because the toolchain lacks both runtime libraries. The Visual Studio ASan attempt also stopped at linking because its runtime thunk library is missing. The README includes a sanitizer command for a supported environment.
