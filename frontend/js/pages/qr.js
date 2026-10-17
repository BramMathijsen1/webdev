// QR codes (design.txt: Pages): one printable card per location of a city. Each code opens the
// location's page on the public site; that page then follows the visitor's story.
//   qr.html?region=<id>
// The codes are drawn by the vendored qrcode-generator (the global `qrcode`).

import * as api from '../apiClient.js';
import { loadSettings, setupPage, showError } from '../page.js';
import { el, fill, fillFields, setTitle } from '../ui.js';

// The public address of the site on GitHub Pages. The codes always point here, so codes printed
// while testing on your own computer still work on the street.
const PUBLIC_BASE_URL = 'https://brammathijsen1.github.io/webdev/';

const main = document.getElementById('main');

start().catch(showError);

async function start() {
  const regions = await api.get('/regions');
  const wanted = new URLSearchParams(location.search).get('region');
  const region = await api.get(`/regions/${regions.some((r) => r.id === wanted) ? wanted : regions[0].id}`);
  await setupPage({ settings: loadSettings(), region: region.id });
  setTitle(`QR codes for ${region.name}`);

  fillFields(main, { title: `QR codes for ${region.name}` });
  main.querySelector('.lmml-print').addEventListener('click', () => window.print());
  fill(main.querySelector('.lmml-qr-cards'), region.locations.map(card));
}

function card(location) {
  const url = `${PUBLIC_BASE_URL}frontend/location.html?id=${encodeURIComponent(location.id)}`;
  const code = window.qrcode(0, 'M'); // 0: the smallest size that fits; M: medium error correction
  code.addData(url);
  code.make();
  const picture = el('div', { class: 'lmml-qr-code', role: 'img', 'aria-label': `QR code for ${location.name}` });
  picture.innerHTML = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); // SVG made by the library
  return el('article', { class: 'lmml-qr-card' }, el('h2', {}, location.name), picture, el('p', { class: 'lmml-qr-url' }, url));
}
