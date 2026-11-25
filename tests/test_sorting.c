#include "../src/sorting/sort.h"

#include <assert.h>
#include <limits.h>
#include <stdlib.h>

static int compare_items(const void *first, const void *second)
{
    const Item *left = first;
    const Item *right = second;
    if (left->value != right->value) {
        return (left->value > right->value) - (left->value < right->value);
    }
    return (left->id > right->id) - (left->id < right->id);
}

static void verify_case(Structure kind, Algorithm algorithm, const int *values, size_t size)
{
    Data data;
    data_init(&data, kind);
    const Node *original[8];
    Item expected[8];
    for (size_t index = 0; index < size; ++index) {
        assert(data_append(&data, values[index]));
        original[index] = data.tail;
        expected[index] = (Item){values[index], index};
    }
    qsort(expected, size, sizeof(*expected), compare_items);

    SortMetrics metrics;
    assert(sort_data(&data, algorithm, &metrics, NULL, NULL));
    assert(data.size == size && data_valid(&data));
    assert((metrics.comparisons == 0) == (size < 2));
    size_t expected_bytes = 0;
    if (size >= 2 && kind == VECTOR && algorithm == MERGE) {
        expected_bytes = size * sizeof(Item);
    } else if (size >= 2 && kind != VECTOR && algorithm >= BUBBLE) {
        expected_bytes = size * sizeof(Node *);
    }
    assert(metrics.auxiliary_bytes == expected_bytes);
    bool stable = algorithm == INSERTION || algorithm == MERGE || algorithm == BUBBLE;
    bool seen[8] = {false};
    const Node *node = data.head;
    for (size_t index = 0; index < size; ++index) {
        Item item = kind == VECTOR ? data.items[index] : node->item;
        assert(item.value == expected[index].value);
        assert(item.id < size && !seen[item.id] && item.value == values[item.id]);
        seen[item.id] = true;
        assert(!stable || item.id == expected[index].id);
        if (node != NULL) {
            assert(node == original[item.id]);
            node = node->next;
        }
    }
    data_destroy(&data);
}

int main(void)
{
    const int cases[][8] = {
        {0}, {1}, {1, 2, 3, 4}, {4, 3, 2, 1},
        {3, 3, 1, 2, 1, 3}, {-1, INT_MIN, 3, -2, 0, INT_MAX, -1}
    };
    const size_t sizes[] = {0, 1, 4, 4, 6, 7};
    for (Structure kind = VECTOR; kind < STRUCTURE_COUNT; ++kind) {
        for (Algorithm algorithm = INSERTION; algorithm < ALGORITHM_COUNT; ++algorithm) {
            for (size_t test = 0; test < sizeof(sizes) / sizeof(*sizes); ++test) {
                verify_case(kind, algorithm, cases[test], sizes[test]);
            }
        }
    }
    return 0;
}
