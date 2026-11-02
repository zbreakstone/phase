import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, MERGE_WINDOW_MS, applySilently, canRedo, canUndo, initHistory, recordEdit, redo, undo } from "@/lib/palette/history";

const GAP = MERGE_WINDOW_MS + 1;

describe("history", () => {
  it("steps back and forward through separate edits", () => {
    let h = initHistory(0);
    h = recordEdit(h, 1, 1000);
    h = recordEdit(h, 2, 1000 + GAP);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it("merges edits that arrive close together into one step", () => {
    let h = initHistory(0);
    // A slider drag: many tiny changes, each within the window of the last.
    for (let i = 1; i <= 20; i++) h = recordEdit(h, i, 1000 + i * 20);
    expect(h.present).toBe(20);
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  it("starts a new step after a pause", () => {
    let h = initHistory(0);
    h = recordEdit(h, 1, 1000);
    h = recordEdit(h, 2, 1000 + GAP);
    expect(h.past).toEqual([0, 1]);
  });

  it("does not merge the first edit after an undo into an earlier step", () => {
    let h = initHistory(0);
    h = recordEdit(h, 1, 1000);
    h = recordEdit(h, 2, 1000 + GAP);
    h = undo(h);
    // Immediately after undoing, a new edit is its own step even though little time has passed.
    h = recordEdit(h, 5, 1000 + GAP + 10);
    expect(h.past).toEqual([0, 1]);
    expect(h.present).toBe(5);
  });

  it("drops redo history when you edit after undoing", () => {
    let h = initHistory(0);
    h = recordEdit(h, 1, 1000);
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = recordEdit(h, 9, 5000);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(9);
  });

  it("ignores an edit that changes nothing", () => {
    const state = { a: 1 };
    const h = initHistory(state);
    expect(recordEdit(h, state, 1000)).toBe(h);
  });

  it("changes the value silently without adding a step or clearing redo", () => {
    let h = initHistory({ n: 0, sel: "a" });
    h = recordEdit(h, { n: 1, sel: "a" }, 1000);
    h = undo(h);
    h = applySilently(h, { ...h.present, sel: "b" });
    expect(h.past).toEqual([]);
    expect(canRedo(h)).toBe(true);
    expect(h.present.sel).toBe("b");
  });

  it("lets the caller keep non-edit state such as the selection", () => {
    const keepSel = (restored: { n: number; sel: string }, current: { n: number; sel: string }) => ({ ...restored, sel: current.sel });
    let h = initHistory({ n: 0, sel: "a" });
    h = recordEdit(h, { n: 1, sel: "a" }, 1000);
    h = applySilently(h, { ...h.present, sel: "b" });
    h = undo(h, keepSel);
    expect(h.present).toEqual({ n: 0, sel: "b" });
    h = redo(h, keepSel);
    expect(h.present).toEqual({ n: 1, sel: "b" });
  });

  it("caps how far back you can go", () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = recordEdit(h, i, i * GAP);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.present).toBe(HISTORY_LIMIT + 50);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const h = initHistory(0);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
