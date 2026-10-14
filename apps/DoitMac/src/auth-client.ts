import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from '@better-auth/passkey/client';

const API_BASE = 'https://doit.osbyrne.workers.dev';
let token = '';

export const authClient = createAuthClient({
  baseURL: API_BASE,
  disableDefaultFetchPlugins: true,
  plugins: [passkeyClient()],
  fetchOptions: {
    auth: { type: 'Bearer', token: () => token },
    onSuccess: ({ response }) => {
      const next = response.headers.get('set-auth-token');
      if (next) token = next;
    },
  },
});

export function getAuthToken(): string {
  return token;
}

export function setAuthToken(next: string): void {
  token = next;
}

export function clearAuthToken(): void {
  token = '';
}
