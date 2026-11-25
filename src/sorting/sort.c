#include "sort.h"

#include <stdlib.h>
#include <string.h>

typedef struct {
    SortMetrics *metrics;
    SortObserver observer;
    void *context;
} SortRun;

static const char *const names[] = {"insertion", "merge"};

const char *algorithm_name(Algorithm algorithm)
{
    return names[algorithm];
}

bool algorithm_parse(const char *name, Algorithm *algorithm)
{
    for (Algorithm candidate = INSERTION; candidate < ALGORITHM_COUNT; ++candidate) {
        if (strcmp(name, names[candidate]) == 0) {
            *algorithm = candidate;
            return true;
        }
    }
    return false;
}

static bool less_equal(SortRun *run, Item left, Item right)
{
    ++run->metrics->comparisons;
    if (run->observer != NULL) {
        run->observer(run->context, (SortEvent){COMPARE, left.id, right.id, 0});
    }
    return left.value <= right.value;
}

static void record_move(SortRun *run, size_t from, size_t to, Item item)
{
    if (run->observer != NULL && from != to) {
        run->observer(run->context, (SortEvent){MOVE, from, to, item.id});
    }
}

static void insertion_vector(Item *items, size_t size, SortRun *run)
{
    for (size_t index = 1; index < size; ++index) {
        Item item = items[index];
        size_t position = index;
        while (position != 0 && !less_equal(run, items[position - 1], item)) {
            items[position] = items[position - 1];
            --position;
        }
        items[position] = item;
        record_move(run, index, position, item);
    }
}

static void merge_vector(Item *items, Item *scratch, size_t start, size_t end,
                         SortRun *run)
{
    if (end - start < 2) {
        return;
    }
    size_t middle = start + (end - start) / 2;
    merge_vector(items, scratch, start, middle, run);
    merge_vector(items, scratch, middle, end, run);
    memcpy(scratch + start, items + start, (end - start) * sizeof(*items));

    size_t left = start;
    size_t right = middle;
    for (size_t output = start; output < end; ++output) {
        if (right == end || (left < middle && less_equal(run, scratch[left], scratch[right]))) {
            items[output] = scratch[left++];
        } else {
            Item item = scratch[right++];
            items[output] = item;
            record_move(run, output + (middle - left), output, item);
        }
    }
}

static Node *insertion_list(Node *first, SortRun *run)
{
    Node *sorted = first;
    Node *pending = first->next;
    first->next = NULL;
    for (size_t index = 1; pending != NULL; ++index) {
        Node *node = pending;
        pending = pending->next;
        Node **position = &sorted;
        size_t rank = 0;
        while (*position != NULL && less_equal(run, (*position)->item, node->item)) {
            position = &(*position)->next;
            ++rank;
        }
        node->next = *position;
        *position = node;
        record_move(run, index, rank, node->item);
    }
    return sorted;
}

static Node *merge_lists(Node *left, Node *right, size_t remaining_left,
                         size_t offset, SortRun *run)
{
    Node *head = NULL;
    Node **next = &head;
    while (left != NULL && right != NULL) {
        if (less_equal(run, left->item, right->item)) {
            *next = left;
            left = left->next;
            --remaining_left;
        } else {
            *next = right;
            record_move(run, offset + remaining_left, offset, right->item);
            right = right->next;
        }
        next = &(*next)->next;
        ++offset;
    }
    *next = left != NULL ? left : right;
    return head;
}

static Node *merge_list(Node *head, size_t size, size_t offset, SortRun *run)
{
    if (size < 2) {
        return head;
    }
    size_t left_size = size / 2;
    Node *split = head;
    for (size_t index = 1; index < left_size; ++index) {
        split = split->next;
    }
    Node *right = split->next;
    split->next = NULL;
    Node *left = merge_list(head, left_size, offset, run);
    right = merge_list(right, size - left_size, offset + left_size, run);
    return merge_lists(left, right, left_size, offset, run);
}

static void restore_list_links(Data *data)
{
    Node *previous = NULL;
    for (Node *node = data->head; node != NULL; node = node->next) {
        if (data->kind == DOUBLY) {
            ((DoubleNode *)node)->prev = previous;
        }
        previous = node;
    }
    data->tail = previous;
    if (data->kind == CIRCULAR && previous != NULL) {
        data->tail->next = data->head;
    }
}

bool sort_data(Data *data, Algorithm algorithm, SortMetrics *metrics,
               SortObserver observer, void *observer_context)
{
    *metrics = (SortMetrics){0};
    SortRun run = {metrics, observer, observer_context};
    if (data->size < 2) {
        return true;
    }
    if (data->kind != VECTOR) {
        data->tail->next = NULL;
        data->head = algorithm == INSERTION
            ? insertion_list(data->head, &run)
            : merge_list(data->head, data->size, 0, &run);
        restore_list_links(data);
    } else if (algorithm == INSERTION) {
        insertion_vector(data->items, data->size, &run);
    } else {
        Item *scratch = malloc(data->size * sizeof(*scratch));
        if (scratch == NULL) {
            return false;
        }
        metrics->auxiliary_bytes = data->size * sizeof(*scratch);
        merge_vector(data->items, scratch, 0, data->size, &run);
        free(scratch);
    }
    return true;
}
