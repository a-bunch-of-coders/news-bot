// src/commands/feedspot/cache.ts
import type { CachedView, ViewState } from "./types.js";
// import { VIEW_TTL_MS } from "./constants.js";

const viewCache = new Map<string, CachedView>();

export function cacheSet(viewId: string, state: ViewState) {
  viewCache.set(viewId, { createdAt: Date.now(), state });
}

export function cacheGet(viewId: string): ViewState | undefined {
  const ent = viewCache.get(viewId);
  if (!ent) return undefined;

  // If you re-enable TTL later:
  // if (Date.now() - ent.createdAt > VIEW_TTL_MS) {
  //   viewCache.delete(viewId);
  //   return undefined;
  // }

  return ent.state;
}

export function cacheBump(viewId: string, next: ViewState) {
  viewCache.set(viewId, { createdAt: Date.now(), state: next });
}

export function cacheCleanup() {
  // If you re-enable TTL later, prune here.
}

export function cacheDebugKeys(): string[] {
  return [...viewCache.keys()];
}
