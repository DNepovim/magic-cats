import { CAT_SIZE, CAT_SPEED_RANGE, FOOD_SPEED_RANGE } from './constants';
import { type FoodType, pickRandomFoodType } from './foods';
import type { CatEntity, FoodEntity } from './types';

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const spawnCat = (
  imageUrl: string,
  bounds: { width: number; height: number },
): CatEntity => {
  const fromHorizontal = Math.random() < 0.5;
  const speed = rand(CAT_SPEED_RANGE[0], CAT_SPEED_RANGE[1]);
  const angle = rand(-0.3, 0.3); // mostly straight
  return {
    id: uid(),
    imageUrl,
    x: fromHorizontal ? -CAT_SIZE : rand(0, bounds.width - CAT_SIZE),
    y: fromHorizontal ? rand(80, bounds.height - CAT_SIZE - 80) : -CAT_SIZE,
    vx: fromHorizontal ? speed : speed * Math.sin(angle),
    vy: fromHorizontal ? speed * Math.sin(angle) : speed,
    size: CAT_SIZE,
    points: 0,
  };
};

export const spawnFood = (bounds: { width: number; height: number }): FoodEntity => {
  const type: FoodType = pickRandomFoodType();
  const speed = rand(FOOD_SPEED_RANGE[0], FOOD_SPEED_RANGE[1]);
  return {
    id: uid(),
    typeId: type.id,
    label: type.label,
    size: type.size,
    points: type.points,
    color: type.color,
    x: rand(20, bounds.width - type.size - 20),
    y: rand(20, bounds.height - type.size - 20),
    vx: speed * randSign() * 0.6,
    vy: speed * randSign() * 0.6,
  };
};

export const tickEntity = <T extends { x: number; y: number; vx: number; vy: number; size: number }>(
  entity: T,
  dt: number,
  bounds: { width: number; height: number },
  mode: 'wrap' | 'bounce',
): T => {
  let { x, y, vx, vy } = entity;
  x += vx * dt;
  y += vy * dt;

  if (mode === 'bounce') {
    if (x <= 0) {
      x = 0;
      vx = Math.abs(vx);
    } else if (x + entity.size >= bounds.width) {
      x = bounds.width - entity.size;
      vx = -Math.abs(vx);
    }
    if (y <= 0) {
      y = 0;
      vy = Math.abs(vy);
    } else if (y + entity.size >= bounds.height) {
      y = bounds.height - entity.size;
      vy = -Math.abs(vy);
    }
  }

  return { ...entity, x, y, vx, vy };
};

export const isOutOfBounds = (
  entity: { x: number; y: number; size: number },
  bounds: { width: number; height: number },
): boolean => {
  return (
    entity.x + entity.size < -50 ||
    entity.x > bounds.width + 50 ||
    entity.y + entity.size < -50 ||
    entity.y > bounds.height + 50
  );
};

export const intersects = (
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number },
): boolean => {
  return (
    a.x < b.x + b.size && a.x + a.size > b.x && a.y < b.y + b.size && a.y + a.size > b.y
  );
};

export const fetchCatImageUrls = async (count: number): Promise<string[]> => {
  const urls = new Set<string>();
  let attempts = 0;
  while (urls.size < count && attempts < count * 3) {
    attempts += 1;
    try {
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      if (!res.ok) continue;
      const data = (await res.json()) as { url: string }[];
      const url = data[0]?.url;
      if (url) urls.add(url);
    } catch {
      // ignore and retry
    }
  }
  return Array.from(urls);
};
