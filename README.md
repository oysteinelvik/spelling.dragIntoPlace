# Drag Into Place

A dependency-free MVP of the Curious Reader Drag Into Place literacy game.

## Run

Open `index.html` directly in a browser with:

```text
file:///.../index.html?cr_lang=english
```

The app loads its language data through XHR on `file://`, stores progress in `localStorage`, and silently skips native event reporting when `ReactNativeWebView` is absent.

## Current scope

- English word levels from `lang/english/data.json`
- Picture clue placeholders
- Target letters and JSON-defined foils
- Correct placement locking and feedback
- Incorrect target-letter return and foil removal with hint reveal
- Local progress persistence
- Native `cr_event` milestone reporting
- Optional moving-letter presentation mode
