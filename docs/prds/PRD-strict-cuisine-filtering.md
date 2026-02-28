# PRD: Strict Cuisine Filtering with Radius Expansion

**Issue:** [#88](https://github.com/jronnomo/Chewabl/issues/88)
**Priority:** P1 — High
**Effort:** Small
**Type:** Bug Fix

## Problem

When a plan specifies a cuisine (e.g. Chinese), the swipe deck sometimes includes restaurants of other cuisines (Japanese, Mexican). This happens because Google Places `searchNearby` with `includedTypes: ['chinese_restaurant']` returns places that have that type anywhere in their `types` array, but their `primaryType` may differ (e.g. a pan-Asian restaurant with `primaryType: 'japanese_restaurant'`). Our `mapToRestaurant` labels by `primaryType`, so the restaurant shows up as "Japanese" even though Google matched it on the Chinese type.

This breaks the core group-swipe experience — participants expect to see only restaurants matching the plan's cuisine filter.

## Goal

All restaurants in the swipe deck must match the plan's cuisine filter. When strict filtering reduces the number of results below the desired count, the search radius should expand automatically to find more matching restaurants nearby.

## Requirements

### Must Have
1. Post-fetch cuisine filter: after mapping Google Places results, discard restaurants whose `.cuisine` doesn't match the plan's `effectiveCuisines`
2. Radius expansion: if strict filtering yields fewer restaurants than `maxResultCount`, retry with 2x then 3x radius (capped at 25 miles / 40,234 m)
3. Deduplication across retries by restaurant ID
4. `isOutsidePreferredRadius` flag on restaurants found beyond the user's preferred distance
5. "Farther out" badge on SwipeCard for restaurants outside preferred radius
6. Backend schema supports `isOutsidePreferredRadius` on plan restaurant options

### Won't Have (this iteration)
- User-configurable max expansion radius
- Sorting expanded-radius results to the end of the deck
- Different visual treatment for different distance tiers

## Technical Approach

### Files Changed

| File | Change |
|------|--------|
| `types/index.ts` | Add `isOutsidePreferredRadius?: boolean` to `Restaurant` |
| `context/AppContext.tsx` | Strict post-fetch cuisine filter + radius expansion loop in `useNearbyRestaurants` queryFn; add `planCuisine` to query key |
| `components/SwipeCard.tsx` | Add `isOutsideRadius` prop + "Farther out" badge (slate-gray pill, top-right) |
| `app/group-session.tsx` | Pass `isOutsideRadius={restaurant.isOutsidePreferredRadius}` to SwipeCard |
| `backend/src/models/Plan.ts` | Add `isOutsidePreferredRadius` to `IPlanRestaurantOption` interface + Mongoose schema |

### Key Logic (useNearbyRestaurants queryFn)

1. Build base search params from plan filters
2. Loop through radius multipliers [1, 2, 3]
3. For each: fetch → map → strict-filter by cuisine (when plan cuisine is set) → deduplicate → collect
4. Break when collected >= maxResultCount or radius >= 25 miles
5. Mark each restaurant with `isOutsidePreferredRadius` based on parsed distance vs user's preferred radius

## Success Criteria

- Plan with "Chinese" cuisine shows only Chinese restaurants in the deck
- No Japanese/Mexican/etc. leak through when plan specifies a cuisine
- In low-density areas, deck fills via radius expansion with "Farther out" badges visible
- `npx tsc --noEmit` — zero errors (frontend)
- `cd backend && npx tsc --noEmit` — zero errors (backend)
