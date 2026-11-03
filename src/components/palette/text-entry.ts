/** Text fields keep the browser's own undo and typing; everything else (sliders, buttons, the page) is fair game for shortcuts. */
export const isTextEntry = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["range", "checkbox", "radio", "button", "submit", "reset", "file", "color"].includes(el.type);
  return false;
};
