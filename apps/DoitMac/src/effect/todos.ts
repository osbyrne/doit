import { Context, Effect, Layer, Schema } from 'effect';
import { AuthService, AuthServiceLive } from './auth';
import {
  TodoDecodeError,
  TodoHttpError,
  TodoTransportError,
  TodoValidationError,
} from './errors';

const API_BASE = 'https://doit.osbyrne.workers.dev/api/todos';

const TodoSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.String,
});
const TodoListSchema = Schema.Struct({ todos: Schema.Array(TodoSchema) });
const TodoResultSchema = Schema.Struct({ todo: TodoSchema });
const OkSchema = Schema.Struct({ ok: Schema.Literal(true) });

export type Todo = typeof TodoSchema.Type;

export interface TodoServiceShape {
  readonly list: () => Effect.Effect<
    ReadonlyArray<Todo>,
    TodoHttpError | TodoTransportError | TodoDecodeError
  >;
  readonly save: (
    title: string,
    id?: string,
  ) => Effect.Effect<
    Todo,
    TodoValidationError | TodoHttpError | TodoTransportError | TodoDecodeError
  >;
  readonly setCompleted: (
    id: string,
    completed: boolean,
  ) => Effect.Effect<
    void,
    TodoHttpError | TodoTransportError | TodoDecodeError
  >;
  readonly remove: (
    id: string,
  ) => Effect.Effect<
    void,
    TodoHttpError | TodoTransportError | TodoDecodeError
  >;
}

export class TodoService extends Context.Service<
  TodoService,
  TodoServiceShape
>()('doit/TodoService') {}

function makeRequest(auth: AuthService['Service']) {
  return <S extends Schema.ConstraintDecoder<unknown, never>>(
    path: string,
    schema: S,
    init?: RequestInit,
  ): Effect.Effect<
    S['Type'],
    TodoHttpError | TodoTransportError | TodoDecodeError
  > =>
    Effect.gen(function* () {
      const token = auth.getToken();
      if (!token) {
        return yield* Effect.fail(
          new TodoHttpError({
            status: 401,
            message: 'Sign in to access your todos.',
          }),
        );
      }

      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const response = yield* Effect.tryPromise({
        try: signal =>
          fetch(`${API_BASE}${path}`, { ...init, headers, signal }),
        catch: cause =>
          new TodoTransportError({
            message:
              'Could not reach the Doit service. Check your connection and try again.',
            cause,
          }),
      });
      const payload = yield* Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: cause =>
          new TodoDecodeError({
            message: 'The Doit service returned unreadable data.',
            cause,
          }),
      });

      if (!response.ok) {
        const apiMessage =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : `The request failed (${response.status}).`;
        return yield* Effect.fail(
          new TodoHttpError({ status: response.status, message: apiMessage }),
        );
      }

      return yield* Schema.decodeUnknownEffect(schema)(payload).pipe(
        Effect.mapError(
          cause =>
            new TodoDecodeError({
              message: 'The Doit service returned an unexpected response.',
              cause,
            }),
        ),
      );
    });
}

export const TodoServiceLive = Layer.effect(
  TodoService,
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const request = makeRequest(auth);

    const list = () =>
      Effect.map(request('', TodoListSchema), result => result.todos);

    const save = (rawTitle: string, id?: string) =>
      Effect.gen(function* () {
        const title = rawTitle.trim();
        if (!title || title.length > 240) {
          return yield* Effect.fail(
            new TodoValidationError({
              message: 'Todo titles must be between 1 and 240 characters.',
            }),
          );
        }
        if (!id) {
          const response = yield* request('', TodoResultSchema, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          });
          return response.todo;
        }

        yield* request(`/${encodeURIComponent(id)}`, OkSchema, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        const todos = yield* list();
        const updated = todos.find(todo => todo.id === id);
        if (!updated)
          return yield* Effect.fail(
            new TodoHttpError({
              status: 404,
              message: 'Todo not found after update.',
            }),
          );
        return updated;
      });

    const setCompleted = (id: string, completed: boolean) =>
      Effect.asVoid(
        request(`/${encodeURIComponent(id)}`, OkSchema, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        }),
      );

    const remove = (id: string) =>
      Effect.asVoid(
        request(`/${encodeURIComponent(id)}`, OkSchema, { method: 'DELETE' }),
      );

    return { list, save, setCompleted, remove } as const;
  }),
);

export const AppServicesLive = Layer.provideMerge(
  TodoServiceLive,
  AuthServiceLive,
);
