import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nástěnka",
  description:
    "Jednoduchá týmová aplikace pro organizaci práce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
