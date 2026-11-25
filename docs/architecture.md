# Architecture

The C11 CLI in `src/main.c` is the entry point. The implementation follows the dependencies in [the plan](../plan.md). Structures own storage, sorting operates on those structures, and benchmarking measures each combination in isolation. The static viewer consumes optional JSON events produced by C.

GNU Make builds the project and runs the CLI smoke test.

`Data` owns either a contiguous buffer or a chain of nodes. A doubly linked node embeds the common node as its first member and adds a backward pointer. Circular lists link the tail to the head. The container assigns each item an ID equal to its original input position.

Insertion sort grows a sorted prefix. Merge sort splits into halves and selects the left item on equality. The vector merge uses one scratch buffer for the whole sort. List merge relinks nodes and uses logarithmic recursion depth. Both list sorts work on a linear forward chain, then restore the tail, backward links, or circular closure.

The benchmark seeds a 32-bit linear congruential generator from the task configuration. Every repetition builds a fresh structure. QueryPerformanceCounter on Windows and CLOCK_MONOTONIC on POSIX measure the sorting call, with value comparison counting enabled. A qsort reference and structural validation run outside the timed section. Reported peak heap bytes are the initial structure allocations plus the merge scratch buffer, where applicable. The estimate excludes call frames, the stack-resident descriptor, allocator overhead, and the benchmark input and reference buffers. Median calculation excludes failed samples.

The queue owns its task nodes and stores task configurations by value. Invalid records also enter the queue so the report preserves input order.
