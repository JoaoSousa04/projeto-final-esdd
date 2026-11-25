#include "history.h"

#include <stdlib.h>
#include <string.h>

bool replay_init(Replay *replay, const Trace *trace)
{
    *replay = (Replay){.trace = trace};
    if (trace->size > 0) {
        replay->items = malloc(trace->size * sizeof(*replay->items));
        if (replay->items == NULL) {
            return false;
        }
        memcpy(replay->items, trace->initial, trace->size * sizeof(*replay->items));
    }
    if (trace->count > 0) {
        if (trace->count <= SIZE_MAX / sizeof(*replay->stack)) {
            replay->stack = malloc(trace->count * sizeof(*replay->stack));
        }
        if (replay->stack == NULL) {
            replay_destroy(replay);
            return false;
        }
    }
    return true;
}

void replay_destroy(Replay *replay)
{
    free(replay->items);
    free(replay->stack);
    *replay = (Replay){0};
}

static void move_item(Item *items, size_t from, size_t to)
{
    Item item = items[from];
    if (from > to) {
        memmove(items + to + 1, items + to, (from - to) * sizeof(*items));
    } else if (from < to) {
        memmove(items + from, items + from + 1, (to - from) * sizeof(*items));
    }
    items[to] = item;
}

static void apply_event(Item *items, SortEvent event, bool inverse)
{
    if (event.type == SWAP) {
        Item temporary = items[event.first];
        items[event.first] = items[event.second];
        items[event.second] = temporary;
    } else if (event.type == MOVE) {
        move_item(items, inverse ? event.second : event.first,
                  inverse ? event.first : event.second);
    }
}

bool replay_next(Replay *replay)
{
    if (replay->cursor == replay->trace->count) {
        return false;
    }
    SortEvent event = replay->trace->events[replay->cursor];
    if (event.type == MOVE &&
        (event.first >= replay->trace->size || event.second >= replay->trace->size ||
         replay->items[event.first].id != event.item)) {
        return false;
    }
    replay->stack[replay->cursor++] = (HistoryFrame){event, replay->highlight};
    apply_event(replay->items, event, false);
    replay->highlight = event;
    return true;
}

bool replay_undo(Replay *replay)
{
    if (replay->cursor == 0) {
        return false;
    }
    HistoryFrame frame = replay->stack[--replay->cursor];
    apply_event(replay->items, frame.event, true);
    replay->highlight = frame.previous_highlight;
    return true;
}

static void print_state(const Replay *replay, FILE *output)
{
    fprintf(output, "Step %zu/%zu:", replay->cursor, replay->trace->count);
    for (size_t index = 0; index < replay->trace->size; ++index) {
        fprintf(output, " %d#%zu", replay->items[index].value, replay->items[index].id);
    }
    if (replay->cursor != 0) {
        SortEvent event = replay->highlight;
        if (event.type == COMPARE) {
            fprintf(output, " | compare item #%zu with #%zu", event.first, event.second);
        } else if (event.type == MOVE) {
            fprintf(output, " | move item #%zu from %zu to %zu", event.item, event.first, event.second);
        } else {
            fprintf(output, " | swap positions %zu and %zu", event.first, event.second);
        }
    }
    fputc('\n', output);
}

void replay_interactive(Replay *replay, FILE *input, FILE *output)
{
    fputs("n = next, u = undo, q = quit\n", output);
    print_state(replay, output);
    char line[64];
    while (fflush(output) == 0 && fgets(line, sizeof(line), input) != NULL && line[0] != 'q') {
        if (line[0] == 'n') {
            if (!replay_next(replay)) {
                fputs("End of trace.\n", output);
            }
        } else if (line[0] == 'u') {
            if (!replay_undo(replay)) {
                fputs("Already at the initial state.\n", output);
            }
        } else {
            fputs("Enter n, u, or q.\n", output);
            continue;
        }
        print_state(replay, output);
    }
}
