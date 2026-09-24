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
- **Membership Authorization Policy Engine:** `checkMembershipPermission()` vyhodnocuje oprávnění nad správou členství (`MEMBER_ADD`, `MEMBER_REMOVE`, `MEMBER_CHANGE_ROLE`). Zajišťuje strukturální invarianty vlastnictví (jediný OWNER na aktivní Nástěnce nelze odebrat ani sesadit ani ADMINem; ChangeRole na OWNER je zakázána a vyžaduje TransferOwnership), invariant max. 1 Manager na Nástěnku, striktní cross-board ochranu a soft-delete guard.
- **Board Aplikační vrstva (Use Cases & Ports):** `CreateBoardUseCase` (atomické vytvoření Nástěnky a OWNER členství v transakci), `SoftDeleteBoardUseCase` (logické smazání s autorizací přes BoardPolicy a zachováním členství), `TransferOwnershipUseCase` (atomický převod vlastnictví na stávajícího člena s row locking ochranou proti souběhu a dodržením invariantů: přesně 1 OWNER a max. 1 MANAGER – původní vlastník přechází na roli MANAGER pokud je volná, jinak MEMBER).
- **Area & Task Aplikační vrstva (Use Cases & Ports):** Kompletní aplikační vrstva pro Oblasti a Úkoly:
  - **Area Use Cases:** `CreateAreaUseCase` (ověření unikátnosti názvu v rámci Nástěnky, soft-delete guard), `UpdateAreaUseCase` (validace a unikátnost nového názvu), `DeleteAreaUseCase` (kontrolované smazání vyžadující přesné textové potvrzení `"SMAZAT"` a kaskádové odstranění navázaných úkolů).
  - **Task Use Cases (13 use cases):** `CreateTaskUseCase` (výchozí stavy, cross-board validace oblasti a řešitele), `UpdateTaskUseCase` (samostatná oprávnění pro název a popis), `ChangeTaskAssigneeUseCase` (cross-board ověření, automatické vyčištění spoluřešitelů při zrušení řešitele), `TakeOverTaskUseCase` (převzetí úkolu členem s odebráním ze spoluřešitelů), `JoinTaskAsParticipantUseCase` (invariant: vyžaduje existujícího řešitele, zákaz připojení řešitele k sobě samému, kontrola duplicity), `LeaveTaskAsParticipantUseCase` (odpojení výhradně sama sebe), `RemoveTaskParticipantUseCase` (oprávnění řešitele, správce a vlastníka k odebrání spoluřešitele), `ChangeTaskStatusUseCase` (automatické nastavení/resetování `completedAt` při přechodu do/z `"HOTOVO"`), `ChangeTaskAreaUseCase` (striktní cross-board guard), `ChangeTaskDueDateUseCase` (validace a nastavení/zrušení termínu), `ChangeTaskPriorityUseCase` (validace enum hodnot `"BĚŽNÁ"` / `"SPĚCHÁ"`), `ArchiveTaskUseCase` (přechod do stavu `"ARCHIVOVÁNO"`), `DeleteTaskUseCase` (kontrolovaný hard-delete vyžadující potvrzení `"SMAZAT"` a kaskádové odstranění vazeb).
  - **Porty & Drizzle adaptéry:** `AreaRepository`, `TaskRepository`, `TaskParticipantRepository` a jejich registrace do transakčního `UnitOfWork` s row-level lockingem (`findByIdForUpdate`).
- **Architektura Ports & Adapters a Unit of Work:** Definice portů `BoardRepository`, `MembershipRepository`, `UserRepository`, `AreaRepository`, `TaskRepository`, `TaskParticipantRepository`, `UnitOfWork` v aplikačních vrstvách modulů a jejich produkční Drizzle adaptéry v `infrastructure/database/repositories/`. Zajišťuje plnou nezávislost aplikační vrstvy na ORM a deterministické testování transakčního rollbacku.
- **Server API Authorization Enforcement:** Znovupoužitelná vrstva `enforceAuthorization()` a `executeProtectedOperation()` zaručující princip autoritativního serveru: ověření ActorContextu a oprávnění probíhá VŽDY před spuštěním chráněné operace. Striktní rozlišení 401 Unauthorized (neautentizován/neaktivní) vs 403 Forbidden (nedostatečná práva s kódem důvodu). Zabraňuje UI bypassu.
- **Hierarchie chyb a Result pattern:** Třídy `AppError`, `AuthenticationError` (401), `AuthorizationError` (403 s kódem důvodu), `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409) a typovaný `Result<T, E>` pattern (`ok`, `err`) v `shared/`.
- **Login / Register UI a autentizační uživatelská cesta (STEP 18):** Kompletní klientská a serverová uživatelská cesta (`/login`, `/register`, `/app`, `/`). Zahrnuje Zod validační schémata (`modules/auth`), klientského Better Auth klienta (`infrastructure/auth/auth-client.ts`), přihlašovací a registrační formuláře v českém jazyce s minimalistickým Tailwind zinc designem, okamžité odhlášení (`LogoutButton`) s revokací session a autoritativní serverové Route Guardy v `(authenticated)/layout.tsx` a `(public)/` zabraňující neoprávněnému přístupu či UI bypassu.
- **Auth Route Handler:** Next.js Catch-All Route Handler (`/api/auth/[...all]`) propojující Better Auth s Next.js.
- **Databázové migrace:** 2 verzované Drizzle migrace (init schema + Better Auth persistence).

---

## Další schopnosti

- **Autoritativní serverová hranice (No UI Trust):** Oprávnění se nikdy nevyhodnocují na klientovi jako bezpečnostní mechanismus; skryté tlačítko v UI nebrání útoku, server každý přímý požadavek nezávisle autorizuje.
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

- Aplikační use cases a API endpointy pro správu členství zbývá implementovat v navazujících krocích (Use Cases pro Nástěnku včetně TransferOwnership jsou dokončeny).
- Audit a Outbox infrastruktura jsou odloženy (deferred) – připraveno DB schéma, aplikační integrace proběhne v samostatném kroku.
- `npm run test` je v současnosti nefunkční (odkazuje na neinstalovaný Vitest); testy se spouštějí přes `node -C react-server --test tests/unit/*.test.ts`.
- Produkční databázové migrace nejsou automatizované (vyžadují ruční `drizzle-kit migrate`).

---

## Historie významných změn

| Datum | Změna |
|---|---|
| 24. 9. 2026 | STEP 19 – Area & Task Use Cases (3 Area + 13 Task Use Cases, Drizzle repositories, UnitOfWork integrace, 74 testů, 403 celkem) |
| 24. 9. 2026 | STEP 18 – Login / Register UI (Login, Register, Logout, Server Route Guards, ActorContext integrace, Zod validace, 25 testů, 329 celkem) |
| 23. 9. 2026 | STEP 17.11 – Board Use Cases (CreateBoard, SoftDeleteBoard, TransferOwnership, Ports & Adapters, Unit of Work, 26 testů, 304 celkem) |
| 23. 9. 2026 | STEP 17.9 – Membership Policy Engine (checkMembershipPermission, strukturální invarianty I1–I4, 46 testů, 278 celkem) |
| 23. 9. 2026 | STEP 17.8D – Server API Authorization Enforcement, Error hierarchie, Result pattern, 36 testů (232 celkem) |
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
