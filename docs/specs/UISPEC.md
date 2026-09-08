# Curious Reader Drag Into Place
## User Interface Specification

**Version:** 0.2.1  
**Status:** Draft  
**Last updated:** 2026-09-08  
**Author:** GitHub Copilot  
**Behavior authority:** Development specification in this project

## 1. UI Principles

- The learner should understand the next action without reading a manual.
- The primary interaction is large, direct, forgiving, and visually stable.
- Feedback is immediate and multimodal: position, text, motion, and optional audio.
- The interface remains usable when audio, images, storage, or the native bridge fail.
- The interface must not expose implementation details, network status, or technical errors to the child.
- Visual states describe behavior; behavior remains defined by the development specification.

## 2. Viewport and Layout

- Support portrait and landscape WebView dimensions.
- Use a responsive root that fills the viewport without horizontal scrolling.
- Keep the play area centered with a stable puzzle region.
- Maintain large hit targets for tiles and slots.
- Keep primary controls in a consistent bottom or edge region that does not overlap the puzzle.
- Respect safe-area insets on mobile devices.
- Use relative local font and image paths only.
- Do not rely on hover for any required action.

## 3. Visual Language

The visual direction is warm, bright, and classroom-friendly without relying on a single hue. Use a light neutral canvas, one strong action color, one success color, one correction color, and high-contrast text. Avoid flashing, dense decoration, or visual noise that competes with the target word.

Typography must remain legible at common phone sizes. Text labels should be short. Icons may supplement labels but must not be the only indication of correctness or completion.

## 4. Application States

| State ID | Name | Purpose | Visible elements |
|---|---|---|---|
| UI-BOOT | Boot | Establish DOM and environment | Root background; no stale controls |
| UI-LOADING | Loading | Load required language data | Progress indicator or calm loading cue |
| UI-READY | Ready | Introduce the next activity | Activity title, start/continue action, progress summary |
| UI-PLAY | Play | Solve the current puzzle | Target image if available, slots, tile bank, progress, audio action |
| UI-CORRECT | Correct placement | Confirm one valid placement | Highlighted slot/tile, positive cue, optional audio |
| UI-INCORRECT | Incorrect placement | Explain that action can be corrected | Non-destructive correction cue, tile returns or remains selectable |
| UI-COMPLETE | Puzzle complete | Celebrate and advance | Completed word, success cue, continue action |
| UI-SESSION-DONE | Session complete | Close the activity | Result summary, restart/continue action |
| UI-CONTENT-ERROR | Content error | Recover from missing required data | Child-safe error message, retry or return action |
| UI-DEGRADED | Degraded media/storage | Continue with reduced capability | No technical detail; optional media simply absent |

## 5. Screen Specifications

### 5.1 Loading

**Entry:** Application boot or language selection.  
**Exit:** Required content loaded, or content error.

The loading view must appear immediately and must not wait for audio, analytics, bridge setup, or optional images. It must be dismissed after required data settles or after a bounded failure path. The loader must not imply that an internet connection is being attempted.

**Acceptance criteria:**

```gherkin
Given the game is opened from a file URL with a valid language
When required local data finishes loading
Then the loading view is replaced by Ready or Play
And no network is needed for the transition

Given an optional image or audio file fails
When required puzzle data is available
Then the game leaves Loading
And the puzzle remains playable

Given required language data fails
When the load attempt settles
Then the game shows Content Error
And the screen offers a local retry or return action
And it does not spin indefinitely
```

### 5.2 Ready

The ready view establishes the activity in one glance. It contains a short title, an optional language-appropriate instruction, progress summary, and one primary Start or Continue action. A settings or audio control may be present but must not compete with the primary action.

**Acceptance criteria:**

```gherkin
Given the learner has no saved progress
When Ready is shown
Then the primary action starts the first puzzle

Given saved progress exists
When Ready is shown
Then the primary action continues at the next available puzzle
And the progress summary reflects saved state
```

### 5.3 Play

The play view contains, in reading order:

1. Session progress and optional exit/back control.
2. Target image or neutral media placeholder.
3. Target word slots with clear empty and filled states.
4. Hint image strip aligned with answer slots when enabled.
5. Letter and foil tile area with stable tile dimensions.
6. Optional pronunciation/audio control.
7. Non-blocking feedback region.

The active puzzle must remain visually stable while a tile is dragged. A tile must not change size in a way that shifts neighboring controls. Empty slots must be visually distinct from filled slots. The solution must not be revealed by styling alone.

**Acceptance criteria:**

```gherkin
Given a Play view with empty slots and available tiles
When the learner selects or drags a tile to an empty valid slot
Then the tile occupies that slot
And the slot and tile show the correct state
And the remaining layout does not shift unexpectedly

Given a selected tile and an invalid destination
When the learner releases or confirms the tile
Then the puzzle remains valid
And the learner receives a correction cue
And the tile remains available for another attempt

Given a foil is dropped into an answer slot
When the drop is processed
Then negative feedback is shown
And the foil disappears from the tile area
And the hint for that position is revealed when hints are enabled

Given a target letter is placed in its correct slot
When the placement is accepted
Then positive feedback and contextual letter audio are triggered
And the placed letter cannot be dragged again

Given the media asset is unavailable
When the Play view renders
Then a neutral placeholder or omitted media area is shown
And slots and tiles remain usable
```

### 5.4 Feedback

Correct feedback uses a brief positive animation or state change and optional audio. Incorrect feedback must be calm and non-punitive. Feedback must never trap focus, prevent the next valid action, or require audio to understand the result.

Target-letter errors return the letter to a random location inside the bounded play area. Foils disappear after their negative feedback. The random location must be computed inside the visible safe area, including the tile's full dimensions.

### 5.5 Moving-letter mode

In the advanced mode, target letters and foils enter from the left, travel toward the right, and disappear after a configured lifetime. Tapping an item stops its motion and makes it draggable. The answer area and locked-letter behavior remain the same as the standard mode.

### 5.5 Puzzle complete

When the final correct placement is made, the completed word remains visible. The UI shows a clear success state and a Continue or Next action. Automatic advance may be used only if it does not remove the completion signal before it can be perceived and does not duplicate completion events.

```gherkin
Given the final slot is correct
When the puzzle becomes complete
Then the full target is visibly complete
And the completion state is shown once
And Continue advances to the next puzzle or Session Done
```

### 5.6 Session complete

The session completion view shows a concise result: puzzles completed, score where configured, and a Restart or Continue action. It must not show a network-sync warning or expose the user ID. If reporting fails, the same completion view remains available.

## 6. Interaction Rules

- Pointer and touch dragging are the only placement mechanism; tapping or keyboard activation of a tile must not place it.
- Keyboard QA mode must support focus and activation of non-placement controls, while tile placement remains drag-only.
- Focus must remain visible and must not be lost after an incorrect action.
- Back/exit behavior must preserve already-completed progress.
- Double activation of Continue must not advance two puzzles.
- Disabled controls must be visibly and semantically disabled.
- A tile that is already placed cannot be placed a second time unless the product explicitly supports removal.
- Audio controls are optional enhancements and never gate progression.

## 7. Visibility and Status Matrix

| Element | Boot | Loading | Ready | Play | Correct/Incorrect | Complete | Session Done | Error |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Loading cue | Yes | Yes | No | No | No | No | No | No |
| Activity title | No | Optional | Yes | Yes | Yes | Yes | Yes | Optional |
| Progress summary | No | Optional | Yes | Yes | Yes | Yes | Yes | No |
| Target image | No | No | No | Optional | Optional | Optional | No | No |
| Word slots | No | No | No | Yes | Yes | Yes | No | No |
| Tile bank | No | No | No | Yes | Yes | No | No | No |
| Audio action | No | No | Optional | Optional | Optional | Optional | Optional | No |
| Primary action | No | No | Yes | Contextual | Contextual | Yes | Yes | Yes |
| Feedback region | No | No | No | Optional | Yes | Yes | Optional | No |
| Technical diagnostics | No | No | No | No | No | No | No | No |

## 8. Responsive and Accessibility Requirements

- The smallest supported viewport must keep every tile and slot fully visible or scrollable without clipping.
- Touch targets should be at least 44 CSS pixels where device density permits.
- Text and controls need strong contrast against their background.
- Success and correction must use text, shape, position, or motion in addition to color.
- Motion must be brief and interruptible; reduced-motion preferences should suppress nonessential animation.
- Screen-reader labels should identify the puzzle, slot position, tile value, progress, and primary action.
- The child-facing interface must use language-pack text where available.

## 9. Empty, Loading, and Failure States

All state transitions must be finite and visible. A required data failure has a retry path that repeats local loading, not a remote request. Missing optional media uses placeholders or omission. Storage failure does not change the primary interaction. Bridge failure is invisible to the learner.

## 10. UI Review Checklist

- Every state in the state table can be reached from a deterministic test fixture.
- Every visible control has a defined enabled, disabled, and activation behavior.
- No text overlaps controls at supported viewport sizes.
- No control requires hover.
- The primary action is visually unambiguous.
- Incorrect actions preserve a recoverable puzzle.
- Completion is perceivable before navigation.
- Browser mode and file-origin mode have equivalent core interaction.

## 11. Spec Change Process

UI changes must identify the affected state IDs, visibility rules, and Gherkin criteria. Approved changes update this document's version, status, date, and change log, then update affected implementation and tests.

## Spec Change Log

2026-09-08 — GitHub Copilot — Updated interaction rules so letters are accepted only when dragged into the correct answer slot.
2026-09-08 — GitHub Copilot — Aligned UI states and interaction criteria with the downloaded brief's word image, foils, hint strip, media feedback, and bounded moving-letter mode.
2026-09-08 — GitHub Copilot — Created the initial user interface specification for the Curious Reader Drag Into Place game.
