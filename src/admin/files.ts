/**
 * Admin file manager — upload files to the server and share download URLs.
 * Hitting a file's URL (/f/:id) triggers an immediate download.
 * Super Admin also manages a single secret file at the fixed URL /secret.
 */
const API_TOKEN_KEY = 'link-admin-api-token';

export interface UploadedFile {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
  url: string;
}

export function getApiToken(): string | null {
  return sessionStorage.getItem(API_TOKEN_KEY);
}

export function setApiToken(token: string): void {
  sessionStorage.setItem(API_TOKEN_KEY, token);
}

export function clearApiToken(): void {
  sessionStorage.removeItem(API_TOKEN_KEY);
}

/** Authenticate against the server so uploads can be authorized. Best-effort. */
export async function serverAdminLogin(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.token) {
      setApiToken(data.token);
      return true;
    }
  } catch {
    /* server offline / not configured */
  }
  return false;
}

export async function serverAdminLogout(): Promise<void> {
  const token = getApiToken();
  clearApiToken();
  if (!token) return;
  try {
    await fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* ignore */
  }
}

async function authed(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getApiToken();
  if (!token) throw new Error('no-token');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function listFiles(): Promise<UploadedFile[]> {
  const res = await authed('/api/admin/uploads');
  if (res.status === 401) throw new Error('unauthorized');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load files.');
  return data.files as UploadedFile[];
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await authed('/api/admin/uploads', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed.');
  return data.file as UploadedFile;
}

export async function deleteFile(id: string): Promise<void> {
  const res = await authed(`/api/admin/uploads/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed.');
}

export async function getSecretFile(): Promise<UploadedFile | null> {
  const res = await authed('/api/admin/secret-upload');
  if (res.status === 401) throw new Error('unauthorized');
  if (res.status === 403) throw new Error('forbidden');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load secret file.');
  return (data.file as UploadedFile | null) ?? null;
}

export type CosmeticAdminItem = {
  id: string;
  kind: string;
  name: string;
  previewUrl: string;
  assetUrl: string;
  createdAt: string;
};

export async function listAdminCosmetics(): Promise<CosmeticAdminItem[]> {
  const res = await authed('/api/admin/cosmetics');
  if (res.status === 401) throw new Error('unauthorized');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load cosmetics.');
  return (data.items as CosmeticAdminItem[]) || [];
}

export async function uploadCosmeticDual(opts: {
  kind: string;
  name: string;
  preview: File;
  asset: File;
}): Promise<CosmeticAdminItem> {
  const form = new FormData();
  form.append('kind', opts.kind);
  form.append('name', opts.name);
  form.append('preview', opts.preview);
  form.append('asset', opts.asset);
  const res = await authed('/api/admin/cosmetics', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Cosmetic upload failed.');
  return data.item as CosmeticAdminItem;
}

export async function deleteCosmetic(id: string): Promise<void> {
  const res = await authed(`/api/admin/cosmetics/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not delete cosmetic.');
}

export async function listAdminMediaPack(): Promise<CosmeticAdminItem[]> {
  const res = await authed('/api/admin/media-pack');
  if (res.status === 401) throw new Error('unauthorized');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load media pack.');
  return (data.items as CosmeticAdminItem[]) || [];
}

export async function uploadMediaPackDual(opts: {
  kind: string;
  name: string;
  preview: File;
  asset: File;
}): Promise<CosmeticAdminItem> {
  const form = new FormData();
  form.append('kind', opts.kind);
  form.append('name', opts.name);
  form.append('preview', opts.preview);
  form.append('asset', opts.asset);
  const res = await authed('/api/admin/media-pack', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Media pack upload failed.');
  return data.item as CosmeticAdminItem;
}

export async function deleteMediaPack(id: string): Promise<void> {
  const res = await authed(`/api/admin/media-pack/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not delete media.');
}

export async function uploadSecretFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await authed('/api/admin/secret-upload', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Secret upload failed.');
  return data.file as UploadedFile;
}

export async function deleteSecretFile(): Promise<void> {
  const res = await authed('/api/admin/secret-upload', { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not clear secret file.');
}

export type DownloadPerson = {
  label: string;
  userId: string;
  username: string;
  ip: string;
  downloads: number;
  lastAt: string;
};

export type DownloadKindStats = {
  totalDownloads: number;
  uniquePeople: number;
  people: DownloadPerson[];
};

export type DownloadStats = {
  regular: DownloadKindStats;
  secret: DownloadKindStats;
};

export async function fetchDownloadStats(): Promise<DownloadStats> {
  const res = await authed('/api/admin/download-stats');
  if (res.status === 401) throw new Error('unauthorized');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load download stats.');
  return data.stats as DownloadStats;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

export function renderFilesPage(opts: { superAdmin?: boolean } = {}): string {
  const secretPanel = opts.superAdmin
    ? `
    <section class="admin-panel admin-secret-panel">
      <h3>Secret File Upload</h3>
      <p class="admin-files-hint">
        Super Admin only — exactly <strong>one</strong> file in this slot.
        Upload or replace overwrites the previous file. The public URL is fixed at
        <code>/secret</code>; anyone who opens it gets an automatic download (no page).
        Max 512 MB.
      </p>
      <div class="admin-secret-url-row">
        <code class="admin-secret-url" id="secret-url">${esc(`${typeof location !== 'undefined' ? location.origin : ''}/secret`)}</code>
        <button type="button" class="admin-mini" id="secret-copy">Copy URL</button>
        <a class="admin-mini" id="secret-open" href="/secret" download>Open / Download</a>
      </div>
      <div class="admin-upload">
        <input type="file" id="secret-file-input" hidden />
        <button type="button" class="admin-mini" id="secret-file-pick">Choose file…</button>
        <span class="admin-upload-name" id="secret-file-name">No file selected</span>
        <button type="button" class="admin-mini admin-upload-send" id="secret-file-send" disabled>Upload / Replace</button>
      </div>
      <div id="secret-file-status" class="admin-secret-status"><p class="admin-files-empty">Loading…</p></div>
    </section>
  `
    : '';

  return `
    <section class="admin-panel" style="margin-bottom:14px">
      <h3>Download activity</h3>
      <p class="admin-files-hint">
        Regular and secret downloads are tracked separately — totals are never combined.
        Signed-in players are named; guests are shown by IP.
      </p>
      <div class="admin-dl-stats" id="download-stats">
        <p class="admin-files-empty">Loading download stats…</p>
      </div>
    </section>
    ${secretPanel}
    ${
      opts.superAdmin
        ? `
    <section class="admin-panel admin-cos-panel">
      <h3>Shop cosmetics (dual upload)</h3>
      <p class="admin-files-hint">
        Upload a <strong>preview image</strong> (shown in Shop / chat) and a <strong>downloadable asset</strong> together.
        Players who equip a card download the asset immediately. Kinds: nameplate, frame, effect.
      </p>
      <div class="admin-dual-form">
        <label>Kind
          <select id="cos-kind">
            <option value="nameplate">Nameplate</option>
            <option value="frame">Frame</option>
            <option value="effect">Profile effect</option>
          </select>
        </label>
        <label>Name <input type="text" id="cos-name" maxlength="64" placeholder="Neon Edge Frame" /></label>
        <label>Preview image <input type="file" id="cos-preview" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        <label>Asset file <input type="file" id="cos-asset" accept="image/*,.zip,.json,application/zip,application/json" /></label>
        <button type="button" class="admin-mini admin-upload-send" id="cos-send">Upload cosmetic</button>
      </div>
      <div id="cos-list" class="admin-cos-list"><p class="admin-files-empty">Loading…</p></div>
    </section>
    <section class="admin-panel admin-cos-panel">
      <h3>Chat stickers &amp; GIFs (dual upload)</h3>
      <p class="admin-files-hint">
        Same dual-file pattern for the chat media pack. Preview appears in the picker; asset is what gets sent in chat.
      </p>
      <div class="admin-dual-form">
        <label>Kind
          <select id="media-kind">
            <option value="sticker">Sticker</option>
            <option value="gif">GIF</option>
            <option value="emoji">Emoji asset</option>
          </select>
        </label>
        <label>Name <input type="text" id="media-name" maxlength="64" placeholder="Victory sticker" /></label>
        <label>Preview image <input type="file" id="media-preview" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        <label>Asset file <input type="file" id="media-asset" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        <button type="button" class="admin-mini admin-upload-send" id="media-send">Upload media</button>
      </div>
      <div id="media-list" class="admin-cos-list"><p class="admin-files-empty">Loading…</p></div>
    </section>
    `
        : ''
    }
    <section class="admin-panel">
      <h3>Upload File</h3>
      <p class="admin-files-hint">
        Files are stored in the database. Anyone who opens a file's URL downloads it immediately. Max 25 MB per file.
      </p>
      <div class="admin-upload">
        <input type="file" id="file-input" hidden />
        <button type="button" class="admin-mini" id="file-pick">Choose file…</button>
        <span class="admin-upload-name" id="file-name">No file selected</span>
        <button type="button" class="admin-mini admin-upload-send" id="file-send" disabled>Upload</button>
      </div>
    </section>
    <section class="admin-panel" style="margin-top:14px">
      <h3>Uploaded Files</h3>
      <div id="files-list"><p class="admin-files-empty">Loading…</p></div>
    </section>
  `;
}

function listHtml(files: UploadedFile[]): string {
  if (files.length === 0) {
    return `<p class="admin-files-empty">No files uploaded yet.</p>`;
  }
  return `
    <div class="admin-table-wrap">
      <table class="admin-table" style="min-width:720px">
        <thead>
          <tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Download URL</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${files
            .map((f) => {
              const abs = `${location.origin}${f.url}`;
              return `
            <tr>
              <td><strong>${esc(f.filename)}</strong></td>
              <td>${esc(f.mime)}</td>
              <td>${formatBytes(f.size)}</td>
              <td>${esc((f.createdAt || '').replace('T', ' ').slice(0, 16))}</td>
              <td><a class="admin-file-link" href="${esc(abs)}">${esc(f.url)}</a></td>
              <td>
                <button type="button" class="admin-mini" data-copy="${esc(abs)}">Copy URL</button>
                <a class="admin-mini" href="${esc(abs)}">Download</a>
                <button type="button" class="admin-mini danger" data-del="${esc(f.id)}">Delete</button>
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function secretStatusHtml(file: UploadedFile | null): string {
  if (!file) {
    return `<p class="admin-files-empty">No secret file uploaded yet. Upload one to activate the fixed URL <code>/secret</code>.</p>`;
  }
  const abs = `${location.origin}${file.url || '/secret'}`;
  return `
    <div class="admin-secret-current">
      <div>
        <strong>${esc(file.filename)}</strong>
        <span class="admin-secret-meta">${esc(file.mime)} · ${formatBytes(file.size)} · ${(file.createdAt || '').replace('T', ' ').slice(0, 16)}</span>
        <span class="admin-secret-meta">Fixed URL: <a class="admin-file-link" href="${esc(abs)}">${esc(abs)}</a></span>
      </div>
      <div class="admin-secret-actions">
        <a class="admin-mini" href="${esc(abs)}" download>Download</a>
        <button type="button" class="admin-mini danger" id="secret-file-clear">Clear</button>
      </div>
    </div>
  `;
}

function peopleTable(people: DownloadPerson[]): string {
  if (!people.length) return `<p class="admin-files-empty">No downloads recorded yet.</p>`;
  return `
    <div class="admin-table-wrap">
      <table class="admin-table" style="min-width:480px">
        <thead>
          <tr><th>Who</th><th>Downloads</th><th>Last download</th><th>IP</th></tr>
        </thead>
        <tbody>
          ${people
            .map(
              (p) => `
            <tr>
              <td><strong>${esc(p.label)}</strong>${p.userId ? `<div class="admin-secret-meta">${esc(p.userId)}</div>` : ''}</td>
              <td>${p.downloads}</td>
              <td>${esc((p.lastAt || '').replace('T', ' ').slice(0, 16))}</td>
              <td>${esc(p.ip || '—')}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function downloadStatsHtml(stats: DownloadStats): string {
  const r = stats.regular;
  const s = stats.secret;
  return `
    <div class="admin-dl-grid">
      <article class="admin-dl-card">
        <h4>Regular downloads</h4>
        <p class="admin-dl-kpis">
          <span><strong>${r.totalDownloads}</strong> downloads</span>
          <span><strong>${r.uniquePeople}</strong> people</span>
        </p>
        ${peopleTable(r.people)}
      </article>
      <article class="admin-dl-card admin-dl-card--secret">
        <h4>Secret downloads</h4>
        <p class="admin-dl-kpis">
          <span><strong>${s.totalDownloads}</strong> downloads</span>
          <span><strong>${s.uniquePeople}</strong> people</span>
        </p>
        ${peopleTable(s.people)}
      </article>
    </div>
  `;
}

/** Wire the Files page: upload control + live list (+ secret slot for Super Admin). */
export function bindFilesPage(
  root: HTMLElement,
  toast: (msg: string) => void,
  opts: { superAdmin?: boolean } = {},
): void {
  const input = root.querySelector<HTMLInputElement>('#file-input');
  const pick = root.querySelector<HTMLButtonElement>('#file-pick');
  const nameEl = root.querySelector<HTMLElement>('#file-name');
  const send = root.querySelector<HTMLButtonElement>('#file-send');
  const listEl = root.querySelector<HTMLElement>('#files-list');
  const statsEl = root.querySelector<HTMLElement>('#download-stats');
  if (!input || !pick || !nameEl || !send || !listEl) return;

  const refreshStats = async (): Promise<void> => {
    if (!statsEl) return;
    try {
      const stats = await fetchDownloadStats();
      statsEl.innerHTML = downloadStatsHtml(stats);
    } catch (err) {
      const msg = (err as Error).message;
      statsEl.innerHTML =
        msg === 'no-token' || msg === 'unauthorized'
          ? `<p class="admin-files-empty">Sign out and sign back in to load download stats.</p>`
          : `<p class="admin-files-empty">${esc(msg)}</p>`;
    }
  };

  const refresh = async (): Promise<void> => {
    try {
      const files = await listFiles();
      listEl.innerHTML = listHtml(files);
      bindRows();
    } catch (err) {
      const msg = (err as Error).message;
      listEl.innerHTML =
        msg === 'no-token' || msg === 'unauthorized'
          ? `<p class="admin-files-empty">Server file storage is unavailable. Sign out and sign back in to reconnect.</p>`
          : `<p class="admin-files-empty">${esc(msg)}</p>`;
    }
  };

  const bindRows = (): void => {
    listEl.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy || '');
          toast('Download URL copied');
        } catch {
          toast('Copy failed — select the URL manually');
        }
      });
    });
    listEl.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del!;
        if (!confirm('Delete this file? The download URL will stop working.')) return;
        try {
          await deleteFile(id);
          toast('File deleted');
          await refresh();
        } catch (err) {
          toast((err as Error).message);
        }
      });
    });
  };

  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    nameEl.textContent = file ? `${file.name} (${formatBytes(file.size)})` : 'No file selected';
    send.disabled = !file;
  });

  send.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) return;
    send.disabled = true;
    send.textContent = 'Uploading…';
    try {
      const saved = await uploadFile(file);
      toast(`Uploaded ${saved.filename}`);
      input.value = '';
      nameEl.textContent = 'No file selected';
      await refresh();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      send.textContent = 'Upload';
      send.disabled = !input.files?.[0];
    }
  });

  if (opts.superAdmin) {
    bindSecretSlot(root, toast, refreshStats);
    bindCosmeticsAdmin(root, toast);
    bindMediaPackAdmin(root, toast);
  }

  void refresh();
  void refreshStats();
}

function dualListHtml(items: CosmeticAdminItem[], delAttr: string): string {
  if (!items.length) return `<p class="admin-files-empty">Nothing uploaded yet.</p>`;
  return `
    <div class="admin-table-wrap">
      <table class="admin-table" style="min-width:640px">
        <thead><tr><th>Preview</th><th>Name</th><th>Kind</th><th>Created</th><th></th></tr></thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr>
              <td><img class="admin-cos-thumb" src="${esc(i.previewUrl)}" alt="" /></td>
              <td><strong>${esc(i.name)}</strong></td>
              <td>${esc(i.kind)}</td>
              <td>${esc((i.createdAt || '').replace('T', ' ').slice(0, 16))}</td>
              <td><button type="button" class="admin-mini danger" data-${delAttr}="${esc(i.id)}">Delete</button></td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function bindCosmeticsAdmin(root: HTMLElement, toast: (msg: string) => void): void {
  const listEl = root.querySelector<HTMLElement>('#cos-list');
  const send = root.querySelector<HTMLButtonElement>('#cos-send');
  const kindEl = root.querySelector<HTMLSelectElement>('#cos-kind');
  const nameEl = root.querySelector<HTMLInputElement>('#cos-name');
  const previewEl = root.querySelector<HTMLInputElement>('#cos-preview');
  const assetEl = root.querySelector<HTMLInputElement>('#cos-asset');
  if (!listEl || !send || !kindEl || !nameEl || !previewEl || !assetEl) return;

  const refresh = async () => {
    try {
      const items = await listAdminCosmetics();
      listEl.innerHTML = dualListHtml(items, 'cos-del');
      listEl.querySelectorAll<HTMLButtonElement>('[data-cos-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this cosmetic?')) return;
          try {
            await deleteCosmetic(btn.dataset.cosDel!);
            toast('Cosmetic deleted');
            await refresh();
          } catch (err) {
            toast((err as Error).message);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p class="admin-files-empty">${esc((err as Error).message)}</p>`;
    }
  };

  send.addEventListener('click', async () => {
    const preview = previewEl.files?.[0];
    const asset = assetEl.files?.[0];
    if (!preview || !asset) {
      toast('Choose both a preview image and an asset file.');
      return;
    }
    send.disabled = true;
    send.textContent = 'Uploading…';
    try {
      await uploadCosmeticDual({
        kind: kindEl.value,
        name: nameEl.value.trim() || preview.name,
        preview,
        asset,
      });
      toast('Cosmetic uploaded');
      nameEl.value = '';
      previewEl.value = '';
      assetEl.value = '';
      await refresh();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      send.disabled = false;
      send.textContent = 'Upload cosmetic';
    }
  });

  void refresh();
}

function bindMediaPackAdmin(root: HTMLElement, toast: (msg: string) => void): void {
  const listEl = root.querySelector<HTMLElement>('#media-list');
  const send = root.querySelector<HTMLButtonElement>('#media-send');
  const kindEl = root.querySelector<HTMLSelectElement>('#media-kind');
  const nameEl = root.querySelector<HTMLInputElement>('#media-name');
  const previewEl = root.querySelector<HTMLInputElement>('#media-preview');
  const assetEl = root.querySelector<HTMLInputElement>('#media-asset');
  if (!listEl || !send || !kindEl || !nameEl || !previewEl || !assetEl) return;

  const refresh = async () => {
    try {
      const items = await listAdminMediaPack();
      listEl.innerHTML = dualListHtml(items, 'media-del');
      listEl.querySelectorAll<HTMLButtonElement>('[data-media-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this media item?')) return;
          try {
            await deleteMediaPack(btn.dataset.mediaDel!);
            toast('Media deleted');
            await refresh();
          } catch (err) {
            toast((err as Error).message);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p class="admin-files-empty">${esc((err as Error).message)}</p>`;
    }
  };

  send.addEventListener('click', async () => {
    const preview = previewEl.files?.[0];
    const asset = assetEl.files?.[0];
    if (!preview || !asset) {
      toast('Choose both a preview image and an asset file.');
      return;
    }
    send.disabled = true;
    send.textContent = 'Uploading…';
    try {
      await uploadMediaPackDual({
        kind: kindEl.value,
        name: nameEl.value.trim() || preview.name,
        preview,
        asset,
      });
      toast('Media uploaded');
      nameEl.value = '';
      previewEl.value = '';
      assetEl.value = '';
      await refresh();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      send.disabled = false;
      send.textContent = 'Upload media';
    }
  });

  void refresh();
}

function bindSecretSlot(root: HTMLElement, toast: (msg: string) => void, onChange?: () => void): void {
  const input = root.querySelector<HTMLInputElement>('#secret-file-input');
  const pick = root.querySelector<HTMLButtonElement>('#secret-file-pick');
  const nameEl = root.querySelector<HTMLElement>('#secret-file-name');
  const send = root.querySelector<HTMLButtonElement>('#secret-file-send');
  const statusEl = root.querySelector<HTMLElement>('#secret-file-status');
  const copyBtn = root.querySelector<HTMLButtonElement>('#secret-copy');
  const urlEl = root.querySelector<HTMLElement>('#secret-url');
  if (!input || !pick || !nameEl || !send || !statusEl) return;

  const absUrl = `${location.origin}/secret`;
  if (urlEl) urlEl.textContent = absUrl;

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(absUrl);
      toast('Secret URL copied');
    } catch {
      toast('Copy failed — select the URL manually');
    }
  });

  const refreshSecret = async (): Promise<void> => {
    try {
      const file = await getSecretFile();
      statusEl.innerHTML = secretStatusHtml(file);
      statusEl.querySelector<HTMLButtonElement>('#secret-file-clear')?.addEventListener('click', async () => {
        if (!confirm('Clear the secret file? /secret will stop working until you upload again.')) return;
        try {
          await deleteSecretFile();
          toast('Secret file cleared');
          await refreshSecret();
          onChange?.();
        } catch (err) {
          toast((err as Error).message);
        }
      });
    } catch (err) {
      const msg = (err as Error).message;
      statusEl.innerHTML =
        msg === 'forbidden'
          ? `<p class="admin-files-empty">Super Admin only.</p>`
          : msg === 'no-token' || msg === 'unauthorized'
            ? `<p class="admin-files-empty">Sign out and sign back in to manage the secret file.</p>`
            : `<p class="admin-files-empty">${esc(msg)}</p>`;
    }
  };

  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    nameEl.textContent = file ? `${file.name} (${formatBytes(file.size)})` : 'No file selected';
    send.disabled = !file;
  });

  send.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) return;
    send.disabled = true;
    send.textContent = 'Uploading…';
    try {
      const saved = await uploadSecretFile(file);
      toast(`Secret file set: ${saved.filename}`);
      input.value = '';
      nameEl.textContent = 'No file selected';
      await refreshSecret();
      onChange?.();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      send.textContent = 'Upload / Replace';
      send.disabled = !input.files?.[0];
    }
  });

  void refreshSecret();
}
