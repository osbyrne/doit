import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { NativeModules } from "react-native";

const API_BASE = "https://doit.osbyrne.workers.dev";
let token = "";

type DoitWidgetBridgeModule = {
  storeSessionToken(next: string): Promise<unknown>;
  loadSessionToken(): Promise<string | null>;
  clearSessionToken(): Promise<unknown>;
  takePendingURL(): Promise<string | null>;
  clearPendingURL(): void;
  reloadTasksWidget(): void;
};

const widgetBridge = NativeModules.DoitWidgetBridge as DoitWidgetBridgeModule | undefined;

export const authClient = createAuthClient({
  baseURL: API_BASE,
  disableDefaultFetchPlugins: true,
  plugins: [passkeyClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: () => token },
    onSuccess: ({ response }) => {
      const next = response.headers.get("set-auth-token");
      if (next) setAuthToken(next);
    },
  },
});

export function getAuthToken(): string {
  return token;
}

export function setAuthToken(next: string): void {
  token = next;
  void widgetBridge?.storeSessionToken(next).catch(() => undefined);
}

export function clearAuthToken(): void {
  token = "";
  void widgetBridge?.clearSessionToken().catch(() => undefined);
}

export async function restoreAuthToken(): Promise<void> {
  if (!token && widgetBridge) {
    try {
      token = (await widgetBridge.loadSessionToken()) ?? "";
    } catch {
      // Keep the native app usable if shared widget storage is unavailable;
      // the app can still authenticate and retry the write after sign-in.
      token = "";
    }
  }
}

export async function takePendingURL(): Promise<string | null> {
  if (!widgetBridge) return null;
  return widgetBridge.takePendingURL();
}

export function clearPendingURL(): void {
  widgetBridge?.clearPendingURL();
}

export function reloadTasksWidget(): void {
  widgetBridge?.reloadTasksWidget();
}
