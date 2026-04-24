import { useState, useCallback } from 'react';
import type { ScheduleRow } from '../types';

export type ScheduleDraft = Omit<ScheduleRow, 'id' | 'updatedAt' | 'todo'>;

type GasResponse<T> = T & { error?: string; status?: number };

async function parse<T>(res: Response): Promise<GasResponse<T>> {
  return (await res.json().catch(() => ({}))) as GasResponse<T>;
}

function errorMessage(status: number, body: { error?: string }): string {
  if (status === 409) return '別の更新と競合しました。再読み込みしてください。';
  if (body?.error) return body.error;
  return `API Error: ${status}`;
}

export function useScheduleApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async (): Promise<ScheduleRow[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets/schedule');
      const body = await parse<{ rows?: ScheduleRow[] }>(res);
      if (!res.ok) throw new Error(errorMessage(res.status, body));
      return body.rows ?? [];
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addRow = useCallback(async (draft: ScheduleDraft): Promise<ScheduleRow | null> => {
    setError(null);
    try {
      const res = await fetch('/api/sheets/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', row: draft }),
      });
      const body = await parse<{ row?: ScheduleRow }>(res);
      if (!res.ok) throw new Error(errorMessage(res.status, body));
      return body.row ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return null;
    }
  }, []);

  const saveRow = useCallback(async (row: ScheduleRow): Promise<ScheduleRow | null> => {
    setError(null);
    try {
      const res = await fetch('/api/sheets/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', row }),
      });
      const body = await parse<{ row?: ScheduleRow }>(res);
      if (!res.ok) throw new Error(errorMessage(res.status, body));
      return body.row ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return null;
    }
  }, []);

  const deleteRow = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch('/api/sheets/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const body = await parse<{ ok?: boolean }>(res);
      if (!res.ok) throw new Error(errorMessage(res.status, body));
      return Boolean(body.ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
      return false;
    }
  }, []);

  return { fetchSchedule, addRow, saveRow, deleteRow, loading, error };
}
