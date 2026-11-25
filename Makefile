CC = gcc
CFLAGS = -O2
WARNINGS = -std=c11 -Wall -Wextra -Wpedantic
BUILD = build
NODE = node

ifeq ($(OS),Windows_NT)
EXE = .exe
MKBUILD = mkdir "$(BUILD)"
else
MKBUILD = mkdir -p "$(BUILD)"
endif

DATA = src/structures/data.c src/structures/data.h
SORT = src/sorting/sort.c src/sorting/sort.h
BENCH = src/benchmark/benchmark.c src/benchmark/benchmark.h src/structures/queue.c src/structures/queue.h
TRACE = src/trace/trace.c src/trace/trace.h src/structures/history.c src/structures/history.h

.PHONY: all test test-integration
all: $(BUILD)/platform$(EXE)

$(BUILD):
	$(MKBUILD)

$(BUILD)/platform$(EXE): src/main.c $(DATA) $(SORT) $(BENCH) $(TRACE) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

$(BUILD)/test_structures$(EXE): tests/test_structures.c $(DATA) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

$(BUILD)/test_sorting$(EXE): tests/test_sorting.c $(DATA) $(SORT) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

$(BUILD)/test_benchmark$(EXE): tests/test_benchmark.c $(DATA) $(SORT) $(BENCH) $(TRACE) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

$(BUILD)/test_trace$(EXE): tests/test_trace.c $(DATA) $(SORT) $(TRACE) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

test: all $(BUILD)/test_structures$(EXE) $(BUILD)/test_sorting$(EXE) $(BUILD)/test_benchmark$(EXE) $(BUILD)/test_trace$(EXE) $(BUILD)/test_allocation$(EXE)
	$(BUILD)/platform$(EXE) --help
	$(BUILD)/test_structures$(EXE)
	$(BUILD)/test_sorting$(EXE)
	$(BUILD)/test_benchmark$(EXE)
	$(BUILD)/test_trace$(EXE)
	$(BUILD)/test_allocation$(EXE)

test-integration: test
	$(NODE) tests/test_integration.mjs $(BUILD)/platform$(EXE)
	$(NODE) tests/test_server.mjs $(BUILD)/platform$(EXE)

$(BUILD)/test_allocation$(EXE): tests/test_allocation.c tests/alloc_hooks.h $(DATA) $(SORT) $(BENCH) $(TRACE) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -include tests/alloc_hooks.h -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)
