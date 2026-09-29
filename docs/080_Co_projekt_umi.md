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
- **Membership Authorization Policy Engine:** `checkMembershipPermission()` vyhodnocuje oprávnění nad správou členství (`MEMBER_ADD`, `MEMBER_REMOVE`, `MEMBER_CHANGE_ROLE`, `MEMBER_LEAVE`). Zajišťuje strukturální invarianty vlastnictví (jediný OWNER na aktivní Nástěnce nelze odebrat ani sesadit ani ADMINem; ChangeRole na OWNER je zakázána a vyžaduje TransferOwnership; OWNER nemůže dobrovolně opustit Nástěnku bez předchozího převodu vlastnictví), invariant max. 1 Manager na Nástěnku, striktní cross-board ochranu a soft-delete guard.
- **Board Aplikační vrstva (Use Cases & Ports):** `CreateBoardUseCase` (atomické vytvoření Nástěnky a OWNER členství v transakci), `SoftDeleteBoardUseCase` (logické smazání s autorizací přes BoardPolicy a zachováním členství), `TransferOwnershipUseCase` (atomický převod vlastnictví na stávajícího člena s row locking ochranou proti souběhu a dodržením invariantů: přesně 1 OWNER a max. 1 MANAGER – původní vlastník přechází na roli MANAGER pokud je volná, jinak MEMBER).
- **Area & Task Aplikační vrstva (Use Cases & Ports):** Kompletní aplikační vrstva pro Oblasti a Úkoly:
  - **Area Use Cases:** `CreateAreaUseCase` (ověření unikátnosti názvu v rámci Nástěnky, soft-delete guard), `UpdateAreaUseCase` (validace a unikátnost nového názvu), `DeleteAreaUseCase` (kontrolované smazání vyžadující přesné textové potvrzení `"SMAZAT"` a kaskádové odstranění navázaných úkolů).
  - **Task Use Cases (13 use cases):** `CreateTaskUseCase` (výchozí stavy, cross-board validace oblasti a řešitele), `UpdateTaskUseCase` (samostatná oprávnění pro název a popis), `ChangeTaskAssigneeUseCase` (cross-board ověření, automatické vyčištění spoluřešitelů při zrušení řešitele), `TakeOverTaskUseCase` (převzetí úkolu členem s odebráním ze spoluřešitelů), `JoinTaskAsParticipantUseCase` (invariant: vyžaduje existujícího řešitele, zákaz připojení řešitele k sobě samému, kontrola duplicity), `LeaveTaskAsParticipantUseCase` (odpojení výhradně sama sebe), `RemoveTaskParticipantUseCase` (oprávnění řešitele, správce a vlastníka k odebrání spoluřešitele), `ChangeTaskStatusUseCase` (automatické nastavení/resetování `completedAt` při přechodu do/z `"HOTOVO"`), `ChangeTaskAreaUseCase` (striktní cross-board guard), `ChangeTaskDueDateUseCase` (validace a nastavení/zrušení termínu), `ChangeTaskPriorityUseCase` (validace enum hodnot `"BĚŽNÁ"` / `"SPĚCHÁ"`), `ArchiveTaskUseCase` (přechod do stavu `"ARCHIVOVÁNO"`), `DeleteTaskUseCase` (kontrolovaný hard-delete vyžadující potvrzení `"SMAZAT"` a kaskádové odstranění vazeb).
  - **Porty & Drizzle adaptéry:** `AreaRepository`, `TaskRepository`, `TaskParticipantRepository` a jejich registrace do transakčního `UnitOfWork` s row-level lockingem (`findByIdForUpdate`).
- **Membership Aplikační vrstva (Use Cases):** Kompletní orchestrace správy členství na Nástěnkách:
  - `AddMemberUseCase`: přidání existujícího aktivního uživatele do Nástěnky, zamezení duplicitního členství, ověření limitu manažerů (max. 1), autorizace přes `MembershipPolicy` (`MEMBER_ADD`).
  - `RemoveMemberUseCase`: administrativní odebrání člena z Nástěnky, striktní ochrana sole OWNERa (`CANNOT_REMOVE_SOLE_OWNER`), kaskádové uvolnění úkolů odebraného řešitele (`assigneeId = null`), vyčištění vazeb spoluřešitelů a autorizace přes `MembershipPolicy` (`MEMBER_REMOVE`).
  - `ChangeMemberRoleUseCase`: změna role existujícího člena mezi `MEMBER` a `MANAGER`, ochrana struktury vlastnictví (zákaz povýšení na OWNER a sesazení sole OWNERa), ochrana limitu manažerů (`MANAGER_LIMIT_EXCEEDED`), idempotence a autorizace přes `MembershipPolicy` (`MEMBER_CHANGE_ROLE`).
  - `LeaveBoardUseCase`: dobrovolný odchod přihlášeného člena (`MEMBER`, `MANAGER`) z Nástěnky na základě serverového ActorContextu, zákaz odchodu pro `OWNER` bez předchozího převodu vlastnictví (`ConflictError` 409), kaskádové uvolnění úkolů odcházejícího člena na Nepřiřazeno, vyčištění spoluřešitelů a autorizace přes `MembershipPolicy` (`MEMBER_LEAVE`).
- **Architektura Ports & Adapters a Unit of Work:** Definice portů `BoardRepository`, `MembershipRepository`, `UserRepository`, `AreaRepository`, `TaskRepository`, `TaskParticipantRepository`, `UnitOfWork` v aplikačních vrstvách modulů a jejich produkční Drizzle adaptéry v `infrastructure/database/repositories/`. Zajišťuje plnou nezávislost aplikační vrstvy na ORM a deterministické testování transakčního rollbacku.
- **Server API Authorization Enforcement:** Znovupoužitelná vrstva `enforceAuthorization()` a `executeProtectedOperation()` zaručující princip autoritativního serveru: ověření ActorContextu a oprávnění probíhá VŽDY před spuštěním chráněné operace. Striktní rozlišení 401 Unauthorized (neautentizován/neaktivní) vs 403 Forbidden (nedostatečná práva s kódem důvodu). Zabraňuje UI bypassu.
- **Hierarchie chyb a Result pattern:** Třídy `AppError`, `AuthenticationError` (401), `AuthorizationError` (403 s kódem důvodu), `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409) a typovaný `Result<T, E>` pattern (`ok`, `err`) v `shared/`.
- **Login / Register UI a autentizační uživatelská cesta (STEP 18):** Kompletní klientská a serverová uživatelská cesta (`/login`, `/register`, `/app`, `/`). Zahrnuje Zod validační schémata (`modules/auth`), klientského Better Auth klienta (`infrastructure/auth/auth-client.ts`), přihlašovací a registrační formuláře v českém jazyce s minimalistickým Tailwind zinc designem, okamžité odhlášení (`LogoutButton`) s revokací session a autoritativní serverové Route Guardy v `(authenticated)/layout.tsx` a `(public)/` zabraňující neoprávněnému přístupu či UI bypassu.
- **Board UI, Server Actions & Switcher (STEP 4 / STEP 22):**
  - **Moje nástěnky (`/app`):** Přehledový rozcestník (Board Directory) nahrazující původní placeholder. Zobrazuje autorizovaný seznam Nástěnek aktuálního uživatele formou karet (`BoardCard`) s názvem, volitelným popisem a českým označením role uživatele (`Vlastník`, `Správce`, `Člen`, `Administrátor`). Obsahuje dedikovaný Empty State pro uživatele bez nástěnek s výzvou k vytvoření první nástěnky.
  - **Vytvoření Nástěnky (`createBoardAction` & `CreateBoardForm`):** Server Action autorizovaná výhradně na základě serverového `ActorContext` (klient nemůže podvrhnout `userId`). Vstup je validován přes Zod (`createBoardSchema`), atomicky spouští `CreateBoardUseCase` v `UnitOfWork` (tvůrce se stává výhradním `OWNERem`), provádí revalidaci `/app` a okamžité přesměrování na novou Nástěnku.
  - **Board Detail (`/app/board/[boardId]`):** Základní kontejner pracovní plochy Nástěnky chráněný přes `GetBoardDetailUseCase`. Nečlen, neexistující nebo logicky smazaná Nástěnka končí striktně voláním `notFound()`. Zobrazuje název, roli a navigaci zpět na přehled.
  - **Board Switcher (`BoardSwitcher`):** Kontextový přepínač Nástěnek v hlavičce detailu umožňující rychlý přechod na jinou dostupnou Nástěnku nebo návrat na přehled. Využívá výhradně autorizovaný seznam nástěnek přihlášeného uživatele.
  - **Board Query vrstva:** Metody `findActiveBoardsForUser()` a `findActiveBoardsForAdmin()` v `BoardRepository` a use case `GetUserBoardsUseCase` striktně filtrující soft-deleted záznamy (`deleted_at IS NULL`) a respektující membership scoping.
- **Area & Task Query vrstva (STEP 1):**
  - `GetBoardAreasUseCase`: autorizované načtení oblastí nástěnky seřazených deterministicky podle názvu, kontrola členství a soft-delete stavu.
  - `GetBoardTasksUseCase`: autorizované načtení úkolů nástěnky s filtrováním (`ACTIVE`, `ARCHIVED`, `ALL`) a obohaceným `BoardTaskView` DTO (název oblasti, jméno autora, jméno a e-mail řešitele, seznam spoluřešitelů s id/jménem/e-mailem).
  - `GetBoardMembersUseCase`: autorizované načtení členů nástěnky pro výběr řešitelů a spoluřešitelů s jejich rolemi a údaji uživatele.
  - **Optimalizace a batch operace v repozitářích:** `UserRepository.findByIds(userIds)` pro dávkové načtení autorů a řešitelů bez N+1 dotazů; `TaskParticipantRepository.findByTaskIds(taskIds)` pro dávkové načtení spoluřešitelů pro celou sadu úkolů.
  - **Deterministické řazení úkolů:** Archivované úkoly jsou řazeny sestupně podle data aktualizace; aktivní úkoly jsou řazeny primárně podle termínu (nejdříve s termínem, vzestupně) s prioritou `SPĚCHÁ` přednostně.
  - **DTO validační schémata:** `createAreaSchema`, `updateAreaSchema`, `deleteAreaSchema`, `createTaskSchema`, `updateTaskSchema`, `taskFilterSchema`.
  - **Izolace a autorizace:** Striktní cross-board ochrana a server-side ověření oprávnění přes ActorContext a Policy.
  - *Důležité:* Osobní řazení úkolů (personal ordering) zatím není implementováno.
- **Area UI & Server Actions – Správa oblastí (STEP 2):**
  - **Zobrazení oblastí na Board Detail (`/app/board/[boardId]`):** Responzivní grid `AreaSection` (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), počítadlo oblastí, empty state s výzvou k vytvoření první oblasti.
  - **Karta oblasti (`AreaCard`):** Zobrazení názvu, popisu a akčních tlačítek pro editaci a smazání. Obsahuje explicitní placeholder pro úkoly (*„Úkoly budou následovat v dalším kroku“*).
  - **Vytvoření oblasti (`createAreaAction` & `CreateAreaDialog`):** Modální formulář s React 19 `useActionState`, auto-focusem, klientskou a serverovou validací (1–255 znaků) a zavřením na Escape.
  - **Úprava oblasti (`updateAreaAction` & `EditAreaDialog`):** Modální formulář pro změnu názvu a popisu se synchronizací stavu.
  - **Bezpečné smazání oblasti (`deleteAreaAction` & `DeleteAreaDialog`):** Destruktivní dialog vyžadující přesné vepsání potvrzení `SMAZAT` s tlačítkem `danger`. V transakci `UnitOfWork` kaskádově maže oblast i všechny v ní zařazené úkoly.
  - **Role-based zobrazení a bezpečnostní hranice:**
    - `OWNER`, `MANAGER`, `ADMIN`: mají zobrazeny ovládací prvky pro správu oblastí (`canManageAreas = true`).
    - `MEMBER`: vidí oblasti, ale mutační prvky se nezobrazují. Přímé volání Server Actions je nezávisle autorizováno Use Casem a zamítnuto chybou `AuthorizationError (INSUFFICIENT_ROLE)`.
  - **Server Actions architektura:** `UI → Server Action → ActorContext → Use Case → Policy → Repository → DB`. Identita aktéra je získávána výhradně ze serverové session (`resolveActorContext`), vstupy jsou validovány Zodem a Use Casem, po mutaci probíhá revalidace cesty `/app/board/[boardId]`.
- **Auth Route Handler:** Next.js Catch-All Route Handler (`/api/auth/[...all]`) propojující Better Auth s Next.js.
- **Databázové migrace:** 2 verzované Drizzle migrace (init schema + Better Auth persistence).

---

## Přehled stavu implementace

### Co už funguje
- Board Directory (`/app`) – přehled nástěnek uživatele s rolemi a empty state.
- Vytvoření nástěnky (`createBoardAction`) – autorizované vytvoření s rolí OWNER.
- Board Detail (`/app/board/[boardId]`) – bezpečný kontejner s `notFound()` ochranou.
- Board Switcher (`BoardSwitcher`) – přepínač mezi dostupnými nástěnkami.
- Area Query vrstva (`GetBoardAreasUseCase`) – autorizované načtení oblastí nástěnky.
- Task Query vrstva (`GetBoardTasksUseCase`) – autorizované načtení úkolů s obohacením a filtrováním.
- Member Query vrstva (`GetBoardMembersUseCase`) – autorizované načtení členů nástěnky.
- Area UI (`AreaSection`, `AreaCard`, `CreateAreaDialog`, `EditAreaDialog`, `DeleteAreaDialog`).
- Area Server Actions (`createAreaAction`, `updateAreaAction`, `deleteAreaAction`).
- Bezpečné kaskádové smazání oblasti a souvisejících úkolů s potvrzením `SMAZAT`.
- Autoritativní server-side autorizace a ochrana proti UI bypassu.

### Co ještě není implementováno
- Task Create & Display UI (plánováno v navazujícím STEP 3).
- Task Server Actions (vytváření, úprava, změna stavu, řešitelů, termínů, priorit, archivace, smazání).
- Kompletní Task UI (karty úkolů, editační dialogy, workflow statusů).
- Membership UI (přidávání/odebírání členů, správa rolí na nástěnce).
- Personal ordering (osobní řazení úkolů per uživatel).
- Real-time notifikace, e-mailové notifikace, outbox worker.

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

- Aplikační use cases pro Nástěnku, Oblasti, Úkoly a Správu členství jsou plně dokončeny na úrovni aplikační vrstvy; UI komponenty a Server Actions pro Nástěnky a Oblasti jsou hotové (STEP 4/22 a STEP 2); UI a Server Actions pro Úkoly (STEP 3+) a Správu členství zbývá implementovat v navazujících krocích.
- Audit a Outbox infrastruktura jsou odloženy (deferred) – připraveno DB schéma, aplikační integrace proběhne v samostatném kroku.
- `npm test` spouští celou testovací sadu v Node.js prostředí přes `node --conditions=react-server --test "tests/unit/*.test.ts" "tests/api/*.test.ts"` (549 testů PASS).
- Produkční databázové migrace nejsou automatizované (vyžadují ruční `drizzle-kit migrate`).

---

## Historie významných změn

| Datum | Změna |
|---|---|
| 29. 9. 2026 | STEP 2 (Area & Task) – Area UI & Server Actions (AreaSection, AreaCard s placeholderem úkolů, dialogy vytvoření, úpravy a smazání s potvrzením SMAZAT, Server Actions, role-based viditelnost OWNER/MANAGER/ADMIN vs MEMBER, Button danger, 36 nových testů, 549 celkem) |
| 29. 9. 2026 | STEP 1 (Area & Task) – Area & Task Query Layer (GetBoardAreasUseCase, GetBoardTasksUseCase, GetBoardMembersUseCase, batch repository metody UserRepository.findByIds a TaskParticipantRepository.findByTaskIds, DTO, obohacené BoardTaskView, filtrování, 32 nových testů, 513 celkem) |
| 29. 9. 2026 | STEP 4 / STEP 22 – Board UI & Server Actions (Moje nástěnky /app, createBoardAction, Board detail /app/board/[boardId], Board Switcher, notFound() guards, 19 nových testů, 481 celkem) |
| 24. 9. 2026 | STEP 21 (LeaveBoardUseCase) – dobrovolný odchod člena MEMBER/MANAGER, ochrana sole OWNERa, kaskáda úkolů, MEMBER_LEAVE v Policy Engine, 20 nových testů (426 celkem) |
| 24. 9. 2026 | STEP 20 (Membership Use Cases) – AddMember, RemoveMember, ChangeMemberRole (Drizzle repository delete, kaskáda úkolů, 34 testů, 401 celkem) |
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
