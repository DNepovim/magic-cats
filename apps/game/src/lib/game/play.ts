/**
 * The five games you can play with a cat.
 *
 * Each round is seeded by the server, played in the browser from that seed, and
 * handed back as a *claim* the server can check — the same bargain the supply
 * run makes. Three games are fully verifiable (the claim names things the seed
 * put there); two are physical enough that the honest bound is time, so their
 * claims are capped by how many moves the round could possibly have contained.
 *
 * How much happiness a round is worth depends on how well it went *and* on how
 * much this particular cat enjoys that particular game. The preference is fixed
 * for her life and never shown — working out that Tulča will chase a laser all
 * day but ignores boxes is the point.
 */

import { hashString } from './items';

export const GAME_IDS = ['laser', 'bugs', 'yarn', 'brush', 'boxes'] as const;
export type GameId = (typeof GAME_IDS)[number];

export const GAME_EMOJI: Record<GameId, string> = {
  laser: '🔴',
  bugs: '🦗',
  yarn: '🧶',
  brush: '🪮',
  boxes: '📦',
};

/** How long a round lasts. Boxes ends on the pick, so it only bounds the page. */
export const GAME_DURATION_MS: Record<GameId, number> = {
  laser: 20_000,
  bugs: 20_000,
  yarn: 20_000,
  brush: 20_000,
  boxes: 15_000,
};

/** Grace for handing a round in over a slow connection. */
export const ROUND_GRACE_MS = 20_000;

/** Happiness a perfect round of a merely tolerated game is worth. */
export const PLAY_BASE_HAPPINESS = 16;

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * How much this cat likes this game, as a multiplier on the reward: 0.5 (humours
 * you) … 1.6 (lives for it). Fixed by her taste_seed, and namespaced so it does
 * not track her taste in food.
 */
export const gameAffinity = (tasteSeed: number, game: GameId): number => {
  const roll = hashString(`game:${tasteSeed}:${game}`) / 0xffffffff;
  return Math.round((0.5 + roll * 1.1) * 100) / 100;
};

/** The happiness a round earns: how well it went, scaled by how much she cares. */
export const happinessForRound = (score: number, affinity: number): number =>
  score <= 0 ? 0 : Math.max(1, Math.round(PLAY_BASE_HAPPINESS * (score / 100) * affinity));

// ── Bug hunt ──────────────────────────────────────────────────────────────
// Seeded scurrying bugs; tapping one sets her on it. The claim names indices,
// so it is checked exactly like a supply run.

export const BUG_COUNT = 14;

export type Bug = {
  index: number;
  emoji: string;
  spawnAt: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  travelMs: number;
  size: number;
};

const BUG_EMOJI = ['🦗', '🪲', '🕷️', '🪰', '🦋'];

export const bugsFor = (seed: number): Bug[] => {
  const random = rng(seed);
  const duration = GAME_DURATION_MS.bugs;

  return Array.from({ length: BUG_COUNT }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const midX = 0.25 + random() * 0.5;
    const midY = 0.2 + random() * 0.6;
    const dx = Math.cos(angle) * 0.8;
    const dy = Math.sin(angle) * 0.7;

    return {
      index,
      emoji: BUG_EMOJI[Math.floor(random() * BUG_EMOJI.length)] ?? BUG_EMOJI[0],
      spawnAt: Math.round((index / BUG_COUNT) * (duration - 2500) + random() * 600),
      fromX: midX - dx,
      fromY: midY - dy,
      toX: midX + dx,
      toY: midY + dy,
      travelMs: Math.round(3200 - random() * 1400),
      size: Math.round(52 - random() * 16),
    };
  });
};

// ── Brushing ──────────────────────────────────────────────────────────────
// Seeded tangles on her coat; hold the brush over one to work it out. Also a
// claim of indices, so also exactly checkable.

export const TANGLE_COUNT = 7;
/** Milliseconds of brushing within reach before a tangle gives way. */
export const TANGLE_WORK_MS = 700;

export type Tangle = { index: number; x: number; y: number; size: number };

export const tanglesFor = (seed: number): Tangle[] => {
  const random = rng(seed + 7777);

  return Array.from({ length: TANGLE_COUNT }, (_, index) => ({
    index,
    x: 0.12 + random() * 0.76,
    y: 0.12 + random() * 0.76,
    size: Math.round(44 + random() * 22),
  }));
};

// ── Box shuffle ───────────────────────────────────────────────────────────
// She hides in one box, the boxes swap a few times, you point at one. The seed
// decides where she is, so the claim is a single index and fully checkable.

export const BOX_COUNT = 3;
export const BOX_SWAPS = 6;
export const BOX_SWAP_MS = 620;

export type BoxShuffle = { hiding: number; swaps: [number, number][] };

export const boxShuffleFor = (seed: number): BoxShuffle => {
  const random = rng(seed + 4242);
  const hiding = Math.floor(random() * BOX_COUNT);

  const swaps = Array.from({ length: BOX_SWAPS }, () => {
    const a = Math.floor(random() * BOX_COUNT);
    const b = (a + 1 + Math.floor(random() * (BOX_COUNT - 1))) % BOX_COUNT;
    return [a, b] as [number, number];
  });

  return { hiding, swaps };
};

/** Where she ends up after the shuffle — the box the player should pick. */
export const boxAfterShuffle = (shuffle: BoxShuffle): number =>
  shuffle.swaps.reduce(
    (position, [a, b]) => (position === a ? b : position === b ? a : position),
    shuffle.hiding,
  );

// ── Time-bounded games ────────────────────────────────────────────────────
// A pounce and a volley are physical events, not seeded objects, so the honest
// ceiling is the clock: no round can contain more of them than it had time for.

/** Fastest a chase can plausibly produce pounces. */
export const LASER_POUNCE_MS = 1400;
/** Pounces that count as a perfect round. */
export const LASER_TARGET = 8;

/** Fastest a rally can plausibly volley. */
export const YARN_VOLLEY_MS = 900;
export const YARN_TARGET = 12;

export type Claim = {
  /** Bug hunt and brushing: the indices dealt with. */
  indices?: number[];
  /** Box shuffle: the box picked. */
  pick?: number;
  /** Laser and yarn: how many pounces or volleys the player claims. */
  count?: number;
};

const uniqueValid = (indices: number[] | undefined, max: number): number => {
  const seen = new Set<number>();
  for (const index of indices ?? []) {
    if (Number.isInteger(index) && index >= 0 && index < max) seen.add(index);
  }
  return seen.size;
};

const percent = (part: number, whole: number) =>
  Math.max(0, Math.min(100, Math.round((part / whole) * 100)));

/**
 * Scores a claim against what the seed actually contained, in 0…100. Anything
 * the round could not have produced is discarded rather than trusted.
 */
export const scoreRound = (
  game: GameId,
  seed: number,
  claim: Claim,
  elapsedMs: number,
): number => {
  const window = Math.min(elapsedMs, GAME_DURATION_MS[game] + 2000);

  switch (game) {
    case 'bugs':
      return percent(uniqueValid(claim.indices, BUG_COUNT), BUG_COUNT);

    case 'brush':
      return percent(uniqueValid(claim.indices, TANGLE_COUNT), TANGLE_COUNT);

    case 'boxes':
      return claim.pick === boxAfterShuffle(boxShuffleFor(seed)) ? 100 : 0;

    case 'laser': {
      const ceiling = Math.floor(window / LASER_POUNCE_MS);
      return percent(Math.min(claim.count ?? 0, ceiling), LASER_TARGET);
    }

    case 'yarn': {
      const ceiling = Math.floor(window / YARN_VOLLEY_MS);
      return percent(Math.min(claim.count ?? 0, ceiling), YARN_TARGET);
    }
  }
};
