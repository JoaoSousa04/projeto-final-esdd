#include "trace.h"
#include "../structures/history.h"

#include <stdlib.h>

static void collect_event(void *context, SortEvent event)
{
    Trace *trace = context;
    if (trace->failed) {
        return;
    }
    if (trace->count == trace->capacity) {
        size_t capacity = trace->capacity == 0 ? 32 : trace->capacity * 2;
        if (capacity < trace->capacity || capacity > SIZE_MAX / sizeof(*trace->events)) {
            trace->failed = true;
            return;
        }
        SortEvent *events = realloc(trace->events, capacity * sizeof(*events));
        if (events == NULL) {
            trace->failed = true;
            return;
        }
        trace->events = events;
        trace->capacity = capacity;
    }
    trace->events[trace->count++] = event;
}

static Item get_item(const Data *data, const Node **node, size_t index)
{
    if (data->kind == VECTOR) {
        return data->items[index];
    }
    Item item = (*node)->item;
    *node = (*node)->next;
    return item;
}

static bool trace_matches(const Trace *trace, const Data *sorted)
{
    Replay replay;
    if (!data_valid(sorted) || !replay_init(&replay, trace)) {
        return false;
    }
    while (replay_next(&replay)) {
    }
    bool matches = replay.cursor == trace->count;
    const Node *node = sorted->head;
    for (size_t index = 0; matches && index < trace->size; ++index) {
        Item item = get_item(sorted, &node, index);
        matches = item.id == replay.items[index].id && item.value == replay.items[index].value;
    }
    replay_destroy(&replay);
    return matches;
}

bool trace_build(Trace *trace, Data *data, Algorithm algorithm)
{
    *trace = (Trace){.size = data->size};
    if (trace->size > 0) {
        if (trace->size > SIZE_MAX / sizeof(*trace->initial)) {
            return false;
        }
        trace->initial = malloc(trace->size * sizeof(*trace->initial));
        if (trace->initial == NULL) {
            return false;
        }
    }
    const Node *node = data->head;
    for (size_t index = 0; index < trace->size; ++index) {
        trace->initial[index] = get_item(data, &node, index);
    }
    SortMetrics metrics;
    return sort_data(data, algorithm, &metrics, collect_event, trace) &&
           !trace->failed && trace_matches(trace, data);
}

void trace_destroy(Trace *trace)
{
    free(trace->initial);
    free(trace->events);
    *trace = (Trace){0};
}

static void write_item(FILE *file, Item item, size_t index)
{
    fprintf(file, "%s{\"id\":%zu,\"value\":%d}", index == 0 ? "" : ",", item.id, item.value);
}

bool trace_write(FILE *file, const Trace *trace, const Data *sorted, Algorithm algorithm)
{
    static const char *const event_names[] = {"compare", "swap", "move"};
    fprintf(file, "{\n\"schemaVersion\":1,\n\"algorithm\":\"%s\",\n\"structure\":\"%s\",\n\"initial\":[",
            algorithm_name(algorithm), structure_name(sorted->kind));
    for (size_t index = 0; index < trace->size; ++index) {
        write_item(file, trace->initial[index], index);
    }
    fputs("],\n\"events\":[", file);
    for (size_t index = 0; index < trace->count; ++index) {
        SortEvent event = trace->events[index];
        fprintf(file, "%s\n{\"step\":%zu,\"type\":\"%s\"",
                index == 0 ? "" : ",", index + 1, event_names[event.type]);
        if (event.type == COMPARE) {
            fprintf(file, ",\"leftId\":%zu,\"rightId\":%zu}", event.first, event.second);
        } else {
            fprintf(file, ",\"from\":%zu,\"to\":%zu", event.first, event.second);
            if (event.type == MOVE) {
                fprintf(file, ",\"id\":%zu", event.item);
            }
            fputc('}', file);
        }
    }
    fputs("],\n\"final\":[", file);
    const Node *node = sorted->head;
    for (size_t index = 0; index < trace->size; ++index) {
        write_item(file, get_item(sorted, &node, index), index);
    }
    fputs("]\n}\n", file);
    return !ferror(file);
}
