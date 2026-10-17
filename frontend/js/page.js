// The frame every page shares (design.txt: Architecture): the visitor's settings, the theme, the header with
// its three menus (story, theme, language), the footer, the tabs of a portrait screen and the
// error state. A page module calls setupPage() once it knows its story and region; a page without
// data of its own (about.html) calls it from a one-line script.

import * as api from './apiClient.js';
import { el, fill } from './ui.js';

// ------------------------------------------------------------------ settings

// A theme picked by hand, the text cell and the active story. They live in localStorage, which can
// be unavailable (private windows, blocked storage), so every access is guarded. A ?theme= in the
// URL wins over the stored theme.
const SETTINGS_KEY = 'lmml-settings';

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    // no storage: start from the defaults
  }
  const text = (value) => (typeof value === 'string' ? value : null);
  return {
    theme: new URLSearchParams(location.search).get('theme') || text(saved.theme),
    cell: saved.cell || null,
    story: text(saved.story),
  };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // no storage: the settings last until the page is left
  }
}

// -------------------------------------------------------------------- themes

// A theme is a folder in themes/ with a theme.css, listed in themes/themes.json (design.txt: Themes and the canvas).
// css/base.css keeps the page invisible until <html> has a data-theme, so it never shows in the
// wrong theme.
let themeList = null;

function loadThemes() {
  themeList ??= fetch(new URL('../themes/themes.json', import.meta.url)).then((response) => {
    if (!response.ok) throw new Error('Could not load the list of themes');
    return response.json();
  });
  return themeList;
}

// Shows a theme once its stylesheet has loaded, then lets the maps measure themselves again.
async function applyTheme(theme) {
  const link = document.getElementById('theme-css');
  const href = new URL(`../themes/${theme.id}/theme.css`, import.meta.url).href;
  if (link.href !== href) {
    await new Promise((resolve) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
      link.href = href;
    });
  }
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
  // A theme can reorder the panels of a row (css/base.css): start again at the first one, or at
  // the one the address names.
  document.querySelectorAll('.lmml-panels').forEach((row) => row.scrollTo({ left: 0 }));
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'nearest', inline: 'start' });
  document.dispatchEvent(new CustomEvent('lmml-theme-change'));
}

// --------------------------------------------------------------------- frame

export async function setupPage({ settings = loadSettings(), story = null, region = '', onStoryChange = null } = {}) {
  const [themes, stories, regions] = await Promise.all([loadThemes(), api.get('/narratives'), api.get('/regions')]);
  document.documentElement.dataset.region = region;
  document.documentElement.dataset.story = story ? story.id : '';

  // A theme picked by hand wins; otherwise the story's own theme (Automatic, design.txt: Stories), else the first.
  const wanted = settings.theme || (story && story.theme);
  const theme = themes.find((t) => t.id === wanted) || themes[0];

  const chooseStory = (id) => {
    const chosen = stories.find((s) => s.id === id) || null;
    settings.story = chosen ? chosen.id : null;
    settings.theme = null; // the story's own theme applies again
    if (chosen) settings.cell = { ...chosen.defaults };
    saveSettings(settings);
    if (onStoryChange) onStoryChange(chosen);
    else location.href = chosen ? `story.html?id=${encodeURIComponent(chosen.id)}` : 'index.html';
  };
  const chooseTheme = (id) => {
    settings.theme = id;
    saveSettings(settings);
    applyTheme(themes.find((t) => t.id === id));
  };

  fill(document.querySelector('.lmml-header'),
    el('a', { class: 'lmml-brand', href: 'index.html' }, 'LMML'),
    el(
      'div',
      { class: 'lmml-controls' },
      control(
        'Story',
        el(
          'select',
          { onchange: (event) => chooseStory(event.target.value) },
          el('option', { value: '' }, 'No story'),
          regions.map((r) =>
            el(
              'optgroup',
              { label: r.name },
              stories.filter((s) => s.region === r.id).map((s) => el('option', { value: s.id, selected: story && story.id === s.id }, s.title))
            )
          )
        )
      ),
      control('Theme', el('select', { onchange: (event) => chooseTheme(event.target.value) }, themes.map((t) => el('option', { value: t.id, selected: t.id === theme.id }, t.name)))),
      control('Language', el('span', { id: 'lmml-language' }))
    )
  );
  fill(document.querySelector('.lmml-footer'),
    el('p', {}, '© 2026 Bram Mathijsen: typography and layout. The content remains with its original owners.'),
    el(
      'nav',
      { 'aria-label': 'Site' },
      el('a', { href: 'index.html' }, 'Stories'),
      ' · ',
      el('a', { href: 'about.html' }, 'About'),
      ' · ',
      el('a', { href: 'colophon.html' }, 'Colophon'),
      ' · QR codes: ',
      regions.map((r, i) => [i ? ', ' : '', el('a', { href: `qr.html?region=${r.id}` }, r.name)])
    )
  );

  startTranslation();
  watchTabs();
  await applyTheme(theme); // shows the page
}

// A menu with its name; the name hides on narrow screens but stays readable to screen readers.
function control(name, field) {
  return el('label', {}, el('span', { class: 'lmml-control-name' }, name), ' ', field);
}

// The language menu (design.txt: Language): the texts are written in English, and translate.js (MIT,
// vendored in vendor/translate/) translates the page into the visitor's language with Microsoft's
// free translation service. It remembers the choice and also translates what the page draws later.
function startTranslation() {
  const translate = window.translate;
  if (!translate) return; // the script did not load (offline): the page stays in English
  translate.selectLanguageTag.documentId = 'lmml-language';
  translate.selectLanguageTag.languages = 'english,french,dutch,deutsch,spanish,italian';
  translate.ignore.class.push('leaflet-container'); // the map draws its own labels
  translate.ignore.class.push('lmml-qr-url'); // web addresses stay as they are
  translate.language.setLocal('english');
  // Every text is English, even when it names French places ("Amélie", "café"): stop the library
  // from guessing a text's language from its accented letters and skipping it.
  const detect = translate.language.recognitionAlgorithm;
  translate.language.recognitionAlgorithm = (...args) => ({ ...detect(...args), languageName: 'english' });
  translate.service.use('client.edge');
  translate.listener.start();
  translate.execute();
}

// On a portrait screen (or a phone on its side) the panels of a page stand in a row and show one
// or two at a time (css/base.css); the tabs of the panels in view are marked as current.
function watchTabs() {
  const tabs = [...document.querySelectorAll('.lmml-tabs a')];
  if (!tabs.length || !('IntersectionObserver' in window)) return;
  const inView = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inView.add(entry.target.id);
        else inView.delete(entry.target.id);
      }
      for (const tab of tabs) {
        if (inView.has(tab.hash.slice(1))) tab.setAttribute('aria-current', 'true');
        else tab.removeAttribute('aria-current');
      }
    },
    { threshold: 0.6 }
  );
  tabs.forEach((tab) => observer.observe(document.getElementById(tab.hash.slice(1))));
}

// --------------------------------------------------------------------- error

// Replaces the content of the page with an error message, and shows the page if no theme has.
export function showError(error) {
  console.error(error);
  fill(document.getElementById('main'),
    el(
      'section',
      { class: 'lmml-panel lmml-error', role: 'alert' },
      el('h1', {}, error.status === 404 ? 'Not found' : 'Something went wrong'),
      el('p', {}, error.message),
      el('p', {}, el('a', { href: 'index.html' }, 'Back to the start page'))
    )
  );
  if (!document.documentElement.dataset.theme) loadThemes().then((themes) => applyTheme(themes[0]), () => {});
}
