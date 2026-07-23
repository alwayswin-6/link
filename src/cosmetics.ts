/** Cosmetics (Discord-style nameplate / frame / profile effect) + sticker media helpers. */

export type CosmeticKind = 'nameplate' | 'frame' | 'effect';
export type MediaKind = 'sticker' | 'gif' | 'emoji';

export type CosmeticItem = {
  id: string;
  kind: CosmeticKind;
  name: string;
  previewUrl: string;
  assetUrl: string;
  createdAt: string;
};

export type MediaItem = {
  id: string;
  kind: MediaKind;
  name: string;
  previewUrl: string;
  assetUrl: string;
  createdAt: string;
};

export type EquippedCosmetics = {
  nameplateId: string;
  frameId: string;
  effectId: string;
};

export const EMPTY_EQUIPPED: EquippedCosmetics = {
  nameplateId: '',
  frameId: '',
  effectId: '',
};

const EQUIP_KEY = 'link-equipped-cosmetics';

export function loadLocalEquipped(): EquippedCosmetics {
  try {
    const raw = localStorage.getItem(EQUIP_KEY);
    if (!raw) return { ...EMPTY_EQUIPPED };
    const parsed = JSON.parse(raw) as Partial<EquippedCosmetics>;
    return {
      nameplateId: String(parsed.nameplateId || ''),
      frameId: String(parsed.frameId || ''),
      effectId: String(parsed.effectId || ''),
    };
  } catch {
    return { ...EMPTY_EQUIPPED };
  }
}

export function saveLocalEquipped(eq: EquippedCosmetics): void {
  localStorage.setItem(EQUIP_KEY, JSON.stringify(eq));
}

/** Wrap an avatar markup string with frame / effect layers. */
export function cosmeticAvatarShell(
  innerAvatarHtml: string,
  opts: { frameUrl?: string; effectUrl?: string; sizeClass?: string } = {},
): string {
  const size = opts.sizeClass ? ` ${opts.sizeClass}` : '';
  const frame = opts.frameUrl
    ? `<img class="cos-frame" src="${opts.frameUrl.replace(/"/g, '&quot;')}" alt="" draggable="false" />`
    : '';
  const effect = opts.effectUrl
    ? `<img class="cos-effect" src="${opts.effectUrl.replace(/"/g, '&quot;')}" alt="" draggable="false" />`
    : '';
  return `<span class="cos-avatar-shell${size}">${effect}<span class="cos-avatar-core">${innerAvatarHtml}</span>${frame}</span>`;
}

export function nameplateHtml(name: string, plateUrl?: string): string {
  const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!plateUrl) return `<span class="cos-nameplate-text">${safe}</span>`;
  return `<span class="cos-nameplate" style="--cos-plate:url('${plateUrl.replace(/'/g, '%27')}')"><span>${safe}</span></span>`;
}
