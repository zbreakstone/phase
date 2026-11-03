/**
 * Where the palette card you just opened sat on screen, so the editor's square can zoom out of it.
 * It lives in module scope because the home page and the editor are separate routes of one client app.
 */
let origin: { rect: DOMRect; at: number } | null = null;

const FRESH_MS = 6000;

export function rememberCardOrigin(rect: DOMRect) {
  origin = { rect, at: Date.now() };
}

/** The remembered card, if it was clicked a moment ago. Doesn't clear it (effects run twice in development). */
export function peekCardOrigin(): DOMRect | null {
  return origin && Date.now() - origin.at < FRESH_MS ? origin.rect : null;
}

export function forgetCardOrigin() {
  origin = null;
}
