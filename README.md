# LMML: film locations, told as stories

LMML is a companion web app for walking tours of film and TV locations in Paris and London. Pick a city and a story, and LMML guides you from one location to the next. At each stop it shows where the camera stood, gives directions on a live map, and tells you about the place at the length, level and tone you choose.

`design.md` is the design document: the technical, media and design choices, with their reasons, and pictures of the real publications behind the typography of the two themes.

The website is published on github pages.

## If you want to run it locally

From the repository root:

```sh
python -m http.server 8000
```

Then open http://localhost:8000/. A local servers is needed for the back-end front-end architecture.

## Contents

- **32 locations**: 17 in Paris (*Amélie*, *Emily in Paris*, and monuments) and 15 in London (*Love Actually*, *Sherlock*). Each has camera positions, credited pictures, stills, sourced facts and nine texts. 13 scenes have an official video clip embeddings, all from Youtube (not locally downloaded).
- **4 stories**, one per film or series:
  - *Amélie, scene by scene*.
  - *Emily's Paris*: a class trip.
  - *Shot for shot*: recreating the London shots of *Love Actually*.
  - *The game is on*: a Sherlock trail for young detectives.
- **A start page** with an introduction, the stories and a map of each city with every location.
- **2 themes**: *Affiche* (1920s–30s travel posters) and *Script* (screenplays and production paperwork). Both are CSS-only and can be replaced; see `design.md`, chapter 3.
- **Languages**: the texts are in English; the language menu at the top right translates a page into French, Dutch, German, Spanish or Italian.

## Credits

- Map data © OpenStreetMap contributors.
- Photos from Wikimedia Commons, each credited with its creator and licence on the page where it's used.
- Leaflet (BSD-2-Clause), qrcode-generator (MIT) and translate.js (MIT), vendored with their licences. Translations are made by Microsoft's translation service, only when a visitor picks another language.
- Video clips are embedded from their channels on YouTube (youtube-nocookie) and load only when played.
- Film stills © their rights holders, credited under each picture.
- Fonts under the SIL Open Font License: Limelight, Jost and Courier Prime.