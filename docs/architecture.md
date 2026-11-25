# Architecture

The C11 CLI in `src/main.c` is the entry point. The implementation follows the dependencies in [the plan](../plan.md). Structures own storage, sorting operates on those structures, and benchmarking measures each combination in isolation. The static viewer consumes optional JSON events produced by C.

GNU Make builds the project and runs the CLI smoke test.

`Data` owns either a contiguous buffer or a chain of nodes. A doubly linked node embeds the common node as its first member and adds a backward pointer. Circular lists link the tail to the head. The container assigns each item an ID equal to its original input position.

Insertion sort grows a sorted prefix. Merge sort splits into halves and selects the left item on equality. The vector merge uses one scratch buffer for the whole sort. List merge relinks nodes and uses logarithmic recursion depth. Both list sorts work on a linear forward chain, then restore the tail, backward links, or circular closure.

The benchmark seeds a 32-bit linear congruential generator from the task configuration. Every repetition builds a fresh structure. QueryPerformanceCounter on Windows and CLOCK_MONOTONIC on POSIX measure the sorting call, with value comparison counting enabled. A qsort reference and structural validation run outside the timed section. Reported peak heap bytes are the initial structure allocations plus the merge scratch buffer, where applicable. The estimate excludes call frames, the stack-resident descriptor, allocator overhead, and the benchmark input and reference buffers. Median calculation excludes failed samples.

The queue owns its task nodes and stores task configurations by value. Invalid records also enter the queue so the report preserves input order.

## Trace schema and undo

Schema version 1 contains `schemaVersion`, `algorithm`, `structure`, `initial`, `events`, and `final`. The initial and final arrays contain objects with integer `id` and `value`. IDs are assigned in input order. Every event includes a contiguous one-based `step` and a `type`.

| Type | Fields | Replay |
| --- | --- | --- |
| compare | leftId, rightId | Highlight the two IDs. |
| move | from, to, id | Remove the item from the zero-based source and insert it at the zero-based destination in the resulting array. |
| swap | from, to | Exchange the items at the two zero-based positions. |

Insertion emits a move when it inserts an item earlier in the prefix. Merge emits a move when the next item is taken from the right half ahead of remaining left items. Neither implementation performs swaps. The C sequence in `final` comes directly from the sorted data. Export verifies it against an independent replay of emitted events, including IDs.

The C replay owns a visual buffer and a preallocated LIFO stack. Each advance pushes the event and previous highlight. Undo pops that frame, inverts the move or swap, restores the highlight, and backs up the cursor. The static viewer validates the complete file before enabling playback and applies the same position and ID rules.

## Direct comparison from the browser

The browser validates and previews one input, then POSTs the values, one structure, selected algorithms and repetition count to the local Node.js service. The service validates the request and calls the existing native executable without a shell. It serves only the web assets and binds to the loopback address. One comparison runs at a time per server to avoid contention between its own measurements.

The C comparison creates a fresh data structure for every timed execution and checks it against a reference outside the measurement. Each algorithm runs again with the observer enabled to generate the trace. The comparison envelope declares its own schema version and nests the existing trace v1 objects. The browser displays metrics from the envelope and feeds each trace to the same replay engine used for file imports.

The comparison accepts one or more distinct algorithms. The chart scales the selected native metric against the largest result and shows the exact displayed values. Playback retains the same DOM nodes for item IDs. Comparison events update highlights only, while moves reorder and animate the affected range. Speed controls the scheduling interval and transition duration. The player honors reduced-motion preferences.

Bubble, Heap, Quick, and Selection Sort use indexed access. For vectors they swap items directly. For linked structures they sort a temporary index of node pointers and relink the original nodes, then restore the list invariants. The benchmark includes the pointer index in auxiliary bytes. Bubble Sort is stable, while Heap, Quick, and Selection Sort may change equal-value item order. Quick Sort recurses on the smaller partition to bound stack depth. These algorithms emit real swap events using the existing trace schema.
