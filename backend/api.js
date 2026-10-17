// LMML API handler: the "backend" of the app (design.txt: Architecture).
//
// handle(db, path) answers one read-only request, like a small REST API:
//   db   = the parsed backend/db.json
//   path = for example '/locations/cafe-des-2-moulins'
// It returns { status, body }. It only reads its inputs (no fetch, no DOM), so the browser
// runs it directly: see frontend/js/apiClient.js.
//
// Routes:
//   /regions            the regions
//   /regions/<id>       one region with its locations (for the QR codes)
//   /narratives         every story, as a summary (start page, story switch)
//   /narratives/<id>    one story, its stops numbered and joined with their locations
//   /locations/<id>     one location, joined with its region, productions, references and stories
//   /sources            where the content comes from: every reference, and the source of every
//                       photo, film still and video clip (the colophon page)
//
// db.json stays normalised (records point to each other by id); the joins and the computed
// fields (stop numbers, totals) are made here.

export function handle(db, path) {
  const [collection, id, ...rest] = new URL(path, 'https://lmml.invalid').pathname
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const route = rest.length === 0 ? routeFor(collection, id) : null;
  if (!route) return notFound(`No such route: ${path}`);
  try {
    return route(db, id);
  } catch (error) {
    return reply(500, { error: { code: 'internal-error', message: error.message } });
  }
}

function routeFor(collection, id) {
  if (collection === 'regions') return id ? getRegion : listRegions;
  if (collection === 'narratives') return id ? getNarrative : listNarratives;
  if (collection === 'locations' && id) return getLocation;
  if (collection === 'sources' && !id) return listSources;
  return null;
}

// The body is copied, as a real API would send a serialised response: a page can never
// change the database by accident.
function reply(status, body) {
  return { status, body: JSON.parse(JSON.stringify(body)) };
}

const ok = (body) => reply(200, body);
const notFound = (message) => reply(404, { error: { code: 'not-found', message } });
const byId = (list, id) => list.find((item) => item.id === id);

// ------------------------------------------------------------------ regions

function listRegions(db) {
  return ok(db.regions.map(({ id, name }) => ({ id, name })));
}

function getRegion(db, id) {
  const region = byId(db.regions, id);
  if (!region) return notFound(`Unknown region: ${id}`);
  const locations = db.locations.filter((location) => location.region === id);
  return ok({ ...region, locations: locations.map((location) => locationSummary(db, location)) });
}

// -------------------------------------------------- productions, locations

function productionSummary(production) {
  const years =
    production.type === 'TVSeries' ? `${production.startYear}–${production.endYear || ''}` : String(production.year);
  return { id: production.id, title: production.title, years };
}

function locationSummary(db, location) {
  const productionIds = [...new Set(location.scenes.map((scene) => scene.production))];
  return {
    id: location.id,
    name: location.name,
    geo: location.geo,
    productions: productionIds.map((id) => productionSummary(byId(db.productions, id))),
  };
}

function getLocation(db, id) {
  const location = byId(db.locations, id);
  if (!location) return notFound(`Unknown location: ${id}`);
  const region = byId(db.regions, location.region);
  return ok({
    ...location,
    region: { id: region.id, name: region.name },
    scenes: location.scenes.map((scene) => {
      const production = byId(db.productions, scene.production);
      return {
        ...scene,
        production: { ...productionSummary(production), aspectRatio: production.aspectRatio },
        episode: (production.episodes || []).find((episode) => episode.id === scene.episode) || null,
        media: scene.media.map((mediaId) => byId(location.media, mediaId)),
      };
    }),
    references: location.references.map((referenceId) => byId(db.references, referenceId)),
    appearsIn: storiesVisiting(db, id),
  });
}

// --------------------------------------------------------------- narratives

// The stops of a story in order, numbered across its chapters (a location can appear
// twice, so the step number, not the location, identifies a stop).
function stopsOf(narrative) {
  let step = 0;
  return narrative.chapters.flatMap((chapter, chapterIndex) =>
    chapter.stops.map((stop, index) => ({ ...stop, step: step++, chapterIndex, firstInChapter: index === 0 }))
  );
}

function totalsOf(stops) {
  const sum = (value) => stops.reduce((total, stop) => total + (value(stop) || 0), 0);
  return {
    stops: stops.length,
    meters: sum((stop) => stop.directions && stop.directions.meters),
    minutes: sum((stop) => stop.minutes) + sum((stop) => stop.directions && stop.directions.minutes),
  };
}

function narrativeSummary(narrative) {
  const { id, region, title, premise, pointOfView, audience, defaults, theme } = narrative;
  return { id, region, title, premise, pointOfView, audience, defaults, theme, totals: totalsOf(stopsOf(narrative)) };
}

function listNarratives(db) {
  return ok(db.narratives.map(narrativeSummary));
}

function getNarrative(db, id) {
  const narrative = byId(db.narratives, id);
  if (!narrative) return notFound(`Unknown story: ${id}`);
  const stops = stopsOf(narrative).map((stop) => ({ ...stop, location: locationSummary(db, byId(db.locations, stop.location)) }));
  const region = byId(db.regions, narrative.region);
  return ok({
    ...narrative,
    region: { id: region.id, name: region.name, center: region.center, zoom: region.zoom },
    chapters: narrative.chapters.map((chapter, index) => ({
      ...chapter,
      stops: stops.filter((stop) => stop.chapterIndex === index),
    })),
    totals: totalsOf(stops),
  });
}

// ------------------------------------------------------------------ sources

// The original locations of the content (design.txt: Pages, colophon): the references the facts cite,
// then each picture and clip with the page it comes from. A still not found yet has no source.
function listSources(db) {
  const media = db.locations.flatMap((location) => location.media.map((item) => ({ ...item, place: location.name })));
  const ofKind = (kind) =>
    media
      .filter((item) => item.kind === kind && item.source)
      .map(({ caption, place, creator, credit, license, source }) => ({ caption, place, creator, credit, license, source }));
  return ok({ references: db.references, photos: ofKind('photo'), stills: ofKind('still'), videos: ofKind('video') });
}

// The stories that visit a location, with the step numbers of its stops.
function storiesVisiting(db, locationId) {
  return db.narratives
    .map((narrative) => ({
      id: narrative.id,
      steps: stopsOf(narrative)
        .filter((stop) => stop.location === locationId)
        .map((stop) => stop.step),
    }))
    .filter((story) => story.steps.length > 0);
}
