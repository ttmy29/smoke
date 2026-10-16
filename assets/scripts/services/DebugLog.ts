import { ENABLE_DEBUG_LOGS } from '../config/InitialSettings';

/** Application-owned diagnostic messages; warnings and errors stay visible independently. */
export function debugLog(message: string, ...details: unknown[]): void {
  if (ENABLE_DEBUG_LOGS) console.debug(`[Smoke] ${message}`, ...details);
}
