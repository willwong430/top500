import { listUSFromPolygon } from './polygon.js';
import { listUSFromFinnhub } from './finnhub.js';

export async function fetchUniversePolygon() { return listUSFromPolygon(); }
export async function fetchUniverseFinnhub() { return listUSFromFinnhub(); }
