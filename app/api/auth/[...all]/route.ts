import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../infrastructure/auth/index.ts";

export const { GET, POST } = toNextJsHandler(auth);
