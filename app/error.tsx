"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // V produkci zde bude volání observability adaptéru
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
        padding: "2rem",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#c0392b" }}>
        Nastala neočekávaná chyba
      </h2>
      <p style={{ color: "#555", textAlign: "center" }}>
        Omlouváme se za potíže. Zkuste akci opakovat.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.25rem",
          background: "#1a1a1a",
          color: "#fff",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Zkusit znovu
      </button>
    </div>
  );
}
