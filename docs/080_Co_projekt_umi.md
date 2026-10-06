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

- **Databázové schéma (Drizzle ORM):** 15 tabulek – `users`, `boards`, `memberships`, `areas`, `tasks`, `task_participants`, `user_task_orders`, `task_comments`, `user_task_notes`, `audit_logs`, `notifications`, `outbox`, `sessions`, `accounts`, `verifications`.
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
- **Login / Register UI a autentizační uživatelská cesta (STEP 18 & Auth Form Fix & LAN Dev Auth):** Kompletní klientská a serverová uživatelská cesta (`/login`, `/register`, `/app`, `/`). Zahrnuje Zod validační schémata (`modules/auth`), klientského Better Auth klienta (`infrastructure/auth/auth-client.ts`), přihlašovací a registrační formuláře v českém jazyce s minimalistickým Tailwind zinc designem, okamžité odhlášení (`LogoutButton`) s revokací session a autoritativní serverové Route Guardy v `(authenticated)/layout.tsx` a `(public)/` zabraňující neoprávněnému přístupu či UI bypassu. Formuláře `LoginForm` a `RegisterForm` explicitně definují atribut `method="post"`, čímž eliminují nativní browser GET fallback při výpadku či zpoždění React hydratace (heslo ani jiné citlivé údaje nemohou uniknout do URL parametrů). Vlastní autentizace stále probíhá přes klientského Better Auth klienta (`authClient.signIn.email`, `authClient.signUp.email`). Autentizace i Next.js dev prostředí (HMR) plně podporují přístup z lokální síťové IP adresy (např. `http://192.168.0.53:3000`) díky konfiguraci `allowedDevOrigins` v `next.config.mjs` a `trustedOrigins` (`resolveTrustedOrigins`) v Better Auth s volitelnou konfigurací `BETTER_AUTH_TRUSTED_ORIGINS`.
- **Board UI, Server Actions & Switcher (STEP 4 / STEP 22):**
  - **Moje nástěnky (`/app`):** Přehledový rozcestník (Board Directory) nahrazující původní placeholder. Zobrazuje autorizovaný seznam Nástěnek aktuálního uživatele formou karet (`BoardCard`) s názvem, volitelným popisem a českým označením role uživatele (`Vlastník`, `Správce`, `Člen`, `Administrátor`). Obsahuje dedikovaný Empty State pro uživatele bez nástěnek s výzvou k vytvoření první nástěnky.
  - **Vytvoření Nástěnky (`createBoardAction` & `CreateBoardForm`):** Server Action autorizovaná výhradně na základě serverového `ActorContext` (klient nemůže podvrhnout `userId`). Vstup je validován přes Zod (`createBoardSchema`), atomicky spouští `CreateBoardUseCase` v `UnitOfWork` (tvůrce se stává výhradním `OWNERem`), provádí revalidaci `/app` a okamžité přesměrování na novou Nástěnku.
  - **Board Detail (`/app/board/[boardId]`):** Základní kontejner pracovní plochy Nástěnky chráněný přes `GetBoardDetailUseCase`. Nečlen, neexistující nebo logicky smazaná Nástěnka končí striktně voláním `notFound()`. Zobrazuje název, roli a navigaci zpět na přehled.
  - **Board Switcher (`BoardSwitcher`):** Kontextový přepínač Nástěnek v hlavičce detailu umožňující rychlý přechod na jinou dostupnou Nástěnku nebo návrat na přehled. Využívá výhradně autorizovaný seznam nástěnek přihlášeného uživatele.
  - **Board Query vrstva:** Metody `findActiveBoardsForUser()` a `findActiveBoardsForAdmin()` v `BoardRepository` a use case `GetUserBoardsUseCase` striktně filtrující soft-deleted záznamy (`deleted_at IS NULL`) a respektující membership scoping.
- **Board Edit UI & Server Action (Úprava metadat nástěnky):**
  - **Editace z detailu nástěnky (`EditBoardButton` & `EditBoardDialog`):** Tlačítko `✏️ Upravit nástěnku` v hlavičce detailu `/app/board/[boardId]` otevírá modální formulář s React 19 `useActionState` pro úpravu názvu a popisu.
  - **Validace a normalizace:** Zod schéma `updateBoardSchema` ověřuje povinný název (1–255 znaků po trimu) a volitelný popis (max. 1000 znaků). Prázdný popis je normalizován na `null`.
  - **Autorizace přes BoardPolicy (`BOARD_EDIT`):** Povoleno pro `OWNER`, `MANAGER` a `ADMIN`. Členové s rolí `MEMBER` a nečlenové mají editaci zakázánu (`INSUFFICIENT_ROLE` / `NOT_A_MEMBER`).
  - **Architektonická ochrana vlastnictví a historie:** `boards.created_by` se nikdy nemění (neměnný auditní údaj). Vlastník se určuje výhradně z `memberships.role = 'OWNER'`.
  - **Server Action & Revalidace:** `updateBoardAction` v `app/(authenticated)/app/board/[boardId]/board-actions.ts` získává autoritativní `ActorContext` ze serverové session, spouští `UpdateBoardUseCase`, aktualizuje záznam přes `BoardRepository.update()` a automaticky revaliduje jak detail `/app/board/[boardId]`, tak přehled `Moje nástěnky` (`/app`).
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
  - **Karta oblasti (`AreaCard`):** Zobrazení názvu, popisu a akčních tlačítek pro editaci a smazání.
  - **Vytvoření oblasti (`createAreaAction` & `CreateAreaDialog`):** Modální formulář s React 19 `useActionState`, auto-focusem, klientskou a serverovou validací (1–255 znaků) a zavřením na Escape.
  - **Úprava oblasti (`updateAreaAction` & `EditAreaDialog`):** Modální formulář pro změnu názvu a popisu se synchronizací stavu.
  - **Bezpečné smazání oblasti (`deleteAreaAction` & `DeleteAreaDialog`):** Destruktivní dialog vyžadující přesné vepsání potvrzení `SMAZAT` s tlačítkem `danger`. V transakci `UnitOfWork` kaskádově maže oblast i všechny v ní zařazené úkoly.
  - **Role-based zobrazení a bezpečnostní hranice:**
    - `OWNER`, `MANAGER`, `ADMIN`: mají zobrazeny ovládací prvky pro správu oblastí (`canManageAreas = true`).
    - `MEMBER`: vidí oblasti, ale mutační prvky se nezobrazují. Přímé volání Server Actions je nezávisle autorizováno Use Casem a zamítnuto chybou `AuthorizationError (INSUFFICIENT_ROLE)`.
  - **Server Actions architektura:** `UI → Server Action → ActorContext → Use Case → Policy → Repository → DB`. Identita aktéra je získávána výhradně ze serverové session (`resolveActorContext`), vstupy jsou validovány Zodem a Use Casem, po mutaci probíhá revalidace cesty `/app/board/[boardId]`.
- **Task Create & Display UI (STEP 3):**
  - **Karta úkolu (`TaskCard`):** Zobrazení stavu (barevné badge pro `Nové`, `Převzaté`, `Rozpracované`, `Čeká se`, `Hotovo`, `Archivováno`), červený badge priority `● Spěchá`, formátovaný termín splnění (`cs-CZ` s červenou indikací `(po termínu)` pro nehotové/nearchivované úkoly), přiřazený řešitel (nebo kurzívou *„Nepřiřazeno“*), výpis spoluřešitelů a autor úkolu (*„Zadal/a: ...“*).
  - **Vytvoření úkolu (`createTaskAction` & `CreateTaskDialog`):** Modální dialog s React 19 `useActionState`, auto-focusem, klientskou i serverovou validací délky názvu (1–255 znaků) a popisu (max. 10 000 znaků), výběrem oblasti (včetně volby bez oblasti a předvyplnění při volání z karty konkrétní oblasti), výběrem řešitele ze seznamu členů nástěnky s českými rolemi, volbou priority (`BĚŽNÁ` / `SPĚCHÁ`), polem termínu splnění (`type="date"`), obsluhou klávesy Escape a ochranou proti vícenásobnému odeslání během `isPending`.
  - **Propojení s oblastmi (`AreaCard` & `AreaSection`):** Zobrazení úkolů přímo v kartách příslušných oblastí, dynamické počítadlo úkolů s českým skloňováním (`1 úkol`, `2–4 úkoly`, `5+ úkolů`), empty state oblasti (*„V této oblasti zatím nejsou žádné úkoly.“*), samostatný přehledný kontejner pro úkoly nezařazené do žádné oblasti (*„Bez oblasti“*), přepínač filtru úkolů **Aktivní** vs. **Archivované** (`/app/board/[boardId]` vs. `?filter=ARCHIVED`) a tlačítka `+ Přidat úkol`.
  - **Autorizace a bezpečnost:** Právo na vytvoření úkolu `canCreateTask` je odvozeno z `TaskPolicy` (povoleno pro `OWNER`, `MANAGER`, `MEMBER` i `ADMIN`). Use case `CreateTaskUseCase` v transakci `UnitOfWork` autoritativně kontroluje platnost a aktivní stav nástěnky, členství volajícího, a striktně vynucuje cross-board izolaci oblasti (`areaId`) i řešitele (`assigneeId`).
- **Membership UI / Správa členů nástěnky (STEP 4):**
  - **Zobrazení členů na Board Detail (`MembersSection`):** Přehledná sekce na stránce `/app/board/[boardId]` zobrazující souhrn členů podle rolí (`vlastník`, `správce`, `členové`), karty jednotlivých členů s vizuálními odznaky rolí (tmavý badge pro `Vlastník`, fialový badge pro `Správce`, šedý badge pro `Člen`), jménem, e-mailem a indikátorem `(Vy)` pro přihlášeného uživatele.
  - **Přidání člena (`addMemberAction` & `AddMemberDialog`):** Modální dialog pro přidání existujícího aktivního uživatele do nástěnky. Využívá autorizovaný `GetAssignableUsersUseCase` pro výběr ze seznamu uživatelů, kteří dosud nejsou členy dané nástěnky (bez N+1 dotazů přes `userRepo.findActiveUsers()`). Volba role (`Člen` nebo `Správce` při splnění limitu max. 1 správce), validace vstupů přes `addMemberSchema`.
  - **Změna role člena (`changeMemberRoleAction` & `ChangeRoleDialog`):** Modální dialog pro úpravu role mezi `MEMBER` a `MANAGER`. Oprávnění vyhrazeno pro vlastníka (`OWNER`) a administrátora (`ADMIN`). Striktně vynucuje limit max. 1 správce na nástěnku a zamezuje neautorizovanému povýšení na vlastníka či sesazení jediného vlastníka.
  - **Odebrání člena (`removeMemberAction` & `RemoveMemberDialog`):** Potvrzovací dialog pro administrativní odebrání člena s výslovným upozorněním na kaskádové uvolnění úkolů (odstranění řešitele a zrušení účasti spoluřešitele). Striktně chrání jediného vlastníka (`CANNOT_REMOVE_SOLE_OWNER`).
  - **Dobrovolný odchod z nástěnky (`leaveBoardAction` & `LeaveBoardDialog`):** Modální dialog pro dobrovolné opuštění nástěnky řadovým členem (`MEMBER`) nebo správcem (`MANAGER`). Kaskádově uvolňuje přiřazené úkoly a po úspěšném odchodu přesměruje uživatele na přehled `Moje nástěnky` (`/app`). Vlastník (`OWNER`) nemůže nástěnku opustit bez předchozího převodu vlastnictví.
  - **Okamžitá synchronizace se seznamem nástěnek:** Jakmile je uživatel přidán jako člen, nástěnka se mu okamžitě zobrazí v `Moje nástěnky` (`/app`) díky zapojení `GetUserBoardsUseCase` do tabulky členství.
  - **Autoritativní serverová autorizace:** Všechny akce správy členství probíhají přes Server Actions v `app/(authenticated)/app/board/[boardId]/member-actions.ts`, které ověřují ActorContext výhradně na serveru, spouští doménové use casy v transakci `UnitOfWork` s row-lockingem (`findByIdForUpdate`) a provádí revalidaci cache.
- **Task Edit & Assignee UI (STEP 5A):**
  - **Editace úkolu z karty (`TaskCard` & `EditTaskDialog`):** Tlačítko `✏️` na kartě úkolu pro oprávněné uživatele otevírá modální dialog předvyplněný aktuálními daty z `BoardTaskView`.
  - **Editace základních údajů:** Změna názvu (1–255 znaků) a popisu (max. 10 000 znaků) s automatickou validací a ořezem mezer.
  - **Přiřazení a odebrání řešitele:** Výběr řešitele ze seznamu aktivních členů nástěnky nebo volba *„Nepřiřazeno“* (`assigneeId = null`). Pokud byl vybraný řešitel dosud spoluřešitelem, je automaticky odebrán z účastníků. Při nastavení na *„Nepřiřazeno“* dochází k automatickému kaskádovému vyčištění všech spoluřešitelů daného úkolu.
  - **Přeřazení a odebrání oblasti:** Možnost přesunout úkol do jiné oblasti nebo do sekce *„Bez oblasti“* s ověřením cross-board konzistence.
  - **Nastavení a zrušení termínu:** Pole pro zadání data splnění (`type="date"`) nebo vymazání termínu.
  - **Změna priority:** Přepínač priority mezi `BĚŽNÁ` a `SPĚCHÁ`.
  - **Role-based field-level autorizace v UI i na serveru:**
    - Všichni členové nástěnky (`OWNER`, `MANAGER`, `MEMBER`) a `ADMIN` mohou upravovat název, popis, prioritu a řešitele.
    - Změnu oblasti (`TASK_CHANGE_AREA`) a termínu (`TASK_CHANGE_DUE_DATE`) smí provádět pouze `OWNER`, `MANAGER`, hlavní řešitel nebo spoluřešitel daného úkolu (`isTaskWorker`) a `ADMIN`. Pro řadového člena bez vazby na úkol jsou tato pole v dialogu deaktivována s vysvětlujícím popiskem a zachovávají původní hodnotu; backend use casy nezávisle vynucují `TaskPolicy` a odmítají neoprávněný zásah chybou `AuthorizationError (INSUFFICIENT_ROLE)`.
  - **Server Actions architektura:** `updateTaskAction` v `task-actions.ts` orchestrálně spouští příslušné doménové use casy (`UpdateTaskUseCase`, `ChangeTaskAssigneeUseCase`, `ChangeTaskAreaUseCase`, `ChangeTaskDueDateUseCase`, `ChangeTaskPriorityUseCase`) v transakci `UnitOfWork` pouze pro skutečně změněná pole a po úspěchu revaliduje cestu `/app/board/[boardId]`. K dispozici je také samostatná `changeTaskAssigneeAction`.
- **Task Status Workflow, Take Over, Participants & Lifecycle UI (STEP 5B):**
  - **Změna stavu úkolu (Status Workflow):** Interaktivní výběr stavu přímo na kartě úkolu (`TaskCard`) pro oprávněné uživatele (`OWNER`, `MANAGER`, řešitel, spoluřešitel a `ADMIN`). Výběr z aktivních stavů (`NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`, `HOTOVO`) prostřednictvím `changeTaskStatusAction` a `ChangeTaskStatusUseCase`. Automatické řízení atributu `completedAt` (nastavení časového razítka při přechodu do `HOTOVO`, vynulování při návratu do aktivního stavu).
  - **Převzetí úkolu (Take Over):** Samostatná akce *„Převzít úkol“* na kartě úkolu umožňující kterémukoliv členu nástěnky nebo administrátorovi převzít řešení úkolu na sebe přes `takeOverTaskAction` a `TakeOverTaskUseCase`. Pokud byl uživatel dosud spoluřešitelem, je automaticky ze spoluřešitelů vyjmut. Akce je odlišná od administrativní změny řešitele třetí osobou.
  - **Správa spoluřešitelů (Participants UI):** Zobrazení seznamu spoluřešitelů na kartě úkolu, tlačítko *„+ Připojit se“* (`joinTaskAction` / `JoinTaskAsParticipantUseCase`) pro dobrovolné zapojení člena (vyžaduje existenci hlavního řešitele, vylučuje duplicitu), tlačítko *„Opustit“* (`leaveTaskAction` / `LeaveTaskAsParticipantUseCase`) pro dobrovolné odpojení spoluřešitele a tlačítko `✕` (`removeTaskParticipantAction` / `RemoveTaskParticipantUseCase`) pro nucené odebrání spoluřešitele vyhrazené hlavnímu řešiteli, správci, vlastníkovi nebo administrátorovi.
  - **Archivace úkolu (Archive Task):** Volba *„Archivovat úkol“* v kontextovém menu `⋯` na kartě úkolu s potvrzovacím dialogem přes `archiveTaskAction` a `ArchiveTaskUseCase`. Úkol přechází do stavu `ARCHIVOVÁNO`, mizí z aktivního přehledu a zobrazuje se ve filtru *„Archivované“*. Archivovaný úkol je striktně pouze pro čtení (read-only) – nelze dodatečně měnit jeho data, stav ani spoluřešitele; obnova z archivu (restore/unarchive) není podle schválených architektonických zásad podporována.
  - **Řízené definitivní smazání úkolu (Delete Task):** Volba *„Smazat úkol“* v kontextovém menu `⋯` otevírající destruktivní modální dialog `DeleteTaskDialog`. Smazání představuje nevratný hard-delete a vyžaduje bezpečnostní ruční vepsání přesného potvrzovacího textu `SMAZAT` (validováno Zodem, Server Action `deleteTaskAction` i `DeleteTaskUseCase`). Kaskádově odstraňuje všechny vazby na spoluřešitele. Oprávnění náleží řešiteli, spoluřešiteli, správci, vlastníkovi a administrátorovi.
- **Osobní řazení úkolů (Personal Task Ordering – STEP 6):**
  - **Perzistentní model per uživatel:** Samostatná tabulka `user_task_orders` (`id`, `user_id`, `task_id`, `board_id`, `position`, časová razítka) se složeným unikátním indexem `[user_id, task_id]`, indexem pro rychlé dotazování `[board_id, user_id]` a kaskádovými cizími klíči. Zajišťuje striktní izolaci – změna pořadí jednoho uživatele nemá žádný vliv na pořadí jiných uživatelů a nezasahuje do sdílených týmových atributů úkolu (stav, priorita, termín).
  - **Normalizace pozic:** Celočíselný krok po 1000 (`1000, 2000, 3000...`) v rámci aktivního kontejneru (oblast nebo úkoly bez oblasti). Zabraňuje degradaci přesnosti plovoucí řádové čárky a potřebě složitého rebalancování. Podporuje relativní posuny nahoru (`UP`), dolů (`DOWN`) i cílené umístění před/za referenční úkol (`BEFORE`, `AFTER`).
  - **Sparse storage a deterministický fallback:** Nově vytvořené nebo dosud nepozicované úkoly nevyžadují okamžitý zápis do DB pro všechny členy. V dotazu `GetBoardTasksUseCase` jsou řazeny deterministicky podle priority (`SPĚCHÁ` > `BĚŽNÁ`), termínu (nejdříve s termínem vzestupně), data vytvoření (`createdAt DESC`) a `id ASC`. Pozicované úkoly mají přednost a řadí se podle osobní `position ASC`.
  - **Invariant archivu:** Ve filtru `ARCHIVED` je osobní řazení striktně potlačeno – archivované úkoly se vždy řadí chronologicky podle času poslední aktualizace (`updatedAt DESC`).
  - **Autorizace přes TaskPolicy (`TASK_REORDER`):** Právo na osobní řazení vyžaduje aktivní členství v nástěnce (`OWNER`, `MANAGER`, `MEMBER`) nebo globální roli `ADMIN`.
  - **UI a ovládací prvky (`TaskCard`):** Přístupná tlačítka pro posun nahoru (`▲`) a dolů (`▼`) s popiskem a klávesovou přístupností, a současně nativní HTML5 Drag & Drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) s vizuální indikací přetahování a optimalizací pro rychlou odezvu.
  - **Kaskádové čištění:** Při smazání úkolu (`DeleteTaskUseCase`), odebrání člena (`RemoveMemberUseCase`) nebo dobrovolném odchodu z nástěnky (`LeaveBoardUseCase`) dochází k automatickému promazání odpovídajících záznamů v `user_task_orders`.
- **Osobní pracovní prostor „Moje úkoly“ (STEP 7):**
  - **Agregovaný pohled (`/app/my-work`):** Osobní prostor přihlášeného uživatele agregující úkoly napříč všemi aktivními nástěnkami, kde uživatel vystupuje jako přímý řešitel (`ASSIGNEE`) nebo spoluřešitel (`PARTICIPANT`).
  - **Striktní bezpečnostní pravidlo:** Samotné autorství úkolu (`created_by`) bez role řešitele či spoluřešitele do přehledu Moje úkoly nepatří. Uživatel nesmí vidět úkoly ze smazaných nástěnek ani z nástěnek, kde není členem.
  - **Precedence role uživatele:** Pokud je uživatel současně hlavním řešitelem i spoluřešitelem, má vždy přednost role Řešitel (`userRole = "ASSIGNEE"`).
  - **Filtrování stavu:** Tlačítka filtru pro `Aktivní` (`ACTIVE` = `NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`; stav `HOTOVO` je striktně vyčleněn), `Dokončené` (`COMPLETED` = `HOTOVO`), `Archivované` (`ARCHIVED` = `ARCHIVOVÁNO`) a `Vše` (`ALL`). Výchozím filtrem je `Aktivní`.
  - **Filtrování rolí:** Tlačítka filtru pro `Všechny` (`ALL`, výchozí), `Řešitel` (`ASSIGNEE`) a `Spoluřešitel` (`PARTICIPANT`).
  - **Seskupení podle nástěnek v UI:** Úkoly jsou zobrazeny seskupené podle nástěnek s počtem úkolů v záhlaví a přímým odkazem na detail příslušné nástěnky (`/app/board/[boardId]`).
  - **Karta úkolu (`MyTaskCard`):** Zobrazení odznaku role uživatele (`Řešitel` / `Spoluřešitel`), barevného stavu úkolu, priority (`● Spěchá`), oblasti (nebo Bez oblasti), termínu splnění s červeným varováním při překročení a odkazu do nástěnky.
  - **Zachování osobního řazení:** V rámci každé skupiny nástěnky se uplatňuje osobní pořadí přihlášeného uživatele (`user_task_orders.position ASC`) s deterministickým fallbackem pro nepozicované úkoly (`SPĚCHÁ` > `BĚŽNÁ`, termín vzestupně, `createdAt DESC`, `id ASC`).
  - **Navigace (`AppHeader`):** Společná hlavička propojující `Moje nástěnky` (`/app`) a `Moje úkoly` (`/app/my-work`).
  - **Backend & Repozitář:** Metoda `findUserTasksAcrossBoards` v `DrizzleTaskRepository` s optimalizovaným SQL poddotazem do `task_participants`, omezující vyhledávání pouze na autorizované aktivní nástěnky z `BoardRepository` (`findActiveBoardsForUser` / `findActiveBoardsForAdmin`). Administrátor (`ADMIN`) vidí v tomto osobním přehledu pouze úkoly, kde je sám řešitelem nebo spoluřešitelem.
- **Komentáře a diskuze k úkolům (STEP 8):**
  - **Uživatelská diskuze k úkolům:** Komplexní podpora pro komentování a diskuzi nad jednotlivými úkoly na detailu nástěnky i v přehledu Moje úkoly.
  - **Databázový model & integrita:** Samostatná tabulka `task_comments` s primárním klíčem UUID, cizím klíčem na úkol `task_id` s kaskádovým smazáním (`ON DELETE CASCADE`), cizím klíčem na autora `author_id` s ochranou proti smazání (`ON DELETE RESTRICT`), textovým obsahem `content` (1–5000 znaků po ořezu mezer), časovými razítky vytvoření a aktualizace, složeným indexem `[task_id, created_at]` pro efektivní chronologické čtení diskuze a indexem `[author_id]`.
  - **Repozitář a transakční Unit of Work:** Port `TaskCommentRepository` a implementace `DrizzleTaskCommentRepository` začleněná do `DrizzleUnitOfWork` pro atomické transakční operace. Podpora dávkového počítání komentářů `countByTaskIds` eliminující N+1 dotazy při načítání úkolů nástěnky nebo osobního workspace.
  - **Author-only autorizační model bez moderačních výjimek:**
    - `TASK_COMMENT_VIEW`: Povoleno pro všechny aktivní členy nástěnky (`OWNER`, `MANAGER`, `MEMBER`) i systémového administrátora (`ADMIN`).
    - `TASK_COMMENT_CREATE`: Povoleno členům nástěnky a administrátorovi u nearchivovaných úkolů.
    - `TASK_COMMENT_EDIT_OWN` a `TASK_COMMENT_DELETE_OWN`: Vyhrazeno **výhradně autorovi daného komentáře** (`comment.authorId === actor.actor_user_id`). Ani vlastník nástěnky (`OWNER`), provozní správce (`MANAGER`) ani globální administrátor (`ADMIN`) nemají moderační výjimku měnit či mazat cizí komentáře (`deny("NOT_COMMENT_AUTHOR")`).
  - **Striktní ochrana archivu (Read-Only):** Pokud je úkol ve stavu `ARCHIVOVÁNO`, veškeré zápisové operace s komentáři (přidání, editace, smazání) jsou striktně odmítnuty chybou `AuthorizationError (TASK_ARCHIVED)` i pro autora komentáře a administrátora. Čtení existující diskuze zůstává zachováno.
  - **Aplikační use cases:** `GetTaskCommentsUseCase` (chronologické seřazení komentářů, dávkové doplnění autorů bez N+1, autorizační příznaky `canEdit`/`canDelete`, indikátor archivovaného úkolu), `AddTaskCommentUseCase` (Zod validace 1–5000 znaků, autorizace), `UpdateTaskCommentUseCase` (autorská kontrola, aktualizace obsahu a časového razítka `updatedAt`), `DeleteTaskCommentUseCase` (autorská kontrola, odstranění záznamu).
  - **Server Actions & Dialog (`TaskCommentsDialog`):** Server Actions v `comment-actions.ts` se serverovým `ActorContextem` a revalidací cesty `/app/board/[boardId]`. Modální dialog s dynamickým scrollováním na nejnovější komentář, počítadlem znaků, zkratkou Ctrl+Enter, inline editací s ukládáním i rušením, potvrzovacím dialogem před smazáním komentáře a informačním pruhem u archivovaných úkolů (*„Diskuze je uzamčena pro čtení.“*).
  - **Vizuální indikátory a počítadla:** Dynamické počítadlo komentářů s tlačítkem otevření diskuze přímo na `TaskCard` (`💬 X komentářů`) a kompaktní odznak počtu komentářů na `MyTaskCard` v přehledu Moje úkoly.
- **Editace úkolů z přehledu „Moje úkoly“:**
  - **Přímo z osobního workspace:** Tlačítko `[ ✏️ Upravit ]` na kartě `MyTaskCard` v `/app/my-work` umožňuje okamžitou editaci úkolu bez nutnosti přecházet na příslušnou nástěnku.
  - **Architektonické znovupoužití:** Plně znovupoužívá dialog `EditTaskDialog`, Server Action `updateTaskAction` i stávající doménové use casy (`UpdateTaskUseCase`, `ChangeTaskAssigneeUseCase`, `ChangeTaskAreaUseCase`, `ChangeTaskDueDateUseCase`, `ChangeTaskPriorityUseCase`). Nevznikla žádná duplicitní logika ani blanket oprávnění typu `MY_TASK_EDIT`.
  - **Autorizace podle existující TaskPolicy:** Zobrazení úkolu v „Moje úkoly“ (např. z pozice spoluřešitele) neuděluje právo měnit pole, na která uživatel nemá oprávnění. Změna oblasti (`TASK_CHANGE_AREA`) a termínu (`TASK_CHANGE_DUE_DATE`) zůstává omezena na řešitele, spoluřešitele, správce, vlastníka a administrátora. Backend oprávnění striktně ověřuje nezávisle na UI.
  - **Revalidace obou pohledů:** Server Action `updateTaskAction` automaticky revaliduje jak detail dotčené nástěnky (`/app/board/[boardId]`), tak osobní workspace (`/app/my-work`).
- **Quick Status v osobním přehledu „Moje úkoly“ (STEP 9A):**
  - **Rychlá změna stavu přímo z karty:** Na kartě `MyTaskCard` v `/app/my-work` je stav úkolu interaktivním dropdownem (pro nearchivované úkoly a oprávněné uživatele: řešitel, spoluřešitel, správce, vlastník, administrátor), umožňujícím okamžitou změnu stavu bez otevírání detailního dialogu `EditTaskDialog`.
  - **Plné architektonické znovupoužití:** Využívá existující Server Action `changeTaskStatusAction`, doménový `ChangeTaskStatusUseCase`, Zod schéma `changeTaskStatusSchema` i autorizační `TaskPolicy` (`TASK_CHANGE_STATUS`). Nevznikla žádná paralelní business logika ani duplicitní use case.
  - **Striktní serverová autorita identity:** Identita aktéra je určena ze serverové session (`resolveActorContext`), klient nesmí předat důvěryhodné `userId`.
  - **Ochrana archivu (Read-Only):** Archivovaný úkol (`ARCHIVOVÁNO`) je v UI striktně read-only (zobrazuje se statický odznak bez dropdownu) a na backendu je pokus o změnu stavu odmítnut chybou `AuthorizationError (TASK_ARCHIVED)` pro všechny role včetně administrátora (`ADMIN`).
  - **Řízení `completedAt`:** Přechod do stavu `HOTOVO` automaticky nastaví časové razítko dokončení; návrat z `HOTOVO` do aktivního stavu `completedAt` bezpečně vynuluje (`null`).
  - **Okamžitá revalidace a reakce filtrů:** Server Action `changeTaskStatusAction` revaliduje detail příslušné nástěnky (`/app/board/[boardId]`) i osobní workspace (`/app/my-work`). Úkol po přechodu do `HOTOVO` okamžitě zmizí z výchozího filtru `Aktivní` a objeví se ve filtru `Dokončené` (a naopak).
  - **Pending a error handling:** Během provádění akce je tlačítko i karta v disabled/pending stavu (`opacity-70 pointer-events-none`) a případná chyba je zobrazena přímo v horním pruhu karty s možností zavření.
- **Soukromé poznámky k úkolům (User Task Notes):**
  - **Osobní obsah vs. týmová diskuze:** Soukromá poznámka je osobní obsah konkrétního uživatele k úkolu, striktně oddělený od týmových komentářů (`task_comments`). Nikdo jiný ji nemůže vidět ani upravovat.
  - **Databázový model & integrita:** Samostatná tabulka `user_task_notes` (`id`, `user_id`, `task_id`, `content`, časová razítka) s unikátním složeným omezením `(user_id, task_id)` (maximálně jedna poznámka na uživatele a úkol) a kaskádovým smazáním při odstranění úkolu (`task_id ON DELETE CASCADE`).
  - **Repozitář & Transakční Unit of Work:** Port `UserTaskNoteRepository` a implementace `DrizzleUserTaskNoteRepository` v `DrizzleUnitOfWork` s metodou `upsert` (`onConflictDoUpdate`) a dávkovou metodou `findByUserAndTaskIds` eliminující N+1 dotazy při načítání přehledu úkolů (`hasPrivateNote`).
  - **Striktní bezpečnostní model a autorizace (TaskPolicy):**
    - `TASK_PRIVATE_NOTE_VIEW_OWN`, `TASK_PRIVATE_NOTE_UPSERT_OWN`, `TASK_PRIVATE_NOTE_DELETE_OWN`: Vyhrazeno **výhradně vlastníkovi poznámky** (`actor.actor_user_id === noteOwnerUserId`).
    - **Absolutní zákaz blanket přístupu:** Ani vlastník nástěnky (`OWNER`), provozní správce (`MANAGER`) ani globální administrátor (`ADMIN`) nesmí číst, upravovat ani mazat cizí soukromou poznámku (`NOT_NOTE_OWNER`).
    - **Ochrana při odchodu z nástěnky:** Nečlen nástěnky (včetně uživatele po odebrání či dobrovolném odchodu) nesmí získat přístup ke své poznámce ani při znalosti `taskId` (`NOT_A_MEMBER`).
    - **Chování u dokončených a archivovaných úkolů:** Úkol ve stavu `HOTOVO` umožňuje plné čtení, zápis i smazání poznámky. U archivovaného úkolu (`ARCHIVOVÁNO`) je povoleno pouze čtení existující poznámky; zápis a smazání jsou striktně odmítnuty (`TASK_ARCHIVED`) i pro vlastníka poznámky a administrátora.
    - **Serverová autorita identity:** Server nikdy nepřijímá `userId` z klienta jako autoritu; identita aktéra je určena ze serverové session (`ActorContext`).
  - **Aplikační use cases:** `GetUserTaskNoteUseCase` (ověření členství a autorizace čtení), `UpsertUserTaskNoteUseCase` (transakční vytvoření/úprava s kontrolou archivu a autorizace), `DeleteUserTaskNoteUseCase` (transakční smazání).
  - **UI a dialog (`UserTaskNoteDialog`):** Tlačítko `[ 📝 Moje poznámka ]` na kartě `MyTaskCard` s vizuální indikací uloženého obsahu. Modální dialog s jasným bezpečnostním označením *„Soukromá poznámka – vidíte ji pouze vy.“*, textovou plochou, počítadlem znaků (1–5000), ukládáním, možností smazání poznámky a read-only bannerem u archivovaných úkolů.
- **Centrální auditní stopa (Audit Trail v1 – STEP 9B):**
  - **Neměnné append-only auditní logování:** Transakční zápis významných business událostí přímo v aplikační vrstvě do tabulky `audit_logs` skrze `DrizzleUnitOfWork` a dedikovaný repozitář `DrizzleAuditLogRepository` (port `AuditLogRepository` v `modules/audit/application/ports/`).
  - **Audit Event Catalog v1 (26 doménových událostí):**
    - *Board (4):* `BOARD_CREATED`, `BOARD_UPDATED`, `BOARD_OWNER_TRANSFERRED`, `BOARD_DELETED`.
    - *Membership (4):* `MEMBER_ADDED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `MEMBER_LEFT_BOARD`.
    - *Area (3):* `AREA_CREATED`, `AREA_UPDATED`, `AREA_DELETED`.
    - *Task (12):* `TASK_CREATED`, `TASK_TITLE_CHANGED`, `TASK_DESCRIPTION_CHANGED`, `TASK_STATUS_CHANGED`, `TASK_PRIORITY_CHANGED`, `TASK_DUE_DATE_CHANGED`, `TASK_AREA_CHANGED`, `TASK_ASSIGNEE_CHANGED`, `TASK_PARTICIPANT_ADDED`, `TASK_PARTICIPANT_REMOVED`, `TASK_ARCHIVED`, `TASK_DELETED`.
    - *Comments (3):* `TASK_COMMENT_CREATED`, `TASK_COMMENT_EDITED`, `TASK_COMMENT_DELETED`.
  - **Striktní Privacy Policy:**
    - Zákaz ukládání textu popisu úkolu (`TASK_DESCRIPTION_CHANGED` ukládá pouze `{ hasDescription: boolean }`).
    - Zákaz ukládání textu komentáře (`TASK_COMMENT_*` ukládá pouze `{ taskId: string }`).
    - **Soukromé poznámky (User Task Notes):** STRIKTNĚ BEZ AUDITU (0 zápisů při upsertu, čtení i smazání poznámky).
    - **Čtení a zobrazení (Read / View):** Žádný audit na technické ani dotazovací operace.
  - **No-op ochrana & Sémantická čistota:** Auditní záznam se nezapisuje, pokud operace neprovedla skutečnou změnu hodnoty. Každá business mutace generuje právě 1 sémantickou událost (převod vlastnictví generuje výhradně `BOARD_OWNER_TRANSFERRED`, archivace generuje výhradně `TASK_ARCHIVED`).
  - **Transakční integrita:** Auditní zápis je nedílnou součástí téže DB transakce jako doménová změna v `UnitOfWork`. Případné selhání auditu způsobí atomický rollback doménové mutace.
- **Auth Route Handler:** Next.js Catch-All Route Handler (`/api/auth/[...all]`) propojující Better Auth s Next.js.
- **Databázové migrace:** 5 verzovaných Drizzle migrací (init schema + Better Auth persistence + user_task_orders + task_comments + user_task_notes).

---

## Přehled stavu implementace

### Co už funguje
- Osobní pracovní prostor Moje úkoly (`/app/my-work`) s agregací úkolů napříč všemi aktivními nástěnkami uživatele.
- Filtrování Moje úkoly podle stavu (Aktivní, Dokončené, Archivované, Vše) s výslovným vyčleněním HOTOVO z aktivních stavů.
- Filtrování Moje úkoly podle role uživatele (Všechny, Řešitel, Spoluřešitel) s prioritou řešitele.
- Seskupení úkolů podle nástěnky s počítadlem a proklikem na detail nástěnky.
- Zachování osobního řazení uvnitř jednotlivých nástěnek v přehledu Moje úkoly.
- Globální navigace mezi Moje nástěnky a Moje úkoly (`AppHeader`).
- Board Directory (`/app`) – přehled nástěnek uživatele s rolemi a empty state.
- Vytvoření nástěnky (`createBoardAction`) – autorizované vytvoření s rolí OWNER.
- Board Detail (`/app/board/[boardId]`) – bezpečný kontejner s `notFound()` ochranou.
- Board Switcher (`BoardSwitcher`) – přepínač mezi dostupnými nástěnkami.
- Editace metadat nástěnky (`updateBoardAction`, `EditBoardDialog`, `EditBoardButton`, `UpdateBoardUseCase`, změna názvu a popisu pro OWNER, MANAGER a ADMIN).
- Area Query vrstva (`GetBoardAreasUseCase`) – autorizované načtení oblastí nástěnky.
- Task Query vrstva (`GetBoardTasksUseCase`) – autorizované načtení úkolů s obohacením a filtrováním.
- Member Query vrstva (`GetBoardMembersUseCase`) – autorizované načtení členů nástěnky.
- Area UI (`AreaSection`, `AreaCard`, `CreateAreaDialog`, `EditAreaDialog`, `DeleteAreaDialog`).
- Area Server Actions (`createAreaAction`, `updateAreaAction`, `deleteAreaAction`).
- Bezpečné kaskádové smazání oblasti a souvisejících úkolů s potvrzením `SMAZAT`.
- Task Display UI (`TaskCard`, zobrazení úkolů v oblastech i sekci Bez oblasti, počítadla úkolů).
- Task Create UI (`CreateTaskDialog`, `createTaskAction`, výběr oblasti, řešitele, priority a termínu).
- Task Edit UI (`EditTaskDialog`, tlačítko `✏️` na `TaskCard`, editace názvu a popisu).
- Změna a odebrání oblasti úkolu (včetně volby *„Bez oblasti“*).
- Změna a zrušení termínu splnění úkolu.
- Změna priority úkolu (`BĚŽNÁ` vs. `SPĚCHÁ`).
- Přiřazení a odebrání řešitele úkolu (výběr ze členů nástěnky nebo *„Nepřiřazeno“* s kaskádovým uvolněním spoluřešitelů).
- Ochrana polí podle rolí (oblast a termín povoleny pouze pro OWNER, MANAGER, řešitele a spoluřešitele úkolu).
- Task Status & Workflow UI (změna stavu na NOVÉ, PŘEVZATÉ, ROZPRACOVANÉ, ČEKÁ SE, HOTOVO s řízením completedAt).
- Převzetí úkolu členem týmu (*„Převzít úkol“* na sebe s automatickým vyjmutím ze spoluřešitelů).
- Správa spoluřešitelů na kartě úkolu (dobrovolné připojení, dobrovolné odpojení, nucené odebrání řešitelem a vedením).
- Archivace úkolu do stavu ARCHIVOVÁNO a zobrazení v přehledu archivovaných úkolů (read-only režim).
- Řízené trvalé smazání úkolu (hard-delete s explicitním bezpečnostním potvrzením `SMAZAT` a kaskádou spoluřešitelů).
- Membership UI (`MembersSection`, `AddMemberDialog`, `ChangeRoleDialog`, `RemoveMemberDialog`, `LeaveBoardDialog`).
- Správa členů nástěnky (přidání člena, změna role MEMBER ↔ MANAGER s limitem max. 1 správce, odebrání člena s kaskádou úkolů, dobrovolný odchod s přesměrováním na /app).
- Okamžitá synchronizace přehledu Moje nástěnky (`/app`) po přidání člena.
- Filtrování úkolů na nástěnce (Aktivní vs. Archivované).
- Osobní řazení úkolů per uživatel (tlačítka `▲`/`▼` a HTML5 Drag & Drop na kartě úkolu, `reorderTaskAction`, `ReorderTaskUseCase`, tabulka `user_task_orders`).
- Přísná izolace osobního pořadí (změna pořadí uživatele A neovlivňuje uživatele B ani sdílená týmová data úkolu).
- Zachování chronologického řazení v archivu úkolů (read-only bypass osobního pořadí).
- Kaskádové čištění osobních pozic při smazání úkolu, odebrání člena a dobrovolném odchodu z nástěnky.
- Komentáře a diskuze k úkolům (`TaskCommentsDialog`, `comment-actions.ts`, tabulka `task_comments`).
- Přidání nového komentáře (1–5000 znaků) s odesláním přes tlačítko i klávesovou zkratkou Ctrl+Enter.
- Author-only úprava a smazání vlastního komentáře (výhradně autor, bez moderační výjimky i pro OWNER, MANAGER a ADMIN).
- Ochrana diskuze u archivovaných úkolů (striktní read-only stav pro komentáře, zákaz přidávání, editace i mazání).
- Počítadlo komentářů na kartě úkolu (`TaskCard`) i v osobním přehledu `MyTaskCard` (optimalizované dávkové počítání `countByTaskIds`).
- Kaskádové smazání komentářů při odstranění úkolu.
- Editace úkolů přímo z karty v osobním workspace `Moje úkoly` (`/app/my-work`) tlačítkem `[ ✏️ Upravit ]` s využitím existujícího `EditTaskDialog`, `updateTaskAction` a autorizací přes stávající `TaskPolicy`.
- Quick Status v osobním workspace `Moje úkoly` (`/app/my-work`) umožňující rychlou změnu stavu úkolu přímo z karty `MyTaskCard` přes existující `changeTaskStatusAction`, `ChangeTaskStatusUseCase` a `TaskPolicy` (`TASK_CHANGE_STATUS`), s řízením `completedAt`, read-only ochranou archivu (`TASK_ARCHIVED`) a obousměrnou revalidací.
- Soukromé poznámky k úkolům v přehledu `Moje úkoly` (`UserTaskNoteDialog`, `note-actions.ts`, tabulka `user_task_notes` s unikátním constraintem `[user_id, task_id]`).
- Striktní author-only přístup k soukromé poznámce bez blanket práv i pro ADMIN, OWNER a MANAGER (`NOT_NOTE_OWNER`).
- Zákaz přístupu k poznámce po odchodu uživatele z nástěnky (`NOT_A_MEMBER`) i při znalosti `taskId`.
- Zákaz zápisu a smazání poznámky u archivovaných úkolů (`TASK_ARCHIVED`, povoleno pouze čtení) a povolený zápis u dokončených úkolů `HOTOVO`.
- Dávková detekce existence poznámky (`hasPrivateNote`) v `GetMyTasksUseCase` bez N+1 dotazů.
- Kaskádové smazání soukromých poznámek při odstranění úkolu.
- Zabezpečení přihlašovacího a registračního formuláře před únikem hesla do URL (explicitní `method="post"` v `LoginForm` i `RegisterForm` zabraňující nativnímu GET fallbacku při absenci hydratace).
- Centrální auditní stopa Audit Trail v1 pro 26 doménových událostí napříč Board, Membership, Area, Task a Komentáři s transakčním zápisem do tabulky `audit_logs`, no-op ochranou a striktní privacy policy (žádný text popisu, žádný text komentářů, absolutní zákaz auditu soukromých poznámek).
- Autoritativní server-side autorizace a cross-board bezpečnostní ochrana.

### Co ještě není implementováno
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

- Aplikační use cases pro Nástěnku, Oblasti, Úkoly, Správu členství, Osobní řazení úkolů, Osobní pracovní prostor Moje úkoly, Komentáře i Soukromé poznámky jsou plně dokončeny na úrovni aplikační vrstvy; UI komponenty a Server Actions pro Nástěnky (vytvoření, detail, přepínač, editace metadat), Oblasti, vytváření/zobrazení/editaci Úkolů, workflow stavů, převzetí úkolu, správu spoluřešitelů, archivaci, mazání, Správu členství, Osobní řazení úkolů, Osobní prostor Moje úkoly (včetně editace, Quick Status a soukromých poznámek) i Komentáře a diskuzi k úkolům jsou hotové.
- Auditní stopa (STEP 9B) je plně funkční v aplikační vrstvě s transakčním zápisem 26 událostí do tabulky `audit_logs`; UI komponenty pro zobrazení historie/auditu (např. časová osa na kartě úkolu nebo v detailu nástěnky) zatím nejsou součástí UI a budou řešeny v navazujícím kroku. Outbox infrastruktura je odložena (deferred) – připraveno DB schéma, aplikační integrace proběhne v samostatném kroku.
- `npm test` spouští celou testovací sadu v Node.js prostředí přes `node --conditions=react-server --test "tests/unit/*.test.ts" "tests/api/*.test.ts"` (881 testů PASS).
- Produkční databázové migrace nejsou automatizované (vyžadují ruční `drizzle-kit migrate`).

---

## Historie významných změn

| Datum | Změna |
|---|---|
| 6. 10. 2026 | STEP 9B – Audit Trail v1 (centrální append-only transakční auditní logování, Audit Event Catalog v1 s 26 událostmi napříč Board, Membership, Area, Task a Comments, DrizzleAuditLogRepository zapojený do UnitOfWork, atomický rollback při selhání auditu, striktní privacy pravidla vylučující text popisu a komentáře, absolutní zákaz auditování privátních poznámek, no-op ochrana, 26 nových unit testů, 881 celkem) |
| 6. 10. 2026 | STEP 9A – Quick Status v „Moje práce“ (rychlá změna stavu úkolu přímo z karty MyTaskCard bez nutnosti otevírat EditTaskDialog, znovupoužití changeTaskStatusAction a ChangeTaskStatusUseCase, TASK_CHANGE_STATUS v TaskPolicy, read-only ochrana archivu TASK_ARCHIVED, řízení completedAt, obousměrná revalidace /app/board/[boardId] i /app/my-work, 16 nových unit testů, 855 celkem) |
| 4. 10. 2026 | Rozšíření „Moje úkoly“ – editace úkolů přímo z karty a soukromé poznámky (tlačítko Upravit s napojením na EditTaskDialog a updateTaskAction bez nových blanket práv, soukromé poznámky user_task_notes s unikátním [user_id, task_id], author-only přístup bez výjimek i pro ADMIN/OWNER/MANAGER, ochrana při odchodu z boardu, read-only archiv, kaskádový delete při smazání úkolu, dávkový hasPrivateNote, UserTaskNoteDialog, 31 nových testů, 839 celkem) |
| 30. 9. 2026 | Povolení autentizace ze síťové adresy v lokálním developmentu – Next.js allowedDevOrigins pro 192.168.0.53 a HMR, Better Auth trustedOrigins přes resolveTrustedOrigins a volitelnou proměnnou BETTER_AUTH_TRUSTED_ORIGINS, 2 nové testy (808 celkem) |
| 30. 9. 2026 | Bezpečnostní oprava auth formulářů – explicitní method="post" v LoginForm a RegisterForm zabraňující nativnímu odeslání přihlašovacích/registračních údajů přes GET do URL při výpadku či zpoždění React hydratace, 14 nových testů (806 celkem) |
| 30. 9. 2026 | STEP 8 – Komentáře a diskuze k úkolům (uživatelská diskuze u úkolů, dialog TaskCommentsDialog, počítadlo komentářů na TaskCard a MyTaskCard, author-only editace a mazání bez výjimek i pro ADMIN/OWNER/MANAGER, striktní read-only režim pro archivované úkoly, tabulka task_comments s kaskádovým smazáním, TaskCommentRepository, transakční DrizzleUnitOfWork integrace, dávkový countByTaskIds, 26 nových testů, 792 celkem) |
| 30. 9. 2026 | STEP 7 – Osobní pracovní prostor „Moje úkoly“ (/app/my-work agregující úkoly přihlášeného uživatele napříč všemi aktivními nástěnkami pro ASSIGNEE a PARTICIPANT s vyloučením pouhého created_by, precedence ASSIGNEE, filtry stavů ACTIVE [bez HOTOVO] / COMPLETED [HOTOVO] / ARCHIVED / ALL, filtry rolí ALL / ASSIGNEE / PARTICIPANT, seskupení podle nástěnek s počítadly a odkazy, zachování osobního řazení uvnitř nástěnek, navigace AppHeader, DrizzleTaskRepository.findUserTasksAcrossBoards, GetMyTasksUseCase, 21 nových testů, 766 celkem) |
| 30. 9. 2026 | STEP 6 – Personal Ordering (osobní pořadí úkolů per uživatel, tabulka user_task_orders se složeným unikátním indexem [user_id, task_id], ReorderTaskUseCase s normalizací pozic po 1000, integrace do GetBoardTasksUseCase s deterministickým fallbackem pro nepozicované úkoly, read-only chronologický bypass pro archiv, tlačítka ▲/▼ a nativní HTML5 drag & drop na TaskCard, TASK_REORDER v TaskPolicy pro členy a ADMINa, kaskádový cleanup při smazání úkolu/členství, 19 nových testů, 745 celkem) |
| 29. 9. 2026 | STEP 5B – Task Status Workflow, Take Over, Participants & Lifecycle UI (TaskCard výběr stavů s completedAt, převzetí úkolu takeOverTaskAction na sebe s vyjmutím ze spoluřešitelů, správa spoluřešitelů připojit se / opustit / odebrat, kontextové menu ⋯ pro archivaci a řízený hard-delete s textem SMAZAT přes DeleteTaskDialog, read-only ochrana archivu, 30 nových testů, 726 celkem) |
| 29. 9. 2026 | Board Edit – Úprava metadat nástěnky (EditBoardDialog, EditBoardButton, updateBoardAction, UpdateBoardUseCase, rozšíření BoardRepository.update, autorizace BOARD_EDIT pro OWNER/MANAGER/ADMIN, ochrana created_by, revalidace detailu i přehledu /app, 32 nových testů, 696 celkem) |
| 29. 9. 2026 | STEP 5A – Task Edit & Assignee UI (EditTaskDialog, updateTaskAction, changeTaskAssigneeAction, editace údajů úkolu, přiřazení a odebrání řešitele, kaskáda spoluřešitelů, 42 nových testů, 664 celkem) |
| 29. 9. 2026 | STEP 4 – Membership UI / Správa členů nástěnky (MembersSection, dialogy pro přidání, změnu role, odebrání a opuštění nástěnky, GetAssignableUsersUseCase, DTO, Server Actions, 40 nových testů, 622 celkem) |
| 29. 9. 2026 | STEP 3 (Area & Task) – Task Create & Display UI (TaskCard, CreateTaskDialog, createTaskAction, propojení úkolů s oblastmi, úkoly Bez oblasti, filtry Aktivní/Archivované, cross-board ochrana, 33 nových testů, 582 celkem) |
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
