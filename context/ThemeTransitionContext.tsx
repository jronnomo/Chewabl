import { useRef, useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';

// ─── ChompConfig ────────────────────────────────────────────────────────────
// Describes all parameters for a single chomp animation run.
// Different callers (theme toggle, plan success) supply different configs.

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
