const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cached: { accessToken: string; expiresAt: number } | null = null;

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function loadOAuthCreds(): { creds: OAuthCreds | null; missing: string[] } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!refreshToken) missing.push('GOOGLE_OAUTH_REFRESH_TOKEN');

  if (missing.length > 0) return { creds: null, missing };
  return {
    creds: { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! },
    missing: [],
  };
}

export async function getAccessToken(creds: OAuthCreds): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `OAuth token refresh failed: ${data.error ?? res.status} ${data.error_description ?? ''}`.trim()
    );
  }

  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}
