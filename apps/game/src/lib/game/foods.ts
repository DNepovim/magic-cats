export const FOOD_TYPES = [
  { id: 'kibble', label: '🥣', size: 56, points: 5, color: 'var(--color-orange)' },
  { id: 'sardine', label: '🐟', size: 44, points: 12, color: 'var(--color-cyan)' },
  { id: 'treat', label: '🍪', size: 32, points: 25, color: 'var(--color-lime)' },
  { id: 'golden', label: '⭐', size: 22, points: 50, color: 'var(--color-gold)' },
] as const;

export type FoodTypeId = (typeof FOOD_TYPES)[number]['id'];
export type FoodType = (typeof FOOD_TYPES)[number];

export const pickRandomFoodType = (): FoodType => {
  // weighted: bigger/easier foods are more common
  const weights = [40, 30, 20, 10];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < FOOD_TYPES.length; i++) {
    r -= weights[i];
    if (r <= 0) return FOOD_TYPES[i];
  }
  return FOOD_TYPES[0];
};
