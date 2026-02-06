// Shared X (Twitter) OAuth credential lookup
// All credentials are loaded from environment variables — never hardcoded.
//
// Required env vars per app:
//   X_<APPKEY>_CLIENT_ID
//   X_<APPKEY>_CLIENT_SECRET
//
// Example:
//   X_JOETALKSHOW_CLIENT_ID=...
//   X_JOETALKSHOW_CLIENT_SECRET=...
//   X_LIZPEEK_CLIENT_ID=...
//   X_LIZPEEK_CLIENT_SECRET=...
//
// The fallback "default" app uses X_CLIENT_ID / X_CLIENT_SECRET.

interface XAppCredentials {
  clientId: string;
  clientSecret: string;
}

const KNOWN_APPS = ['joetalkshow', 'lizpeek'] as const;

export function getXAppCredentials(appKey: string): XAppCredentials | null {
  const envPrefix = `X_${appKey.toUpperCase()}`;
  const clientId = process.env[`${envPrefix}_CLIENT_ID`] || '';
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`] || '';

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  // Fallback to default env vars
  const defaultId = process.env.X_CLIENT_ID || '';
  const defaultSecret = process.env.X_CLIENT_SECRET || '';
  if (defaultId && defaultSecret) {
    return { clientId: defaultId, clientSecret: defaultSecret };
  }

  return null;
}

export function getKnownAppKeys(): readonly string[] {
  return KNOWN_APPS;
}
