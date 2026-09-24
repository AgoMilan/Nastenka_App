import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { LoginForm } from "@/components/auth/login-form.tsx";

export default async function LoginPage() {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (actor) {
    redirect("/app");
  }

  return <LoginForm />;
}
