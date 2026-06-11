import './style.css';
import { TabController } from './ui/dom';
import { createRushTab } from './tabs/rush';
import { createPlayTab } from './tabs/play';
import { createWatchTab } from './tabs/watch';
import { createRaceTab } from './tabs/race';

interface TabSpec {
  id: string;
  label: string;
  make: () => TabController;
}

const TABS: TabSpec[] = [
  { id: 'rush', label: '⚡ Rush', make: createRushTab },
  { id: 'play', label: '🧘 Zen', make: createPlayTab },
  { id: 'watch', label: 'Watch', make: createWatchTab },
  { id: 'race', label: 'Race', make: createRaceTab },
];

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark">◈</span>
      <div>
        <h1>State Space</h1>
        <p>watch search algorithms think</p>
      </div>
    </div>
    <nav class="tabs" data-tabs></nav>
    <div class="top-hint">a sliding-block puzzle &amp; its search graph</div>
  </header>
  <main data-main></main>
`;

const nav = app.querySelector<HTMLElement>('[data-tabs]')!;
const main = app.querySelector<HTMLElement>('[data-main]')!;

const controllers = new Map<string, TabController>();
let activeId = '';

function switchTo(id: string): void {
  if (id === activeId) return;
  const prev = controllers.get(activeId);
  if (prev) {
    prev.deactivate();
    prev.root.classList.remove('active');
  }
  activeId = id;

  let ctrl = controllers.get(id);
  if (!ctrl) {
    const spec = TABS.find((t) => t.id === id)!;
    ctrl = spec.make();
    controllers.set(id, ctrl);
    main.appendChild(ctrl.root);
  }
  ctrl.root.classList.add('active');
  ctrl.activate();

  nav.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === id);
  });
}

for (const spec of TABS) {
  const btn = document.createElement('button');
  btn.textContent = spec.label;
  btn.dataset.tab = spec.id;
  btn.addEventListener('click', () => switchTo(spec.id));
  nav.appendChild(btn);
}

// tabs can request a switch (e.g. rush's "practice in Zen" button)
main.addEventListener('switch-tab', (e) => {
  const id = (e as CustomEvent<string>).detail;
  if (TABS.some((t) => t.id === id)) switchTo(id);
});

// deep links: ?tab=watch opens a tab directly, ?run=1 starts its search immediately
const params = new URLSearchParams(location.search);
const requested = params.get('tab') ?? 'rush';
switchTo(TABS.some((t) => t.id === requested) ? requested : 'rush');
