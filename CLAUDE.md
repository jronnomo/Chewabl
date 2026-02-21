# Chewabl — Claude Instructions

## Testing Requirement

**Always run `npx tsc --noEmit` before considering any feature done.** Fix all TypeScript errors without asking.

Do not ask the user to test features — run the type check yourself and fix issues proactively.

## Color System Pattern

All files must follow this two-level color pattern:

1. **Module level** — `const Colors = StaticColors;` (used by `StyleSheet.create()`)
2. **Component level** — `const Colors = useColors();` inside each component function (shadows module-level `Colors` for reactive dark mode)

```ts
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors; // ← for StyleSheet.create()

export default function MyScreen() {
  const Colors = useColors(); // ← shadows above; use for JSX icon colors, inline styles
  ...
}
```

Never reference `Colors` in a `StyleSheet.create()` block without a module-level `const Colors = StaticColors` fallback.

## Key Architecture

- **Expo Router** (file-based routing) — use `as never` cast when route string isn't in typed routes
- **React Query v5** — `useQuery`, `useMutation`; `queryKey` arrays required
- **ThemeContext** (`context/ThemeContext.tsx`) — `useColors()` returns LIGHT or DARK palette based on `preferences.isDarkMode`
- **AppContext** — preferences, plans, restaurants, location, avatar persistence
- **AuthContext** — user, isAuthenticated, signIn/signUp/signOut
- **Google Places API (New)** — `POST /v1/places:searchNearby`; price levels must use named enums (`PRICE_LEVEL_INEXPENSIVE` etc.)
- **Backend** (`backend/`) — Node/Express/TypeScript/MongoDB; deployed to Railway; `EXPO_PUBLIC_API_URL` in `.env`

## Install Packages

Use `npm install <pkg> --legacy-peer-deps` (bun is not available in shell).
