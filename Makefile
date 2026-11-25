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

test: all
	$(BUILD)/platform$(EXE) --help
