import { useRef, useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';

/**
 * Signature for the function the overlay registers so the context can
 * trigger the animation without importing ChompOverlay directly (avoids
 * circular dependencies and keeps the context pure).
 *
 * @param fromBgColor  The old theme's background color (hex string) —
 *                     captured by the caller before the commit so the overlay
 *                     can fill itself with the correct color.
 * @param onCommit     Called at COMMIT_DELAY ms to flip isDarkMode. Passed
 *                     through so the context stays decoupled from AppContext.
 * @param onDone       Called when the animation finishes so the context can
 *                     clear isAnimating.
 */
type OverlayTriggerFn = (
  fromBgColor: string,
  onCommit: () => void,
  onDone: () => void,
) => void;

/**
 * Shape of the value exposed by useThemeTransition().
 */
interface ThemeTransitionContextValue {
  /**
   * Call this instead of directly mutating isDarkMode. Passes the old
   * background color to the overlay and schedules the commit.
   */
  requestThemeToggle: (fromBgColor: string, onCommit: () => void) => void;

  /**
   * The overlay calls this on mount to hand the context a stable wrapper
   * around its trigger function. The context stores the wrapper in a ref.
   */
  registerOverlayTrigger: (fn: OverlayTriggerFn) => void;

  /**
   * True while an animation is in flight. Consumers (Profile screen) read
   * this to disable the Switch.
   */
  isAnimating: boolean;
}

export const [ThemeTransitionProvider, useThemeTransition] = createContextHook(
  (): ThemeTransitionContextValue => {
    // STATE
    const [isAnimating, setIsAnimating] = useState(false);

    // REFS (stale-closure safe; never used as useEffect deps)
    const isAnimatingRef = useRef(false);
    const overlayTriggerRef = useRef<OverlayTriggerFn | null>(null);

    // FUNCTION: called by ChompOverlay on mount — stores a STABLE WRAPPER
    // [DA-FIX-1]: The overlay registers a stable wrapper that always routes to
    // the latest triggerRef.current. This means even if trigger is recreated inside
    // ChompOverlay, the context never holds a stale function reference.
    const registerOverlayTrigger = useCallback((fn: OverlayTriggerFn) => {
      overlayTriggerRef.current = fn;
    }, []);

    // FUNCTION: called by Profile toggle handler
    const requestThemeToggle = useCallback(
      (fromBgColor: string, onCommit: () => void) => {
        // Spam guard — use ref not state to avoid closure stale reads
        if (isAnimatingRef.current) return;

        isAnimatingRef.current = true;
        setIsAnimating(true);

        const onDone = () => {
          isAnimatingRef.current = false;
          setIsAnimating(false);
        };

        if (overlayTriggerRef.current) {
          overlayTriggerRef.current(fromBgColor, onCommit, onDone);
        } else {
          // Overlay not mounted (edge case) — instant commit, no animation
          onCommit();
          onDone();
        }
      },
      [], // no deps — all reads go through refs
    );

    return { requestThemeToggle, registerOverlayTrigger, isAnimating };
  },
);
