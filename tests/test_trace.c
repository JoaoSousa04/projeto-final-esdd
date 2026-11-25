#include "../src/structures/history.h"

#include <assert.h>

static void verify_trace(Structure kind, Algorithm algorithm, size_t size)
{
    const int values[] = {4, -2, 4, 0, -3, 1, 0};
    Data data;
    data_init(&data, kind);
    for (size_t index = 0; index < size; ++index) {
        assert(data_append(&data, values[index]));
    }
    Trace trace;
    assert(trace_build(&trace, &data, algorithm));
    Replay replay;
    assert(replay_init(&replay, &trace));
    assert(!replay_undo(&replay));
    size_t comparisons = 0;
    size_t moves = 0;
    for (size_t index = 0; index < trace.count; ++index) {
        SortEvent previous = replay.highlight;
        Item before[7];
        for (size_t item = 0; item < size; ++item) {
            before[item] = replay.items[item];
        }
        assert(replay_next(&replay));
        comparisons += replay.highlight.type == COMPARE;
        moves += replay.highlight.type != COMPARE;
        assert(replay_undo(&replay));
        assert(replay.cursor == index);
        assert(replay.highlight.type == previous.type && replay.highlight.first == previous.first &&
               replay.highlight.second == previous.second && replay.highlight.item == previous.item);
        for (size_t item = 0; item < size; ++item) {
            assert(before[item].id == replay.items[item].id && before[item].value == replay.items[item].value);
        }
        assert(replay_next(&replay));
    }
    assert(!replay_next(&replay));
    assert((comparisons != 0) == (size > 1));
    assert((moves != 0) == (size > 1));
    while (replay_undo(&replay)) {
    }
    for (size_t index = 0; index < size; ++index) {
        assert(replay.items[index].id == index && replay.items[index].value == values[index]);
    }

    SortMetrics metrics;
    data_destroy(&data);
    for (size_t index = 0; index < size; ++index) {
        assert(data_append(&data, values[index]));
    }
    assert(sort_data(&data, algorithm, &metrics, NULL, NULL));
    assert(metrics.comparisons == comparisons);
    replay_destroy(&replay);
    trace_destroy(&trace);
    data_destroy(&data);
}

int main(void)
{
    for (Structure kind = VECTOR; kind < STRUCTURE_COUNT; ++kind) {
        for (Algorithm algorithm = INSERTION; algorithm < ALGORITHM_COUNT; ++algorithm) {
            verify_trace(kind, algorithm, 0);
            verify_trace(kind, algorithm, 1);
            verify_trace(kind, algorithm, 7);
        }
    }
    return 0;
}
