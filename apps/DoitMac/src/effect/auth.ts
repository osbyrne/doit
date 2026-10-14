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
  readonly signIn: (
    email: string,
    password: string,
  ) => Effect.Effect<void, AuthError>;
  readonly signUp: (
    email: string,
    password: string,
    name: string,
  ) => Effect.Effect<void, AuthError>;
  readonly signOut: () => Effect.Effect<void, AuthError>;
  readonly openPasskeySignIn: () => Effect.Effect<void, AuthError>;
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

  signIn: (email, password) =>
    runAuthAction(signal =>
      authClient.signIn.email({ email, password }, { signal }),
    ),

  signUp: (email, password, name) =>
    runAuthAction(signal =>
      authClient.signUp.email({ email, password, name }, { signal }),
    ),

  signOut: () =>
    Effect.ensuring(
      runAuthAction(signal => authClient.signOut({ fetchOptions: { signal } })),
      Effect.sync(clearAuthToken),
    ),

  openPasskeySignIn: () =>
    Effect.tryPromise({
      try: () => Linking.openURL('https://doit.osbyrne.workers.dev/?native=1'),
      catch: cause =>
        new AuthError({
          message: 'Could not open the browser for passkey sign-in.',
          cause,
        }),
    }),

  acceptCallback: url =>
    Effect.try({
      try: () => {
        const tokenValue = url.match(/[?&]token=([^&]+)/)?.[1];
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
