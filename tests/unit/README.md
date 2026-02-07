# Nexical Core Unit Testing

This directory contains unit tests for the Nexical Ecosystem core located in `src/`.

## Philosophy

Unit tests in Nexical should:

- Be **Fast**: They should execute in milliseconds.
- Be **Isolated**: No network calls, database interaction, or file system access (unless using a memory-only provider).
- Be **Predictable**: Given the same input, they always produce the same output.
- Target **Business Logic**: Focus on utility functions, state management, and core services.

> [!IMPORTANT]
> **CRITICAL RULE**: Unit tests MUST follow the exact same folder structure as the `src/` files being tested.
> For example:
>
> - `src/lib/core/config.ts` -> `tests/unit/lib/core/config.test.ts`
> - `src/middleware.ts` -> `tests/unit/middleware.test.ts`

## Running Tests

To run all unit tests:

```bash
npm run test:unit
```

To run tests with coverage:

```bash
npx vitest run -c vitest.unit.config.ts --coverage
```

## Directory Structure

- `tests/unit/core`: Tests for core system logic.
- `tests/unit/lib`: Tests for utility functions in `src/lib`.
- `tests/unit/hooks`: Tests for React/Astro hooks.
- `tests/unit/helpers.ts`: Shared testing utilities and mocks.

## Mocking Strategy

We use `vitest`'s built-in mocking capabilities. For core services:

- Mock dependencies using `vi.mock()`.
- Use the helpers in `tests/unit/helpers.ts` for common patterns.

## Coverage Requirements

We aim for **>80%** line and function coverage for the core library. Coverage reports are generated in the `coverage/` directory.
