// The start page: the stories of each city, and a map of each city with every place.

import * as api from '../apiClient.js';
import { loadSettings, setupPage, showError } from '../page.js';
import { el, fill, formatMinutes, productionLabel, setTitle } from '../ui.js';
import { createMap, fit, pin } from '../map.js';

start().catch(showError);

async function start() {
  const settings = loadSettings();
  const [regions, stories] = await Promise.all([api.get('/regions'), api.get('/narratives')]);
  const active = stories.find((s) => s.id === settings.story) || null;
  await setupPage({ settings, story: active, region: active ? active.region : '' });
  setTitle('Film locations, told as stories');

  fill(document.querySelector('[data-panel="stories"]'),
    regions.map((region) =>
      el(
        'section',
        { class: 'lmml-region' },
        el('h2', {}, region.name),
        el('div', { class: 'lmml-cards' }, stories.filter((s) => s.region === region.id).map(storyCard))
      )
    )
  );
  drawMaps(await Promise.all(regions.map((region) => api.get(`/regions/${region.id}`))));
}

// One map per city, with a pin for every place, marked with the initial of its film or series.
// A pin's popup names the place and links to its page.
function drawMaps(regions) {
  const panel = document.querySelector('[data-panel="map"]');
  // Every city's section goes in first, so each map is drawn at its final size.
  const canvases = regions.map((region) => {
    const canvas = el('div', { class: 'lmml-map-canvas' });
    const productions = new Map(region.locations.flatMap((place) => place.productions).map((p) => [p.id, p]));
    const key = [...productions.values()].map((p) => `${p.title[0]}: ${productionLabel(p)}`).join(' · ');
    panel.append(el('h3', {}, region.name), canvas, el('p', {}, key));
    return canvas;
  });
  regions.forEach((region, i) => {
    const map = createMap(canvases[i], region.center, region.zoom);
    for (const place of region.locations) {
      const popup = el('div', {},
        el('p', {}, el('a', { href: `location.html?id=${encodeURIComponent(place.id)}` }, place.name)),
        el('p', {}, place.productions.map(productionLabel).join('; ')));
      pin(map, place.geo, place.productions[0].title[0], { title: place.name }).bindPopup(popup);
    }
    fit(map, region.locations.map((place) => place.geo));
  });
}

function storyCard(story) {
  return el(
    'article',
    { class: 'lmml-card' },
    el('h3', {}, el('a', { href: `story.html?id=${encodeURIComponent(story.id)}` }, story.title)),
    el('p', {}, story.pointOfView),
    el('p', { class: 'lmml-card-meta' }, `${story.totals.stops} stops · about ${formatMinutes(story.totals.minutes)}`)
  );
}
