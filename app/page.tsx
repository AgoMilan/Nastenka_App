export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: "0.75rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Nástěnka</h1>
      <p style={{ color: "#555", fontSize: "1rem" }}>
        Technický bootstrap projektu – Step 17.2
      </p>
    </main>
  );
}
