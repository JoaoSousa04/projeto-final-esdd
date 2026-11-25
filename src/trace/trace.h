#ifndef PLATFORM_TRACE_H
#define PLATFORM_TRACE_H

#include "../sorting/sort.h"
#include <stdio.h>

typedef struct {
    Item *initial;
    SortEvent *events;
    size_t size;
    size_t count;
    size_t capacity;
    bool failed;
} Trace;

bool trace_build(Trace *trace, Data *data, Algorithm algorithm);
void trace_destroy(Trace *trace);
bool trace_write(FILE *file, const Trace *trace, const Data *sorted, Algorithm algorithm);

#endif
