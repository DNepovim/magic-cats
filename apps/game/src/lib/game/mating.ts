/**
 * Mating, pregnancy and kittens.
 *
 * Whether a mating takes is a matter of chance, and the chance is how well the
 * two cats are kept: a pair at 50% happiness barely manage it, a pair in fine
 * fettle usually do. Below 50% they will not try at all.
 *
 * The outcome of a *successful* mating — how many kittens, what they look like
 * — is decided at birth from a seed, so the same pregnancy always produces the
 * same litter no matter how often the page is loaded.
 */

import { PREGNANCY_MS, simulate, type SimInput } from './care';
import { hashString } from './items';

export type Gender = 'male' | 'female';

export const GENDER_SYMBOL: Record<Gender, string> = {
  male: '♂',
  female: '♀',
};

/** Neither cat will consider it below this. */
export const MATING_MIN_HAPPINESS = 50;

/** Whether they will try again, win or lose. */
export const MATING_COOLDOWN_MS = 3 * 60 * 60_000;

export const MIN_KITTENS = 1;
export const MAX_KITTENS = 3;

export type MateCandidate = SimInput & {
  id: string;
  gender: Gender;
  last_mated_at?: string | null;
};

export type MatingRefusal =
  | 'same-gender'
  | 'unhappy'
  | 'already-expecting'
  | 'ill'
  | 'resting'
  | 'asleep';

export type MatingReadiness = { ok: true; chance: number } | { ok: false; reason: MatingRefusal };

const cooldownLeft = (cat: MateCandidate, now: number) =>
  cat.last_mated_at ? Math.max(0, Date.parse(cat.last_mated_at) + MATING_COOLDOWN_MS - now) : 0;

/**
 * The chance a mating takes: 15% for a pair scraping the threshold, rising to
 * 85% for two blissful cats.
 */
export const matingChance = (happinessA: number, happinessB: number): number => {
  const average = (happinessA + happinessB) / 2;
  const above = Math.max(0, average - MATING_MIN_HAPPINESS) / (100 - MATING_MIN_HAPPINESS);
  return Math.round((0.15 + above * 0.7) * 100) / 100;
};

/** Whether these two may try, and with what chance. */
export const canMate = (
  a: MateCandidate,
  b: MateCandidate,
  now = Date.now(),
): MatingReadiness => {
  if (a.gender === b.gender) return { ok: false, reason: 'same-gender' };

  const female = a.gender === 'female' ? a : b;
  if (female.pregnant_since) return { ok: false, reason: 'already-expecting' };

  const stateA = simulate(a, now);
  const stateB = simulate(b, now);

  if (stateA.illness || stateB.illness) return { ok: false, reason: 'ill' };
  if (stateA.happiness < MATING_MIN_HAPPINESS || stateB.happiness < MATING_MIN_HAPPINESS) {
    return { ok: false, reason: 'unhappy' };
  }
  if (cooldownLeft(a, now) > 0 || cooldownLeft(b, now) > 0) {
    return { ok: false, reason: 'resting' };
  }

  return { ok: true, chance: matingChance(stateA.happiness, stateB.happiness) };
};

export const dueDateFrom = (conceivedAt: number): number => conceivedAt + PREGNANCY_MS;

export type Kitten = {
  name: string;
  gender: Gender;
  image_url: string;
  domestication_points: number;
  taste_seed: number;
};

const KITTEN_NAMES = [
  'Pip', 'Mote', 'Bean', 'Sprout', 'Wisp', 'Nib', 'Tuft', 'Pebble',
  'Fizz', 'Sock', 'Clover', 'Moss', 'Biscuit', 'Pickle', 'Sesame', 'Juniper',
];

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * The litter. Derived from the pregnancy itself, so two page loads racing each
 * other would compute the same kittens — the row-level guard decides which one
 * gets to write them.
 */
export const litterFor = (
  motherId: string,
  dueAt: string,
  parents: { image_url: string; domestication_points: number }[],
): Kitten[] => {
  const random = rng(hashString(`${motherId}:${dueAt}`));
  const count = MIN_KITTENS + Math.floor(random() * (MAX_KITTENS - MIN_KITTENS + 1));
  const averagePoints = Math.round(
    parents.reduce((sum, parent) => sum + parent.domestication_points, 0) / parents.length,
  );

  return Array.from({ length: count }, () => {
    // A kitten takes after one parent or the other.
    const takesAfter = parents[Math.floor(random() * parents.length)] ?? parents[0];

    return {
      name: KITTEN_NAMES[Math.floor(random() * KITTEN_NAMES.length)] ?? 'Kitten',
      gender: (random() < 0.5 ? 'male' : 'female') as Gender,
      image_url: takesAfter.image_url,
      domestication_points: Math.max(1, averagePoints + Math.round((random() - 0.5) * 20)),
      taste_seed: Math.floor(random() * 1_000_000),
    };
  });
};
