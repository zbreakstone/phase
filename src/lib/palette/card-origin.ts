/**
 * Where the palette card you just opened sat on screen, so the editor's square can zoom out of it.
 * It lives in module scope because the home page and the editor are separate routes of one client app.
 */
let origin: { rect: DOMRect; at: number; picture: HTMLCanvasElement | null } | null = null;

const FRESH_MS = 6000;

export function rememberCardOrigin(rect: DOMRect, source?: HTMLCanvasElement | null) {
  // A copy of the card's picture, so it can keep zooming while the editor is still loading.
  let picture: HTMLCanvasElement | null = null;
  if (source && source.width > 0) {
    picture = document.createElement("canvas");
    picture.width = source.width;
    picture.height = source.height;
    picture.getContext("2d")?.drawImage(source, 0, 0);
  }
  origin = { rect, at: Date.now(), picture };
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

/** Which palette was just left, if any (doesn't consume it). */
export function peekLeavingId(): string | null {
  return leaving && Date.now() - leaving.at < FRESH_MS ? leaving.id : null;
}

/**
 * The zoom from card to editor starts the moment the editor's shell is on screen, not when the palette finishes loading:
 * a copy of the card's picture flies to where the square will be, and waits there until the real square is ready.
 */
let arrival: { el: HTMLElement; done: Promise<void> } | null = null;

export function hasArrival(): boolean {
  return arrival !== null;
}

/** Fly the remembered card's picture to `target`'s rectangle. Returns false when there is nothing to fly. */
export function startArrival(target: HTMLElement): boolean {
  if (arrival) return true;
  const picture = origin && Date.now() - origin.at < FRESH_MS ? origin.picture : null;
  if (!origin || !picture) return false;
  const from = origin.rect;
  const to = target.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) return false;
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    overflow: "hidden",
    zIndex: "50",
    pointerEvents: "none",
    willChange: "transform",
  });
  picture.style.cssText = "display:block;width:100%;height:100%";
  el.appendChild(picture);
  document.body.appendChild(el);
  const flight = el.animate(flightKeyframes(from, to, 16, 24), { duration: 420, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
  arrival = { el, done: flight.finished.then(() => undefined, () => undefined) };
  return true;
}

/** The real square is on screen: let the flight finish, then fade the stand-in away. */
export function endArrival() {
  const current = arrival;
  if (!current) return;
  void current.done.then(() => {
    const fade = current.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-out", fill: "forwards" });
    const remove = () => {
      current.el.remove();
      if (arrival === current) arrival = null;
      forgetCardOrigin();
    };
    fade.finished.then(remove, remove);
  });
}
