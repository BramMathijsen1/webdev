// How the pages talk to the backend.
//
// There is no server: the "backend" (backend/api.js with backend/db.json) runs in the
// browser. The client loads the database once, then hands every request to the API
// handler, so a page can write
//     const location = await api.get('/locations/cafe-des-2-moulins');
// as if it were calling a web API. A real server could replace this file later
// without any change to the pages.

import { handle } from '../../backend/api.js';

const DATABASE_URL = new URL('../../backend/db.json', import.meta.url);

let database = null;

function loadDatabase() {
  if (!database) {
    database = fetch(DATABASE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the database (HTTP ${response.status})`);
        return response.json();
      })
      .catch((error) => {
        database = null; // try again on the next request
        throw error;
      });
  }
  return database;
}

export class ApiError extends Error {
  constructor({ status, code, message }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function get(path) {
  const db = await loadDatabase();
  const { status, body } = handle(db, path);
  if (status >= 400) throw new ApiError({ status, ...body.error });
  return body;
}
