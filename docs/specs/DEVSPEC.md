# Curious Reader Drag Into Place
## Development Specification

**Version:** 0.2.1  
**Status:** Draft  
**Last updated:** 2026-09-08  
**Author:** GitHub Copilot  
**Source of behavior:** Product requirements in this project

## 1. Engineering Contract

This document defines the system behavior, data contracts, implementation order, architecture, and non-functional constraints for the product. The UI specification owns visual presentation and screen-level visibility. The test specification owns verification procedures and test cases. When a task changes behavior, update this document first, then update affected UI and test requirements before implementation continues.

## 2. System Context

The game is a static web application loaded from `file://.../index.html` by an Android or iOS WebView. The container extracts an engine ZIP and one language ZIP into a shared directory, then appends query parameters. The game has no server dependency.

Supported launch parameters:

| Parameter | Required | Behavior |
|---|---:|---|
| `cr_lang` | Yes | Selects the language pack; missing or unknown values use the configured fallback and expose a load error state |
| `cr_book` | No | Reserved for a future or 3-tier content context; the value is treated as opaque |
| `cr_user_id` | No | Passed unchanged to event envelopes; absent means empty string |

## 3. Functional Requirements

### FR-01 Boot and environment detection

**Goal:** Establish a deterministic runtime before loading content.

**Tasks:**
- Parse query parameters with `URLSearchParams`.
- Detect `file:` protocol once at boot.
- Avoid service-worker registration and Cache Storage on `file:`.
- Ensure the root DOM element exists before application code starts.
- Initialize a non-blocking error boundary and loading state.

**Exit criterion:** A local launch with valid parameters reaches the loading state without a console exception, and a browser launch without the native bridge reaches the same state.

### FR-02 Local asset loader

**Goal:** Load every binary asset correctly on WebView `file://`.

**Tasks:**
- Implement `loadBinary(url)` using XHR with `arraybuffer` for `file:`.
- Treat XHR status `0` and `200` as successful local reads.
- Use `fetch` and Cache Storage only in an HTTP(S) development mode, never in a file-origin path.
- Resolve asset URLs relative to the document or an explicit `./` base.
- Use `Promise.allSettled` for preload groups.
- Provide silent audio and visible image fallbacks when optional assets fail.

**Exit criterion:** A file-origin test loads JSON and audio without `fetch` or `caches.open`, and one failed optional asset does not prevent gameplay.

### FR-03 Content model and validation

**Goal:** Make language content data-driven and packageable.

**Tasks:**
- Define a versioned JSON schema for English word levels, letters, foils, labels, asset paths, and audio.
- Require relative asset paths under `lang/<langCode>/` or `assets/`.
- Validate puzzle IDs, target strings, tile values, solution order, score limits, and referenced assets.
- Reject malformed required content with a recoverable content error.
- Keep language-specific audio under `lang/<langCode>/audios/`.

**Minimum content shape:**

```json
{
  "schema_version": 1,
  "lang": "english",
  "display_name": "English",
  "puzzles": [
    {
      "level_id": 1,
      "target_word": "cat",
      "letters": ["c", "a", "t"],
      "foils": ["b", "m"],
      "image": "lang/english/images/cat.png",
      "hint_image": "lang/english/images/cat-hint.png",
      "word_audio": "lang/english/audios/cat.mp3",
      "letter_audio": ["lang/english/audios/c.mp3", "lang/english/audios/a.mp3", "lang/english/audios/t.mp3"]
    }
  ]
}
```

**Exit criterion:** A validator rejects absolute URLs, duplicate level IDs, non-Roman letters, mismatched target letters, invalid foils, and missing required fields; a valid fixture loads and renders one English word level.

### FR-04 Puzzle engine

**Goal:** Implement deterministic, recoverable spelling gameplay with target letters and foils.

**Tasks:**
- Represent an immutable puzzle definition separately from mutable session state.
- Track placed tiles, remaining target letters, active foils, score, attempts, completion, and emitted milestones.
- Accept a tile only into an empty valid slot.
- Accept a tile only after a pointer drag ends inside that slot; click and keyboard activation must not place a tile.
- Prevent duplicate placement of the same tile instance.
- Mark correct placement immediately, lock the letter, play positive feedback, and pronounce the letter in context.
- Return an incorrectly placed target letter to a random bounded location.
- Remove an incorrectly placed foil and reveal its positional hint when hints are enabled.
- Complete a puzzle once all target positions are correct, then play celebration and word audio.
- Advance to a newly selected target word only after completion handling finishes.

**Exit criterion:** Unit tests cover target-letter placement, foils, locked letters, bounded random return, complete words, repeated actions, and malformed-state transitions with deterministic results.

### FR-05 Persistence

**Goal:** Preserve learner progress without network services.

**Tasks:**
- Store a namespaced state object in `localStorage`.
- Persist completed puzzle IDs, session progress, score, settings, and schema version.
- Validate and migrate stored state before use.
- Recover from unavailable storage or malformed data by using an empty state.
- Never persist the native user ID as a game-owned identity.

**Exit criterion:** Reloading after a completed puzzle restores the expected progress; malformed or unavailable storage leaves the game playable.

### FR-06 Audio and media

**Goal:** Make media enhance learning without becoming a gameplay dependency.

**Tasks:**
- Load local word, per-letter, image, hint, and celebration assets through the file-origin loader when needed.
- Permit `<audio>` or Web Audio playback with relative paths.
- Use a one-frame silent buffer or no-op playback after decode failure.
- Keep image rendering independent of audio readiness.
- Verify true file formats during packaging.

**Exit criterion:** Missing or corrupt audio produces no uncaught exception and does not prevent puzzle completion.

### FR-09 Moving-letter mode

**Goal:** Provide the brief's advanced interaction as a separately testable mode.

**Tasks:**
- Move target letters and foils from left to right at a configured speed.
- Remove each unselected item after a bounded lifetime.
- Stop an item when tapped so it can be dragged to the answer area.
- Preserve all bounded-screen and locked-letter constraints from FR-04.

**Exit criterion:** A fixture can enable moving mode, observe items entering and leaving within the configured lifetime, tap one to stop it, and complete a word without off-screen drag placement.

### FR-07 Event bridge

**Goal:** Report meaningful events through the container only.

**Tasks:**
- Detect `window.ReactNativeWebView.postMessage` at emission time.
- Generate a fresh UUID v4 for every envelope using `crypto.randomUUID()` with a standards-compliant fallback.
- Send one JSON string per event with type `cr_event`.
- Include `payload_id`, `cr_user_id`, `sub_app_id`, `payload_version`, `collection`, `timestamp`, `data`, and `options` only when applicable.
- Allow only `user_sessions_data` and `summary_data` collections.
- Include `type` and `lang` in granular event data and `max_score` with every score.
- Catch all bridge errors and never await reporting.
- Emit session start, puzzle completion, and session completion at most once per occurrence.

**Exit criterion:** Bridge fixtures receive valid envelopes, browser mode sends nothing, duplicate lifecycle calls do not duplicate milestone events, and gameplay is unaffected by a throwing bridge.

### FR-08 Build and packaging

**Goal:** Produce valid engine and language ZIPs.

**Tasks:**
- Configure the bundler public path as `./`.
- Exclude source maps and forbidden network SDKs from the standalone build.
- Put `index.html` at the engine ZIP root.
- Keep `lang/` out of the engine ZIP.
- Put language data and audio under `lang/<langCode>/` in language ZIPs.
- Use the required filename tokens: `<engine>-core.zip` and `<engine>-lang-<langCode>.zip`.
- Validate no file overwrites occur when packages are merged.
- Validate tile icons as square true PNG files.

**Exit criterion:** A clean build produces the required files, a merge check reports no collisions, and the merged directory launches from a local URL.

## 4. Non-Functional Requirements

### NFR-01 Offline first

Gameplay must not wait on DNS, TCP, HTTP, analytics, feature flags, error reporting, service workers, or a remote configuration service.

### NFR-02 Relative resources

No gameplay-critical HTML, CSS, JavaScript, JSON, audio, image, font, WASM, or dynamic import path may begin with `/`, `http://`, or `https://` in the standalone package.

### NFR-03 Resilience

Optional asset failure, storage failure, absent bridge, absent audio, malformed query parameters, and unexpected user actions must result in a recoverable state rather than an uncaught fatal error.

### NFR-04 Performance

The initial playable path should complete within 10 seconds on a supported low-end WebView with local assets. Preloading must be bounded and must not require all optional media to succeed.

### NFR-05 Privacy

The game shall not invent device or user identifiers, send data over the network, or include advertising or third-party tracking.

### NFR-06 Accessibility

Touch targets must be large enough for children, focus order must be predictable, color must not be the only correctness signal, and keyboard-equivalent selection should be supported in browser QA mode.

## 5. Error Handling

| Failure | Required behavior |
|---|---|
| Missing `cr_lang` | Use configured fallback or show recoverable content error |
| Unknown language data | Show retry/fallback state without network access |
| Failed optional image | Show neutral image placeholder and continue |
| Failed audio load/decode | No-op or silent buffer and continue |
| Failed required data load | Show actionable local content error; never infinite-load |
| `localStorage` unavailable | Continue with in-memory state |
| Bridge absent or throws | Silently skip event |
| BroadcastChannel constructor throws | Disable channel use and continue |
| Unexpected puzzle action | Ignore safely and retain valid state |

## 6. Security and Architecture Review Gates

Before release, a human reviewer must verify:

- No external script, CDN, tracker, or runtime SDK is included in the standalone package.
- User IDs are read-only opaque inputs and are not logged unnecessarily.
- Event payloads cannot contain functions, cycles, `NaN`, `Infinity`, or unbounded data.
- ZIP extraction cannot overwrite unrelated package content.
- JSON and asset validation prevents path traversal or disallowed absolute paths.
- The application remains usable when all optional media and the bridge fail.

## 7. Functional Repository Tree

```text
specs/                 Versioned project specifications
src/
  app/                 Boot, routing, lifecycle, error boundary
  content/             Schema, loader, validator, fixtures
  puzzle/              Word, letter, foil, hint, and scoring state machine
  persistence/         localStorage adapter and migration
  media/               Audio/image/hint/animation loading and fallbacks
  reporting/           cr_event bridge and UUID generation
  ui/                  View components and interaction adapters
  styles/              Relative CSS and fonts
public/
  assets/              Shared assets only
  lang/                Development language fixtures
scripts/               Build, validation, packaging, and audit commands
tests/
  unit/                Pure module tests
  integration/         Application and bridge tests
  e2e/                 Browser and file-origin tests
  fixtures/             Valid and invalid content/package fixtures
```

## 8. Implementation Layout

The implementation may use a framework, but the following boundaries must remain explicit:

| Area | Required artifact | Regenerable? |
|---|---|---|
| Source code | `src/` | No, versioned |
| Tests | `tests/` | No, versioned |
| Specs | `specs/` or repository root docs | No, versioned |
| Build output | `dist/` or `build/` | Yes, ephemeral |
| ZIP packages | `packages/` | Yes from versioned source, retain release copies separately |
| Downloaded dependencies | package manager cache | Yes, ephemeral |
| Curated language source | content fixtures/data | No, versioned and backed up |
| Test reports | CI artifact output | Regenerable, retain per release as evidence |

## 9. Technology Constraints

Use the repository's selected web stack, but it must support static output, relative public paths, local XHR binary loading, `localStorage`, and Web Audio. Avoid dependencies that require Node built-ins in the browser or network initialization at runtime. Exact package versions must be pinned in the lockfile.

## 10. Build and Run Contract

A clean-machine runbook must provide commands for:

1. Installing pinned dependencies.
2. Running unit and integration tests.
3. Running browser tests against an HTTP development server.
4. Building the standalone output.
5. Auditing paths, source maps, forbidden modules, and external URLs.
6. Building engine and language ZIPs.
7. Running the file-origin offline test.

No command may require credentials or network access after dependencies are installed.

## 11. Task Planning Protocol

Every new task plan must list:

- The requirement IDs it implements or changes.
- The files and modules it expects to modify.
- The acceptance criteria and linked TESTSPEC cases.
- The focused validation command.
- Any security, packaging, or migration impact.
- Whether an approved spec update is required after completion.

A task is complete only when implementation, focused tests, full relevant regression tests, and human approval are recorded. If implementation exposes a specification defect, update the relevant spec before planning the next task.

## 12. Open Questions

| ID | Question | Blocks implementation? | Owner |
|---|---|---:|---|
| OQ-01 | What stable engine slug and `sub_app_id` will Curious Learning assign? | Yes for upload | Product/operations |
| OQ-02 | Which languages and content sets are in the first release? | Yes for content packaging | Product/content |
| OQ-03 | What exact puzzle progression and scoring policy should the first content set use? | Yes for final scoring | Product/learning |
| OQ-04 | Which browser automation and mobile WebView matrix is available in CI? | No, but affects coverage | QA |

## 13. Resolved Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-08 | Use XHR `arraybuffer` for local binary loading | Android WebView file-origin `fetch` is unreliable and Cache Storage does not support `file:` |
| 2026-09-08 | Use native bridge events rather than game-side analytics | The container owns offline buffering and sync |
| 2026-09-08 | Separate engine and language packages | The container extracts shared engine content once and language content per tile |

## 14. Lessons Log

No implementation lessons recorded yet. Add raw discoveries during development; promote confirmed lessons into requirements or resolved decisions at the next approved spec update.

## Spec Change Log

2026-09-08 — GitHub Copilot — Restricted puzzle placement to pointer drag-and-drop into the correct slot and removed click/keyboard placement behavior.
2026-09-08 — GitHub Copilot — Aligned the engineering specification with the downloaded brief's English word schema, foils, hints, media feedback, and moving-letter mode.
2026-09-08 — GitHub Copilot — Created the initial engineering specification for the Curious Reader Drag Into Place game.
