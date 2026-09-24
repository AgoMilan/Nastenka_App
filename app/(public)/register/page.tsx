import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { RegisterForm } from "@/components/auth/register-form.tsx";

export default async function RegisterPage() {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (actor) {
    redirect("/app");
  }

  return <RegisterForm />;
}
