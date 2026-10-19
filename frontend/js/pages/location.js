// The location page: one place, on its own or as a stop in a story.
//   location.html?id=<location>                       the place on its own
//   location.html?id=<location>&story=<id>&step=<n>   stop n of a story
// location.html holds the parts of the page; this module fills them from the API. Without a story
// in the URL, the visitor's active story is used when it visits this place, so a scanned QR code
// opens as a stop of the story being followed (design.md: 3.4 Stories).

import * as api from '../apiClient.js';
import { loadSettings, saveSettings, setupPage, showError } from '../page.js';
import { citation, el, fill, fillFields, formatAddress, formatDistance, modeLabel, productionLabel, setTitle, stopHref } from '../ui.js';
import { camera, compassName, createMap, fit, line, pin, positionAllowed, showPosition } from '../map.js';

const main = document.getElementById('main');
const part = (name) => main.querySelector(`.lmml-${name}`);
const params = new URLSearchParams(location.search);

// The text grid (design.md: 3.1 General): its three axes, each from the first value to the last.
const AXES = { tone: ['young', 'adult', 'scholar'], competence: ['intro', 'average', 'advanced'], length: ['brief', 'mid', 'long'] };
const DEFAULT_CELL = { tone: 'adult', competence: 'average', length: 'brief' };

const KINDS = { 'filming-location': 'Filming location', landmark: 'Landmark' };
const SHOT_SIZES = { ELS: 'extreme long shot', LS: 'long shot', MLS: 'medium long shot', MS: 'medium shot', MCU: 'medium close-up', CU: 'close-up', ECU: 'extreme close-up' };
const ANGLES = { 'birds-eye': "bird's-eye view", high: 'high angle', 'eye-level': 'eye level', low: 'low angle', 'worms-eye': "worm's-eye view", dutch: 'Dutch angle' };
const REGISTERS = {
  'Mérimée': (id) => `https://www.pop.culture.gouv.fr/notice/merimee/${id}`,
  NHLE: (id) => `https://historicengland.org.uk/listing/the-list/list-entry/${id}`,
};

start().catch(showError);

async function start() {
  if (!params.get('id')) throw new Error('No location was given: pick one from a story.');
  const place = await api.get(`/locations/${encodeURIComponent(params.get('id'))}`);
  const settings = loadSettings();

  // Which story is this place shown in? The one in the URL, else the active one (if it visits here).
  const visit = place.appearsIn.find((s) => s.id === (params.get('story') || settings.story));
  let story = null;
  let stop = null;
  if (visit) {
    story = await api.get(`/narratives/${visit.id}`);
    const wanted = Number(params.get('step'));
    stop = story.chapters.flatMap((c) => c.stops)[visit.steps.includes(wanted) ? wanted : visit.steps[0]];
    if (settings.story !== story.id) {
      // Entering a story applies its default texts and its theme (Automatic, design.md: 3.4 Stories).
      settings.story = story.id;
      settings.cell = { ...story.defaults };
      settings.theme = params.get('theme');
    }
  }
  const isCell = (cell) => Boolean(cell) && Object.entries(AXES).every(([axis, values]) => values.includes(cell[axis]));
  if (!isCell(settings.cell)) settings.cell = { ...DEFAULT_CELL };
  saveSettings(settings);

  await setupPage({
    settings,
    story,
    region: place.region.id,
    onStoryChange: (chosen) => {
      // Stay on this place if the chosen story visits it; otherwise open the story.
      const there = chosen && place.appearsIn.find((s) => s.id === chosen.id);
      if (there) location.href = stopHref(chosen.id, place.id, there.steps[0]);
      else location.href = chosen ? `story.html?id=${encodeURIComponent(chosen.id)}` : `location.html?id=${encodeURIComponent(place.id)}`;
    },
  });
  render(place, story, stop, settings);
}

function render(place, story, stop, settings) {
  const stops = story ? story.chapters.flatMap((c) => c.stops) : [];
  const chapter = stop ? story.chapters[stop.chapterIndex] : null;
  const next = stop ? stops[stop.step + 1] : null;
  // A story may highlight only some of the scenes filmed here, and choose the pictures and their order.
  const scenes = stop && stop.scenes.length ? place.scenes.filter((s) => stop.scenes.includes(s.id)) : place.scenes;
  const media = stop && stop.media.length ? stop.media.map((id) => place.media.find((m) => m.id === id)) : place.media;
  setTitle(place.name, story && story.title);

  // The slugline (EXT. PLACE – DAY) is only shown by the Script theme.
  const first = scenes[0];
  const time = first && first.camera.timeOfDay;
  fillFields(main, {
    slug: `${first ? first.setting : 'EXT'}. ${place.name.toUpperCase()}${time ? ` – ${time}` : ''}`,
    kicker: stop ? `Stop ${stop.step + 1} of ${stops.length} · ${chapter.title}` : place.region.name,
    title: place.name,
    productions: productionsOf(place).map(productionLabel).join(' · '),
    chapterNumber: chapter && `Chapter ${stop.chapterIndex + 1}`,
    chapterTitle: chapter && chapter.title,
    chapterIntro: chapter && chapter.intro,
    storyTitle: story && story.title,
    narration: stop && stop.narration,
    recognise: stop ? stop.recognise : place.identify,
    nextName: next && `${next.step + 1}. ${next.location.name}`,
    nextTime: next && `${next.directions.minutes} min ${modeLabel(next.directions.mode)}${next.directions.meters ? ` · ${formatDistance(next.directions.meters)}` : ''}`,
    nextDirections: next && next.directions.text,
  });
  main.dataset.chapter = stop ? String(stop.chapterIndex + 1) : '';
  if (stop) part('slug').dataset.step = String(stop.step + 1);
  part('chapter').hidden = !(stop && stop.firstInChapter);
  part('narration').hidden = !stop;
  part('next').hidden = !next;

  drawText(place, settings);
  fill(part('gallery'), media.map((item, i) => figure(item, i + 1, aspectOf(item, place.scenes))));
  // On a story stop the narration already tells the scene, so a scene shows only its camera.
  part('scenes').append(...scenes.map((s) => scene(s, !stop)));
  part('scenes').hidden = scenes.length === 0;
  part('meta').querySelector('tbody').append(...recordRows(place));
  if (stop) {
    fill(part('nav'), navLinks(story, stops[stop.step - 1], next));
    part('nav').hidden = false;
    part('navigate').href = navigateHref(place, stop);
    part('navigate').hidden = false;
  }
  drawMap(place, stop, scenes, next);
}

function productionsOf(place) {
  return [...new Map(place.scenes.map((s) => [s.production.id, s.production])).values()];
}

// ---------------------------------------------------------------- text grid

// All nine texts go into the page. The text section's data-tone, data-competence and data-length
// name the one to show, and css/base.css hides the others and the passages meant for other levels
// (design.md: 3.1 General). A switch only changes those attributes.
function drawText(place, settings) {
  const section = part('text');
  fill(part('versions'),
    place.texts.map((text) => {
      const version = el('article', { class: 'lmml-version', dataset: { tone: text.tone, length: text.length } });
      version.innerHTML = text.html; // the site's own content, in the restricted HTML vocabulary (design.md: 1. Technical choices)
      return version;
    })
  );
  part('play').append(...play(place.activities));
  part('sources').append(...sources(place));

  const show = (cell) => {
    Object.assign(section.dataset, cell);
    for (const button of section.querySelectorAll('[data-axis]')) {
      const atEnd = !move(cell, button.dataset.axis, Number(button.dataset.direction));
      // aria-disabled (not disabled) keeps the button focusable, so its explanation can be read.
      button.setAttribute('aria-disabled', String(atEnd));
      button.title = atEnd ? button.dataset.end : '';
      // The two tone buttons are toggles, pressed while their text is shown.
      if (button.dataset.axis === 'tone') button.setAttribute('aria-pressed', String(cell.tone === toneOf(Number(button.dataset.direction))));
    }
  };
  part('switches').addEventListener('click', (event) => {
    const button = event.target.closest('[data-axis]');
    const cell = button && move(settings.cell, button.dataset.axis, Number(button.dataset.direction));
    if (!cell) return;
    settings.cell = cell;
    saveSettings(settings);
    show(cell);
  });
  show(settings.cell);
}

// One step along one axis, keeping the other two; null at the end of the axis. The two tone buttons
// go straight to their text instead, and back to the adult text when pressed again.
function move(cell, axis, direction) {
  if (axis === 'tone') {
    const tone = toneOf(direction);
    return { ...cell, tone: cell.tone === tone ? DEFAULT_CELL.tone : tone };
  }
  const values = AXES[axis];
  const value = values[values.indexOf(cell[axis]) + direction];
  return value ? { ...cell, [axis]: value } : null;
}

// "Do you want to play?" asks for the young text, "additional details and references" for the scholar one.
function toneOf(direction) {
  return direction < 0 ? AXES.tone[0] : AXES.tone[AXES.tone.length - 1];
}

// "Do you want to play?": the young tone shows the location's quizzes and challenges.
function play(activities) {
  return activities.map((activity) => {
    if (activity.type !== 'quiz') {
      return el('div', {}, el('p', {}, activity.prompt), el('details', {}, el('summary', {}, 'Show the answer'), el('p', {}, activity.answer)));
    }
    const feedback = el('p', { role: 'status' });
    const options = activity.options.map((option, index) =>
      el(
        'button',
        {
          type: 'button',
          class: 'lmml-button',
          onclick: () => {
            feedback.textContent = index === activity.answer ? `Yes! ${activity.explanation}` : 'Not quite. Try again!';
          },
        },
        option
      )
    );
    return el('div', {}, el('p', {}, activity.question), el('div', { class: 'lmml-options' }, options), feedback);
  });
}

// "Additional details and references": the scholar tone shows the facts with their sources.
function sources(place) {
  const numberOf = (id) => place.references.findIndex((r) => r.id === id) + 1;
  return [
    el('ul', {}, place.facts.map((fact) => el('li', {}, fact.text, ' ', el('a', { href: `#ref-${fact.source}` }, `[${numberOf(fact.source)}]`)))),
    el('ol', {}, place.references.map((ref) => el('li', { id: `ref-${ref.id}` }, citation(ref)))),
  ];
}

// ----------------------------------------------------------------- pictures

// A still is labelled with the aspect ratio of its production (the Script theme shows it).
function aspectOf(item, scenes) {
  const scene = scenes.find((s) => s.media.some((m) => m.id === item.id));
  return scene ? scene.production.aspectRatio : null;
}

function figure(item, number, aspect) {
  let picture;
  if (item.kind === 'video') {
    // A video only loads when asked for (privacy, mobile data).
    picture = el('button', { type: 'button', class: 'lmml-button', onclick: () => picture.replaceWith(youtube(item)) }, 'Play the clip');
  } else {
    picture = el('img', { src: item.src, alt: item.alt, width: item.width, height: item.height, loading: 'lazy' });
    // A film still not found yet (design.md: 2. Media choices) shows which file belongs here.
    picture.addEventListener('error', () => picture.replaceWith(el('p', { class: 'lmml-placeholder' }, `Film still to add: frontend/${item.src}`)), { once: true });
  }
  return el(
    'figure',
    { class: 'lmml-figure', dataset: { kind: item.kind, frame: String(number), aspect: aspect || '' } },
    picture,
    el('figcaption', {}, item.caption, ' ', el('span', { class: 'lmml-credit' }, credit(item)))
  );
}

function youtube(item) {
  return el('iframe', {
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.video.id)}?start=${item.video.start || 0}&autoplay=1`,
    title: item.caption,
    allow: 'autoplay; encrypted-media',
    allowfullscreen: true,
  });
}

function credit(item) {
  if (item.kind === 'still') return `Film still © ${item.credit}.`;
  if (item.kind === 'video') return ['Video: ', el('a', { href: item.source }, item.credit), ' on YouTube.'];
  return [`Photo: ${item.creator}, `, el('a', { href: item.licenseUrl }, item.license), ', ', el('a', { href: item.source }, 'Wikimedia Commons'), '.'];
}

// ------------------------------------------------------------------- scenes

function scene(s, withDescription) {
  const c = s.camera;
  const episode = s.episode;
  // Series without episode titles call them "Episode 1": then the number says it all.
  const episodeTitle = episode && episode.title !== `Episode ${episode.episode}` ? `: “${episode.title}”` : '';
  const shot = [SHOT_SIZES[c.shotSize], ANGLES[c.angle], c.lensMm && `${c.lensMm} mm lens`].filter(Boolean).join(', ');
  return el(
    'article',
    { class: 'lmml-scene' },
    el('h3', {}, productionLabel(s.production), episode ? `, series ${episode.season} episode ${episode.episode}${episodeTitle}` : ''),
    withDescription ? el('p', {}, s.description) : null,
    el(
      'table',
      { class: 'lmml-table lmml-camera' },
      el('caption', {}, 'Where the camera stood'),
      el(
        'tbody',
        {},
        row('Position', `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`),
        row('Facing', c.bearing === null ? 'not documented' : `${c.bearing}° (${compassName(c.bearing)})`),
        row('Shot', shot || 'not documented'),
        c.timeOfDay ? row('Time of day', c.timeOfDay.toLowerCase()) : null,
        row('Accuracy', `about ±${c.accuracyM} m`)
      )
    ),
    s.costume ? el('p', { class: 'lmml-costume' }, el('strong', {}, 'Costume: '), s.costume) : null
  );
}

function row(label, value) {
  return el('tr', {}, el('th', { scope: 'row' }, label), el('td', {}, value));
}

// ---------------------------------------------------------------------- map

function drawMap(place, stop, scenes, next) {
  const section = part('map');
  const button = section.querySelector('button');
  const status = section.querySelector('[role="status"]');
  const map = createMap(part('map-canvas'), place.geo, 17);
  pin(map, place.geo, stop ? stop.step + 1 : '★', { title: place.name, current: true });
  scenes.forEach((s) => camera(map, s.camera));
  const points = [place.geo, ...scenes.map((s) => s.camera)];
  if (next) {
    pin(map, next.location.geo, next.step + 1, { title: next.location.name });
    line(map, place.geo, next.location.geo, next.directions.mode);
    points.push(next.location.geo);
  }
  fit(map, points);

  const track = () => {
    button.hidden = true;
    showPosition(map, place.geo, (error) => {
      status.textContent = `Your position is not available: ${error.message}.`;
    });
  };
  button.addEventListener('click', track);
  positionAllowed().then((allowed) => allowed && track());
}

// The route in Google Maps from where the visitor is to this stop: on foot, or by public transport
// when the story goes there by metro, tube, bus or train.
function navigateHref(place, stop) {
  const travelmode = stop.directions.mode === 'walk' ? 'walking' : 'transit';
  return `https://www.google.com/maps/dir/?api=1&destination=${place.geo.lat},${place.geo.lng}&travelmode=${travelmode}&dir_action=navigate`;
}

// ------------------------------------------------------------------- record

// The catalogue record (design.md: 1. Technical choices): the core fields every location has, then the tailored
// blocks this place has.
function recordRows(place) {
  const { heritage: h, architecture: a, business: b, transport: t, access: x } = place;
  return [
    ['Kind', KINDS[place.kind]],
    ['Address', formatAddress(place.address)],
    ['Coordinates', `${place.geo.lat.toFixed(5)}, ${place.geo.lng.toFixed(5)}`],
    ['Productions', productionsOf(place).map(productionLabel).join('; ')],
    h && ['Heritage', [`${h.status} `, h.id ? register(h) : null]],
    a && ['Architecture', [a.style, a.architect, a.built].filter(Boolean).join(' · ')],
    b && ['Business', b.type],
    t && ['Transport', t.lines.join('; ')],
    x && ['Visiting', [x.fee ? 'admission charged' : 'free to see', x.notes].filter(Boolean).join(' · ')],
    ['Identifiers', identifiers(place.ids)],
    ['Record', `${place.cataloguing.status}, last checked ${place.cataloguing.modified}`],
  ]
    .filter((r) => r && r[1] && r[1].length !== 0)
    .map(([label, value]) => row(label, value));
}

// The register entry, linked when the register has a public page per entry.
function register(h) {
  const label = `(${h.register} ${h.id})`;
  return REGISTERS[h.register] ? el('a', { href: REGISTERS[h.register](h.id) }, label) : label;
}

function identifiers(ids) {
  const links = [];
  if (ids.wikidata) links.push(el('a', { href: `https://www.wikidata.org/wiki/${ids.wikidata}` }, `Wikidata ${ids.wikidata}`));
  if (ids.osm) links.push(el('a', { href: `https://www.openstreetmap.org/${ids.osm}` }, 'OpenStreetMap'));
  return links.flatMap((link, i) => (i ? [' · ', link] : [link]));
}

function navLinks(story, previous, next) {
  const link = (stop, text) => el('a', { href: stopHref(story.id, stop.location.id, stop.step) }, text);
  return [
    previous ? link(previous, `← ${previous.location.name}`) : el('span', {}),
    el('a', { href: `story.html?id=${encodeURIComponent(story.id)}` }, story.title),
    next ? link(next, `${next.location.name} →`) : el('span', {}, 'Last stop'),
  ];
}
