// Leaflet helpers (design.md: 1. Technical choices). Leaflet is a classic script (frontend/vendor/leaflet/) that
// defines the global L. Pins, lines and camera wedges get .lmml-* classes, so themes can style them.

const L = window.L;

// ------------------------------------------------- geometry of the camera wedge
// Points are { lat, lng } in degrees (WGS84); bearings are degrees from north.

const EARTH_RADIUS = 6371000; // metres
const toRad = (degrees) => (degrees * Math.PI) / 180;
const toDeg = (radians) => (radians * 180) / Math.PI;

// The point reached by going `meters` from `start` towards `bearing`.
function destination(start, bearing, meters) {
  const angle = meters / EARTH_RADIUS;
  const lat1 = toRad(start.lat);
  const b = toRad(bearing);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(b));
  const lng2 =
    toRad(start.lng) +
    Math.atan2(Math.sin(b) * Math.sin(angle) * Math.cos(lat1), Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

// How wide a lens sees, in degrees, from its 35 mm-equivalent focal length.
function fieldOfView(lensMm) {
  return toDeg(2 * Math.atan(36 / (2 * lensMm)));
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export function compassName(bearing) {
  return COMPASS[Math.round(bearing / 45) % 8];
}

// ------------------------------------------------------------------------ map

export function createMap(element, center, zoom) {
  const map = L.map(element, { scrollWheelZoom: false }).setView([center.lat, center.lng], zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // A theme can change the map's size: let Leaflet measure it again.
  document.addEventListener('lmml-theme-change', () => map.invalidateSize());
  return map;
}

// A round pin with a short label in it: a stop number, S for the start, ★ for a place on its own.
export function pin(map, point, label, { title = '', current = false } = {}) {
  const icon = L.divIcon({ className: current ? 'lmml-pin is-current' : 'lmml-pin', html: `<span>${label}</span>`, iconSize: [30, 30] });
  L.marker([point.lat, point.lng], { icon, title }).addTo(map);
}

// A straight line from one stop to the next: solid on foot, dashed by public transport.
export function line(map, from, to, mode) {
  const className = mode === 'walk' ? 'lmml-line' : 'lmml-line is-transit';
  L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { className, interactive: false }).addTo(map);
}

// Where the camera stood: a dot, plus a wedge as wide as the lens sees when the bearing is known.
export function camera(map, cam) {
  if (cam.bearing !== null) {
    const half = fieldOfView(cam.lensMm || 35) / 2;
    const edge = [-1, -0.5, 0, 0.5, 1].map((part) => destination(cam, cam.bearing + part * half, 45));
    L.polygon([cam, ...edge].map((p) => [p.lat, p.lng]), { className: 'lmml-cone', interactive: false }).addTo(map);
  }
  L.circleMarker([cam.lat, cam.lng], { radius: 6, className: 'lmml-camera-dot', interactive: false }).addTo(map);
}

export function fit(map, points) {
  map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 17 });
}

// Shows the visitor's live position: a dot with a circle as large as the GPS uncertainty.
// The first fix zooms out just enough to show both the visitor and `place`.
export function showPosition(map, place, onError) {
  if (!navigator.geolocation) return onError(new Error('this browser cannot share its position'));
  let dot = null;
  let ring = null;
  navigator.geolocation.watchPosition(
    ({ coords }) => {
      const here = [coords.latitude, coords.longitude];
      if (dot) {
        dot.setLatLng(here);
        ring.setLatLng(here).setRadius(coords.accuracy);
        return;
      }
      ring = L.circle(here, { radius: coords.accuracy, className: 'lmml-me-accuracy', interactive: false }).addTo(map);
      dot = L.circleMarker(here, { radius: 7, className: 'lmml-me', interactive: false }).addTo(map);
      fit(map, [place, { lat: here[0], lng: here[1] }]);
    },
    onError,
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
  );
}

// True when the visitor already allowed this site to use their position: then the page
// can show it straight away, without the button.
export async function positionAllowed() {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted';
  } catch {
    return false;
  }
}
