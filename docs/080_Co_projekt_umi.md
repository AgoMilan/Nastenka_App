# Co projekt umí

Tento dokument slouží k přehledu hlavních funkcí a schopností projektu.

Dokument se průběžně aktualizuje podle skutečného stavu projektu.

---

## Přehled projektu

**Název projektu:**  
Nástěnka

**Účel projektu:**  
Týmová aplikace pro správu Nástěnek, Oblastí a Úkolů s rolemi (OWNER, MANAGER, MEMBER) a globální rolí ADMIN.

**Stručný popis:**  
Nástěnka je modulární monolit postavený na Next.js 16 (App Router), TypeScript Strict, PostgreSQL 18, Drizzle ORM a Better Auth. Aplikace implementuje serverovou autentizaci, session management a autorizační Policy Engine.

---

## Hlavní funkce

Zde jsou uvedeny hlavní funkce, které projekt aktuálně poskytuje.

- **Databázové schéma (Drizzle ORM):** 12 tabulek – `users`, `boards`, `memberships`, `areas`, `tasks`, `task_participants`, `audit_logs`, `notifications`, `outbox`, `sessions`, `accounts`, `verifications`.
- **Better Auth – serverová autentizace:** Integrace Better Auth 1.7.5 s Drizzle adaptérem, lazy inicializace, e-mail/heslo přihlašování.
- **ActorContext:** Server-side `resolveActorContext()` sestavuje bezpečný kontext volajícího (actor_user_id, global_role, session_id, is_active) z live DB stavu. Vrací `null` pro neaktivní nebo soft-deleted uživatele.
- **Board Authorization Policy Engine:** `checkBoardPermission()` vyhodnocuje Board-level oprávnění na základě ActorContext a členství. Implementuje explicitní autorizační matici (ALLOW/DENY s důvody), ADMIN bypass, soft-delete guard a 401 vs 403 rozlišení.
- **Task & Area Authorization Policy Engine:** `checkTaskPermission()` a `checkAreaPermission()` vyhodnocují oprávnění nad Úkoly a Oblastmi. Podporují rozlišení rolí (OWNER, MANAGER, MEMBER), vztahů k úkolu (Hlavní Řešitel, Spoluřešitel), pravidla pro spoluřešitele (JOIN vyžaduje řešitele, LEAVE pouze sám sebe, REMOVE vyhrazeno pro řešitele a správu) a striktní cross-board ochranu.
- **Auth Route Handler:** Next.js Catch-All Route Handler (`/api/auth/[...all]`) propojující Better Auth s Next.js.
- **Databázové migrace:** 2 verzované Drizzle migrace (init schema + Better Auth persistence).

---

## Další schopnosti

- **Ochrana server-owned polí:** `globalRole`, `isActive`, `deletedAt` jsou nastaveny `input: false, returned: false` v Better Auth – klient nemůže tato pole číst ani zapisovat přes auth API.
- **Build safety:** Better Auth inicializace je lazy (Proxy pattern) – `next build` proběhne bez live DB spojení.
- **Konfigurační validace (Fail-Fast):** Povinné env proměnné jsou validovány při startu (Zod), chybná konfigurace způsobí okamžitý pád.
- **Soft-delete:** `users.deleted_at`, `boards.deleted_at` – logické mazání bez ztráty dat.

---

## Technologie a integrace

- **Runtime:** Node.js 24 LTS
- **Framework:** Next.js 16.3.5 (App Router, Turbopack)
- **Jazyk:** TypeScript 5 (Strict mode)
- **Databáze:** PostgreSQL 18 (Drizzle ORM 0.43)
- **Autentizace:** Better Auth 1.7.5 (e-mail + heslo, server-side session v PostgreSQL)
- **Autorizace:** Custom Policy Engine (čistý TypeScript, bez závislostí na infrastruktuře)
- **Migrace:** Drizzle Kit (verzované SQL migrace)
- **Linting / Formátování:** ESLint, Prettier
- **Testy:** Node.js built-in test runner (`node --test`)

---

## Omezení

- Login/Register UI není implementováno (pouze auth backend).
- Membership autorizace (správa členů/rolí) zbývá dokončit v návazném kroku.
- `npm run test` je v současnosti nefunkční (odkazuje na neinstalovaný Vitest); testy se spouštějí přes `node -C react-server --test tests/unit/*.test.ts`.
- Produkční databázové migrace nejsou automatizované (vyžadují ruční `drizzle-kit migrate`).

---

## Historie významných změn

| Datum | Změna |
|---|---|
| 23. 9. 2026 | STEP 17.8C – Task & Area Authorization Policy Engine (checkTaskPermission, checkAreaPermission, 119 testů, 196 celkem) |
| 23. 9. 2026 | STEP 17.8A+B – Board Authorization Policy Engine (checkBoardPermission, 39 testů) |
| 23. 9. 2026 | STEP 17.7B – Better Auth persistence schema, Auth Route Handler, ActorContext |
| 23. 9. 2026 | STEP 17.7A – Better Auth server foundation (lazy init, Drizzle adapter, server-owned fields) |
| 23. 9. 2026 | STEP 17.6B1–B3 – Drizzle schema (12 tabulek), migrace, db skripty |
| 19. 9. 2026 | Inicializace projektu |

---

## Pravidlo dokumentu

Tento dokument má popisovat pouze skutečné schopnosti projektu.

Plánované nebo zamýšlené funkce patří do dokumentu `060_Roadmapa.md`.
