# PRD: Home Screen Sections Redesign — Deduplicate + Curveball Picks

**Status:** Ready
**Priority:** High
**Author:** Tech Lead
**Date:** 2026-02-26

---

## Problem Statement

The home screen has 3 sections (Tonight Near You, Last Call Deals, Closing Soon) that show nearly identical restaurants. There is no deduplication:

- **Tonight Near You** = all open restaurants
- **Last Call Deals** = closing within 90 min OR open late after 9 PM (subset of open)
- **Closing Soon** = closing within 2 hours (overlaps heavily with Last Call Deals)

A restaurant closing in 45 minutes appears in all three sections. This creates a repetitive, confusing experience.

Additionally, curveball-style restaurants (different cuisines the user wouldn't normally pick) are only surfaced during group swipe sessions. There's no way to discover them from the home screen.

---

## Solution

Redefine sections to have distinct, non-overlapping purposes and add a Curveball Picks section.

### Section Changes

| # | Section | Filter | Change |
|---|---------|--------|--------|
| 1 | Tonight Near You | `isOpenNow && NOT in Last Call Deals` | **Deduped** — excludes urgency restaurants |
| 2 | Last Call Deals | `lastCallDeal` truthy | **Unchanged** — urgency owns these |
| 3 | **Curveball Picks** | Open + different cuisine + deal/high rating | **NEW** — try something new |
| 4 | Popular Nearby | `rating >= 4.5` | Unchanged |
| 5 | Based on Your Picks | Matches user cuisine preferences | Unchanged |

**Closing Soon section is removed** — it's redundant with Last Call Deals since both derive from closing-time data.

### Curveball Picks Logic

Mirrors the existing curveball selection from group swipe (`group-session.tsx`):
- Must be open now
- Cuisine must differ from user's `preferences.cuisines`
- Must have a `lastCallDeal` OR `rating >= 4.5`
- Sorted: deals first, then by rating descending
- Up to 5 shown
- Purple Dices icon (`#8B5CF6`) matching SwipeCard curveball branding

If user has no cuisine preferences, the cuisine filter is skipped — section shows deals/high-rated restaurants as a fallback.

---

## Scope

**Single file change:** `app/(tabs)/(home)/index.tsx`

- Update lucide import: remove `Clock`, add `Dices`
- Rewrite filter logic with deduplication (Last Call computed first, Tonight excludes those IDs)
- Delete `closingSoon` variable and its JSX section
- Add Curveball Picks JSX section (horizontal FlatList, same pattern as other sections)
- No new styles needed — reuses existing section styles

---

## Edge Cases

| Case | Handling |
|------|----------|
| No cuisine preferences | Cuisine filter skipped, shows deals/high-rated |
| All open restaurants in Last Call | Tonight Near You shows existing empty state |
| Curveball overlaps Popular Nearby | Acceptable — different purposes |
| No curveball candidates | Shows "No curveball picks right now" empty state |

---

## Verification

1. `npx tsc --noEmit` → 0 errors
2. Tonight Near You excludes Last Call restaurants (no duplicates)
3. Closing Soon section is gone
4. Curveball Picks shows purple Dices icon + different-cuisine restaurants
5. Dark mode inline overrides correct on all new Text elements
