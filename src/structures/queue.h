#ifndef PLATFORM_QUEUE_H
#define PLATFORM_QUEUE_H

#include "../benchmark/benchmark.h"

typedef struct TaskNode TaskNode;

typedef struct {
    TaskNode *head;
    TaskNode *tail;
} TaskQueue;

bool queue_push(TaskQueue *queue, Task task);
bool queue_pop(TaskQueue *queue, Task *task);
void queue_clear(TaskQueue *queue);

#endif
