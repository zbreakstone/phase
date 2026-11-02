/**
 * Undo/redo for any immutable value. Pure functions so the rules can be tested without React.
 *
 * Edits that arrive close together (a slider drag, fast typing) merge into one step, so a single
 * undo reverses the whole gesture instead of one pixel of it.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** When the last recorded edit happened, or 0 when the next edit must start a new step. */
  lastEditAt: number;
}

/** Edits within this many ms of the previous one count as the same step. */
export const MERGE_WINDOW_MS = 500;
/** How many steps back you can go. */
export const HISTORY_LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastEditAt: 0 };
}

/** A user edit. Starts a new undo step unless it follows the previous edit closely. */
export function recordEdit<T>(h: History<T>, next: T, now: number): History<T> {
  if (Object.is(next, h.present)) return h;
  const merge = h.lastEditAt > 0 && now - h.lastEditAt < MERGE_WINDOW_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastEditAt: now };
}

/** A change that shouldn't be a step of its own (such as selecting a swatch). History is untouched. */
export function applySilently<T>(h: History<T>, next: T): History<T> {
  return Object.is(next, h.present) ? h : { ...h, present: next };
}

/**
 * Steps back or forward. `adapt` lets the caller carry bits that aren't part of the edit
 * (such as which swatch is selected) from the current value onto the restored one.
 */
export function undo<T>(h: History<T>, adapt: (restored: T, current: T) => T = (r) => r): History<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: adapt(previous, h.present), future: [h.present, ...h.future], lastEditAt: 0 };
}

export function redo<T>(h: History<T>, adapt: (restored: T, current: T) => T = (r) => r): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: adapt(next, h.present), future: rest, lastEditAt: 0 };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
