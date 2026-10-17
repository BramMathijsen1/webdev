// The colophon (design.txt: Pages): the course disclaimer, with the original location of every piece
// of content. The four lists come from the database (/sources), so they always match the site.

import * as api from '../apiClient.js';
import { setupPage, showError } from '../page.js';
import { citation, el, fill, setTitle } from '../ui.js';

const link = (url) => el('a', { href: url }, url);

// How each kind of source is listed.
const ITEMS = {
  references: (ref) => citation(ref),
  photos: (photo) => [`${photo.caption} (${photo.place}). Photo: ${photo.creator}, ${photo.license}: `, link(photo.source)],
  stills: (still) => [`${still.caption} (${still.place}). Film still © ${still.credit}: `, link(still.source)],
  videos: (video) => [`${video.caption} (${video.place}). ${video.credit} on YouTube: `, link(video.source)],
};

start().catch(showError);

async function start() {
  const sources = await api.get('/sources');
  await setupPage();
  setTitle('Colophon');
  for (const [list, item] of Object.entries(ITEMS)) {
    fill(document.querySelector(`[data-list="${list}"]`), sources[list].map((source) => el('li', {}, item(source))));
  }
}
