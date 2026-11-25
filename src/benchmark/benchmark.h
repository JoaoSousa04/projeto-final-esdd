#ifndef PLATFORM_BENCHMARK_H
#define PLATFORM_BENCHMARK_H

#include "../sorting/sort.h"
#include <stdio.h>

typedef enum { RANDOM, SORTED, REVERSE, DUPLICATES, PROFILE_COUNT } Profile;

typedef struct {
    size_t size;
    Profile profile;
    uint32_t seed;
    size_t repetitions;
} InputConfig;

typedef struct {
    Algorithm algorithm;
    Structure structure;
    InputConfig input;
    size_t id;
    bool valid;
} Task;

enum { COMPARE_MAX_VALUES = 256, COMPARE_MAX_REPETITIONS = 100 };

bool benchmark_compare(Structure structure, const Algorithm *algorithms, size_t count,
                       const int *values, size_t size, size_t repetitions, FILE *output);
bool parse_input(const char *const fields[4], InputConfig *input);
int benchmark_all(InputConfig input, FILE *output);
int benchmark_batch(FILE *input, FILE *output);

#endif
