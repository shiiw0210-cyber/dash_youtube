import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ScheduleRow {
  id: string;
  shoot: string;
  shootDate: string;
  deliveryDate: string;
  publishDate: string;
  editor: string;
  thumbnail: string;
  title: string;
  content: string;
  materialUrl: string;
  updatedAt: string;
  todo: boolean;
}

export type ScheduleDraft = Omit<ScheduleRow, 'id' | 'updatedAt' | 'todo'>;

interface DbRow {
  id: string;
  shoot: string | null;
  shoot_date: string | null;
  delivery_date: string | null;
  publish_date: string | null;
  editor: string | null;
  thumbnail: string | null;
  title: string | null;
  content: string | null;
  material_url: string | null;
  todo: boolean | null;
  updated_at: string | null;
}

const TABLE = 'schedules';
const COLUMNS =
  'id, shoot, shoot_date, delivery_date, publish_date, editor, thumbnail, title, content, material_url, todo, updated_at';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function fromDb(r: DbRow): ScheduleRow {
  return {
    id: r.id,
    shoot: r.shoot ?? '',
    shootDate: r.shoot_date ?? '',
    deliveryDate: r.delivery_date ?? '',
    publishDate: r.publish_date ?? '',
    editor: r.editor ?? '',
    thumbnail: r.thumbnail ?? '',
    title: r.title ?? '',
    content: r.content ?? '',
    materialUrl: r.material_url ?? '',
    updatedAt: r.updated_at ?? '',
    todo: !!r.todo,
  };
}

function toDb(row: Partial<ScheduleRow>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (row.shoot !== undefined) out.shoot = row.shoot;
  if (row.shootDate !== undefined) out.shoot_date = row.shootDate;
  if (row.deliveryDate !== undefined) out.delivery_date = row.deliveryDate;
  if (row.publishDate !== undefined) out.publish_date = row.publishDate;
  if (row.editor !== undefined) out.editor = row.editor;
  if (row.thumbnail !== undefined) out.thumbnail = row.thumbnail;
  if (row.title !== undefined) out.title = row.title;
  if (row.content !== undefined) out.content = row.content;
  if (row.materialUrl !== undefined) out.material_url = row.materialUrl;
  if (row.todo !== undefined) out.todo = row.todo;
  return out;
}

export async function listSchedules(): Promise<ScheduleRow[]> {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(COLUMNS)
    .order('publish_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map(fromDb);
}

export async function createSchedule(draft: Partial<ScheduleDraft>): Promise<ScheduleRow> {
  const sb = getClient();
  const updatedAt = new Date().toISOString();
  const payload = {
    ...toDb(draft),
    todo: false,
    updated_at: updatedAt,
  };
  const { data, error } = await sb
    .from(TABLE)
    .insert(payload)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return fromDb(data as DbRow);
}

export type UpdateResult =
  | { kind: 'ok'; row: ScheduleRow }
  | { kind: 'conflict'; currentUpdatedAt: string }
  | { kind: 'notFound' };

export async function updateSchedule(
  row: Partial<ScheduleRow> & { id: string }
): Promise<UpdateResult> {
  if (!row.id) throw new Error('id is required');
  const sb = getClient();

  const { data: existing, error: fetchError } = await sb
    .from(TABLE)
    .select('updated_at')
    .eq('id', row.id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return { kind: 'notFound' };

  const currentUpdatedAt = (existing as { updated_at: string | null }).updated_at ?? '';
  if (row.updatedAt && currentUpdatedAt && row.updatedAt !== currentUpdatedAt) {
    return { kind: 'conflict', currentUpdatedAt };
  }

  const newUpdatedAt = new Date().toISOString();
  const payload = {
    ...toDb(row),
    updated_at: newUpdatedAt,
  };

  const { data, error } = await sb
    .from(TABLE)
    .update(payload)
    .eq('id', row.id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { kind: 'ok', row: fromDb(data as DbRow) };
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (!id) throw new Error('id is required');
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}
