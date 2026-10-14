import { Context, Effect, Layer } from 'effect';
import { Linking } from 'react-native';
import {
  authClient,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from '../auth-client';
import { AuthError, toErrorMessage } from './errors';

export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>['data']
>;

export interface AuthServiceShape {
  readonly getSession: () => Effect.Effect<AuthSession | null, AuthError>;
  readonly signOut: () => Effect.Effect<void, AuthError>;
  readonly openBrowserAuth: () => Effect.Effect<void, AuthError>;
  readonly acceptCallback: (url: string) => Effect.Effect<boolean, AuthError>;
  readonly getToken: () => string;
}

export class AuthService extends Context.Service<
  AuthService,
  AuthServiceShape
>()('doit/AuthService') {}

function runAuthAction(
  action: (
    signal: AbortSignal,
  ) => Promise<{ error?: { message?: string } | null }>,
): Effect.Effect<void, AuthError> {
  return Effect.tryPromise({
    try: async signal => {
      const result = await action(signal);
      if (result.error)
        throw new Error(result.error.message || 'Authentication failed.');
    },
    catch: cause => new AuthError({ message: toErrorMessage(cause), cause }),
  });
}

export const AuthServiceLive = Layer.succeed(AuthService, {
  getSession: () =>
    Effect.tryPromise({
      try: async () => {
        const result = await authClient.getSession();
        if (result.error)
          throw new Error(
            result.error.message || 'Could not check your session.',
          );
        return result.data;
      },
      catch: cause => new AuthError({ message: toErrorMessage(cause), cause }),
    }),

  signOut: () =>
    Effect.ensuring(
      runAuthAction(signal => authClient.signOut({ fetchOptions: { signal } })),
      Effect.sync(clearAuthToken),
    ),

  openBrowserAuth: () =>
    Effect.tryPromise({
      try: () => Linking.openURL('https://doit.osbyrne.workers.dev/?native=1'),
      catch: cause =>
        new AuthError({
          message: 'Could not open the browser for Doit sign-in.',
          cause,
        }),
    }),

  acceptCallback: url =>
    Effect.try({
      try: () => {
        if (!/^com\.osbyrne\.doit:\/\/auth(?:\?|$)/i.test(url)) return false;
        const query = url.split('?')[1]?.split('#')[0] ?? '';
        const tokenValue = query
          .split('&')
          .find(value => value.startsWith('token='))
          ?.slice(6);
        if (!tokenValue) return false;
        const token = decodeURIComponent(tokenValue);
        if (!token) return false;
        setAuthToken(token);
        return true;
      },
      catch: cause =>
        new AuthError({
          message: 'The browser returned an invalid sign-in link.',
          cause,
        }),
    }),

  getToken: getAuthToken,
});
