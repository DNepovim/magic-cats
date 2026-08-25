/**
 * The supply run: a thirty-second scramble for food and medicine.
 *
 * The server hands out a seed and re-derives the very same schedule when the
 * run is handed in, so "I caught item 7" can be checked rather than trusted.
 */

import { ITEMS, type Item } from './items';

export const RUN_DURATION_MS = 30_000;
/** Grace for the round trip when handing a run in. Generous on purpose: a
 *  backgrounded tab hands in late, and losing a haul to that would sting. */
export const RUN_GRACE_MS = 20_000;
export const RUN_COOLDOWN_MS = 5 * 60_000;
export const RUN_ITEM_COUNT = 18;

export type SupplyDrop = {
  index: number;
  itemId: string;
  /** Milliseconds into the run when it enters the screen. */
  spawnAt: number;
  /** 0…1 of the field height. */
  lane: number;
  /** Screen widths per second. */
  speed: number;
  size: number;
};

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pickWeighted = (roll: number): Item => {
  const total = ITEMS.reduce((sum, item) => sum + item.weight, 0);
  let remaining = roll * total;
  for (const item of ITEMS) {
    remaining -= item.weight;
    if (remaining <= 0) return item;
  }
  return ITEMS[0];
};

/**
 * The full flight plan for a run. Rarer items are smaller and faster, so a
 * medicine is genuinely harder to grab than a bowl of kibble.
 */
export const scheduleFor = (seed: number): SupplyDrop[] => {
  const random = rng(seed);

  return Array.from({ length: RUN_ITEM_COUNT }, (_, index) => {
    const item = pickWeighted(random());
    const rarity = 1 - item.weight / 30; // 0 = common, ~0.8 = rare

    return {
      index,
      itemId: item.id,
      spawnAt: Math.round((index / RUN_ITEM_COUNT) * (RUN_DURATION_MS - 4000) + random() * 900),
      lane: 0.12 + random() * 0.76,
      speed: 0.22 + rarity * 0.3 + random() * 0.12,
      size: Math.round(70 - rarity * 26),
    };
  });
};

/** Items actually earned, given the indices the player claims to have caught. */
export const grantsFor = (seed: number, caught: number[]): string[] => {
  const schedule = scheduleFor(seed);
  const seen = new Set<number>();

  return caught
    .filter((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= schedule.length) return false;
      if (seen.has(index)) return false;
      seen.add(index);
      return true;
    })
    .map((index) => schedule[index].itemId);
};
