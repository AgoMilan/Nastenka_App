import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import {
  drizzleAdapter,
  type DrizzleAdapterConfig,
} from "better-auth/adapters/drizzle";
import { getEnv, type Env } from "../configuration/index.ts";
import { getDb, type Database } from "../database/index.ts";
import * as schema from "../../database/schema/index.ts";

type AuthInstance = Auth;

export const betterAuthDrizzleAdapterConfig = {
  provider: "pg",
  schema,
  usePlural: true,
} satisfies DrizzleAdapterConfig;

export const serverOwnedUserFields = {
  globalRole: {
    type: "string",
    input: false,
    returned: false,
  },
  deletedAt: {
    type: "date",
    input: false,
    returned: false,
  },
  isActive: {
    type: "boolean",
    input: false,
    returned: false,
  },
} satisfies NonNullable<BetterAuthOptions["user"]>["additionalFields"];

let cachedAuth: AuthInstance | null = null;

export function createBetterAuthOptions(
  db: Database,
  env: Env,
): BetterAuthOptions {
  return {
    appName: "Nástěnka",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, betterAuthDrizzleAdapterConfig),
    user: {
      additionalFields: serverOwnedUserFields,
    },
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
    },
  };
}

export function createAuth(db: Database, env: Env): AuthInstance {
  return betterAuth(createBetterAuthOptions(db, env));
}

export function getAuth(): AuthInstance {
  cachedAuth ??= createAuth(getDb(), getEnv());
  return cachedAuth;
}

export function resetAuthForTests(): void {
  cachedAuth = null;
}

export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
  has(_target, prop) {
    return prop in getAuth();
  },
  ownKeys() {
    return Reflect.ownKeys(getAuth());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getAuth(), prop);
  },
});
