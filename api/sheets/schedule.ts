import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
} from '../../lib/scheduleStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
            res.status(404).json({ error: 'row not found' });
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
          res.status(400).json({ error: `unknown action: ${body.action}` });
          return;
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
