# Roadmapa projektu

Tento dokument slouží k plánování dalšího vývoje projektu.

Roadmapa obsahuje pouze skutečně schválené nebo plánované kroky tohoto projektu.

---

# DONE – Dokončeno

Sem se zapisují dokončené a ověřené funkce, etapy nebo významné změny.

| ID | Položka | Stav | Datum |
|---|---|---|---|
| STEP 17.4 | Next.js 16 projekt bootstrap | DONE | 9/2026 |
| STEP 17.5 | ESLint, Prettier, TypeScript Strict | DONE | 9/2026 |
| STEP 17.6B1 | Drizzle schema – users, boards, memberships | DONE | 9/2026 |
| STEP 17.6B2 | Drizzle schema – areas, tasks, task_participants, audit_logs, notifications, outbox | DONE | 9/2026 |
| STEP 17.6B3 | Drizzle migrace generování + db skripty | DONE | 9/2026 |
| STEP 17.7A | Better Auth server foundation (lazy init, Drizzle adapter, server-owned fields) | DONE | 23. 9. 2026 |
| STEP 17.7B | Better Auth persistence schema, Auth Route Handler, ActorContext | DONE | 23. 9. 2026 |
| STEP 17.8A+B | Board Authorization Policy Engine (checkBoardPermission, 39 testů, 77 celkem) | DONE | 23. 9. 2026 |
| STEP 17.8C | Task / Area Authorization Policy Engine (checkTaskPermission, checkAreaPermission, 119 testů, 196 celkem) | DONE | 23. 9. 2026 |
| STEP 17.8D | Server API Authorization Enforcement + testovací matice (36 testů, 232 celkem) | DONE | 23. 9. 2026 |
| STEP 17.9 | Membership Policy Engine (checkMembershipPermission, 46 testů, 278 celkem) | DONE | 23. 9. 2026 |
| STEP 17.11 | Board Use Cases (CreateBoard, SoftDeleteBoard, TransferOwnership, 26 testů, 304 celkem) | DONE | 23. 9. 2026 |
| STEP 18 | Login / Register UI (přihlašovací a registrační stránka, logout, server guards, 25 testů, 329 celkem) | DONE | 24. 9. 2026 |

---

# CURRENT – Aktuálně řešené

Sem patří aktuálně rozpracované úkoly.

| ID | Úkol | Stav | Poznámka |
|---|---|---|---|
| — | — | — | — |

---

# NEXT – Nejbližší kroky

Sem patří nejbližší schválené úkoly, které mají následovat.

1. Area & Task Use Cases

---

# FUTURE – Budoucí rozvoj

Sem patří dlouhodobější nápady a plánované směry vývoje, které ještě nejsou aktuálním úkolem.

- Area Use Cases + Task CRUD
- Real-time notifikace
- Full-text search (PostgreSQL tsvector + pg_trgm)
- E-mailové notifikace
- Outbox worker (asynchronní zpracování událostí)

---

# TECHNICKÝ DLUH

Sem patří známé technické nedostatky, které nejsou aktuálně prioritou.

- `npm run test` odkazuje na neinstalovaný Vitest – nutno opravit v package.json (nízká priorita, testy fungují přes `node --test`).
- `"type": "module"` chybí v package.json – způsobuje Node.js varování při testech (výkon), nízká priorita.

---

# ZÁSADY ROADMAPY

- Do roadmapy se zapisují pouze reálné a relevantní úkoly projektu.
- Dokončené položky se přesouvají do sekce `DONE`.
- `CURRENT` obsahuje pouze skutečně rozpracované úkoly.
- `NEXT` obsahuje nejbližší schválené kroky.
- `FUTURE` slouží pro dlouhodobější směr projektu.
- Technický dluh se eviduje odděleně od běžných vývojových úkolů.
- Roadmapa není náhradou za technickou dokumentaci.
