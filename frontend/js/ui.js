// Small helpers shared by the pages: filling a page's HTML, building elements and formatting values.

// Fills the slots of a page: every element with data-field="name" inside `container` gets
// values[name] as its text. Slots without a value keep what the HTML has.
export function fillFields(container, values) {
  for (const slot of container.querySelectorAll('[data-field]')) {
    const value = values[slot.dataset.field];
    if (value !== undefined && value !== null) slot.textContent = value;
  }
}

// el('p', { class: 'note' }, 'Hello ', el('strong', {}, 'world'))
// Attributes: 'class', 'dataset' (an object), 'on…' (event listeners) or any HTML attribute
// (null and false are left out). Children are nodes or text: text is never read as HTML.
// Arrays of children are flattened; null and false are skipped.
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'dataset') Object.assign(node.dataset, value);
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? '' : value);
  }
  return fill(node, ...children);
}

// Replaces all children of a node.
export function fill(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// A CSL-JSON reference in a short author–date style: "Author (year). Title. Container. URL".
export function citation(ref) {
  const authors = (ref.author || []).map((a) => a.literal || `${a.family}, ${a.given}`).join('; ');
  const year = ref.issued ? ` (${ref.issued['date-parts'][0][0]})` : '';
  return [
    authors ? `${authors}${year}. ` : '',
    el('cite', {}, ref.title),
    ref['container-title'] ? `. ${ref['container-title']}. ` : '. ',
    el('a', { href: ref.URL }, ref.URL),
  ];
}

export function stopHref(storyId, locationId, step) {
  return `location.html?id=${encodeURIComponent(locationId)}&story=${encodeURIComponent(storyId)}&step=${step}`;
}

export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatAddress({ streetAddress, postalCode, locality }) {
  return [streetAddress, [postalCode, locality].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function productionLabel(production) {
  return `${production.title} (${production.years})`;
}

const MODES = { walk: 'walk', metro: 'by Métro', tube: 'by Tube', bus: 'by bus', train: 'by train' };

export function modeLabel(mode) {
  return MODES[mode] || mode;
}

export function setTitle(...parts) {
  document.title = [...parts.filter(Boolean), 'LMML'].join(' · ');
}
