#ifndef PLATFORM_TEST_ALLOC_HOOKS_H
#define PLATFORM_TEST_ALLOC_HOOKS_H

#ifndef _WIN32
#define _POSIX_C_SOURCE 200809L
#endif
#include <stdlib.h>

void *test_malloc(size_t size);
void *test_realloc(void *pointer, size_t size);
void test_free(void *pointer);

#define malloc test_malloc
#define realloc test_realloc
#define free test_free

#endif
