#include "data.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static const char *const names[] = {"vector", "singly", "doubly", "circular"};

const char *structure_name(Structure kind)
{
    return names[kind];
}

bool structure_parse(const char *name, Structure *kind)
{
    for (Structure candidate = VECTOR; candidate < STRUCTURE_COUNT; ++candidate) {
        if (strcmp(name, names[candidate]) == 0) {
            *kind = candidate;
            return true;
        }
    }
    return false;
}

void data_init(Data *data, Structure kind)
{
    *data = (Data){.kind = kind};
}

static bool vector_grow(Data *data)
{
    const size_t limit = SIZE_MAX / sizeof(Item);
    if (data->capacity == limit) {
        return false;
    }
    size_t capacity = 8;
    if (data->capacity != 0) {
        capacity = data->capacity > limit / 2 ? limit : data->capacity * 2;
    }
    Item *items = realloc(data->items, capacity * sizeof(*items));
    if (items == NULL) {
        return false;
    }
    data->items = items;
    data->capacity = capacity;
    return true;
}

size_t data_node_bytes(Structure kind)
{
    return kind == DOUBLY ? sizeof(DoubleNode) : sizeof(Node);
}

bool data_append(Data *data, int value)
{
    Item item = {value, data->size};
    if (data->kind == VECTOR) {
        if (data->size == data->capacity && !vector_grow(data)) {
            return false;
        }
        data->items[data->size] = item;
    } else {
        Node *node = malloc(data_node_bytes(data->kind));
        if (node == NULL) {
            return false;
        }
        *node = (Node){.item = item};
        if (data->kind == DOUBLY) {
            ((DoubleNode *)node)->prev = data->tail;
        }
        if (data->tail == NULL) {
            data->head = node;
        } else {
            data->tail->next = node;
        }
        data->tail = node;
        if (data->kind == CIRCULAR) {
            node->next = data->head;
        }
    }
    ++data->size;
    return true;
}

void data_destroy(Data *data)
{
    if (data->kind == CIRCULAR && data->tail != NULL) {
        data->tail->next = NULL;
    }
    Node *node = data->head;
    while (node != NULL) {
        Node *next = node->next;
        free(node);
        node = next;
    }
    free(data->items);
    data_init(data, data->kind);
}

bool data_valid(const Data *data)
{
    if (data->kind == VECTOR) {
        return data->size <= data->capacity &&
               (data->capacity == 0) == (data->items == NULL);
    }
    const Node *previous = NULL;
    const Node *node = data->head;
    for (size_t index = 0; index < data->size; ++index) {
        if (node == NULL || (index != 0 && node == data->head)) {
            return false;
        }
        if (data->kind == DOUBLY && ((const DoubleNode *)node)->prev != previous) {
            return false;
        }
        previous = node;
        node = node->next;
    }
    return previous == data->tail &&
           node == (data->kind == CIRCULAR ? data->head : NULL) &&
           (data->size != 0 || data->head == NULL);
}

size_t data_bytes(const Data *data)
{
    if (data->kind == VECTOR) {
        return data->capacity * sizeof(Item);
    }
    return data->size * data_node_bytes(data->kind);
}
