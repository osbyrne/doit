import { createSignal } from "solid-js";
import { authClient } from "../auth-client";
import TodoList from "./TodoList.tsrx";

export default function AuthGate() @{
  const [session, setSession] = createSignal<any>(null);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [register, setRegister] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  const refresh = async () => {
    const result = await authClient.getSession();
    setSession(result.data);
  };
  void refresh();

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = register()
      ? await authClient.signUp.email({ email: email(), password: password(), name: name() || email().split("@")[0] })
      : await authClient.signIn.email({ email: email(), password: password() });
    setBusy(false);
    if (result.error) { setError(result.error.message ?? "Could not sign in."); return; }
    await refresh();
  };

  const signInPasskey = async () => {
    setBusy(true);
    setError("");
    const result = await authClient.signIn.passkey();
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Passkey sign-in failed.");
    else await refresh();
  };

  const addPasskey = async () => {
    setBusy(true);
    const result = await authClient.passkey.addPasskey({ name: "Doit passkey", authenticatorAttachment: "platform" });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Could not add passkey.");
  };

  @if (session()) {
    <>
      <p class="auth-row">Signed in as {session().user.email}
        <button disabled={busy()} onClick={() => void addPasskey()} type="button">Add passkey</button>
        <button onClick={async () => { await authClient.signOut(); setSession(null); }} type="button">Sign out</button>
      </p>
      <TodoList />
    </>;
  } @else {
    <section class="auth-card" aria-labelledby="auth-title">
      <h2 id="auth-title">{register() ? "Create your account" : "Sign in to Doit"}</h2>
      <form onSubmit={(event) => void submit(event)}>
        {register() ? <label>Name<input autocomplete="name" onInput={(event) => setName(event.currentTarget.value)} value={name()} /></label> : null}
        <label>Email<input autocomplete="email" onInput={(event) => setEmail(event.currentTarget.value)} required type="email" value={email()} /></label>
        <label>Password<input autocomplete={register() ? "new-password" : "current-password"} minlength="8" onInput={(event) => setPassword(event.currentTarget.value)} required type="password" value={password()} /></label>
        {error() ? <p class="error" role="alert">{error()}</p> : null}
        <button disabled={busy()} type="submit">{register() ? "Create account" : "Sign in"}</button>
      </form>
      <button disabled={busy()} onClick={() => void signInPasskey()} type="button">Sign in with passkey</button>
      <button class="text-button" onClick={() => { setRegister(!register()); setError(""); }} type="button">
        {register() ? "Already have an account? Sign in" : "Create an account"}
      </button>
    </section>;
  }
}
