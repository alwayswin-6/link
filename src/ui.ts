/** Shared toast + modal helpers used across the player dashboard */

let toastTimer = 0;

export function showToast(msg: string, ms = 2600): void {
  let el = document.querySelector<HTMLDivElement>('#link-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'link-toast';
    el.className = 'link-toast';
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el!.hidden = true;
  }, ms);
}

export function ensureUiChrome(): void {
  if (document.querySelector('#link-modal')) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="link-modal-overlay" id="link-modal" hidden>
      <div class="link-modal" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
        <button type="button" class="link-modal-close" id="link-modal-close" aria-label="Close">×</button>
        <h2 id="link-modal-title"></h2>
        <div class="link-modal-body" id="link-modal-body"></div>
        <div class="link-modal-actions" id="link-modal-actions"></div>
      </div>
    </div>
    <div class="link-notify" id="link-notify" hidden></div>
    `,
  );

  document.querySelector('#link-modal-close')?.addEventListener('click', closeModal);
  document.querySelector('#link-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'link-modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

export function openModal(opts: {
  title: string;
  bodyHtml: string;
  actions?: { label: string; primary?: boolean; onClick?: () => void }[];
}): void {
  ensureUiChrome();
  const overlay = document.querySelector<HTMLDivElement>('#link-modal')!;
  document.querySelector<HTMLHeadingElement>('#link-modal-title')!.textContent = opts.title;
  document.querySelector<HTMLDivElement>('#link-modal-body')!.innerHTML = opts.bodyHtml;
  const actions = document.querySelector<HTMLDivElement>('#link-modal-actions')!;
  actions.innerHTML = '';
  const list = opts.actions?.length
    ? opts.actions
    : [{ label: 'CLOSE', primary: true as boolean }];
  for (const a of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `link-modal-btn${a.primary ? ' primary' : ''}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      a.onClick?.();
      closeModal();
    });
    actions.appendChild(btn);
  }
  overlay.hidden = false;
}

export function closeModal(): void {
  const overlay = document.querySelector<HTMLDivElement>('#link-modal');
  if (overlay) overlay.hidden = true;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
