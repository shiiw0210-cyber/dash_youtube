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

export interface DiagnosticResult {
  envSupabaseUrl: 'set' | 'missing';
  envServiceRoleKey: 'set' | 'missing';
  supabaseUrlPreview: string | null;
  serviceKeyShape: {
    length: number;
    looksLikeJwt: boolean;
    role: string | null;
    issuerRef: string | null;
  } | null;
  urlProjectRef: string | null;
  refMatch: 'match' | 'mismatch' | 'unknown';
  tableCheck: 'ok' | 'error' | 'skipped';
  rowCount: number | null;
  error: string | null;
  errorCode: string | null;
  errorDetails: string | null;
  errorHintRaw: string | null;
  errorRaw: string | null;
  hint: string | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inspectKey(key: string): DiagnosticResult['serviceKeyShape'] {
  const payload = decodeJwtPayload(key);
  return {
    length: key.length,
    looksLikeJwt: payload !== null,
    role: payload && typeof payload.role === 'string' ? payload.role : null,
    issuerRef: payload && typeof payload.ref === 'string' ? payload.ref : null,
  };
}

function urlRef(url: string): string | null {
  const m = /^https:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(url);
  return m ? m[1] : null;
}

export async function diagnose(): Promise<DiagnosticResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result: DiagnosticResult = {
    envSupabaseUrl: url ? 'set' : 'missing',
    envServiceRoleKey: key ? 'set' : 'missing',
    supabaseUrlPreview: url ? url.replace(/^(https?:\/\/[^.]+)\..*/, '$1.…') : null,
    serviceKeyShape: key ? inspectKey(key) : null,
    urlProjectRef: url ? urlRef(url) : null,
    refMatch: 'unknown',
    tableCheck: 'skipped',
    rowCount: null,
    error: null,
    errorCode: null,
    errorDetails: null,
    errorHintRaw: null,
    errorRaw: null,
    hint: null,
  };

  if (!url || !key) {
    result.hint = 'Vercel の Environment Variables に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定し Redeploy してください';
    return result;
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    result.error = `SUPABASE_URL の形式が不正です: ${url}`;
    result.hint = 'https://xxxxx.supabase.co の形式で設定してください (ダッシュボードのページURLではなく Project URL)';
    result.tableCheck = 'error';
    return result;
  }

  if (result.serviceKeyShape && result.urlProjectRef && result.serviceKeyShape.issuerRef) {
    result.refMatch = result.serviceKeyShape.issuerRef === result.urlProjectRef ? 'match' : 'mismatch';
    if (result.refMatch === 'mismatch') {
      result.tableCheck = 'error';
      result.error = `URL のプロジェクト (${result.urlProjectRef}) と service_role キー (${result.serviceKeyShape.issuerRef}) が別プロジェクトです`;
      result.hint = '同じ Supabase プロジェクトの Project URL と service_role キーをセットで設定してください';
      return result;
    }
  }

  if (result.serviceKeyShape && result.serviceKeyShape.role && result.serviceKeyShape.role !== 'service_role') {
    result.tableCheck = 'error';
    result.error = `キーの role が "${result.serviceKeyShape.role}" になっています (期待値: "service_role")`;
    result.hint = 'API Keys 画面の anon (public) キーではなく service_role (secret) キーをコピーして設定してください';
    return result;
  }

  try {
    const sb = getClient();
    const { count, error } = await sb
      .from(TABLE)
      .select('id', { count: 'exact', head: true });
    if (error) {
      result.tableCheck = 'error';
      result.error = error.message || '(empty message)';
      result.errorCode = (error as { code?: string }).code ?? null;
      result.errorDetails = (error as { details?: string }).details ?? null;
      result.errorHintRaw = (error as { hint?: string }).hint ?? null;
      try {
        result.errorRaw = JSON.stringify(error, Object.getOwnPropertyNames(error)).slice(0, 500);
      } catch {
        result.errorRaw = String(error);
      }
      const allMsg = `${error.message ?? ''} ${result.errorDetails ?? ''} ${result.errorCode ?? ''}`;
      if (/relation .* does not exist/i.test(allMsg) || /Could not find the table/i.test(allMsg) || /PGRST(20[24])/i.test(allMsg)) {
        result.hint = `Supabase の SQL Editor で supabase/schema.sql を実行して "${TABLE}" テーブルを作成してください`;
      } else if (/Invalid API key/i.test(allMsg) || /JWT/i.test(allMsg)) {
        result.hint = 'SUPABASE_SERVICE_ROLE_KEY が anon キーやダミー値になっていないか確認してください';
      } else if (/permission denied/i.test(allMsg) || /RLS/i.test(allMsg)) {
        result.hint = 'RLS ポリシーが不足しています。schema.sql の "alter table ... disable row level security" を実行してください';
      }
      return result;
    }
    result.tableCheck = 'ok';
    result.rowCount = count ?? 0;
    return result;
  } catch (e) {
    result.tableCheck = 'error';
    result.error = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.stack) {
      result.errorRaw = e.stack.split('\n').slice(0, 5).join(' | ');
    }
    return result;
  }
}
