import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: "0.75rem",
        padding: "2rem",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Stránka nenalezena
      </h2>
      <p style={{ color: "#666" }}>Požadovaná stránka nebo zdroj neexistuje.</p>
      <Link
        href="/"
        style={{
          color: "#1a1a1a",
          textDecoration: "underline",
          fontSize: "0.875rem",
        }}
      >
        Zpět na úvodní stránku
      </Link>
    </div>
  );
}
