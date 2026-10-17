// The story overview (design.md: 3.4 Stories): the framing of the story, its route by chapter and a map.
//   story.html?id=<story>
// story.html holds the parts of the page; this module fills them from the API.

import * as api from '../apiClient.js';
import { loadSettings, saveSettings, setupPage, showError } from '../page.js';
import { el, fillFields, formatDistance, formatMinutes, modeLabel, setTitle, stopHref } from '../ui.js';
import { createMap, pin, line, fit } from '../map.js';

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);

start().catch(showError);

async function start() {
  if (!params.get('id')) throw new Error('No story was given: pick one on the start page.');
  const story = await api.get(`/narratives/${encodeURIComponent(params.get('id'))}`);
  const settings = loadSettings();
  if (settings.story !== story.id) {
    // Opening a story applies its default texts and its theme (Automatic, design.md: 3.4 Stories).
    settings.story = story.id;
    settings.cell = { ...story.defaults };
    settings.theme = params.get('theme');
    saveSettings(settings);
  }
  await setupPage({ settings, story, region: story.region.id });
  setTitle(story.title);

  const stops = story.chapters.flatMap((chapter) => chapter.stops);
  fillFields(main, {
    kicker: `A story in ${story.region.name}`,
    title: story.title,
    premise: story.premise,
    pointOfView: story.pointOfView,
    audience: story.audience,
    start: story.start.name,
    length: `${stops.length} stops · ${formatDistance(story.totals.meters)} · about ${formatMinutes(story.totals.minutes)}`,
  });
  main.querySelector('.lmml-start').href = stopHref(story.id, stops[0].location.id, 0);
  main.querySelector('#route').append(...story.chapters.map((chapter, index) => routeChapter(story.id, chapter, index)));
  drawMap(main.querySelector('.lmml-map-canvas'), story, stops);
}

// A chapter of the route: its stops, numbered across the whole story, with the leg to reach each.
function routeChapter(storyId, chapter, index) {
  return el(
    'section',
    { class: 'lmml-route-chapter', dataset: { chapter: String(index + 1) } },
    el('h3', {}, `${index + 1}. ${chapter.title}`),
    el(
      'ol',
      { class: 'lmml-stops', start: chapter.stops[0].step + 1 },
      chapter.stops.map((stop) =>
        el(
          'li',
          {},
          el('a', { href: stopHref(storyId, stop.location.id, stop.step) }, stop.location.name),
          ' ',
          el('span', { class: 'lmml-leg' }, `${stop.directions.minutes} min ${modeLabel(stop.directions.mode)}`)
        )
      )
    )
  );
}

// The start (S) and the numbered stops, joined in story order.
function drawMap(canvas, story, stops) {
  const map = createMap(canvas, story.region.center, story.region.zoom);
  pin(map, story.start.geo, 'S', { title: `Start: ${story.start.name}` });
  let previous = story.start.geo;
  for (const stop of stops) {
    line(map, previous, stop.location.geo, stop.directions.mode);
    pin(map, stop.location.geo, stop.step + 1, { title: stop.location.name });
    previous = stop.location.geo;
  }
  fit(map, [story.start.geo, ...stops.map((stop) => stop.location.geo)]);
}
