export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  reviewCount: number;
  distance: string;
  address: string;
  imageUrl: string;
  tags: string[];
  isOpenNow: boolean;
  hasReservation: boolean;
  noiseLevel: 'quiet' | 'moderate' | 'lively';
  seating: ('indoor' | 'outdoor')[];
  busyLevel: 'low' | 'moderate' | 'busy';
  phone: string;
  hours: string;
  description: string;
  lastCallDeal?: string;
  photos: string[];
}

export interface DiningPlan {
  id: string;
  title: string;
  date: string;
  time: string;
  restaurant?: Restaurant;
  status: 'voting' | 'confirmed' | 'completed' | 'cancelled';
  cuisine: string;
  budget: string;
  invitees: Invitee[];
  options: Restaurant[];
  votes: Record<string, string[]>;
  createdAt: string;
}

export interface Invitee {
  id: string;
  name: string;
  avatar: string;
  hasVoted: boolean;
}

export interface UserPreferences {
  name: string;
  cuisines: string[];
  budget: string;
  dietary: string[];
  atmosphere: string;
  groupSize: string;
}

export type CuisineType =
  | 'Italian'
  | 'Japanese'
  | 'Mexican'
  | 'Thai'
  | 'Indian'
  | 'Chinese'
  | 'American'
  | 'French'
  | 'Korean'
  | 'Mediterranean'
  | 'Vietnamese'
  | 'Ethiopian';

export type BudgetLevel = '$' | '$$' | '$$$' | '$$$$';

export type DietaryRestriction =
  | 'Vegetarian'
  | 'Vegan'
  | 'Gluten-Free'
  | 'Halal'
  | 'Kosher'
  | 'Dairy-Free'
  | 'Nut-Free';

export interface GroupSession {
  id: string;
  planId: string;
  title: string;
  restaurants: Restaurant[];
  members: GroupMember[];
  swipes: Record<string, Record<string, 'yes' | 'no'>>;
  status: 'swiping' | 'results';
  createdAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  completedSwiping: boolean;
}

export interface SwipeResult {
  restaurantId: string;
  restaurant: Restaurant;
  yesCount: number;
  totalMembers: number;
  isMatch: boolean;
}
