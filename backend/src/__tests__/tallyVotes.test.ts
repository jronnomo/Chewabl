import { tallyWinner } from '../utils/tallyVotes';
import { IPlan } from '../models/Plan';

// Create a minimal mock plan for testing tallyWinner
function mockPlan(overrides: Partial<IPlan> = {}): IPlan {
  return {
    restaurantOptions: [],
    votes: {},
    ...overrides,
  } as unknown as IPlan;
}

describe('tallyWinner', () => {
  it('returns null when no restaurantOptions', () => {
    const plan = mockPlan({ restaurantOptions: [] });
    expect(tallyWinner(plan)).toBeNull();
  });

  it('picks the restaurant with the highest vote count', () => {
    const plan = mockPlan({
      restaurantOptions: [
        { id: 'r1', name: 'Pizza', imageUrl: '', address: '', cuisine: 'Italian', priceLevel: 2, rating: 4.0, distance: '', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 0, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
        { id: 'r2', name: 'Sushi', imageUrl: '', address: '', cuisine: 'Japanese', priceLevel: 3, rating: 4.5, distance: '', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 0, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
      ] as any,
      votes: { user1: ['r1', 'r2'], user2: ['r1'] } as any,
    });
    const winner = tallyWinner(plan);
    expect(winner).not.toBeNull();
    expect(winner!.id).toBe('r1'); // r1 has 2 votes, r2 has 1
  });

  it('tie-breaks by highest rating', () => {
    const plan = mockPlan({
      restaurantOptions: [
        { id: 'r1', name: 'Pizza', imageUrl: '', address: '', cuisine: 'Italian', priceLevel: 2, rating: 4.0, distance: '', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 0, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
        { id: 'r2', name: 'Sushi', imageUrl: '', address: '', cuisine: 'Japanese', priceLevel: 3, rating: 4.8, distance: '', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 0, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
      ] as any,
      votes: { user1: ['r1'], user2: ['r2'] } as any,
    });
    const winner = tallyWinner(plan);
    expect(winner).not.toBeNull();
    expect(winner!.id).toBe('r2'); // Same vote count, r2 has higher rating (4.8 vs 4.0)
  });
});
