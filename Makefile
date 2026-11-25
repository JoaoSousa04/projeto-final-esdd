CC = gcc
CFLAGS = -O2
WARNINGS = -std=c11 -Wall -Wextra -Wpedantic
BUILD = build

ifeq ($(OS),Windows_NT)
EXE = .exe
MKBUILD = if not exist "$(BUILD)" mkdir "$(BUILD)"
else
MKBUILD = mkdir -p "$(BUILD)"
endif

.PHONY: all test
all: $(BUILD)/platform$(EXE)

$(BUILD):
	$(MKBUILD)

$(BUILD)/platform$(EXE): src/main.c Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ src/main.c $(LDFLAGS) $(LDLIBS)

test: all $(BUILD)/test_structures$(EXE) $(BUILD)/test_sorting$(EXE)
	$(BUILD)/platform$(EXE) --help
	$(BUILD)/test_structures$(EXE)
	$(BUILD)/test_sorting$(EXE)

$(BUILD)/test_structures$(EXE): tests/test_structures.c src/structures/data.c src/structures/data.h Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)

DATA = src/structures/data.c src/structures/data.h
SORT = src/sorting/sort.c src/sorting/sort.h

$(BUILD)/test_sorting$(EXE): tests/test_sorting.c $(DATA) $(SORT) Makefile | $(BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(WARNINGS) -o $@ $(filter %.c,$^) $(LDFLAGS) $(LDLIBS)
