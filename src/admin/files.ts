/**
 * Admin file manager — upload files to the server and share download URLs.
 * Hitting a file's URL (/f/:id) triggers an immediate download.
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

export function renderFilesPage(): string {
  return `
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

/** Wire the Files page: upload control + live list. */
export function bindFilesPage(root: HTMLElement, toast: (msg: string) => void): void {
  const input = root.querySelector<HTMLInputElement>('#file-input');
  const pick = root.querySelector<HTMLButtonElement>('#file-pick');
  const nameEl = root.querySelector<HTMLElement>('#file-name');
  const send = root.querySelector<HTMLButtonElement>('#file-send');
  const listEl = root.querySelector<HTMLElement>('#files-list');
  if (!input || !pick || !nameEl || !send || !listEl) return;

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

  void refresh();
}
