import type { FoodTypeId } from './foods';

export type CatEntity = {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  points: number;
};

export type FoodEntity = {
  id: string;
  typeId: FoodTypeId;
  label: string;
  size: number;
  points: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type DragState = {
  foodId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};
