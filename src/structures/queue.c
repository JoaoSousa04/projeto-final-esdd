#include "queue.h"
#include <stdlib.h>

struct TaskNode {
    Task task;
    TaskNode *next;
};

bool queue_push(TaskQueue *queue, Task task)
{
    TaskNode *node = malloc(sizeof(*node));
    if (node == NULL) {
        return false;
    }
    *node = (TaskNode){.task = task};
    if (queue->tail == NULL) {
        queue->head = node;
    } else {
        queue->tail->next = node;
    }
    queue->tail = node;
    return true;
}

bool queue_pop(TaskQueue *queue, Task *task)
{
    TaskNode *node = queue->head;
    if (node == NULL) {
        return false;
    }
    *task = node->task;
    queue->head = node->next;
    if (queue->head == NULL) {
        queue->tail = NULL;
    }
    free(node);
    return true;
}

void queue_clear(TaskQueue *queue)
{
    Task task;
    while (queue_pop(queue, &task)) {
    }
}
