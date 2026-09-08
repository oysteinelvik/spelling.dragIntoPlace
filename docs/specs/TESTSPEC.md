# Curious Reader Drag Into Place
## Test Specification

**Version:** 0.2.1  
**Status:** Draft  
**Last updated:** 2026-09-08  
**Author:** GitHub Copilot  
**Verification target:** Product, development, and UI specifications in this project

## 1. Test Mission

Verify that the game is reproducible, playable, offline-compliant, packageable, accessible, and safe to release inside the Curious Reader container. Tests are derived from product requirements, engineering requirements, and UI state/acceptance criteria. The test specification supports implementation; it does not redefine behavior.

## 2. Quality Gates

A release candidate must satisfy all of the following:

- All automated unit, integration, browser, packaging, and static audit tests pass.
- All critical and high-risk manual cases pass.
- The file-origin offline run reaches a playable puzzle within 10 seconds.
- No external network request is observed during startup or gameplay.
- Engine plus one language ZIP extracts without collisions and launches.
- Native bridge envelopes are valid and browser mode is silent.
- Human security, architecture, product, and UI review is approved.
- Every implemented requirement has at least one passing test reference.

## 3. Test Data and Fixtures

| Fixture | Purpose |
|---|---|
| `valid-english` | Complete language pack with two puzzles and valid relative assets |
| `valid-secondary-language` | Confirms engine reuse and language selection |
| `missing-optional-audio` | Verifies degraded media behavior |
| `missing-required-data` | Verifies finite content error state |
| `malformed-json` | Verifies parser and validation failure handling |
| `absolute-asset-url` | Rejects CDN and root-relative paths |
| `duplicate-puzzle-id` | Rejects non-unique content |
| `corrupt-audio` | Verifies silent/no-op playback fallback |
| `storage-unavailable` | Simulates `localStorage` failure |
| `bridge-present` | Captures and validates native messages |
| `bridge-absent` | Confirms browser no-op reporting |
| `bridge-throws` | Confirms reporting cannot break gameplay |
| `query-matrix` | Valid, missing, unknown, encoded, and extra launch parameters |
| `package-collision` | Detects overwrites between engine and language ZIPs |

## 4. Unit Test Requirements

### TS-UNIT-01 URL and environment parsing

**Covers:** FR-01, PR-12, PR-17.  
Test valid, missing, encoded, duplicate, and unexpected parameters. Confirm `cr_lang`, `cr_book`, and `cr_user_id` semantics and `file:` detection.

### TS-UNIT-02 Local binary loader

**Covers:** FR-02, NFR-01, NFR-02.  
Mock XHR statuses `0`, `200`, `404`, and network error. Confirm file-origin uses XHR and never Cache Storage or `fetch`. Confirm HTTP mode follows the configured development path.

### TS-UNIT-03 Content schema validator

**Covers:** FR-03, PR-13, NFR-02.  
Accept valid English word content. Reject missing fields, malformed JSON, unknown schema version, duplicate level IDs, empty solutions, non-Roman letters, mismatched target letters, invalid foils, absolute URLs, path traversal, and missing required asset references.

### TS-UNIT-04 Puzzle state transitions

**Covers:** FR-04, PR-06 through PR-11.  
Test initial state, valid target-letter placement, incorrect target-letter return, foil removal and hint reveal, locked placed letters, tile identity, partial completion, final completion, repeated completion, next word selection, and malformed action inputs.

### TS-UNIT-05 Score and progress

**Covers:** FR-04, FR-05, KPI-04, KPI-05.  
Confirm score bounds, `max_score`, attempts, completed IDs, progress count, and deterministic results after repeated actions.

### TS-UNIT-06 Persistence adapter

**Covers:** FR-05, PR-16.  
Test save/load, version migration, malformed JSON, unavailable storage, quota failure, and namespace isolation. Confirm no user identity is generated or persisted.

### TS-UNIT-07 Media fallback

**Covers:** FR-06, PR-14, NFR-03.  
Test successful image/audio load, missing asset, corrupt audio, decode failure, and silent/no-op playback. Confirm required puzzle interaction remains available.

### TS-UNIT-07A Brief media and hint behavior

Verify word image, hint image, word audio, per-letter audio, negative feedback audio, and celebration animation paths. Confirm each optional failure degrades independently.

### TS-UNIT-08 Event envelope generation

**Covers:** FR-07, PR-17 through PR-20.  
Validate UUID v4 freshness, ISO timestamp, user ID pass-through, stable sub-app ID, allowed collections, `type` and `lang`, `max_score`, JSON serializability, and absent options for granular events.

### TS-UNIT-09 Event lifecycle deduplication

**Covers:** FR-07, KPI-06.  
Call lifecycle handlers repeatedly and confirm one event per milestone occurrence. Confirm a new occurrence receives a new UUID.

## 5. Integration Test Requirements

### TS-INT-01 Boot to first puzzle

Load the application with a valid language fixture. Confirm boot, loading, content validation, persistence initialization, and first Play state complete without a network dependency.

### TS-INT-02 Incorrect then correct placement

Start a puzzle, perform an invalid action, then a valid action. Confirm the invalid action is recoverable, the correct state is visible, score/progress are correct, and only the intended events are emitted.

### TS-INT-03 Full puzzle and session completion

Complete all fixture puzzles. Confirm completion state, persistence, event counts, score bounds, and restart/continue behavior.

### TS-INT-04 Language selection

Load two language fixtures using different `cr_lang` values. Confirm the engine is shared, text/audio paths resolve to the selected language, and unsupported language behavior is recoverable.

### TS-INT-05 Degraded dependencies

Run with absent bridge, unavailable storage, missing images, corrupt audio, and a throwing optional channel. Confirm the learner can still complete a puzzle.

### TS-INT-06 Event bridge contract

Capture each `postMessage` call. Parse the JSON string, verify exactly one envelope per message, verify top-level fields, and reject oversized or invalid payloads in the test harness. Confirm no message is sent when the bridge is absent.

## 6. Browser and File-Origin Tests

### TS-E2E-01 Browser development mode

Run the application in an HTTP development server. Verify that clicking or keyboard-activating a tile does not place it, then complete one puzzle by dragging tiles into their correct slots. Verify visible states, focus, persistence, and browser console cleanliness.

### TS-E2E-02 Direct file-origin launch

Open the built `index.html` as `file:///.../index.html?cr_lang=english&cr_user_id=test-user`. Confirm the root exists before scripts run, loading clears, local data loads, and the first puzzle is playable.

### TS-E2E-03 Offline network audit

Use a browser context with network disabled and monitor requests. Fail on any external request or any attempted URL outside `file:`, `data:`, `blob:`, or `about:`. Confirm zero CDN, analytics, feature-flag, Sentry, service-worker, WebSocket, EventSource, or remote configuration calls.

### TS-E2E-04 Touch and viewport matrix

Run at minimum one narrow portrait, one wide portrait, and one landscape viewport. Confirm no clipped slots or tiles, no overlap, stable layout during drag, readable text, visible focus, and operable primary controls.

### TS-E2E-05 Reload persistence

Complete a puzzle, reload the same file-origin URL, and confirm progress and settings restore. Repeat with malformed stored state and confirm a clean playable fallback.

### TS-E2E-06 Reduced motion and media failure

Enable reduced motion and block or corrupt optional media. Confirm animations are reduced, visual feedback remains sufficient, and the puzzle is still completable.

### TS-E2E-07 Foils and hints

Drop a foil into an answer slot. Confirm negative feedback, foil disappearance, and the matching hint reveal. Place a correct target letter and confirm positive feedback, letter audio, and locked state.

### TS-E2E-08 Moving-letter mode

Enable advanced moving mode. Confirm target letters and foils enter from the left, move right, expire within the configured lifetime, stop on tap, remain draggable after stopping, and cannot be placed outside the viewport.

## 7. Packaging and Static Audit Tests

### TS-PKG-01 Engine ZIP structure

Confirm `index.html` is at ZIP root, no `lang/` directory exists, public paths are relative, source maps are absent, and shared assets are present.

### TS-PKG-02 Language ZIP structure

Confirm one language ZIP contains only the expected `lang/<langCode>/` subtree and every referenced audio/data file is present.

### TS-PKG-03 Merge collision check

Extract engine and language packages into a clean directory with collision detection enabled. Fail if any later file overwrites an earlier file.

### TS-PKG-04 ZIP filename and icon validation

Validate `<engine>-core.zip`, `<engine>-lang-<langCode>.zip`, lowercase naming rules, square icon dimensions, true PNG signature, and no unsupported wrapper directory.

### TS-PKG-05 Relative path audit

Search emitted HTML, CSS, JavaScript, and JSON for root-relative asset paths, absolute URLs, CDN URLs, and forbidden runtime module names. Fail on any gameplay-critical match.

### TS-PKG-06 Clean-machine build

From a clean checkout and pinned dependency install, run the documented build and test commands. Confirm output can be regenerated and no undeclared local files are required.

## 8. Contract and Security Tests

- Verify no service-worker registration occurs.
- Verify `caches.open` is not invoked on file origin.
- Verify local binary loading does not use `fetch` on file origin.
- Verify `BroadcastChannel` failure is caught if used.
- Verify JSON payloads contain no `undefined`, `NaN`, `Infinity`, functions, cycles, or unbounded asset data.
- Verify `cr_user_id` is never transformed into a generated identifier.
- Verify event reporting is fire-and-forget and cannot change UI state.
- Verify ZIP paths cannot escape the extraction root.
- Verify no secrets, tokens, or credentials are packaged.

## 9. Manual Review Cases

| ID | Review |
|---|---|
| TS-MAN-01 | A child can infer the next action without technical help |
| TS-MAN-02 | Incorrect actions feel recoverable and non-punitive |
| TS-MAN-03 | Completion is obvious before the next puzzle appears |
| TS-MAN-04 | Text, target, tiles, and feedback remain readable on supported viewports |
| TS-MAN-05 | Offline startup and play do not expose network or developer errors |
| TS-MAN-06 | Content and audio quality are appropriate for the selected language |
| TS-MAN-07 | Security and privacy review approves identifiers, bridge use, and package contents |
| TS-MAN-08 | Product owner approves learning flow and release scope |

## 10. Traceability Matrix

| Requirement area | Tests |
|---|---|
| Offline runtime and paths | TS-UNIT-02, TS-E2E-02, TS-E2E-03, TS-PKG-05 |
| Content and language packs | TS-UNIT-03, TS-INT-04, TS-PKG-02 |
| Puzzle behavior | TS-UNIT-04, TS-UNIT-05, TS-INT-02, TS-INT-03 |
| Persistence | TS-UNIT-06, TS-E2E-05 |
| Media resilience | TS-UNIT-07, TS-INT-05, TS-E2E-06 |
| Brief-specific media, foils, hints, and moving mode | TS-UNIT-07A, TS-E2E-07, TS-E2E-08 |
| Event reporting | TS-UNIT-08, TS-UNIT-09, TS-INT-06 |
| UI states and accessibility | TS-E2E-01, TS-E2E-04, TS-E2E-06, TS-MAN-01 through TS-MAN-05 |
| Packaging and release | TS-PKG-01 through TS-PKG-06, TS-MAN-07 |

## 11. Test Execution Order

1. Static audits and schema validation.
2. Unit tests for pure modules.
3. Integration tests for boot, gameplay, persistence, and bridge.
4. Browser tests over HTTP.
5. Direct file-origin and offline tests.
6. Package extraction and merge tests.
7. Manual accessibility, learning, security, and architecture review.
8. Record results, open failures, and approval decision.

## 12. Task-Level Completion Record

Every task plan must name its affected requirement IDs and test IDs. Completion evidence must include the focused command, relevant regression command, results, and unresolved risks. A failing test caused by a specification defect requires an approved spec update before code is considered the source of truth.

## 13. Spec Change Process

When an approved task changes coverage, update test IDs, fixtures, expected outcomes, traceability, version, status, date, and the change log. Removed tests must be named in the completion report with the reason for removal.

## Spec Change Log

2026-09-08 — GitHub Copilot — Added regression coverage confirming click and keyboard activation cannot place letters and drag placement remains required.
2026-09-08 — GitHub Copilot — Added validation and end-to-end coverage for the downloaded brief's English word schema, foils, hints, media feedback, and moving-letter mode.
2026-09-08 — GitHub Copilot — Created the initial test specification for the Curious Reader Drag Into Place game.
