#ifndef _WIN32
#define _POSIX_C_SOURCE 200809L
#endif
#include "benchmark.h"
#include "../structures/queue.h"

#include <errno.h>
#include <inttypes.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifdef _WIN32
#include <windows.h>
#endif

static const char *const profiles[] = {"random", "sorted", "reverse", "duplicates"};

static bool parse_number(const char *text, uintmax_t limit, uintmax_t *result)
{
    if (text[0] < '0' || text[0] > '9') {
        return false;
    }
    char *end;
    errno = 0;
    uintmax_t value = strtoumax(text, &end, 10);
    if (errno != 0 || *end != '\0' || value > limit) {
        return false;
    }
    *result = value;
    return true;
}

bool parse_input(const char *const fields[4], InputConfig *input)
{
    uintmax_t size, seed, repetitions;
    if (!parse_number(fields[0], 1000000, &size) ||
        !parse_number(fields[2], UINT32_MAX, &seed) ||
        !parse_number(fields[3], 1000, &repetitions) || repetitions == 0) {
        return false;
    }
    for (Profile profile = RANDOM; profile < PROFILE_COUNT; ++profile) {
        if (strcmp(fields[1], profiles[profile]) == 0) {
            *input = (InputConfig){(size_t)size, profile, (uint32_t)seed, (size_t)repetitions};
            return true;
        }
    }
    return false;
}

static int compare_ints(const void *first, const void *second)
{
    int left = *(const int *)first;
    int right = *(const int *)second;
    return (left > right) - (left < right);
}

static int compare_times(const void *first, const void *second)
{
    double left = *(const double *)first;
    double right = *(const double *)second;
    return (left > right) - (left < right);
}

static void generate_values(InputConfig input, int *values)
{
    uint32_t state = input.seed;
    for (size_t index = 0; index < input.size; ++index) {
        state = state * UINT32_C(1664525) + UINT32_C(1013904223);
        uint32_t range = input.profile == DUPLICATES ? 9 : 2000001;
        values[index] = (int)((state >> 8) % range) - (int)(range / 2);
    }
    if (input.profile == SORTED || input.profile == REVERSE) {
        qsort(values, input.size, sizeof(*values), compare_ints);
    }
    if (input.profile == REVERSE) {
        for (size_t index = 0; index < input.size / 2; ++index) {
            size_t opposite = input.size - 1 - index;
            int temporary = values[index];
            values[index] = values[opposite];
            values[opposite] = temporary;
        }
    }
}

static bool monotonic_seconds(double *seconds)
{
#ifdef _WIN32
    LARGE_INTEGER counter, frequency;
    if (!QueryPerformanceFrequency(&frequency) || !QueryPerformanceCounter(&counter)) {
        return false;
    }
    *seconds = (double)counter.QuadPart / (double)frequency.QuadPart;
#else
    struct timespec timestamp;
    if (clock_gettime(CLOCK_MONOTONIC, &timestamp) != 0) {
        return false;
    }
    *seconds = (double)timestamp.tv_sec + (double)timestamp.tv_nsec / 1e9;
#endif
    return true;
}

static bool matches_reference(const Data *data, const int *reference, size_t size)
{
    if (data->size != size || !data_valid(data)) {
        return false;
    }
    const Node *node = data->head;
    for (size_t index = 0; index < size; ++index) {
        int value = data->kind == VECTOR ? data->items[index].value : node->item.value;
        if (value != reference[index]) {
            return false;
        }
        if (node != NULL) {
            node = node->next;
        }
    }
    return true;
}

static const char *measure(Task task, const int *values, const int *reference,
                           FILE *output, size_t attempt, double *milliseconds)
{
    Data data;
    data_init(&data, task.structure);
    const char *status = "ok";
    for (size_t index = 0; index < task.input.size; ++index) {
        if (!data_append(&data, values[index])) {
            status = "allocation-error";
            goto cleanup;
        }
    }
    size_t before = data_bytes(&data);
    double start, end;
    SortMetrics metrics;
    if (!monotonic_seconds(&start)) {
        status = "clock-error";
    } else if (!sort_data(&data, task.algorithm, &metrics, NULL, NULL)) {
        status = "allocation-error";
    } else if (!monotonic_seconds(&end)) {
        status = "clock-error";
    } else if (!matches_reference(&data, reference, task.input.size)) {
        status = "validation-error";
    } else {
        *milliseconds = (end - start) * 1000.0;
        fprintf(output, "%zu,%zu,ok,%.9f,%zu,%zu,%zu,%" PRIu64 "\n",
                task.id, attempt, *milliseconds, before, metrics.auxiliary_bytes,
                before + metrics.auxiliary_bytes, metrics.comparisons);
    }

cleanup:
    data_destroy(&data);
    if (strcmp(status, "ok") != 0) {
        fprintf(output, "%zu,%zu,%s,,,,,\n", task.id, attempt, status);
    }
    return status;
}

static bool run_task(Task task, FILE *output)
{
    if (!task.valid) {
        fprintf(output, "task,%zu,invalid\n", task.id);
        return false;
    }
    InputConfig input = task.input;
    fprintf(output, "task,%zu,%s,%s,%zu,%s,%" PRIu32 ",%zu\n", task.id,
            algorithm_name(task.algorithm), structure_name(task.structure), input.size,
            profiles[input.profile], input.seed, input.repetitions);
    size_t count = input.size == 0 ? 1 : input.size;
    int *values = malloc(count * sizeof(*values));
    int *reference = malloc(count * sizeof(*reference));
    double *times = malloc(input.repetitions * sizeof(*times));
    size_t successful = 0;
    if (values != NULL && reference != NULL && times != NULL) {
        generate_values(input, values);
        memcpy(reference, values, input.size * sizeof(*values));
        qsort(reference, input.size, sizeof(*reference), compare_ints);
        for (size_t attempt = 1; attempt <= input.repetitions; ++attempt) {
            const char *status = measure(task, values, reference, output, attempt, &times[successful]);
            if (strcmp(status, "ok") == 0) {
                ++successful;
            }
        }
        if (successful > 0) {
            qsort(times, successful, sizeof(*times), compare_times);
            double median = (times[(successful - 1) / 2] + times[successful / 2]) / 2.0;
            fprintf(output, "median,%zu,%zu,%.9f\n", task.id, successful, median);
        }
    } else {
        fprintf(output, "task-error,%zu,allocation-error\n", task.id);
    }
    free(times);
    free(reference);
    free(values);
    if (successful == 0) {
        fprintf(output, "median,%zu,0,\n", task.id);
    }
    return successful == input.repetitions;
}

static void report_header(FILE *output)
{
    fputs("# bytes exclude allocator overhead, call stack and input/reference buffers\n"
          "# task,id,algorithm,structure,size,profile,seed,repetitions\n"
          "# id,run,status,ms,structure_bytes,auxiliary_bytes,peak_bytes,comparisons\n"
          "# median,id,successful_runs,ms\n", output);
}

int benchmark_all(InputConfig input, FILE *output)
{
    report_header(output);
    bool success = true;
    size_t id = 0;
    for (Algorithm algorithm = INSERTION; algorithm < ALGORITHM_COUNT; ++algorithm) {
        for (Structure kind = VECTOR; kind < STRUCTURE_COUNT; ++kind) {
            Task task = {algorithm, kind, input, ++id, true};
            if (!run_task(task, output)) {
                success = false;
            }
        }
    }
    return success && !ferror(output) ? 0 : 1;
}

static bool parse_task(const char *line, Task *task)
{
    char algorithm[24], structure[24], size[24], profile[24], seed[24], repetitions[24], extra;
    const char *fields[] = {size, profile, seed, repetitions};
    return sscanf(line, "%23s %23s %23s %23s %23s %23s %c",
                  algorithm, structure, size, profile, seed, repetitions, &extra) == 6 &&
           algorithm_parse(algorithm, &task->algorithm) &&
           structure_parse(structure, &task->structure) && parse_input(fields, &task->input);
}

int benchmark_batch(FILE *input, FILE *output)
{
    TaskQueue queue = {0};
    char line[256];
    size_t id = 0;
    bool success = true;
    while (fgets(line, sizeof(line), input) != NULL) {
        bool truncated = strlen(line) == sizeof(line) - 1 && strchr(line, '\n') == NULL;
        if (truncated) {
            int byte;
            do {
                byte = fgetc(input);
            } while (byte != '\n' && byte != EOF);
        }
        const char *content = line + strspn(line, " \t\r\n");
        if (!truncated && (*content == '\0' || *content == '#')) {
            continue;
        }
        Task task = {.id = ++id};
        task.valid = !truncated && parse_task(content, &task);
        if (!queue_push(&queue, task)) {
            fprintf(output, "task-error,%zu,queue-allocation-error\n", id);
            success = false;
            break;
        }
    }
    if (ferror(input)) {
        fputs("batch-error,input-read-error\n", output);
        success = false;
    }
    report_header(output);
    Task task;
    while (queue_pop(&queue, &task)) {
        if (!run_task(task, output)) {
            success = false;
        }
    }
    return success && !ferror(output) ? 0 : 1;
}
