import { createAuthClient } from "better-auth/react";

/**
 * Klientský Better Auth klient pro použití v prohlížeči a Client Components.
 * Izolován od serverových modulů s "server-only".
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
