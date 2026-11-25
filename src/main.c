#include <stdio.h>
#include <string.h>

int main(int argument_count, char **arguments)
{
    if (argument_count == 2 && strcmp(arguments[1], "--help") == 0) {
        puts("Sorting and Data Structure Analysis Platform\nUsage: platform --help");
        return 0;
    }

    fputs("Run platform --help for usage.\n", stderr);
    return 1;
}
