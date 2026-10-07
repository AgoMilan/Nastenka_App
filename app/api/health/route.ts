export const dynamic = "force-dynamic";

/**
 * Healthcheck endpoint pro Docker liveness a Synology Container Manager.
 * Ověřuje, že Next.js Node.js server běží a přijímá HTTP požadavky.
 */
export function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
