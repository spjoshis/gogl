import * as google from './google.js';
import * as duckduckgo from './duckduckgo.js';

export const DEFAULT_ENGINE = 'google';

export const ENGINES = { google, duckduckgo };

export const ENGINE_NAMES = Object.keys(ENGINES);

export function resolveEngine(name) {
  const engine = ENGINES[name];
  if (!engine) {
    throw new Error(`Unknown engine: ${name}. Supported: ${ENGINE_NAMES.join(', ')}`);
  }
  return engine;
}
