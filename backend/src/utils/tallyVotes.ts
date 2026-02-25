import { IPlan, IPlanRestaurant } from '../models/Plan';

/**
 * Tally votes from a plan and return the winning restaurant.
 * Tie-breaks by highest rating.
 * Returns null if no restaurantOptions exist.
 */
export function tallyWinner(plan: IPlan): IPlanRestaurant | null {
  if (!plan.restaurantOptions || plan.restaurantOptions.length === 0) {
    return null;
  }

  const voteCounts: Record<string, number> = {};
  const votesObj: Record<string, string[]> =
    plan.votes instanceof Map
      ? Object.fromEntries(plan.votes)
      : (plan.votes as Record<string, string[]>);

  for (const userVotes of Object.values(votesObj)) {
    for (const rid of userVotes) {
      voteCounts[rid] = (voteCounts[rid] || 0) + 1;
    }
  }

  const sorted = plan.restaurantOptions
    .map(r => ({ restaurant: r, count: voteCounts[r.id] || 0 }))
    .sort((a, b) => b.count - a.count || b.restaurant.rating - a.restaurant.rating);

  return sorted[0].restaurant;
}
