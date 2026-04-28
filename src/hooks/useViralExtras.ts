import { useCallback, useEffect, useState } from 'react';
import type { ViralExtras } from '../types';

const STORAGE_KEY = 'dash_youtube.viralExtras.v1';

type ExtrasMap = Record<string, ViralExtras>;

function readStorage(): ExtrasMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? (parsed as ExtrasMap) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: ExtrasMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 容量超過などは無視
  }
}

/**
 * 動画ごとの「伸びる動画」分析用 手入力データを localStorage で永続化。
 * Supabase へ移行する場合はこの hook を差し替えるだけで済む。
 */
export function useViralExtras() {
  const [extrasMap, setExtrasMap] = useState<ExtrasMap>(() => readStorage());

  useEffect(() => {
    writeStorage(extrasMap);
  }, [extrasMap]);

  const updateExtras = useCallback(
    (videoId: string, patch: Partial<ViralExtras>) => {
      setExtrasMap((prev) => {
        const current = prev[videoId] ?? { videoId };
        const merged: ViralExtras = {
          ...current,
          ...patch,
          videoId,
          updatedAt: new Date().toISOString(),
        };
        return { ...prev, [videoId]: merged };
      });
    },
    []
  );

  const clearExtras = useCallback((videoId: string) => {
    setExtrasMap((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

  const replaceAll = useCallback((next: ExtrasMap) => {
    setExtrasMap(next);
  }, []);

  return { extrasMap, updateExtras, clearExtras, replaceAll };
}
