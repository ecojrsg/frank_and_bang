---
name: hackjs
description: "Use when writing, modifying, reviewing, documenting, or refactoring JavaScript or TypeScript in this repository. Apply standard JS/TS best practices, JSDoc/TSDoc in English, confirm the header author, detect the language of user-facing strings, consider standard web/Node APIs and justified packages, and keep functions short, focused, and easy for software engineering students to understand."
---

# Hackjs: Clear JavaScript and TypeScript for Students

Write JavaScript and TypeScript that a software engineering student can
understand without decoding clever tricks. Correctness comes first; optimize
for readability, one responsibility per function, and the fewest useful lines
of executable code. Fewer lines are not an improvement if they make the code
harder to read.

## Workflow

1. Read the request, requirements, design diagrams, existing types, callers,
   and applicable tests. Identify the runtime environment (browser, Next.js
   Server Component, Route Handler, or Node script) and TypeScript config.
2. Before a task that writes or modifies JS/TS source files, confirm the human
   author's name. A name explicitly supplied for this task is confirmation;
   otherwise ask: "What name should I use for the code header in this task?"
   Ask once per task, not once per file. Never infer the answer from old
   headers, Git configuration, a username, or a previous task. Wait for the
   answer before writing implementation code. Read-only reviews do not need
   this question, and do not persist the answer as the skill's default author.
3. Identify the application's language from the user's requirements, existing
   interface text, localization resources, and project documentation. If it is
   unspecified, mixed without an established localization policy, or ambiguous,
   ask before adding user-facing text. Do not ask about an application language
   for a task that has no user-facing text.
4. Choose the simplest appropriate solution and libraries using the rules
   below. Explain and request approval for a new dependency before adding or
   installing it; do not change `package.json` or lockfiles on a proposal
   alone.
5. Write English identifiers and documentation, appropriate file headers and
   JSDoc/TSDoc comments, and focused single-responsibility functions. Preserve
   existing behavior unless a behavior change was requested.
6. Run the relevant checks (`tsc --noEmit`, lint, tests) and complete the
   final checklist. Report what changed, what was verified, and any remaining
   uncertainty briefly.

## 1. JavaScript & TypeScript Conventions

### Coding conventions

- Use two spaces per indentation level; never mix tabs and spaces.
- Use `camelCase` for variables, functions, parameters, and methods;
  `PascalCase` for classes, React components, types, and interfaces; and
  `UPPER_SNAKE_CASE` for module-level constants.
- Choose short, descriptive English names such as `totalDamage`, `playerId`,
  and `partCount`. Avoid opaque abbreviations and generic names such as `tmp`
  or `data` when a more specific name is available. Short mathematical names
  (`x`, `y`, `vx`, `vy`, `dt`) are acceptable in physics and geometry code.
- Prefer `const` by default and `let` only when reassignment is necessary.
  Never use `var`.
- Use strict equality (`===` and `!==`) everywhere. Check nullable values
  explicitly (`value === null`, `value === undefined`, or `value == null` only
  when intentionally matching both).
- Group imports in order: external packages, internal aliased modules (`@/`),
  then relative modules, separated by a blank line. Avoid unused imports and
  wildcard imports unless required by an external API.
- Keep lines readable (target 80-100 characters) and let the project linter
  or formatter govern minor wrapping without competing styles.
- Avoid `any` in TypeScript. Use explicit interfaces, discriminated unions,
  and `unknown` (narrowed with type guards or Zod schemas) at system
  boundaries (HTTP requests, database rows, Realtime payloads).
- Never swallow errors with empty `catch {}` blocks. Handle specific failure
  cases cleanly and surface safe, actionable messages.
- Preserve public APIs, database column contracts, protocol event names, and
  assignment-required identifiers. Do not rename a contract merely for style.

### Where to look when unsure

Start with local design docs, TypeScript definitions, existing helpers, and
tests. Then consult official documentation for the installed version:

- [MDN Web Docs (JavaScript & Web APIs)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TSDoc / JSDoc Reference](https://tsdoc.org/)
- Official documentation for Next.js, React, Vitest, Zod, and Supabase JS.

Verify edge cases with focused unit tests rather than guessing runtime
behavior.

## 2. English Code, Headers, and Documentation

### Language boundary

- Write all new or materially changed identifiers, comments, JSDoc/TSDoc
  blocks, internal log messages, and technical documentation in **English**.
- Only user-facing text follows the application's language (for example,
  Spanish labels, buttons, notifications, HUD banners, and user-visible error
  messages).
- Do not translate file paths, URLs, SQL column names, Realtime event names,
  or JSON/API protocol keys. Preserve proper names and authors' names.

### File headers

For each new handwritten `.ts`, `.tsx`, `.js`, or `.mjs` source file, place
this header at the top (after any `"use client";` or `"use server";` directive
when Next.js requires the directive on line 1, or directly on line 1 for
regular modules), followed by a concise English module JSDoc comment:

```ts
// @Author: <confirmed author>
// @Date:   <actual creation timestamp>
// @Last Modified by:   <confirmed author>
// @Last Modified time: <actual modification timestamp>

/**
 * Describe the module's purpose in English.
 */
```

- Replace placeholders with the confirmed author name and actual clock times
  in `YYYY-MM-DD HH:MM:SS` format. Never copy historical timestamps or invent
  creation dates.
- Note for Next.js App Router: `"use client";` and `"use server";` directives
  must remain the first executable statement of the file; placing the `//`
  header comments immediately above or below the directive is valid, and
  placing `"use client";` on line 1 guarantees full bundler compatibility.
- When editing an existing file, preserve its original `@Author` and `@Date`.
  Update `@Last Modified by` and `@Last Modified time` with the confirmed name
  and actual edit time.
- Preserve copyright, license, or third-party provenance notices in vendored
  or supplied files.
- Do not add this JS/TS header to Markdown, JSON, CSS, or generated files.

### JSDoc / TSDoc and comments

- Document every exported function, method, class, component, and non-trivial
  helper created or materially changed using `/** ... */`.
- For a simple function, prefer one short imperative English sentence ending
  in a period: `/** Return the effective damage after defense mitigation. */`.
- For non-obvious contracts, include a summary, a blank line, and only the
  relevant `@param`, `@returns`, and `@throws` tags. Do not repeat obvious
  TypeScript types inside JSDoc tags or add empty boilerplate sections.
- Comments explain **why** a decision, formula, constraint, or workaround
  exists, not what an obvious line does. Keep comments in complete English
  sentences and remove stale or commented-out code.

## 3. Small Functions and Appropriate Libraries

### Do not reinvent the wheel

Consider built-in JavaScript/Web/Node APIs (`Map`, `Set`, `URL`, `crypto`,
`Array.prototype` helpers), already installed packages, and maintained
external libraries before writing custom utilities.

- Propose a new external package only when it eliminates substantial custom
  code or handles security/validation/protocol concerns more reliably.
- Explain the problem it solves, the readability benefit, and the dependency
  cost before adding it. Never add speculative dependencies for unused future
  features.

### One responsibility, few useful lines

- Describe each function's responsibility in one short sentence. If that
  sentence combines independent jobs, split them into focused functions. Thin
  orchestration functions may compose small pure steps.
- Always prefer explicit named functions for reusable logic and clear early
  returns to reduce nesting.
- Prefer boring, explicit control flow over nested ternaries, dense chained
  reducers, dynamic property tricks, or clever one-liners.
- Avoid artificial helper fragmentation and unnecessary abstraction layers
  (unused factories, redundant wrappers, speculative generic frameworks).
- Keep pure domain logic free of framework, DOM, or database side effects so
  it stays simple to read and test directly with unit tests.

## Final Checklist

Before delivering JavaScript or TypeScript changes, verify:

- The human author was confirmed for this task, headers use real timestamps,
  and original attribution remains intact.
- Identifiers, comments, and JSDoc/TSDoc are in English; user-facing UI text
  matches the application's language.
- Every function has one clear responsibility and no unnecessary executable
  lines. A software engineering student can trace it directly.
- Any new dependency was approved before modifying `package.json`.
- TypeScript compiles cleanly (`tsc --noEmit`), lint checks pass, and unit
  tests covering changed domain logic pass.
- No unrelated contracts, schemas, or files were broken.
