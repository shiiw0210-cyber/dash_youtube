import { useCallback, useEffect, useState } from 'react';
import type { ThumbnailMeta } from '../types';

const STORAGE_KEY = 'dash_youtube.thumbnailMeta.v1';

type MetaMap = Record<string, ThumbnailMeta>;

function readStorage(): MetaMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? (parsed as MetaMap) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: MetaMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 容量超過などは無視
  }
}

/**
 * 動画ごとのサムネイル メタデータ (ジャンル / サムネ文字 / 人数 / 色 等) を
 * localStorage で永続化する。
 */
export function useThumbnailMeta() {
  const [metaMap, setMetaMap] = useState<MetaMap>(() => readStorage());

  useEffect(() => {
    writeStorage(metaMap);
  }, [metaMap]);

  const updateMeta = useCallback(
    (videoId: string, patch: Partial<ThumbnailMeta>) => {
      setMetaMap((prev) => {
        const current = prev[videoId] ?? { videoId };
        const merged: ThumbnailMeta = {
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

  const clearMeta = useCallback((videoId: string) => {
    setMetaMap((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

  return { metaMap, updateMeta, clearMeta };
}
