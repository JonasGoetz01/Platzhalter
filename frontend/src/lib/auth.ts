import { createAuthClient } from "better-auth/react";
import { adminClient, jwtClient, organizationClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : `http://localhost:${process.env.FRONTEND_PORT || "3000"}`,
  plugins: [jwtClient(), adminClient(), twoFactorClient(), organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
