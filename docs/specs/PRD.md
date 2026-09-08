# Curious Reader Drag Into Place
## Product Requirements Document

**Version:** 0.2.0  
**Status:** Draft  
**Last updated:** 2026-09-08  
**Author:** GitHub Copilot  
**Product type:** Offline-first literacy game for the Curious Reader container

## 1. Product Summary

Curious Reader Drag Into Place is a self-contained English-language literacy game that helps children practice spelling by dragging target letters into the correct positions in a word. Incorrect letter alternatives, called foils, provide discrimination practice. The game runs inside the Curious Reader mobile application, including when the device has no network connection.

The product is delivered as an engine package plus one language package per supported language. The game must also remain playable in a normal desktop browser for development and QA.

## 2. Problem and Opportunity

Children need short, repeatable literacy activities that work in classrooms and homes with unreliable connectivity. Existing web experiences often assume a server, external analytics, or a persistent network. This product makes the learning interaction local and immediate while allowing the Curious Reader container to collect offline events through its native bridge.

## 3. Goals

- Provide a simple, understandable drag-and-drop spelling activity for early readers.
- Reach a playable state without network access or remote services.
- Support language-specific word, image, and audio content without rebuilding the engine.
- Provide immediate feedback and a clear path through a session.
- Present a picture clue for the target word and optional positional hint images.
- Provide target letters and incorrect foil letters from JSON content.
- Persist local progress and settings across reloads.
- Report meaningful learning milestones through the Curious Reader `cr_event` bridge without game-side networking.
- Produce packages that can be uploaded, extracted, and launched by the Curious Reader CMS and mobile WebView.

## 4. Success Measures

| ID | Measure | Target |
|---|---|---|
| KPI-01 | Offline launch | Playable within 10 seconds from a local `file://` URL |
| KPI-02 | Offline network activity | Zero external requests during startup or play |
| KPI-03 | Session completion | A child can complete a configured activity without adult intervention |
| KPI-04 | Interaction correctness | Correct placements are accepted; incorrect placements never corrupt the puzzle |
| KPI-05 | Persistence | Progress and settings survive a reload in the same local origin |
| KPI-06 | Event integrity | Each milestone produces at most one valid bridge envelope |
| KPI-07 | Package integrity | Engine and language packages merge without overwrites and launch from the documented URL |
| KPI-08 | Accessibility of interaction | Core activity is operable with pointer, touch, and keyboard-equivalent controls where supported |

## 5. Users and Personas

### 5.1 Learner

A young child developing letter-sound and spelling skills. The learner needs large targets, low reading burden, immediate feedback, forgiving recovery from mistakes, and a visible sense of progress.

### 5.2 Facilitator or caregiver

An adult who launches the activity, selects the available language or book context, and expects the game to work without configuration or connectivity. The facilitator needs predictable startup, no confusing error screens, and reliable progress persistence.

### 5.3 Content author

A person who supplies language data, images, and audio. The author needs a stable schema, relative asset paths, package rules, and deterministic validation.

### 5.4 Developer and QA engineer

A contributor who must be able to reproduce the product from the repository, run it offline, inspect events, build ZIPs, and validate behavior against explicit acceptance criteria.

## 6. Core User Journey

1. The container opens the game with `cr_lang` and `cr_user_id`, and optionally `cr_book`.
2. The game loads local engine and language assets.
3. The learner sees an activity introduction or the next available puzzle.
4. The learner drags or selects letter tiles into the matching slots.
5. The game gives immediate correct or incorrect feedback without blocking on audio or network.
6. A completed puzzle advances the session and records a milestone.
7. Completion shows a clear result and a way to continue or finish.
8. Progress and settings are stored locally. The container receives event envelopes through the native bridge when available.

## 7. Product Requirements

### 7.1 Runtime and offline behavior

- **PR-01:** The game shall run from a local `file://` URL in an embedded WebView.
- **PR-02:** All gameplay-critical assets shall be local and referenced with relative paths.
- **PR-03:** The game shall not require network access, a service worker, a server, a cache API, or an external SDK to reach playable state.
- **PR-04:** A missing optional asset shall not strand the loading screen; the product shall continue with a visible or silent fallback.
- **PR-05:** The game shall support a plain browser mode with no native bridge and no bridge errors.

### 7.2 Learning interaction

- **PR-06:** A puzzle shall present an image clue, the target word as empty slots, and a set of target letter tiles plus JSON-defined foils.
- **PR-07:** The learner shall be able to place a tile in a valid empty slot using drag and drop or an equivalent selection action.
- **PR-08:** The game shall identify correct and incorrect placement deterministically from the active puzzle data.
- **PR-09:** Incorrect target-letter placement shall play negative feedback and return the letter to a random on-screen location without allowing it off-screen.
- **PR-10:** Dropping a foil shall play negative feedback, remove the foil, and reveal the corresponding hint image when hints are enabled.
- **PR-10A:** A correctly placed letter shall become unavailable for dragging, play positive feedback, and pronounce the letter in word context.
- **PR-10B:** Completing a word shall play a celebration, pronounce the full word, and select a new target word.
- **PR-11:** The activity shall expose current progress within the active session.

### 7.3 Language and content

- **PR-12:** The selected language shall be read from `cr_lang`; it shall not be hardcoded as the only supported language.
- **PR-13:** Language packs shall contain all text and per-language audio required by their puzzles.
- **PR-14:** Audio and image failures shall not make the activity unplayable.
- **PR-15:** Content authors shall be able to add a language pack without changing engine code.

### 7.4 Persistence and reporting

- **PR-16:** Progress, scores, and settings shall be persisted in `localStorage` where supported.
- **PR-17:** The game shall read `cr_user_id` as an opaque value and shall send an empty string when it is absent.
- **PR-18:** In the container, meaningful milestones shall be reported as `cr_event` envelopes using the native bridge.
- **PR-19:** Outside the container, reporting shall silently no-op.
- **PR-20:** Reporting shall never block, retry, batch, or determine gameplay state.

### 7.5 Delivery

- **PR-21:** The engine package shall contain the entry point at ZIP root and shall contain no language directory.
- **PR-22:** Each language package shall contain only its language subtree and required language assets.
- **PR-23:** Packages shall follow the registered engine and language naming conventions.
- **PR-24:** A tile icon supplied with each language package shall be a true square PNG.

## 8. Non-Goals

- Online multiplayer or server-backed gameplay.
- Remote content downloads during play.
- Game-side analytics SDKs, advertising, social sharing, or user accounts.
- A general-purpose authoring CMS.
- Replacing the Curious Reader container, its manifest service, or its offline sync layer.
- IndexedDB-backed synchronization.
- Service-worker-based caching.
- High-frequency telemetry such as per-frame or per-tap event streams.

## 9. Scope and Milestones

### Milestone 1: Engine shell

Local boot, URL parameter parsing, loading states, one hardcoded development puzzle, basic persistence, and browser fallback.

### Milestone 2: Core interaction

Reusable puzzle state, tile placement, correction behavior, progress display, completion, keyboard/touch support, and audio/image fallbacks.

### Milestone 3: Content and packaging

Language schema, relative asset loading, language package build, engine package build, icon validation, and ZIP merge verification.

### Milestone 4: Reporting and release validation

Native event bridge, deduplication-safe payload generation, offline test protocol, full regression suite, human security and architecture review, and release approval.

## 10. Product Acceptance Gate

The product is ready for implementation completion when all product requirements have linked passing tests, the offline load test passes from `file://`, the engine and one language package merge and launch successfully, no external request is observed, and a human reviewer approves behavior, packaging, privacy, and architecture.

## 11. Spec Change Process

Approved changes are made deliberately after a task is implemented and tested. The change must update the version, status, last-updated date, and the change log. Any change to product behavior must also update the corresponding engineering, UI, and testing requirements before the next task is planned.

## Spec Change Log

2026-09-08 — GitHub Copilot — Aligned the product requirements with the downloaded Drag Into Place brief, adding English spelling, foils, hints, media feedback, and bounded letter placement behavior.
2026-09-08 — GitHub Copilot — Created the initial product requirements for the Curious Reader Drag Into Place game.
