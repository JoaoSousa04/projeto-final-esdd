#include "../src/structures/data.h"

#include <assert.h>

int main(void)
{
    for (Structure kind = VECTOR; kind < STRUCTURE_COUNT; ++kind) {
        Data data;
        data_init(&data, kind);
        assert(data_valid(&data));
        assert(data_bytes(&data) == 0);
        for (int value = 0; value < 100; ++value) {
            assert(data_append(&data, -value));
            assert(data_valid(&data));
        }
        assert(data.size == 100);
        const Node *node = data.head;
        for (size_t index = 0; index < data.size; ++index) {
            Item item = kind == VECTOR ? data.items[index] : node->item;
            assert(item.id == index && item.value == -(int)index);
            if (node != NULL) {
                node = node->next;
            }
        }
        assert(node == (kind == CIRCULAR ? data.head : NULL));
        assert(data_bytes(&data) >= 100 * sizeof(Item));
        data_destroy(&data);
        assert(data_valid(&data) && data.size == 0 && data_bytes(&data) == 0);
        data_destroy(&data);
    }
    return 0;
}
