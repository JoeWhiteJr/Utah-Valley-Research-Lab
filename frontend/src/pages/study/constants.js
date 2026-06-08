// Study flow timing & validation constants.
// Used by both the client (Consent, GameFrame, Demographics) and assertions in tests.
// Server-side mirror in backend/src/research-studies/study-constants.js.

export const MIN_CONSENT_TIME_MS = 3000       // minimum read time before accept enabled
export const LOAD_TIMEOUT_MS = 12000           // game iframe load timeout
export const SAVE_RETRY_BACKOFF_MS = [500, 2000, 5000]
export const MIN_AGE = 18
export const MAX_AGE = 100
