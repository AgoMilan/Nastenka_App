import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Nástěnka
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Technický bootstrap projektu – Step 17.4
        </p>
        <div className="mt-6 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          Tailwind CSS v4 je aktivní
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary">Hlavní akce</Button>
          <Button variant="outline">Sekundární</Button>
        </div>
      </div>
    </main>
  );
}
