export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild as T;
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export interface TabController {
  root: HTMLElement;
  activate(): void;
  deactivate(): void;
}
