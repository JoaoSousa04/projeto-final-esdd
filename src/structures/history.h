#ifndef PLATFORM_HISTORY_H
#define PLATFORM_HISTORY_H

#include "../trace/trace.h"

typedef struct {
    SortEvent event;
    SortEvent previous_highlight;
} HistoryFrame;

typedef struct {
    const Trace *trace;
    Item *items;
    HistoryFrame *stack;
    size_t cursor;
    SortEvent highlight;
} Replay;

bool replay_init(Replay *replay, const Trace *trace);
void replay_destroy(Replay *replay);
bool replay_next(Replay *replay);
bool replay_undo(Replay *replay);
void replay_interactive(Replay *replay, FILE *input, FILE *output);

#endif
