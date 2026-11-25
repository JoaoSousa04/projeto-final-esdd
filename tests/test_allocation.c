#include "../src/benchmark/benchmark.h"
#include "../src/structures/history.h"
#include "../src/structures/queue.h"

#include <assert.h>
#include <string.h>

#undef malloc
#undef realloc
#undef free

static size_t live_blocks;
static int allocations_until_failure = -1;

static bool fail_allocation(void)
{
    if (allocations_until_failure < 0) {
        return false;
    }
    return allocations_until_failure-- == 0;
}

void *test_malloc(size_t size)
{
    void *pointer = fail_allocation() ? NULL : malloc(size);
    if (pointer != NULL) {
        ++live_blocks;
    }
    return pointer;
}

void *test_realloc(void *pointer, size_t size)
{
    if (fail_allocation()) {
        return NULL;
    }
    bool new_block = pointer == NULL;
    void *result = realloc(pointer, size);
    if (result != NULL && new_block) {
        ++live_blocks;
    }
    return result;
}

void test_free(void *pointer)
{
    if (pointer != NULL) {
        assert(live_blocks != 0);
        --live_blocks;
    }
    free(pointer);
}

static void test_vector(void)
{
    Data data;
    data_init(&data, VECTOR);
    assert(data_append(&data, 3));
    while (data.size < data.capacity) {
        assert(data_append(&data, 1));
    }
    const Item *original = data.items;
    size_t capacity = data.capacity;
    allocations_until_failure = 0;
    assert(!data_append(&data, 2));
    assert(data.items == original && data.size == capacity && data.capacity == capacity);
    assert(data.items[0].value == 3 && data_valid(&data));

    allocations_until_failure = 0;
    SortMetrics metrics;
    assert(!sort_data(&data, MERGE, &metrics, NULL, NULL));
    assert(data.items == original && data.items[0].value == 3);
    assert(data_append(&data, 2));
    data_destroy(&data);
    assert(live_blocks == 0);
}

static void test_lists(void)
{
    for (Structure kind = SINGLY; kind < STRUCTURE_COUNT; ++kind) {
        Data data;
        data_init(&data, kind);
        assert(data_append(&data, 3));
        allocations_until_failure = 0;
        assert(!data_append(&data, 2));
        assert(data.size == 1 && data.head == data.tail && data_valid(&data));
        data_destroy(&data);
        assert(live_blocks == 0);
    }
}

static void test_trace(void)
{
    for (int failure = 0; failure < 4; ++failure) {
        Data data;
        data_init(&data, CIRCULAR);
        assert(data_append(&data, 3));
        assert(data_append(&data, 2));
        allocations_until_failure = failure;
        Trace trace;
        assert(!trace_build(&trace, &data, INSERTION));
        assert(data_valid(&data));
        trace_destroy(&trace);
        data_destroy(&data);
        assert(live_blocks == 0);
    }
}

static void test_batch(void)
{
    FILE *input = tmpfile();
    FILE *output = tmpfile();
    assert(input != NULL && output != NULL);
    fputs("merge vector 10 sorted 42 1\nmerge vector 10 sorted 42 1\nmerge circular 10 reverse 42 1\n", input);
    rewind(input);
    allocations_until_failure = 1;
    assert(benchmark_batch(input, output) != 0);
    rewind(output);
    char line[256];
    bool first_finished = false;
    bool failure_reported = false;
    bool last_finished = false;
    while (fgets(line, sizeof(line), output) != NULL) {
        if (strncmp(line, "median,1,1,", strlen("median,1,1,")) == 0) {
            first_finished = true;
        }
        if (strstr(line, "task-error,2,queue-allocation-error") != NULL) {
            assert(first_finished);
            failure_reported = true;
        }
        if (strncmp(line, "median,3,1,", strlen("median,3,1,")) == 0) {
            assert(failure_reported);
            last_finished = true;
        }
    }
    assert(last_finished && live_blocks == 0);
    fclose(input);
    fclose(output);
}

int main(void)
{
    test_vector();
    test_lists();
    test_trace();
    test_batch();
    return 0;
}
