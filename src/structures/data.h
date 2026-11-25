#ifndef PLATFORM_DATA_H
#define PLATFORM_DATA_H

#include <stdbool.h>
#include <stddef.h>

typedef enum { VECTOR, SINGLY, DOUBLY, CIRCULAR, STRUCTURE_COUNT } Structure;

typedef struct {
    int value;
    size_t id;
} Item;

typedef struct Node {
    Item item;
    struct Node *next;
} Node;

typedef struct {
    Node node;
    Node *prev;
} DoubleNode;

typedef struct {
    Structure kind;
    size_t size;
    size_t capacity;
    Item *items;
    Node *head;
    Node *tail;
} Data;

void data_init(Data *data, Structure kind);
bool data_append(Data *data, int value);
void data_destroy(Data *data);
bool data_valid(const Data *data);
size_t data_bytes(const Data *data);
size_t data_node_bytes(Structure kind);
const char *structure_name(Structure kind);
bool structure_parse(const char *name, Structure *kind);

#endif
