# LMML: film locations, told as stories

LMML is a companion web app for walking tours of film and TV locations in Paris and London. Pick a city and a story, and LMML guides you from one location to the next. At each stop it shows where the camera stood, gives directions on a live map, and tells you about the place at the length, level and tone you choose.

It's a course project and a static site: plain HTML, CSS and JavaScript, with no build step, no npm and no server code. The "backend" is a JSON database (`backend/db.json`) plus an API handler (`backend/api.js`) that runs in the browser.

## Run it

From the repository root:

```sh
python -m http.server 8000
```

Then open http://localhost:8000/. A local server is needed, because ES modules and `fetch()` don't work from `file://`.

## What's inside

- **32 locations**: 17 in Paris (*Amélie*, *Emily in Paris*, and monuments) and 15 in London (*Love Actually*, *Sherlock*). Each has camera positions, credited pictures, sourced facts, references and nine texts; 13 scenes have an official video clip.
- **4 stories**:
  - *Two Parisiennes*: a class trip.
  - *Amélie, scene by scene*.
  - *Shot for shot*: recreating London shots.
  - *The game is on*: a Sherlock trail for young detectives.
- **2 themes**: *Affiche* (1920s–30s travel posters) and *Script* (screenplays and production paperwork). Both are CSS-only and can be replaced; see `design.txt: Themes and the canvas`.
- **A canvas the size of the screen**: every page fits the viewport, and its texts, pictures, map and record scroll in their own panels. They stand side by side in landscape; in portrait they show one at a time, with tabs.
- **Pages**: start page, story overview, location or story stop, printable QR codes, about, and the colophon (the course disclaimer, with every source of the content).
- **Languages**: the texts are in English; the language menu at the top right translates a page into French, Dutch, German, Spanish or Italian.

## Film stills

`frontend/media/<region>/stills/` holds 26 film stills, at most 960 px wide and uncropped, each credited to its rights holder and recorded in `backend/db.json` with the page it was found on. Three Sherlock stills are still missing and show a placeholder; the README.txt in each stills folder lists them. Stills are copyrighted and GitHub Pages sites are public, so decide before publishing whether to commit them (`design.txt: Risks`).

## Credits

- Map data © OpenStreetMap contributors.
- Walking times and distances: OSRM foot profile on routing.openstreetmap.de.
- Photos from Wikimedia Commons, each credited with its creator and licence on the page where it's used.
- Leaflet (BSD-2-Clause), qrcode-generator (MIT) and translate.js (MIT), vendored with their licences. Translations are made by Microsoft's translation service, only when a visitor picks another language.
- Video clips are embedded from their channels on YouTube (youtube-nocookie) and load only when played.
- Film stills © their rights holders, credited under each picture.
- Fonts under the SIL Open Font License: Limelight, Jost and Courier Prime.

## Design

`design.txt` holds the key design decisions, each with its reason, in a few short sections.
