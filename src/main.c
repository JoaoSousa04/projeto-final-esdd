#include "benchmark/benchmark.h"
#include "structures/history.h"

#include <errno.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>

static void show_usage(void)
{
    puts("Sorting and Data Structure Analysis Platform\n"
         "Usage:\n"
         "  platform --help\n"
         "  platform benchmark SIZE PROFILE SEED REPETITIONS\n"
         "  platform batch FILE\n"
         "  platform compare STRUCTURE REPETITIONS ALGORITHM[,ALGORITHM ...] [INTEGER ...]\n"
         "  platform trace ALGORITHM STRUCTURE FILE [INTEGER ...]\n"
         "  platform step ALGORITHM STRUCTURE [INTEGER ...]\n"
         "Profiles: random, sorted, reverse, duplicates\n"
         "Algorithms: bubble, heap, insertion, merge, quick, selection\n"
         "Structures: vector, singly, doubly, circular");
}

static bool parse_integer(const char *text, int *value)
{
    char *end;
    errno = 0;
    long number = strtol(text, &end, 10);
    if (end == text || *end != '\0' || errno != 0 || number < INT_MIN || number > INT_MAX) {
        fprintf(stderr, "Invalid integer: %s\n", text);
        return false;
    }
    *value = (int)number;
    return true;
}

static bool append_values(Data *data, int count, char **values)
{
    for (int index = 0; index < count; ++index) {
        int value;
        if (!parse_integer(values[index], &value)) {
            return false;
        }
        if (!data_append(data, value)) {
            fputs("Could not allocate input.\n", stderr);
            return false;
        }
    }
    return true;
}

static bool save_trace(const char *path, const Trace *trace, const Data *data, Algorithm algorithm)
{
    FILE *file = fopen(path, "w");
    if (file == NULL) {
        perror(path);
        return false;
    }
    bool written = trace_write(file, trace, data, algorithm);
    if (fclose(file) != 0 || !written) {
        fprintf(stderr, "Could not write trace: %s\n", path);
        return false;
    }
    return true;
}

static bool run_steps(const Trace *trace)
{
    Replay replay;
    if (!replay_init(&replay, trace)) {
        fputs("Could not allocate replay history.\n", stderr);
        return false;
    }
    replay_interactive(&replay, stdin, stdout);
    replay_destroy(&replay);
    return !ferror(stdin) && !ferror(stdout);
}

static int run_trace(int argument_count, char **arguments, bool export_file)
{
    Algorithm algorithm;
    Structure structure;
    if (!algorithm_parse(arguments[2], &algorithm) || !structure_parse(arguments[3], &structure)) {
        fputs("Invalid algorithm or structure.\n", stderr);
        return 1;
    }
    int first_value = export_file ? 5 : 4;
    if (argument_count - first_value > 256) {
        fputs("Trace supports up to 256 integers.\n", stderr);
        return 1;
    }
    Data data;
    data_init(&data, structure);
    Trace trace = {0};
    bool success = append_values(&data, argument_count - first_value, arguments + first_value);
    if (success && !trace_build(&trace, &data, algorithm)) {
        fputs("Could not build or validate trace.\n", stderr);
        success = false;
    }
    if (success) {
        success = export_file ? save_trace(arguments[4], &trace, &data, algorithm) : run_steps(&trace);
    }
    trace_destroy(&trace);
    data_destroy(&data);
    return success ? 0 : 1;
}

static bool parse_algorithms(const char *list, Algorithm *algorithms, size_t *count)
{
    bool seen[ALGORITHM_COUNT] = {false};
    *count = 0;
    for (;;) {
        char name[24];
        size_t length = strcspn(list, ",");
        Algorithm algorithm;
        if (length == 0 || length >= sizeof(name)) {
            return false;
        }
        memcpy(name, list, length);
        name[length] = '\0';
        if (!algorithm_parse(name, &algorithm) || seen[algorithm]) {
            return false;
        }
        seen[algorithm] = true;
        algorithms[(*count)++] = algorithm;
        if (list[length] == '\0') {
            return true;
        }
        list += length + 1;
    }
}

static int run_compare(int argument_count, char **arguments)
{
    Structure structure;
    Algorithm algorithms[ALGORITHM_COUNT];
    size_t count;
    int repetitions;
    int size = argument_count - 5;
    if (!structure_parse(arguments[2], &structure) ||
        !parse_integer(arguments[3], &repetitions) || repetitions < 1 ||
        repetitions > COMPARE_MAX_REPETITIONS || size > COMPARE_MAX_VALUES ||
        !parse_algorithms(arguments[4], algorithms, &count)) {
        fputs("Invalid comparison configuration (choose at least one algorithm, without duplicates).\n", stderr);
        return 1;
    }
    int values[COMPARE_MAX_VALUES];
    for (int index = 0; index < size; ++index) {
        if (!parse_integer(arguments[index + 5], &values[index])) {
            return 1;
        }
    }
    return benchmark_compare(structure, algorithms, count, values, (size_t)size,
                             (size_t)repetitions, stdout) ? 0 : 1;
}

int main(int argument_count, char **arguments)
{
    if (argument_count == 2 && strcmp(arguments[1], "--help") == 0) {
        show_usage();
        return 0;
    }
    if (argument_count == 6 && strcmp(arguments[1], "benchmark") == 0) {
        const char *fields[] = {arguments[2], arguments[3], arguments[4], arguments[5]};
        InputConfig input;
        if (parse_input(fields, &input)) {
            return benchmark_all(input, stdout);
        }
        fputs("Invalid benchmark configuration.\n", stderr);
        return 1;
    }
    if (argument_count == 3 && strcmp(arguments[1], "batch") == 0) {
        FILE *input = fopen(arguments[2], "r");
        if (input == NULL) {
            perror(arguments[2]);
            return 1;
        }
        int result = benchmark_batch(input, stdout);
        fclose(input);
        return result;
    }
    if (argument_count >= 5 && strcmp(arguments[1], "compare") == 0) {
        return run_compare(argument_count, arguments);
    }
    if (argument_count >= 5 && strcmp(arguments[1], "trace") == 0) {
        return run_trace(argument_count, arguments, true);
    }
    if (argument_count >= 4 && strcmp(arguments[1], "step") == 0) {
        return run_trace(argument_count, arguments, false);
    }
    fputs("Run platform --help for usage.\n", stderr);
    return 1;
}
