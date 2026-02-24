import { Restaurant } from '../types';

const registry = new Map<string, Restaurant>();

export function registerRestaurants(restaurants: Restaurant[]): void {
  for (const r of restaurants) registry.set(r.id, r);
}

export function getRegisteredRestaurant(id: string): Restaurant | undefined {
  return registry.get(id);
}

export function clearRegistry(): void {
  registry.clear();
}
