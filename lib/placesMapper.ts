import { Restaurant } from '../types';
import { Place, PlacePhoto, Coords } from '../services/googlePlaces';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

const PRIMARY_TYPE_TO_CUISINE: Record<string, string> = {
  italian_restaurant: 'Italian',
  japanese_restaurant: 'Japanese',
  ramen_restaurant: 'Japanese',
  sushi_restaurant: 'Japanese',
  mexican_restaurant: 'Mexican',
  thai_restaurant: 'Thai',
  indian_restaurant: 'Indian',
  chinese_restaurant: 'Chinese',
  american_restaurant: 'American',
  hamburger_restaurant: 'American',
  barbecue_restaurant: 'American',
  french_restaurant: 'French',
  korean_restaurant: 'Korean',
  mediterranean_restaurant: 'Mediterranean',
  greek_restaurant: 'Mediterranean',
  vietnamese_restaurant: 'Vietnamese',
  african_restaurant: 'Ethiopian',
};

const PRICE_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildPhotoUrl(photo: PlacePhoto): string {
  return `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&key=${API_KEY}`;
}

function getTodayHours(weekdayDescriptions?: string[]): string {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return '';
  // weekdayDescriptions: index 0 = Monday … index 6 = Sunday
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon … 6=Sat
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  const desc = weekdayDescriptions[idx] || '';
  // Strip "Monday: " prefix
  return desc.replace(/^[^:]+:\s*/, '');
}

function getLastCallDeal(place: Place): string | undefined {
  // Heuristic 1: closing within 2 hours based on today's hours string
  const descs = place.regularOpeningHours?.weekdayDescriptions;
  if (descs) {
    const jsDay = new Date().getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    const desc = descs[idx] || '';
    // Match closing time "– HH:MM AM/PM" (en-dash or hyphen)
    const closeMatch = desc.match(/[–\-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (closeMatch) {
      const h = parseInt(closeMatch[1]);
      const m = parseInt(closeMatch[2]);
      const isPM = closeMatch[3].toUpperCase() === 'PM';
      let close24 = h;
      if (isPM && h !== 12) close24 = h + 12;
      else if (!isPM && h === 12) close24 = 0;
      const now = new Date();
      const diffMins = (close24 * 60 + m) - (now.getHours() * 60 + now.getMinutes());
      if (diffMins > 0 && diffMins <= 120) {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const timeStr = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
        return `Last call! Closes in ${timeStr}`;
      }
    }
  }
  // Heuristic 2: inexpensive + well-rated + open = great deal
  const priceLevel = PRICE_LEVEL_MAP[place.priceLevel ?? ''] ?? 2;
  if (priceLevel === 1 && (place.rating ?? 0) >= 4.0 && place.regularOpeningHours?.openNow) {
    return 'Great value – top-rated for the price';
  }
  return undefined;
}

const EXCLUDED_TYPES = new Set([
  'restaurant',
  'food',
  'point_of_interest',
  'establishment',
  'local_business',
  'place',
  'geocode',
]);

function extractTags(types?: string[]): string[] {
  if (!types) return [];
  return types
    .filter(t => !EXCLUDED_TYPES.has(t))
    .map(t =>
      t
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
    )
    .slice(0, 4);
}

export function mapToRestaurant(place: Place, userLocation?: Coords): Restaurant {
  const priceLevel: 1 | 2 | 3 | 4 =
    PRICE_LEVEL_MAP[place.priceLevel ?? ''] ?? 2;

  const cuisine =
    PRIMARY_TYPE_TO_CUISINE[place.primaryType ?? ''] ||
    place.types?.map(t => PRIMARY_TYPE_TO_CUISINE[t]).find(Boolean) ||
    'Restaurant';

  let distanceStr = '';
  if (userLocation && place.location) {
    const d = haversineDistanceMiles(
      userLocation.latitude,
      userLocation.longitude,
      place.location.latitude,
      place.location.longitude
    );
    distanceStr = d < 0.1 ? '< 0.1 mi' : `${d.toFixed(1)} mi`;
  }

  const allPhotos = (place.photos || []).map(buildPhotoUrl);
  const fallbackImage =
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
  const imageUrl = allPhotos[0] || fallbackImage;

  return {
    id: place.id,
    placeId: place.id,
    name: place.displayName?.text || 'Unknown Restaurant',
    cuisine,
    priceLevel,
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    distance: distanceStr,
    address: place.formattedAddress || '',
    imageUrl,
    photos: allPhotos.length > 0 ? allPhotos : [fallbackImage],
    isOpenNow: place.regularOpeningHours?.openNow ?? false,
    hasReservation: place.reservable ?? false,
    phone: place.internationalPhoneNumber || '',
    hours: getTodayHours(place.regularOpeningHours?.weekdayDescriptions),
    description: place.editorialSummary?.text || '',
    tags: extractTags(place.types),
    noiseLevel: 'moderate',
    busyLevel: 'moderate',
    seating: ['indoor'],
    lastCallDeal: getLastCallDeal(place),
  };
}
