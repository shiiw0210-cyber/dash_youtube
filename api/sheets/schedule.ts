import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ErrorPayload {
  error: string;
  details?: string;
  hint?: string;
}

function fail(res: VercelResponse, status: number, payload: ErrorPayload, e?: unknown): void {
  if (e !== undefined) {
    console.error('[api/sheets/schedule]', payload.error, e);
  } else {
    console.error('[api/sheets/schedule]', payload.error);
  }
  res.status(status).json(payload);
}

function buildErrorPayload(e: unknown): ErrorPayload {
  const msg = e instanceof Error ? e.message : String(e);
  const payload: ErrorPayload = { error: msg };
  if (/Cannot find module|MODULE_NOT_FOUND/.test(msg)) {
    payload.hint =
      'モジュール解決に失敗しました。Vercel の Functions ログでスタックトレースを確認してください';
  } else if (/SUPABASE_URL \/ SUPABASE_SERVICE_ROLE_KEY/.test(msg)) {
    payload.hint =
      'Vercel の Environment Variables に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定し Redeploy してください';
  } else if (/relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)) {
    payload.hint = 'Supabase の SQL Editor で supabase/schema.sql を実行してテーブルを作成してください';
  } else if (/Invalid API key/i.test(msg) || /JWT/i.test(msg)) {
    payload.hint = 'SUPABASE_SERVICE_ROLE_KEY が正しい値か確認してください (anon キーや短い文字列ではないか)';
  } else if (/fetch failed/i.test(msg) || /ENOTFOUND/i.test(msg) || /getaddrinfo/i.test(msg)) {
    payload.hint = 'SUPABASE_URL のホスト名が解決できません。https://xxxxx.supabase.co の形式か確認してください';
  }
  if (e instanceof Error && e.stack) payload.details = e.stack.split('\n').slice(0, 3).join(' | ');
  return payload;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Dynamic import: any module-loading failure (missing dep, ESM/CJS mismatch,
    // bundler issue) is caught here and reported as JSON instead of crashing
    // the function with FUNCTION_INVOCATION_FAILED.
    const store = await import('../_lib/scheduleStore.js');
    const { createSchedule, deleteSchedule, diagnose, listSchedules, updateSchedule } = store;

    if (req.method === 'GET' && (req.query.diag === '1' || req.query.diag === 'true')) {
      const result = await diagnose();
      res.status(200).json(result);
      return;
    }

    if (req.method === 'GET') {
      const rows = await listSchedules();
      res.status(200).json({ rows });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
      switch (body.action) {
        case 'create': {
          const row = await createSchedule(body.row ?? {});
          res.status(200).json({ row });
          return;
        }
        case 'update': {
          const result = await updateSchedule(body.row ?? {});
          if (result.kind === 'ok') {
            res.status(200).json({ row: result.row });
            return;
          }
          if (result.kind === 'notFound') {
            fail(res, 404, { error: 'row not found' });
            return;
          }
          res
            .status(409)
            .json({ error: 'conflict', currentUpdatedAt: result.currentUpdatedAt });
          return;
        }
        case 'delete': {
          const ok = await deleteSchedule(body.id ?? '');
          res.status(200).json({ ok });
          return;
        }
        default:
          fail(res, 400, { error: `unknown action: ${body.action}` });
          return;
      }
    }

    fail(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    fail(res, 500, buildErrorPayload(e), e);
  }
}
