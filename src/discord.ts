/** Shared Discord invite opener for launcher + chat voice. */

const FALLBACK = 'https://discord.gg/vYZH5jh7es';

export function discordInviteUrl(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_DISCORD_INVITE;
  return (fromEnv && fromEnv.trim()) || FALLBACK;
}

export function openDiscordInvite(): void {
  window.open(discordInviteUrl(), '_blank', 'noopener,noreferrer');
}
