"use client";

import * as React from "react";
import { applySilently, canRedo, canUndo, initHistory, recordEdit, redo, undo, type History } from "./history";

type Updater<T> = T | ((current: T) => T);

type Action<T> =
  | { type: "edit"; next: Updater<T>; now: number }
  | { type: "silent"; next: Updater<T> }
  | { type: "replace"; next: T }
  | { type: "undo" }
  | { type: "redo" };

const resolve = <T>(next: Updater<T>, current: T): T => (typeof next === "function" ? (next as (c: T) => T)(current) : next);

/**
 * State with undo and redo.
 * - `edit` is a user change and becomes an undo step.
 * - `silent` changes the value without adding a step.
 * - `replace` swaps the value and forgets history (loading a different palette).
 * `adapt` keeps things that aren't edits, such as the selected swatch, when stepping through history.
 */
export function useHistory<T>(initial: () => T, adapt?: (restored: T, current: T) => T) {
  const [history, dispatch] = React.useReducer(
    (h: History<T>, action: Action<T>): History<T> => {
      switch (action.type) {
        case "edit":
          return recordEdit(h, resolve(action.next, h.present), action.now);
        case "silent":
          return applySilently(h, resolve(action.next, h.present));
        case "replace":
          return initHistory(action.next);
        case "undo":
          return undo(h, adapt);
        case "redo":
          return redo(h, adapt);
      }
    },
    undefined,
    () => initHistory(initial()),
  );

  const edit = React.useCallback((next: Updater<T>) => dispatch({ type: "edit", next, now: Date.now() }), []);
  const silent = React.useCallback((next: Updater<T>) => dispatch({ type: "silent", next }), []);
  const replace = React.useCallback((next: T) => dispatch({ type: "replace", next }), []);
  const stepBack = React.useCallback(() => dispatch({ type: "undo" }), []);
  const stepForward = React.useCallback(() => dispatch({ type: "redo" }), []);

  return {
    state: history.present,
    edit,
    silent,
    replace,
    undo: stepBack,
    redo: stepForward,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
