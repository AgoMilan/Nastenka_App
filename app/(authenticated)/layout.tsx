import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";

/**
 * Autoritativní serverový layout pro chráněné trasy.
 * Zajišťuje striktní kontrolu platného ActorContextu (neautentizovaný,
 * neaktivní nebo soft-deleted uživatel je okamžitě přesměrován na /login).
 */
export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor) {
    redirect("/login");
  }

  return <>{children}</>;
}
