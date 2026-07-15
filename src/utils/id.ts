/**
 * Generate a unique layer id. Prefers `crypto.randomUUID()`; falls back to a timestamp + random
 * suffix in environments without the Web Crypto API (e.g. older jsdom).
 */
export const generateLayerId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
