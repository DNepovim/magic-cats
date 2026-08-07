export const THRESHOLD = 100;

// Cats a single user may own at once. Enforced server-side in
// src/routes/api/cats/+server.ts and src/routes/tame/+page.server.ts — there is
// no DB constraint, so raising this is a one-line change.
export const MAX_CATS = 3;

export const CAT_COUNT = 5;
export const FOOD_COUNT = 8;

export const CAT_SIZE = 96;
export const CAT_RESPAWN_MS = 1200;
export const FOOD_RESPAWN_MS = 900;

// pixels per second
export const CAT_SPEED_RANGE = [60, 140] as const;
export const FOOD_SPEED_RANGE = [30, 80] as const;
