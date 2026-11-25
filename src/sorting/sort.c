#include "sort.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    SortMetrics *metrics;
    SortObserver observer;
    void *context;
} SortRun;

static const char *const names[] = {"insertion", "merge", "bubble", "heap", "quick", "selection"};

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

typedef struct {
    Data *data;
    Node **nodes;
    SortRun *run;
} IndexedSort;

static Item item_at(const IndexedSort *sort, size_t index)
{
    return sort->nodes == NULL ? sort->data->items[index] : sort->nodes[index]->item;
}

static bool ordered(const IndexedSort *sort, size_t left, size_t right)
{
    return less_equal(sort->run, item_at(sort, left), item_at(sort, right));
}

static void swap_at(IndexedSort *sort, size_t left, size_t right)
{
    if (left == right) {
        return;
    }
    if (sort->nodes == NULL) {
        Item item = sort->data->items[left];
        sort->data->items[left] = sort->data->items[right];
        sort->data->items[right] = item;
    } else {
        Node *node = sort->nodes[left];
        sort->nodes[left] = sort->nodes[right];
        sort->nodes[right] = node;
    }
    if (sort->run->observer != NULL) {
        sort->run->observer(sort->run->context, (SortEvent){SWAP, left, right, 0});
    }
}

static void bubble_sort(IndexedSort *sort, size_t end)
{
    while (end > 1) {
        size_t last_swap = 0;
        for (size_t right = 1; right < end; ++right) {
            if (!ordered(sort, right - 1, right)) {
                swap_at(sort, right - 1, right);
                last_swap = right;
            }
        }
        end = last_swap;
    }
}

static void selection_sort(IndexedSort *sort, size_t size)
{
    for (size_t first = 0; first + 1 < size; ++first) {
        size_t smallest = first;
        for (size_t candidate = first + 1; candidate < size; ++candidate) {
            if (!ordered(sort, smallest, candidate)) {
                smallest = candidate;
            }
        }
        swap_at(sort, first, smallest);
    }
}

static void sift_down(IndexedSort *sort, size_t root, size_t size)
{
    while (root < size / 2) {
        size_t child = root * 2 + 1;
        if (child + 1 < size && ordered(sort, child, child + 1)) {
            ++child;
        }
        if (!ordered(sort, root, child)) {
            break;
        }
        swap_at(sort, root, child);
        root = child;
    }
}

static void heap_sort(IndexedSort *sort, size_t size)
{
    for (size_t root = size / 2; root > 0; --root) {
        sift_down(sort, root - 1, size);
    }
    for (size_t end = size - 1; end > 0; --end) {
        swap_at(sort, 0, end);
        sift_down(sort, 0, end);
    }
}

static void quick_sort(IndexedSort *sort, size_t first, size_t end)
{
    while (end - first > 1) {
        size_t pivot = end - 1;
        size_t split = first;
        for (size_t index = first; index < pivot; ++index) {
            if (ordered(sort, index, pivot)) {
                swap_at(sort, index, split++);
            }
        }
        swap_at(sort, split, pivot);
        /* Recurse into the smaller partition to bound stack depth. */
        if (split - first < end - split - 1) {
            quick_sort(sort, first, split);
            first = split + 1;
        } else {
            quick_sort(sort, split + 1, end);
            end = split;
        }
    }
}

static bool sort_indexed(Data *data, Algorithm algorithm, SortRun *run)
{
    IndexedSort sort = {.data = data, .run = run};
    size_t size = data->size;
    if (data->kind != VECTOR) {
        if (size > SIZE_MAX / sizeof(*sort.nodes)) {
            return false;
        }
        sort.nodes = malloc(size * sizeof(*sort.nodes));
        if (sort.nodes == NULL) {
            return false;
        }
        run->metrics->auxiliary_bytes = size * sizeof(*sort.nodes);
        Node *node = data->head;
        for (size_t index = 0; index < size; ++index) {
            sort.nodes[index] = node;
            node = node->next;
        }
    }

    switch (algorithm) {
        case BUBBLE: bubble_sort(&sort, size); break;
        case HEAP: heap_sort(&sort, size); break;
        case QUICK: quick_sort(&sort, 0, size); break;
        case SELECTION: selection_sort(&sort, size); break;
        default: free(sort.nodes); return false;
    }

    if (sort.nodes != NULL) {
        data->head = sort.nodes[0];
        for (size_t index = 1; index < size; ++index) {
            sort.nodes[index - 1]->next = sort.nodes[index];
        }
        sort.nodes[size - 1]->next = NULL;
        restore_list_links(data);
        free(sort.nodes);
    }
    return true;
}

bool sort_data(Data *data, Algorithm algorithm, SortMetrics *metrics,
               SortObserver observer, void *observer_context)
{
    *metrics = (SortMetrics){0};
    SortRun run = {metrics, observer, observer_context};
    if (data->size < 2) {
        return true;
    }
    if (algorithm != INSERTION && algorithm != MERGE) {
        return sort_indexed(data, algorithm, &run);
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
