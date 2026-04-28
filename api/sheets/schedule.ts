import type { VercelRequest, VercelResponse } from '@vercel/node';

async function postPreservingMethod(url: string, payload: object): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  };
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, init);
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) return res;
    current = new URL(location, current).toString();
  }
  throw new Error('Too many redirects');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = process.env.GAS_WEB_APP_URL;
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url || !secret) {
    res.status(500).json({ error: 'GAS_WEB_APP_URL / GAS_SHARED_SECRET が設定されていません' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const gasRes = await fetch(`${url}?secret=${encodeURIComponent(secret)}`, {
        redirect: 'follow',
      });
      const data = await gasRes.json().catch(() => ({}));
      const status = typeof (data as { status?: number }).status === 'number' ? (data as { status: number }).status : gasRes.status;
      res.status(status).json(data);
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
      const gasRes = await postPreservingMethod(url, { ...body, secret });
      const data = await gasRes.json().catch(() => ({}));
      const status = typeof (data as { status?: number }).status === 'number' ? (data as { status: number }).status : gasRes.status;
      res.status(status).json(data);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
