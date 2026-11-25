# Architecture

The C11 CLI in `src/main.c` is the entry point. The implementation follows the dependencies in [the plan](../plan.md). Structures own storage, sorting operates on those structures, and benchmarking measures each combination in isolation. The static viewer consumes optional JSON events produced by C.

GNU Make builds the project and runs the CLI smoke test.

`Data` owns either a contiguous buffer or a chain of nodes. A doubly linked node embeds the common node as its first member and adds a backward pointer. Circular lists link the tail to the head. The container assigns each item an ID equal to its original input position.

Insertion sort grows a sorted prefix. Merge sort splits into halves and selects the left item on equality. The vector merge uses one scratch buffer for the whole sort. List merge relinks nodes and uses logarithmic recursion depth. Both list sorts work on a linear forward chain, then restore the tail, backward links, or circular closure.
