#include "../src/benchmark/benchmark.h"
#include "../src/structures/queue.h"

#include <assert.h>
#include <string.h>

static void test_queue(void)
{
    TaskQueue queue = {0};
    Task task;
    assert(!queue_pop(&queue, &task));
    for (size_t id = 1; id <= 3; ++id) {
        assert(queue_push(&queue, (Task){.id = id}));
    }
    for (size_t id = 1; id <= 3; ++id) {
        assert(queue_pop(&queue, &task));
        assert(task.id == id);
    }
    assert(queue.head == NULL && queue.tail == NULL);
    assert(queue_push(&queue, (Task){.id = 4}));
    queue_clear(&queue);
    assert(!queue_pop(&queue, &task));
}

int main(void)
{
    test_queue();

    FILE *input = tmpfile();
    FILE *output = tmpfile();
    assert(input != NULL && output != NULL);
    fputs("merge vector 10 reverse 42 3\ninvalid\ninsertion circular 10 reverse 42 3\n", input);
    rewind(input);
    assert(benchmark_batch(input, output) == 1);
    rewind(output);
    char line[256];
    size_t next_task = 1;
    size_t medians = 0;
    while (fgets(line, sizeof(line), output) != NULL) {
        size_t id;
        size_t runs;
        if (sscanf(line, "task,%zu,", &id) == 1) {
            assert(id == next_task++);
            if (id == 2) {
                assert(strstr(line, "invalid") != NULL);
            }
        }
        if (sscanf(line, "median,%zu,%zu", &id, &runs) == 2) {
            assert(runs == 3);
            ++medians;
        }
    }
    assert(next_task == 4 && medians == 2);
    fclose(input);
    fclose(output);

    output = tmpfile();
    assert(output != NULL);
    assert(benchmark_all((InputConfig){32, DUPLICATES, 0, 2}, output) == 0);
    rewind(output);
    next_task = 1;
    medians = 0;
    while (fgets(line, sizeof(line), output) != NULL) {
        size_t id;
        size_t runs;
        if (sscanf(line, "task,%zu,", &id) == 1) {
            assert(id == next_task++);
        }
        if (sscanf(line, "median,%zu,%zu", &id, &runs) == 2) {
            assert(runs == 2);
            ++medians;
        }
    }
    assert(next_task == 9 && medians == 8);
    fclose(output);
    return 0;
}
