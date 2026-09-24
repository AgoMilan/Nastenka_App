import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nástěnka – Přihlášení a registrace",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900">
      {children}
    </main>
  );
}
