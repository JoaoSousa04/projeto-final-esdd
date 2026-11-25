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
         "  platform trace ALGORITHM STRUCTURE FILE [INTEGER ...]\n"
         "  platform step ALGORITHM STRUCTURE [INTEGER ...]\n"
         "Profiles: random, sorted, reverse, duplicates\n"
         "Algorithms: insertion, merge\n"
         "Structures: vector, singly, doubly, circular");
}

static bool append_values(Data *data, int count, char **values)
{
    for (int index = 0; index < count; ++index) {
        char *end;
        errno = 0;
        long number = strtol(values[index], &end, 10);
        if (end == values[index] || *end != '\0' || errno != 0 || number < INT_MIN || number > INT_MAX) {
            fprintf(stderr, "Invalid integer: %s\n", values[index]);
            return false;
        }
        if (!data_append(data, (int)number)) {
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
    if (argument_count >= 5 && strcmp(arguments[1], "trace") == 0) {
        return run_trace(argument_count, arguments, true);
    }
    if (argument_count >= 4 && strcmp(arguments[1], "step") == 0) {
        return run_trace(argument_count, arguments, false);
    }
    fputs("Run platform --help for usage.\n", stderr);
    return 1;
}
