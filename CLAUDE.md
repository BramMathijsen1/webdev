# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LMML is a companion web app for walking tours of film and TV filming locations in Paris and London. It's a static site for GitHub Pages: the "backend" is `backend/db.json` plus an API handler that runs in the browser, with no server code and no Node.js. Content and UI are written in English; a language menu (translate.js) translates a page when the visitor asks. It's a learning project. Keep the code simple and readable, and after each change explain what changed and why.

## Design document

`design.txt` holds the key design decisions, each with its reason, and it's imported below so it's always in context. Treat it as the source of truth. The owner wants it very short: when you make or change a decision that is important and specific to LMML, update its line in the same style, as part of the same change; leave out details the code or the data already show. Refer to its sections by name (for example `design.txt: Text grid`).

@design.txt

## Running locally

From the repo root:

```sh
python -m http.server 8000
```

Then open http://localhost:8000/. A server is needed because ES modules and `fetch()` don't work from `file://` URLs.

## Checking a change

There are no automated tests or check pages; the owner removed them because the brief doesn't ask for them. After changing data or code:

- Open the affected pages through the local server, in both themes (`?theme=affiche`, `?theme=script`), in landscape (wider than 3:2, and squarer, such as 4:3), in portrait, and on a phone held sideways. The page must always fit the viewport, with only its panels scrolling.
- For print styles, use the browser's print preview: on paper the canvas flows onto pages.
- After editing `db.json`, open every story and location it touches: a misspelled id shows up as a "Not found" page or a missing stop.
- Browsers cache ES modules aggressively with `http.server`: hard-reload (or use a fresh profile) before trusting a result.

## Architecture

- `backend/db.json` is the whole database: normalised, with records linked by id. Edit it directly and keep its formatting. The authoring scripts that first assembled it are not in the repo.
- `backend/api.js` is a pure `handle(db, path) → {status, body}`. All joins and computed fields (summaries, totals, `appearsIn`, `/sources`) live there. `frontend/js/apiClient.js` fetches `db.json` once and calls it, so pages use `api.get('/locations/<id>')` like a REST API.
- HTML first: each `frontend/*.html` holds its page's structure, with `data-field` slots (and `data-list` lists on the colophon); `frontend/js/pages/<page>.js` only fills them from the API. Add structure in the HTML, not in JavaScript, unless it repeats per record (figures, stops, table rows).
- `frontend/js/page.js` is the frame of every page: the settings (localStorage, every access in try/catch; `?theme=` wins), the themes, the header menus, the footer, the portrait tabs and the error state. `ui.js` has small helpers (`fillFields`, `el`, `citation`, formatters); `map.js` the Leaflet code.
- The text grid is HTML and CSS: all 9 texts sit in the page as `article.lmml-version[data-tone][data-length]`; the `.lmml-text` section's `data-tone`, `data-competence` and `data-length` name the cell, and `css/base.css` hides the rest. A switch only changes one attribute (`move()` in `location.js`).
- Themes are CSS only: `frontend/themes/<id>/theme.css`, registered in `frontend/themes/themes.json`. Pages use the restricted HTML vocabulary and the `.lmml-*` classes and `data-*` attributes listed at the top of `frontend/css/base.css` (the theme contract). Restyle through those; don't add theme-specific markup.
- The canvas is exactly the viewport: `body` is a grid of header, canvas and footer; only `.lmml-panel`s scroll. In portrait (and on a phone held sideways) the panels inside `.lmml-panels` form a swipeable row with `.lmml-tabs`. Keep new content inside a panel.
- Keep it minimal: the owner removed everything the brief doesn't ask for. Ask before adding anything beyond it.
- Every URL must be relative, because GitHub Pages serves the site under `/webdev/`. QR codes use `PUBLIC_BASE_URL` in `frontend/js/pages/qr.js`.
- There's no npm. Leaflet 1.9.4, qrcode-generator and translate.js are vendored in `frontend/vendor/`.

## Content rules

- Facts first: texts use only facts the location records, each with a source in `references` (CSL-JSON). Remove a claim rather than leave it unsourced.
- Every location has all 9 texts (tone × length), each an HTML string using only `p`, `em`, `strong`, `q`, `cite`, `a` and `span`. Each text needs at least one intro-only and one advanced-only passage (`<span data-level="intro">`, `<span data-level="advanced">`), so the competence versions differ. Word targets, at every level: brief ≤ 60, mid 120–200, long ≥ 300.
- Camera data that isn't documented is `null`, never guessed.
- Film stills live in `frontend/media/<region>/stills/<still-id>.jpg` (at most 960 px wide, never cropped), each recorded in `db.json` with its caption, credit and the page it was found on. A missing file shows a placeholder; the stills folders' README.txt lists them.
- Videos come only from official or licensed YouTube channels, checked as embeddable; a scene without one has no video.
