import { useRef, useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';

// ─── ChompConfig ────────────────────────────────────────────────────────────
// Describes all parameters for a single chomp animation run.
// Different callers (theme toggle, plan success) supply different configs.

export type BitePattern = 'fixed' | 'randomized' | 'spiral' | 'edges-in';
export type ChompEasing = 'cubic-out' | 'bounce' | 'spring';

export interface ChompConfig {
  biteCount: number;
  biteDuration: number;
  bitePause: number;
  commitDelay: number;
  overlayColor: string;
  hapticSequence: Array<{
    style: 'Light' | 'Medium' | 'Heavy';
    withSuccessNotification?: boolean;
  }>;

  // Phase 2 — all optional, backward compatible
  bitePattern?: BitePattern;
  positionSeed?: number;
  easingCurve?: ChompEasing;
  scallopJitter?: number;       // 0–1 intensity multiplier
  enableCrumbs?: boolean;
  crumbCount?: number;          // particles per bite (default 5)
  crumbStyle?: 'crumbs' | 'confetti';
  confettiOnFinalOnly?: boolean; // if crumbStyle='confetti', fire only on last bite (default true)
  radiusScale?: number[];       // per-bite radius multipliers
}

// ─── Factory helpers ────────────────────────────────────────────────────────

export function buildThemeChompConfig(fromBgColor: string): ChompConfig {
  return {
    biteCount: 5,
    biteDuration: 200,
    bitePause: 120,
    commitDelay: 150,
    overlayColor: fromBgColor,
    hapticSequence: [
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Medium' },
    ],
  };
}

export function buildPlanSuccessChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 4,
    biteDuration: 150,
    bitePause: 80,
    commitDelay: 150,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Heavy', withSuccessNotification: true },
    ],
  };
}

// ─── Auth lifecycle builders ────────────────────────────────────────────────

export function buildSignInChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 3,
    biteDuration: 150,
    bitePause: 80,
    commitDelay: 120,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Medium', withSuccessNotification: true },
    ],
  };
}

export function buildSignUpChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 4,
    biteDuration: 140,
    bitePause: 70,
    commitDelay: 120,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Heavy', withSuccessNotification: true },
    ],
  };
}

export function buildGuestEntryChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 2,
    biteDuration: 160,
    bitePause: 90,
    commitDelay: 120,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Medium' },
    ],
  };
}

export function buildOnboardingCompleteChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 4,
    biteDuration: 130,
    bitePause: 60,
    commitDelay: 120,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Heavy', withSuccessNotification: true },
    ],
  };
}

export function buildSignOutChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 3,
    biteDuration: 180,
    bitePause: 100,
    commitDelay: 150,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Heavy' },
    ],
  };
}

// ─── App-wide expansion builders (Phase 3) ──────────────────────────────────

export function buildFriendAcceptChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 2,
    biteDuration: 150,
    bitePause: 80,
    commitDelay: 100,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Medium', withSuccessNotification: true },
    ],
  };
}

export function buildRsvpAcceptChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 3,
    biteDuration: 140,
    bitePause: 70,
    commitDelay: 100,
    overlayColor: primaryColor,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Medium', withSuccessNotification: true },
    ],
  };
}

export function buildResultsRevealChompConfig(primaryColor: string): ChompConfig {
  return {
    biteCount: 5,
    biteDuration: 140,
    bitePause: 60,
    commitDelay: 150,
    overlayColor: primaryColor,
    bitePattern: 'spiral',
    easingCurve: 'bounce',
    enableCrumbs: true,
    crumbCount: 8,
    hapticSequence: [
      { style: 'Light' },
      { style: 'Light' },
      { style: 'Medium' },
      { style: 'Medium' },
      { style: 'Heavy', withSuccessNotification: true },
    ],
  };
}

// ─── Overlay trigger signature ──────────────────────────────────────────────

type OverlayTriggerFn = (
  config: ChompConfig,
  onCommit: () => void,
  onDone: () => void,
) => void;

// ─── Context value ──────────────────────────────────────────────────────────

interface ThemeTransitionContextValue {
  /** Theme toggle convenience wrapper — backward-compatible API. */
  requestThemeToggle: (fromBgColor: string, onCommit: () => void) => void;

  /** Generic chomp: any caller can supply a ChompConfig. */
  requestChomp: (config: ChompConfig, onCommit: () => void) => void;

  /** ChompOverlay registers its trigger on mount. */
  registerOverlayTrigger: (fn: OverlayTriggerFn) => void;

  /** True while an animation is in flight. */
  isAnimating: boolean;
}

export const [ThemeTransitionProvider, useThemeTransition] = createContextHook(
  (): ThemeTransitionContextValue => {
    const [isAnimating, setIsAnimating] = useState(false);

    const isAnimatingRef = useRef(false);
    const overlayTriggerRef = useRef<OverlayTriggerFn | null>(null);

    const registerOverlayTrigger = useCallback((fn: OverlayTriggerFn) => {
      overlayTriggerRef.current = fn;
    }, []);

    // Core method — drives the overlay with any ChompConfig
    const requestChomp = useCallback(
      (config: ChompConfig, onCommit: () => void) => {
        if (isAnimatingRef.current) return;

        isAnimatingRef.current = true;
        setIsAnimating(true);

        const onDone = () => {
          isAnimatingRef.current = false;
          setIsAnimating(false);
        };

        if (overlayTriggerRef.current) {
          overlayTriggerRef.current(config, onCommit, onDone);
        } else {
          onCommit();
          onDone();
        }
      },
      [],
    );

    // Thin wrapper — keeps Profile screen's API unchanged
    const requestThemeToggle = useCallback(
      (fromBgColor: string, onCommit: () => void) => {
        requestChomp(buildThemeChompConfig(fromBgColor), onCommit);
      },
      [requestChomp],
    );

    return { requestThemeToggle, requestChomp, registerOverlayTrigger, isAnimating };
  },
);
