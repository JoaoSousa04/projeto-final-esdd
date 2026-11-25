#include "benchmark/benchmark.h"

#include <string.h>

static void show_usage(void)
{
    puts("Sorting and Data Structure Analysis Platform\n"
         "Usage:\n"
         "  platform --help\n"
         "  platform benchmark SIZE PROFILE SEED REPETITIONS\n"
         "  platform batch FILE\n"
         "Profiles: random, sorted, reverse, duplicates");
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
    fputs("Run platform --help for usage.\n", stderr);
    return 1;
}
