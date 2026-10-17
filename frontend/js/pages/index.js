// The start page (design.txt: Pages): the stories of each city.

import * as api from '../apiClient.js';
import { loadSettings, setupPage, showError } from '../page.js';
import { el, fill, formatMinutes, setTitle } from '../ui.js';

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
