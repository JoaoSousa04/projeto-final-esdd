#ifndef PLATFORM_SORT_H
#define PLATFORM_SORT_H

#include "../structures/data.h"
#include <stdint.h>

typedef enum { INSERTION, MERGE, BUBBLE, HEAP, QUICK, SELECTION, ALGORITHM_COUNT } Algorithm;
typedef enum { COMPARE, SWAP, MOVE } EventType;

typedef struct {
    EventType type;
    size_t first;
    size_t second;
    size_t item;
} SortEvent;

typedef void (*SortObserver)(void *context, SortEvent event);

typedef struct {
    uint64_t comparisons;
    size_t auxiliary_bytes;
} SortMetrics;

const char *algorithm_name(Algorithm algorithm);
bool algorithm_parse(const char *name, Algorithm *algorithm);
bool sort_data(Data *data, Algorithm algorithm, SortMetrics *metrics,
               SortObserver observer, void *observer_context);

#endif
