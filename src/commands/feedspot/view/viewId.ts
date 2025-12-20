// src/commands/feedspot/view/viewId.ts
import type { CommandInteraction } from "discord.js";

export function makeViewId(interaction: CommandInteraction): string {
  const gid = interaction.guildId ?? "dm";
  return `fs-${gid}-${interaction.user.id}-${Date.now().toString(36)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function shortHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
