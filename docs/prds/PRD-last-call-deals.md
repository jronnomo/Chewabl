# PRD: Last Call Deals — Smart Time-Based Labels

**Status:** Phase 1 Ready
**Priority:** Medium
**Author:** Tech Lead
**Date:** 2026-02-26

---

## Problem Statement

The `lastCallDeal` field on Restaurant objects was populated by a fake heuristic that just restated price+rating ("Great value – top-rated for the price"). That's been stripped. The field is already wired across the entire UI (home screen deals section, discover filter, SwipeCard badge, RestaurantCard badge, restaurant detail hero) — it just needs real data to create genuine value for users.

## Solution Overview

**Phase 1** (this PRD): Populate `lastCallDeal` with time-sensitive labels derived from real Google Places closing-time data. Creates genuine urgency without fake deal claims.

**Phase 2** (future): Community-sourced deals where users submit real promotions they discover.

---

## Phase 1: Time-Based Labels

### Scope

Single file change: `lib/placesMapper.ts`. Zero frontend changes needed — all UI already renders `lastCallDeal` as a badge with Flame icon.

### Requirements

1. **Extract shared `parseClosingInfo()` utility** — refactor duplicated time-parsing logic from `getClosingSoon()` into a reusable helper
2. **Rewrite `getClosingSoon()` as thin wrapper** — behavior-preserving refactor, identical output
3. **New `getLastCallDeal()` function** — priority-ordered, mutually exclusive labels:

| Priority | Condition | Label |
|----------|-----------|-------|
| 1 | ≤ 30 min to close | `"Last call – Xm left!"` |
| 2 | 31–90 min to close | `"Closing soon – Xh Ym left"` |
| 3 | Closes after midnight AND current hour ≥ 9 PM | `"Open late – until X AM"` |

Urgency wins: a late-night restaurant about to close gets "Last call", not "Open late".

4. **Wire into `mapToRestaurant()`** — change `lastCallDeal: undefined` → `lastCallDeal: getLastCallDeal(place)`

### Edge Cases

| Case | Handling |
|------|----------|
| 24-hour restaurant | `isOpen24Hours: true` → no label |
| Closed today | `parseClosingInfo` returns `undefined` → no label |
| No hours data | Returns `undefined` → no label |
| Already closed (diff ≤ 0) | All conditions check `diff > 0` |
| Midnight crossing (e.g. 6 PM – 2 AM) | Existing `closeMins += 24*60` logic handles this |
| Close at exactly midnight | `closeHour24 === 0` → displays "until 12 AM" |

### What Does NOT Change

- `types/index.ts` — both `lastCallDeal` and `closingSoon` fields stay
- All frontend components — they already render `lastCallDeal` as a badge
- Home screen — "Last Call Deals" section + "Closing Soon" section both work
- Mock data — static promo strings in `mocks/restaurants.ts` still work for non-live paths
- `closingSoon` field — kept, different UX purpose (section filter vs badge text)

### Verification

1. `npx tsc --noEmit` → 0 errors
2. `closingSoon` output unchanged (behavior-preserving refactor)
3. Restaurants closing within 30 min show "Last call – Xm left!" badge
4. Restaurants closing in 31–90 min show "Closing soon" badge
5. Late-night restaurants after 9 PM show "Open late" badge
6. Home screen "Last Call Deals" section populates with real restaurants

---

## Phase 2: Community-Sourced Deals (Future)

### Concept

Users can submit real deals/promotions they discover at restaurants (e.g., "Half-price appetizers Mon–Thu 4–6 PM"). Other users can upvote/report deals. Deals expire automatically or via moderation.

### Requirements (High Level)

- Deal submission form (restaurant, description, valid days/times, expiry)
- Deal display on restaurant cards and detail pages
- Upvote/downvote system for deal accuracy
- Auto-expiry after N days without upvotes
- Moderation/reporting for fake or outdated deals
- Backend: new Deal model, CRUD endpoints, vote tracking

*Detailed PRD for Phase 2 will be written when Phase 1 is validated in production.*

---

## Success Metrics

- **Phase 1:** ≥ 30% of live restaurants display a time-based label during evening hours (7 PM – midnight)
- **Phase 2:** TBD after Phase 1 validation
