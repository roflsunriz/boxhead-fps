export function requiredElement<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Required element missing: ${selector}`);
  return el;
}
