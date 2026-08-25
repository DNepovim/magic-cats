/**
 * Everything a cat can be given, and how a particular cat feels about it.
 *
 * The catalogue lives in code rather than in a table: it is content, it never
 * changes at runtime, and both the browser and the API need the same numbers.
 * Inventory rows only ever reference these ids.
 */

export const ILLNESSES = ['sniffles', 'earmites', 'furball'] as const;
export type Illness = (typeof ILLNESSES)[number];

export const ILLNESS_EMOJI: Record<Illness, string> = {
  sniffles: '🤧',
  earmites: '👂',
  furball: '🌀',
};

export type ItemKind = 'meal' | 'dainty' | 'medicine';

export type Item = {
  id: string;
  kind: ItemKind;
  emoji: string;
  /** Base satiety before the cat's own taste is applied. */
  satiety: number;
  happiness: number;
  /** Medicines only: the illness this one clears. */
  cures?: Illness;
  /** Relative chance of showing up in a supply run. */
  weight: number;
};

export const ITEMS: Item[] = [
  // Meals — the satiety workhorses. Quality climbs, rarity climbs with it.
  { id: 'kibble', kind: 'meal', emoji: '🥣', satiety: 12, happiness: 0, weight: 26 },
  { id: 'pate', kind: 'meal', emoji: '🥫', satiety: 20, happiness: 2, weight: 18 },
  { id: 'sardine', kind: 'meal', emoji: '🐟', satiety: 30, happiness: 4, weight: 12 },
  { id: 'roast', kind: 'meal', emoji: '🍖', satiety: 42, happiness: 6, weight: 6 },

  // Dainties — barely fill her up, but she will remember them.
  { id: 'cream', kind: 'dainty', emoji: '🥛', satiety: 4, happiness: 14, weight: 12 },
  { id: 'catnip_cookie', kind: 'dainty', emoji: '🍪', satiety: 3, happiness: 22, weight: 7 },

  // Medicines — useless until she is actually ill, and then priceless.
  { id: 'nose_syrup', kind: 'medicine', emoji: '💊', satiety: 0, happiness: 0, cures: 'sniffles', weight: 6 },
  { id: 'ear_drops', kind: 'medicine', emoji: '💧', satiety: 0, happiness: 0, cures: 'earmites', weight: 6 },
  { id: 'fur_paste', kind: 'medicine', emoji: '🧴', satiety: 0, happiness: 0, cures: 'furball', weight: 7 },
];

export const ITEMS_BY_ID: Record<string, Item> = Object.fromEntries(
  ITEMS.map((item) => [item.id, item]),
);

export const itemById = (id: string): Item | undefined => ITEMS_BY_ID[id];

export const medicineFor = (illness: Illness): Item =>
  ITEMS.find((item) => item.cures === illness) ?? ITEMS[ITEMS.length - 1];

/** Deterministic 32-bit hash — the same string always lands on the same number. */
export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * How much this cat likes this food, as a multiplier on its satiety value.
 * Fixed for the life of the cat: her `taste_seed` and the item id decide it,
 * so a cat who adores sardines adores them forever.
 */
export const tasteFor = (tasteSeed: number, itemId: string): number => {
  const item = itemById(itemId);
  if (!item || item.kind === 'medicine') return 1;
  const roll = hashString(`${tasteSeed}:${itemId}`) / 0xffffffff;
  // 0.5 (turns her nose up) … 1.6 (devours it)
  return Math.round((0.5 + roll * 1.1) * 100) / 100;
};
