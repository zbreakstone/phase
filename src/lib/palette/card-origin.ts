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

/** The reverse trip: the square you're leaving, so that palette's card on the home page can zoom out of it. */
let leaving: { id: string; rect: DOMRect; at: number } | null = null;

export function rememberLeavingSquare(id: string, rect: DOMRect) {
  leaving = { id, rect, at: Date.now() };
}

/** Takes the square rect for this palette's card (once), if it was just left. */
export function takeLeavingSquare(id: string): DOMRect | null {
  if (!leaving || leaving.id !== id) return null;
  const { rect, at } = leaving;
  leaving = null;
  return Date.now() - at < FRESH_MS ? rect : null;
}

/**
 * Keyframes that carry an element from where `from` sat to where `to` sits. Scaling would squash its
 * rounded corners, so the border radius is animated too, keeping the corners the same size on screen
 * while they grow from `radiusFrom` to `radiusTo` pixels. (Use with an easing on the animation itself, not per keyframe.)
 */
export function flightKeyframes(from: DOMRect, to: DOMRect, radiusFrom: number, radiusTo: number, steps = 12): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const lerp = (a: number, b: number) => a + (b - a) * p;
    const sx = lerp(from.width / to.width, 1);
    const sy = lerp(from.height / to.height, 1);
    const r = lerp(radiusFrom, radiusTo);
    frames.push({
      offset: p,
      transformOrigin: "0 0",
      transform: `translate(${lerp(from.left - to.left, 0)}px, ${lerp(from.top - to.top, 0)}px) scale(${sx}, ${sy})`,
      borderRadius: `${r / sx}px / ${r / sy}px`,
    });
  }
  return frames;
}
