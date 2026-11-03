/** Text fields keep the browser's own undo and typing; everything else (sliders, buttons, the page) is fair game for shortcuts. */
export const isTextEntry = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["range", "checkbox", "radio", "button", "submit", "reset", "file", "color"].includes(el.type);
  return false;
};

/**
 * Whether a popup matching the selector is actually open. Base UI keeps a popup in the DOM (marked `data-closed`)
 * while it animates out, and can leave it there if the exit animation never reports back, so mere presence
 * would swallow the page's shortcuts for good.
 */
export const isPopupOpen = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(selector)).some(
    (el) => !el.hasAttribute("data-closed") && !el.hasAttribute("data-ending-style") && el.getAttribute("aria-hidden") !== "true",
  );
