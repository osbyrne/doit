import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [passkeyClient()],
  fetchOptions: {
    onSuccess: ({ response }) => {
      if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("native") !== "1") return;
      const token = response.headers.get("set-auth-token");
      if (token) window.location.href = `com.osbyrne.doit://auth?token=${encodeURIComponent(token)}`;
    },
  },
});
