# Drag Into Place

A dependency-free MVP of the Curious Reader Drag Into Place literacy game.

## Get started

New clone? Run:

```text
npm run getstarted
```

This verifies your Node.js version, creates `dist/packages/`, and builds `lang/*/data.json` from `content/words.csv`. No `npm install` is required — the game and tooling use zero third-party dependencies.

## Developer console

```text
npm run console
```

Opens a local control panel at `http://localhost:4300` with:

- **REBUILD** — regenerates `lang/*/data.json` from `content/words.csv` (the "spreadsheet"; export a real Google Sheet to this CSV shape to replace it).
- **Language dropdown** — lists languages currently built.
- **PREVIEW** — opens the selected language in a sized window so you can play it.
- **Display toggle** — switches the preview window between portrait and landscape dimensions.
- **MAKE PACKAGE & UPLOAD** — builds `<engine>-core.zip` and one `<engine>-lang-<code>.zip` per language into `dist/packages/`, then uploads them via the Curious Reader CMS MCP endpoint if `CR_MCP_SERVER` and `CR_MCP_TOKEN` are set (see `.env.example`). Without them, packaging still completes and the upload step is skipped with a clear message.
- **Console output pane** — live log of every command above.

Standalone equivalents: `npm run build:content`, `npm run build:packages`.

## Run the game directly

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
