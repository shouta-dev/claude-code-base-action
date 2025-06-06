import type { OAuthCredentials } from "./setup-oauth";

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function isTokenExpiringSoon(credentials: OAuthCredentials, bufferMinutes: number = 10): boolean {
  const expiresAt = parseInt(credentials.expiresAt);
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = bufferMinutes * 60;
  
  return (expiresAt - now) <= bufferSeconds;
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthCredentials> {
  console.log('Making token refresh request...');
  
  const response = await fetch('https://api.anthropic.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token refresh failed: ${response.status} ${response.statusText}`);
    console.error(`Response body: ${errorText}`);
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as RefreshTokenResponse;
  console.log('Token refresh successful');
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: String(Math.floor(Date.now() / 1000) + data.expires_in),
  };
}

export async function ensureValidToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  if (isTokenExpiringSoon(credentials)) {
    console.log('Token expiring soon, refreshing...');
    return await refreshAccessToken(credentials.refreshToken);
  }
  
  return credentials;
}