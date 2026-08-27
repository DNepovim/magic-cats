/**
 * The cat simulation.
 *
 * A cat is stored as a snapshot — satiety, happiness, illness — plus the
 * moment that snapshot was true (`state_at`). Everything else is derived by
 * replaying time forward in fixed steps, so nothing has to tick server-side
 * and an untouched cat still gets hungry.
 *
 * The replay is deterministic, including illness: each step rolls a PRNG
 * seeded from the cat's id and the step's index, so the browser and the API
 * always arrive at the same cat from the same snapshot.
 */

import { ILLNESSES, type Illness, itemById, tasteFor } from './items';

/** The minimum a cat needs to be replayed forward. */
export type SimInput = {
  id: string;
  satiety: number;
  happiness: number;
  state_at: string;
  illness: Illness | null;
};

/** Everything an action needs on top of that. */
export type CatState = SimInput & {
  taste_seed: number;
  last_petted_at: string | null;
};

export const STAT_MAX = 100;

/** Above this, she is comfortable and cheers up; below it, she sulks. */
export const SATIETY_THRESHOLD = 50;

/** Satiety she must reach before medicine can do anything. */
export const CURE_SATIETY = 80;

const HOUR = 3_600_000;
export const STEP_MS = 5 * 60_000;
/** A month of neglect is as bad as it gets; beyond that the replay is capped. */
const MAX_STEPS = (30 * 24 * HOUR) / STEP_MS;

// ~16h from stuffed down to the threshold, ~33h to empty: a cat wants
// attention daily, but one missed evening is not a catastrophe.
export const SATIETY_DECAY_PER_HOUR = 3;
export const HAPPINESS_RISE_PER_HOUR = 2;
export const HAPPINESS_FALL_PER_HOUR = 4;
/** Being ill costs mood on top of everything else, and doubles hunger. */
export const ILL_HAPPINESS_PER_HOUR = 3;
export const ILL_DECAY_MULTIPLIER = 2;

export const PET_HAPPINESS = 10;
export const PET_COOLDOWN_MS = 30 * 60_000;

// ── Night ─────────────────────────────────────────────────────────────────
// Cats sleep at night: they stop getting hungry, their mood slowly climbs, and
// they are not to be woken for food or games.
//
// "Night" is the same hours for everybody, in the game's home timezone — the
// simulation has to be reproducible from a timestamp alone, and a per-player
// timezone would make one cat's history depend on where it was read. The fixed
// offset means the boundary drifts by an hour under summer time, which is a
// price worth paying for a cat that is asleep at a sensible hour.
export const GAME_UTC_OFFSET_HOURS = 1;
export const NIGHT_STARTS_HOUR = 22;
export const NIGHT_ENDS_HOUR = 6;

/** Happiness gained per hour of undisturbed sleep. */
export const SLEEP_HAPPINESS_PER_HOUR = 3;

const localHour = (at: number): number => {
  const hours = at / HOUR + GAME_UTC_OFFSET_HOURS;
  return ((Math.floor(hours) % 24) + 24) % 24;
};

/** Whether the cats are asleep at this moment. */
export const isNight = (at = Date.now()): boolean => {
  const hour = localHour(at);
  return hour >= NIGHT_STARTS_HOUR || hour < NIGHT_ENDS_HOUR;
};

/** When they will wake — the next NIGHT_ENDS_HOUR in the game's timezone. */
export const wakesAt = (at = Date.now()): number => {
  const hour = localHour(at);
  const hoursUntil = hour < NIGHT_ENDS_HOUR ? NIGHT_ENDS_HOUR - hour : 24 - hour + NIGHT_ENDS_HOUR;
  // Snap to the top of the hour so the countdown lands on the boundary itself.
  const hourStart = Math.floor((at / HOUR + GAME_UTC_OFFSET_HOURS)) * HOUR - GAME_UTC_OFFSET_HOURS * HOUR;
  return hourStart + hoursUntil * HOUR;
};

const clamp = (value: number) => Math.max(0, Math.min(STAT_MAX, value));

/** mulberry32 — small, fast, and identical in every JS engine. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * Chance per hour of falling ill. A well-fed, happy cat is near-immune; a
 * starving miserable one is in real trouble.
 */
export const illnessChancePerHour = (satiety: number, happiness: number): number =>
  Math.max(0, (1 - satiety / STAT_MAX) * 0.1 + (1 - happiness / STAT_MAX) * 0.06);

export type SimulatedCat = {
  satiety: number;
  happiness: number;
  illness: Illness | null;
  /** When the illness that is showing now began. */
  ill_since: string | null;
};

/**
 * Replays a cat forward to `now`. Pure: same snapshot in, same cat out,
 * wherever it runs.
 */
export const simulate = (cat: SimInput, now = Date.now()): SimulatedCat => {
  const from = Date.parse(cat.state_at);
  const steps = Math.min(MAX_STEPS, Math.max(0, Math.floor((now - from) / STEP_MS)));

  let satiety = clamp(cat.satiety);
  let happiness = clamp(cat.happiness);
  let illness = cat.illness;
  let illSince: number | null = illness ? from : null;

  const stepHours = STEP_MS / HOUR;
  const seedBase = hash(cat.id);

  for (let step = 0; step < steps; step++) {
    const at = from + step * STEP_MS;
    const asleep = isNight(at);

    // Asleep she does not get hungry at all, ill or not.
    if (!asleep) {
      const decay = SATIETY_DECAY_PER_HOUR * (illness ? ILL_DECAY_MULTIPLIER : 1);
      satiety = clamp(satiety - decay * stepHours);
    }

    const drift = asleep
      ? SLEEP_HAPPINESS_PER_HOUR
      : satiety >= SATIETY_THRESHOLD
        ? HAPPINESS_RISE_PER_HOUR
        : -HAPPINESS_FALL_PER_HOUR;
    happiness = clamp(happiness + drift * stepHours - (illness ? ILL_HAPPINESS_PER_HOUR * stepHours : 0));

    if (!illness) {
      const random = rng(seedBase + step);
      if (random() < illnessChancePerHour(satiety, happiness) * stepHours) {
        illness = ILLNESSES[Math.floor(random() * ILLNESSES.length)] ?? ILLNESSES[0];
        illSince = from + (step + 1) * STEP_MS;
      }
    }
  }

  return {
    satiety: Math.round(satiety),
    happiness: Math.round(happiness),
    illness,
    ill_since: illSince === null ? null : new Date(illSince).toISOString(),
  };
};

/** The snapshot to store after an action — always simulated up to `now` first. */
export type Snapshot = {
  satiety: number;
  happiness: number;
  illness: Illness | null;
  ill_since: string | null;
  state_at: string;
};

const snapshot = (state: SimulatedCat, now: number): Snapshot => ({
  ...state,
  state_at: new Date(now).toISOString(),
});

export type FeedResult = Snapshot & {
  satietyGain: number;
  happinessGain: number;
  taste: number;
};

/** Feeding: the cat's taste scales the food's satiety, never its joy. */
export const applyFood = (cat: CatState, itemId: string, now = Date.now()): FeedResult | null => {
  const item = itemById(itemId);
  if (!item || item.kind === 'medicine') return null;
  // Medicine still gets through at night; a bowl of food does not.
  if (isNight(now)) return null;

  const current = simulate(cat, now);
  const taste = tasteFor(cat.taste_seed, itemId);
  const satietyGain = Math.round(item.satiety * taste);
  // A meal she dislikes is still a meal, but it does not lift her mood.
  const happinessGain = taste < 0.75 ? Math.round(item.happiness / 2) : item.happiness;

  return {
    ...snapshot(
      {
        ...current,
        satiety: clamp(current.satiety + satietyGain),
        happiness: clamp(current.happiness + happinessGain),
      },
      now,
    ),
    satietyGain,
    happinessGain,
    taste,
  };
};

export type MedicineOutcome =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; reason: 'not-ill' | 'wrong-medicine' | 'too-hungry' };

/**
 * Medicine only works on a cat with something in her stomach — under
 * CURE_SATIETY she is too weak to keep it down.
 */
export const applyMedicine = (
  cat: CatState,
  itemId: string,
  now = Date.now(),
): MedicineOutcome => {
  const item = itemById(itemId);
  const current = simulate(cat, now);

  if (!current.illness) return { ok: false, reason: 'not-ill' };
  if (!item || item.cures !== current.illness) return { ok: false, reason: 'wrong-medicine' };
  if (current.satiety < CURE_SATIETY) return { ok: false, reason: 'too-hungry' };

  return {
    ok: true,
    snapshot: snapshot(
      {
        satiety: current.satiety,
        happiness: clamp(current.happiness + 8),
        illness: null,
        ill_since: null,
      },
      now,
    ),
  };
};

export const petCooldownLeft = (
  cat: Pick<CatState, 'last_petted_at'>,
  now = Date.now(),
): number =>
  cat.last_petted_at === null
    ? 0
    : Math.max(0, Date.parse(cat.last_petted_at) + PET_COOLDOWN_MS - now);

export type PlayRefusal = { ok: false; reason: 'resting' | 'ill' | 'asleep' };
export type PlayReadiness = { ok: true } | PlayRefusal;
export type PlayOutcome = { ok: true; snapshot: Snapshot } | PlayRefusal;

/**
 * Whether she is up for a game at all. Checked before a round starts, so a
 * player is never sent into a game whose reward would be refused afterwards.
 */
export const canPlay = (
  cat: SimInput & Pick<CatState, 'last_petted_at'>,
  now = Date.now(),
): PlayReadiness => {
  if (isNight(now)) return { ok: false, reason: 'asleep' };
  if (petCooldownLeft(cat, now) > 0) return { ok: false, reason: 'resting' };
  if (simulate(cat, now).illness) return { ok: false, reason: 'ill' };
  return { ok: true };
};

/**
 * Banking a finished round. The gain comes from the game and the cat's taste
 * for it (see $lib/game/play); the guards are the same ones canPlay() applies,
 * rechecked here because the round takes time and the world moves on.
 */
export const applyPlay = (
  cat: SimInput & Pick<CatState, 'last_petted_at'>,
  gain: number = PET_HAPPINESS,
  now = Date.now(),
): PlayOutcome => {
  const ready = canPlay(cat, now);
  if (!ready.ok) return ready;

  const current = simulate(cat, now);
  return {
    ok: true,
    snapshot: snapshot({ ...current, happiness: clamp(current.happiness + gain) }, now),
  };
};

export type MoodTier = 'miserable' | 'grumpy' | 'content' | 'happy' | 'blissful';

export const moodTier = (happiness: number): MoodTier => {
  if (happiness < 20) return 'miserable';
  if (happiness < 45) return 'grumpy';
  if (happiness < 70) return 'content';
  if (happiness < 90) return 'happy';
  return 'blissful';
};

export const MOOD_EMOJI: Record<MoodTier, string> = {
  miserable: '😿',
  grumpy: '🙀',
  content: '😺',
  happy: '😸',
  blissful: '😻',
};

export type HungerTier = 'starving' | 'hungry' | 'peckish' | 'fed' | 'stuffed';

export const hungerTier = (satiety: number): HungerTier => {
  if (satiety < 20) return 'starving';
  if (satiety < SATIETY_THRESHOLD) return 'hungry';
  if (satiety < 70) return 'peckish';
  if (satiety < 90) return 'fed';
  return 'stuffed';
};

/** "1h 04m" / "4m 20s" — enough to know whether it is worth waiting. */
export const formatCountdown = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

// ── Cat-versus-cat games ──────────────────────────────────────────────────

export const GAME_KINDS = ['chase', 'wrestle', 'yarn'] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const GAME_COOLDOWN_MS = 30 * 60_000;
export const GAME_WIN_HAPPINESS = 8;
export const GAME_LOSS_HAPPINESS = 3;

export const gameCooldownLeft = (cat: Pick<CatRowLike, 'last_played_at'>, now = Date.now()): number =>
  cat.last_played_at === null
    ? 0
    : Math.max(0, Date.parse(cat.last_played_at) + GAME_COOLDOWN_MS - now);

type CatRowLike = { last_played_at: string | null };

export type GameSide = { happiness: number; satiety: number; domestication_points: number };

export type GameOutcome = {
  kind: GameKind;
  challengerScore: number;
  opponentScore: number;
  challengerWon: boolean;
};

/**
 * A game is mostly about how well a cat is kept — mood first, then whether she
 * has the energy for it, then the points she was tamed with, then luck.
 */
export const scoreSide = (side: GameSide, luck: number): number =>
  Math.round(side.happiness * 1.1 + side.satiety * 0.5 + side.domestication_points * 0.3 + luck * 30);

export const resolveGame = (
  challenger: GameSide,
  opponent: GameSide,
  random: () => number = Math.random,
): GameOutcome => {
  const kind = GAME_KINDS[Math.floor(random() * GAME_KINDS.length)] ?? GAME_KINDS[0];
  const challengerScore = scoreSide(challenger, random());
  const opponentScore = scoreSide(opponent, random());

  return {
    kind,
    challengerScore,
    opponentScore,
    // A dead heat goes to the cat who was brave enough to ask.
    challengerWon: challengerScore >= opponentScore,
  };
};

/** The challenger's snapshot after a game. The opponent is never written. */
export const applyGame = (cat: SimInput, won: boolean, now = Date.now()): Snapshot => {
  const current = simulate(cat, now);
  return snapshot(
    {
      ...current,
      happiness: clamp(current.happiness + (won ? GAME_WIN_HAPPINESS : GAME_LOSS_HAPPINESS)),
    },
    now,
  );
};
