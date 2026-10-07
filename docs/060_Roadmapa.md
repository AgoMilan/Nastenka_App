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
| STEP 19 | Area & Task Use Cases (3 Area + 13 Task Use Cases, Ports & Adapters, 74 testů, 403 celkem) | DONE | 24. 9. 2026 |
| STEP 20 | Membership Use Cases (AddMember, RemoveMember, ChangeMemberRole, 34 testů, 401 celkem) | DONE | 24. 9. 2026 |
| STEP 21 | LeaveBoardUseCase (dobrovolný odchod člena MEMBER/MANAGER, zákaz pro OWNER bez převodu, task cascade, MEMBER_LEAVE v Policy Engine, 20 nových testů, 426 celkem) | DONE | 24. 9. 2026 |
| STEP 4 / STEP 22 | Board UI & Server Actions (Moje nástěnky /app, createBoardAction, Board detail /app/board/[boardId], Board Switcher, notFound() guards, 19 nových testů, 481 celkem) | DONE | 29. 9. 2026 |
| STEP 1 (Area & Task) | Area & Task Query Layer (GetBoardAreasUseCase, GetBoardTasksUseCase, GetBoardMembersUseCase, batch metody UserRepository.findByIds a TaskParticipantRepository.findByTaskIds, DTO, obohacené BoardTaskView, filtrování ACTIVE/ARCHIVED/ALL, deterministické řazení, server authorization, cross-board izolace, 32 nových testů, 513 celkem) | DONE | 29. 9. 2026 |
| STEP 2 (Area & Task) | Area UI & Server Actions (zobrazení oblastí na detailu nástěnky, responzivní grid, počet oblastí, empty state, CreateAreaDialog, EditAreaDialog, DeleteAreaDialog s potvrzením SMAZAT a kaskádou úkolů, createAreaAction, updateAreaAction, deleteAreaAction, role-based zobrazení pro OWNER/MANAGER/ADMIN vs MEMBER, Button danger, 36 nových testů, 549 celkem) | DONE | 29. 9. 2026 |
| STEP 3 (Area & Task) | Task Create & Display UI (vytvoření úkolu přes createTaskAction a CreateTaskDialog, zobrazení úkolů v kartách oblastí a sekci Bez oblasti přes TaskCard, výběr oblasti a řešitele, priorita BĚŽNÁ/SPĚCHÁ, termín splnění s detekcí po termínu, přepínač filtrů Aktivní/Archivované, serverová autorizace a cross-board izolace, 33 nových testů, 582 celkem) | DONE | 29. 9. 2026 |
| STEP 4 | Membership UI / Správa členů nástěnky (kompletní správa členů na detailu nástěnky, MembersSection, karty členů s rolemi Vlastník/Správce/Člen, přidání člena přes AddMemberDialog s výběrem z aktivních uživatelů přes GetAssignableUsersUseCase, změna role člena přes ChangeRoleDialog, odebrání člena s kaskádou úkolů přes RemoveMemberDialog, dobrovolný odchod přes LeaveBoardDialog s přesměrováním na /app, ochrana sole OWNERa a limitu správců, zobrazení v Moje nástěnky po přidání membershipu, 40 nových testů, 622 celkem) | DONE | 29. 9. 2026 |
| STEP 5A | Task Edit & Assignee UI (editace základních údajů úkolu na detailu nástěnky přes EditTaskDialog, tlačítko ✏️ na TaskCard, editace názvu, popisu, změna oblasti na existující i Bez oblasti, změna termínu splnění, změna priority BĚŽNÁ/SPĚCHÁ, přiřazení aktivního člena a odebrání řešitele na Nepřiřazeno, kaskáda uvolnění spoluřešitelů při zrušení řešitele, serverová autorizace dle TaskPolicy, cross-board ochrana, 42 nových testů, 664 celkem) | DONE | 29. 9. 2026 |
| Board Edit | Board Edit UI & Use Case (úprava metadat nástěnky – název a popis přes EditBoardDialog a updateBoardAction, UpdateBoardUseCase, rozšíření BoardRepository o update, autorizace přes BoardPolicy BOARD_EDIT pro OWNER, MANAGER, ADMIN, ochrana boards.created_by, revalidace detailu i /app, 32 nových testů, 696 celkem) | DONE | 29. 9. 2026 |
| STEP 5B | Task Status Workflow, Take Over, Participants & Lifecycle UI (výběr stavů úkolu NOVÉ / PŘEVZATÉ / ROZPRACOVANÉ / ČEKÁ SE / HOTOVO s automatickým completedAt, převzetí úkolu přes takeOverTaskAction a TakeOverTaskUseCase s vyčištěním ze spoluřešitelů, správa spoluřešitelů – připojení joinTaskAction, odpojení leaveTaskAction a odebrání removeTaskParticipantAction pro řešitele a správu, kontextové menu ⋯ pro archivaci archiveTaskAction a trvalé smazání deleteTaskAction s modálním potvrzením přes přesný text SMAZAT přes DeleteTaskDialog, ochrana read-only pro archivované úkoly dle architektonických pravidel, 30 nových testů, 726 celkem) | DONE | 29. 9. 2026 |
| STEP 6 (Area & Task) | Personal Ordering (osobní řazení úkolů per uživatel, nová tabulka user_task_orders se složeným unikátním indexem [user_id, task_id], ReorderTaskUseCase s normalizací pozic po 1000, integrace do GetBoardTasksUseCase s deterministickým fallbackem pro nepozicované úkoly, read-only chronologický bypass pro archiv, tlačítka ▲/▼ a HTML5 Drag & Drop na TaskCard, TASK_REORDER v TaskPolicy pro členy a ADMINa, kaskádový cleanup při smazání úkolu/členství, 19 nových testů, 745 celkem) | DONE | 30. 9. 2026 |
| STEP 7 | Osobní pracovní prostor „Moje úkoly“ (/app/my-work agregace úkolů napříč aktivními nástěnkami uživatele kde je ASSIGNEE nebo PARTICIPANT, vyloučení pouhého created_by, precedence ASSIGNEE, filtry stavů s vyčleněním HOTOVO z ACTIVE, filtry rolí ALL/ASSIGNEE/PARTICIPANT, seskupení dle nástěnek s počítadlem a proklikem, zachování osobního řazení v rámci nástěnek, AppHeader navigace, GetMyTasksUseCase, findUserTasksAcrossBoards, 21 nových testů, 766 celkem) | DONE | 30. 9. 2026 |
| STEP 8 | Komentáře a diskuze k úkolům (uživatelská diskuze u úkolů, tabulka task_comments, TaskCommentRepository a transakční UnitOfWork, author-only editace a mazání bez výjimek i pro ADMIN/OWNER/MANAGER, striktní read-only režim pro archivované úkoly, kaskádový delete při smazání úkolu, dávkový countByTaskIds, TaskCommentsDialog, počítadlo komentářů na TaskCard a MyTaskCard, 26 nových testů, 792 celkem) | DONE | 30. 9. 2026 |
| Fix Auth Form | Bezpečnostní oprava auth formulářů (explicitní method="post" v LoginForm a RegisterForm proti úniku přihlašovacích údajů přes nativní GET fallback při výpadku/zpoždění React hydratace, zachování Better Auth toku, 14 nových testů, 806 celkem) | DONE | 30. 9. 2026 |
| LAN Dev Auth | Povolení autentizace ze síťové adresy v developmentu (Next.js allowedDevOrigins pro 192.168.0.53 a HMR, Better Auth trustedOrigins přes resolveTrustedOrigins a BETTER_AUTH_TRUSTED_ORIGINS, zachování CSRF ochrany, 2 nové testy, 808 celkem) | DONE | 30. 9. 2026 |
| Rozšíření Moje úkoly | Editace úkolů a soukromé poznámky (editace z MyTaskCard s využitím existujícího EditTaskDialog, updateTaskAction a TaskPolicy bez nových blanket práv, soukromé poznámky user_task_notes s unikátním [user_id, task_id], author-only izolace bez blanket práv pro ADMIN/OWNER/MANAGER, ochrana při odchodu z boardu, read-only archiv, kaskádové mazání, batch hasPrivateNote bez N+1, UserTaskNoteDialog, 31 nových testů, 839 celkem) | DONE | 4. 10. 2026 |
| STEP 9A | Quick Status v „Moje práce“ (rychlá změna stavu úkolu přímo z karty MyTaskCard bez nutnosti otevírat EditTaskDialog, znovupoužití changeTaskStatusAction a ChangeTaskStatusUseCase, TASK_CHANGE_STATUS v TaskPolicy, read-only ochrana archivu TASK_ARCHIVED, řízení completedAt, obousměrná revalidace /app/board/[boardId] i /app/my-work, 16 nových unit testů, 855 celkem) | DONE | 6. 10. 2026 |
| STEP 9B | Audit Trail v1 (centrální append-only transakční auditní logování, Audit Event Catalog v1 s 26 událostmi napříč Board, Membership, Area, Task a Comments, DrizzleAuditLogRepository zapojený do UnitOfWork, atomický rollback při selhání auditu, striktní privacy pravidla vylučující text popisu a komentáře, absolutní zákaz auditování privátních poznámek, no-op ochrana, 26 nových unit testů, 881 celkem) | DONE | 6. 10. 2026 |
| STEP 9B-UI | Audit Trail UI (zobrazení chronologické historie aktivit úkolů i nástěnky, dialogy TaskAuditHistoryDialog a BoardAuditHistoryDialog, vizuální osa AuditTimeline, tlačítka Historie na kartách i v hlavičce nástěnky, GetTaskAuditHistoryUseCase, GetBoardAuditHistoryUseCase, formatAuditEvent pro 25 událostí v češtině, složené indexy na audit_logs, 25 nových testů, 906 celkem) | DONE | 6. 10. 2026 |
| STEP 10 | NAS Deployment & Persistent Runtime (produkční Docker multi-stage build s Alpine Node 20 a non-root uživatelem nextjs:1001, docker-compose.yml pro Synology Container Manager bez duplikace PostgreSQL, liveness healthcheck /api/health s HTTP 200, Better Auth a Next.js konfigurace pro LAN http://192.168.0.250:3000, vzor .env.production.example, postup bezpečných Drizzle migrací z PC/NAS bez secrets, 1 nový test, 907 celkem) | DONE | 7. 10. 2026 |

### Podrobný rozsah dokončených kroků:

#### STEP 1 – Area & Task Query Layer (Dokončeno)
- **Implementované Use Casy:**
  - `GetBoardAreasUseCase`: autorizované načtení oblastí nástěnky seřazených deterministicky podle názvu, kontrola členství a soft-delete stavu.
  - `GetBoardTasksUseCase`: autorizované načtení úkolů nástěnky s filtrováním (`ACTIVE`, `ARCHIVED`, `ALL`) a obohaceným `BoardTaskView` DTO (název oblasti, jméno autora, jméno a e-mail řešitele, seznam spoluřešitelů s id/jménem/e-mailem).
  - `GetBoardMembersUseCase`: autorizované načtení členů nástěnky pro výběr řešitelů a spoluřešitelů s jejich rolemi a údaji uživatele.
- **Optimalizace a batch operace v repozitářích:**
  - `UserRepository.findByIds(userIds)` pro dávkové načtení autorů a řešitelů bez N+1 dotazů.
  - `TaskParticipantRepository.findByTaskIds(taskIds)` pro dávkové načtení spoluřešitelů pro celou sadu úkolů.
- **DTO vrstva:** `createAreaSchema`, `updateAreaSchema`, `deleteAreaSchema`, `createTaskSchema`, `updateTaskSchema`, `taskFilterSchema`.
- **Deterministické řazení úkolů:** Archivované úkoly jsou řazeny sestupně podle data aktualizace; aktivní úkoly jsou řazeny primárně podle termínu (nejdříve s termínem, vzestupně) s prioritou `SPĚCHÁ` přednostně.
- **Důležité vymezení:** **Personal ordering zatím NENÍ implementováno** a nebylo nahrazeno globálním pořadím vydávaným za osobní pořadí.
- **Testy a Quality Gates:** 32 nových testů (`tests/unit/area-task-queries.test.ts`), celkem 513/513 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 2 – Area UI & Server Actions (Dokončeno)
- **Area UI komponenty:**
  - `AreaSection`: kontejner oblastí na stránce `/app/board/[boardId]`, responzivní grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), počítadlo oblastí, empty state s výzvou k vytvoření.
  - `AreaCard`: karta oblasti s názvem, popisem, editačními/mazacími tlačítky a explicitním placeholderem pro úkoly (*„Úkoly budou následovat v dalším kroku“*).
  - `CreateAreaDialog`: modální formulář s `useActionState`, auto-focusem, validací (1–255 znaků) a zavřením na Escape.
  - `EditAreaDialog`: modální formulář pro úpravu názvu a popisu se synchronizací stavu.
  - `DeleteAreaDialog`: destruktivní dialog vyžadující přesné vepsání potvrzení `SMAZAT`.
- **Server Actions:**
  - `createAreaAction`, `updateAreaAction`, `deleteAreaAction` v `app/(authenticated)/app/board/[boardId]/area-actions.ts`.
  - Architektonický tok: `UI → Server Action → ActorContext → Use Case → Policy → Repository → DB`.
  - ActorContext je získáván striktně na serveru přes `resolveActorContext()`, klient neposílá důvěryhodnou identitu.
  - `boardId` a `areaId` jsou nedůvěryhodné vstupy validované Use Casem vůči DB.
  - `updateAreaAction` ověřuje skutečnou příslušnost k nástěnce načtením z DB (`area.boardId`).
  - Po úspěšné mutaci probíhá revalidace cesty `/app/board/[boardId]`.
- **Oprávnění a role:**
  - `OWNER`, `MANAGER`, `ADMIN`: mohou oblasti vytvářet, upravovat a mazat (`canManage = true`).
  - `MEMBER`: vidí oblasti, ale mutační ovládací prvky se nezobrazují; přímé volání Server Action skončí `AuthorizationError (INSUFFICIENT_ROLE)`.
- **Bezpečné mazání oblasti:**
  - Vyžaduje striktní shodu textu `SMAZAT` (odmítnuto Zodem i Use Casem při jakékoli odchylce).
  - Volá `DeleteAreaUseCase`, který v transakci `UnitOfWork` kaskádově maže oblast i všechny související úkoly.
- **UI infrastruktura:** `Button` rozšířen o variantu `danger` (zpětně kompatibilní).
- **Testy a Quality Gates:** 36 nových unit testů (`tests/unit/area-ui-actions.test.ts`), celkem 549/549 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 3 – Task Create & Display UI (Dokončeno)
- **Komponenty zobrazení úkolů (Task Display):**
  - `TaskCard`: karta úkolu zobrazující název, popis (s `line-clamp-2`), barevný odznak stavu (`Nové`, `Převzaté`, `Rozpracované`, `Čeká se`, `Hotovo`, `Archivováno`), červený badge priority `● Spěchá`, termín splnění (`cs-CZ` formát s detekcí po termínu pro aktivní úkoly), přiřazeného řešitele (nebo kurzívou *„Nepřiřazeno“*), spoluřešitele a autora (*„Zadal/a: ...“*).
  - Propojení s `AreaCard`: nahrazení dřívějšího statického placeholderu reálným seznamem `TaskCard`, počítadlo úkolů v záhlaví oblasti s českým skloňováním (`1 úkol`, `2–4 úkoly`, `5+ úkolů`), empty state (*„V této oblasti zatím nejsou žádné úkoly.“*) a tlačítko `+ Přidat úkol` pro oprávněné uživatele.
  - Propojení s `AreaSection`: podpora pro zobrazení úkolů nezařazených do žádné oblasti (*„Bez oblasti“*), počítadlo celkového počtu úkolů nástěnky, přepínač filtru úkolů **Aktivní** vs. **Archivované** (`/app/board/[boardId]` vs. `?filter=ARCHIVED`).
- **Vytvoření úkolu (Create Task):**
  - `CreateTaskDialog`: modální dialog s React 19 `useActionState`, auto-focusem, validací povinného názvu (1–255 znaků), volitelným popisem (max. 10 000 znaků), výběrem oblasti (s možností bez oblasti a předvyplněním při volání z karty oblasti), výběrem řešitele ze seznamu členů nástěnky s českými rolemi, výběrem priority (`BĚŽNÁ` / `SPĚCHÁ`), polem termínu splnění (`type="date"`), obsluhou klávesy Escape, zakázáním opakovaného odeslání během `isPending` a zobrazením validačních chyb.
  - `createTaskAction`: Server Action v `app/(authenticated)/app/board/[boardId]/task-actions.ts`. Autoritativní serverové získání ActorContextu přes `resolveActorContext()`, validace přes `createTaskSchema`, spuštění `CreateTaskUseCase` v transakci `DrizzleUnitOfWork` a revalidace cesty `/app/board/[boardId]`.
- **Autorizace a bezpečnost (Security & Authorization):**
  - Autoritativní odvození oprávnění: `TASK_CREATE` a `TASK_VIEW` jsou podle `TaskPolicy` povoleny všem členům nástěnky (`OWNER`, `MANAGER`, `MEMBER`) i systémovému administrátorovi (`ADMIN`).
  - Cross-board izolace: backend Use Case autoritativně odmítá přiřazení oblasti z jiné nástěnky (`CROSS_BOARD_ACCESS`) i přiřazení řešitele, který není aktivním členem dané nástěnky (`CROSS_BOARD_ACCESS`).
  - Zákaz přístupu k neexistujícím, neautorizovaným nebo logicky smazaným nástěnkám (`BOARD_DELETED`).
- **Důležité vymezení rozsahu (Scope Boundaries):**
  - V tomto kroku záměrně **NEJSOU implementovány**: mutace životního cyklu úkolu (změna stavu, editace názvu a popisu, změna řešitele, změna termínu/priority, převzetí úkolu, správa spoluřešitelů JOIN/LEAVE/REMOVE, archivace ani smazání úkolu `SMAZAT`), osobní řazení (personal ordering) ani Membership UI.
- **Testy a Quality Gates:** 33 nových unit a integračních testů v `tests/unit/task-ui-actions.test.ts`, celkem 582/582 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 4 – Membership UI / Správa členů nástěnky (Dokončeno)
- **Komponenty správy členů (Membership UI):**
  - `MembersSection`: kontejner členů na stránce `/app/board/[boardId]`, zobrazení souhrnu rolí (`vlastník`, `správce`, `členové`), tlačítka `+ Přidat člena` (pro OWNER/MANAGER/ADMIN) a `Opustit nástěnku` (pro MEMBER/MANAGER).
  - Karty členů: vizuální odznak role (`Vlastník` - tmavý, `Správce` - fialový, `Člen` - šedý), jméno, e-mail, indikátor `(Vy)` pro přihlášeného uživatele, kontextová akční tlačítka `Povýšit na Správce` / `Změnit na Člena` a `Odebrat`.
  - `AddMemberDialog`: modální dialog s výběrem dostupných uživatelů (kteří dosud nejsou členy) načtených autorizovaným use casem `GetAssignableUsersUseCase`, výběr role (`Člen` nebo `Správce` při splnění limitu), validace a prevence duplicity.
  - `ChangeRoleDialog`: modální dialog pro změnu role člena mezi `MEMBER` a `MANAGER` s kontrolou limitu max. 1 správce.
  - `RemoveMemberDialog`: destruktivní potvrzovací dialog pro odebrání člena z nástěnky s varováním o uvolnění přiřazených úkolů.
  - `LeaveBoardDialog`: modální dialog pro dobrovolný odchod přihlášeného člena (`MEMBER`/`MANAGER`) s přesměrováním do `Moje nástěnky` (`/app`).
- **Server Actions & Use Cases:**
  - `addMemberAction`: volá `AddMemberUseCase` v transakci `UnitOfWork` s row lockingem `findByIdForUpdate`.
  - `changeMemberRoleAction`: volá `ChangeMemberRoleUseCase` (pouze OWNER a ADMIN).
  - `removeMemberAction`: volá `RemoveMemberUseCase` s kaskádovým uvolněním úkolů (assignee = null, vymazání spoluřešitelů).
  - `leaveBoardAction`: volá `LeaveBoardUseCase` s kaskádou úkolů a následným redirectem na `/app`.
  - `GetAssignableUsersUseCase`: autorizované načtení aktivních uživatelů systému s vyloučením stávajících členů nástěnky bez N+1 dotazů (`userRepo.findActiveUsers()`).
- **Autorizace a invarianty (Security & Invariants):**
  - Ochrana sole OWNERa: zákaz odebrání (`CANNOT_REMOVE_SOLE_OWNER`), zákaz sesazení (`CANNOT_DEMOTE_SOLE_OWNER`), zákaz povýšení na OWNER přes ChangeRole (`OWNERSHIP_TRANSFER_REQUIRED`), zákaz opuštění nástěnky bez předchozího převodu vlastnictví.
  - Invariant max. 1 MANAGER: zákaz přidání nebo povýšení druhého správce (`MANAGER_LIMIT_EXCEEDED`).
  - Cross-board izolace: přísná kontrola příslušnosti členství k dané nástěnce.
  - Okamžitá synchronizace Board Directory: uživatel po přidání členství ihned vidí nástěnku v `Moje nástěnky` (`/app`).
- **Testy a Quality Gates:** 40 nových unit a integračních testů v `tests/unit/member-ui-actions.test.ts`, celkem 622/622 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 5A – Task Edit & Assignee UI (Dokončeno)
- **Komponenty editace úkolu (Task Edit UI):**
  - Tlačítko `✏️` na `TaskCard` pro oprávněné uživatele (všichni aktivní členové nástěnky a administrátor).
  - `EditTaskDialog`: modální dialog s React 19 `useActionState`, auto-focusem, validací povinného názvu (1–255 znaků), popisu (max. 10 000 znaků), výběrem oblasti (včetně volby bez oblasti), výběrem řešitele ze seznamu členů nástěnky (s možností Nepřiřazeno), volbou priority (`BĚŽNÁ` / `SPĚCHÁ`) a termínu splnění (`type="date"`).
  - Rozlišení oprávnění pro editaci jednotlivých polí v UI dle `TaskPolicy`:
    - Název, popis, priorita a přiřazení řešitele jsou povoleny všem členům.
    - Změna oblasti a termínu je povolena Řešiteli, Spoluřešiteli, Správci, Vlastníkovi a Administrátorovi. Pokud uživatel tato práva nemá, pole jsou v UI uzamčena (disabled s vysvětlujícím textem) a odesílá se nezměněná hodnota.
  - Ochrana proti vícenásobnému odeslání během `isPending` a zachování zadaných údajů při chybě.
- **Server Actions & Use Cases:**
  - `updateTaskAction` v `app/(authenticated)/app/board/[boardId]/task-actions.ts`: autoritativní serverový ActorContext, validace přes `editTaskSchema`, kontrola existence úkolu a cross-board příslušnosti k nástěnce. Změněná pole deleguje na příslušné doménové use casy: `UpdateTaskUseCase` (název, popis), `ChangeTaskAssigneeUseCase` (řešitel), `ChangeTaskAreaUseCase` (oblast), `ChangeTaskDueDateUseCase` (termín), `ChangeTaskPriorityUseCase` (priorita). Po úspěchu provádí `revalidatePath`.
  - `changeTaskAssigneeAction`: samostatná Server Action pro přiřazení/odebrání řešitele přes `ChangeTaskAssigneeUseCase`.
  - Invarianty řešitele: při odebrání řešitele (`assigneeId = null`) se automaticky odstraní všichni spoluřešitelé; pokud byl nový řešitel dosud spoluřešitelem, je ze spoluřešitelů vyjmut.
- **Bezpečnostní hranice a cross-board izolace:**
  - Cílová oblast musí patřit do stejné nástěnky (`CROSS_BOARD_ACCESS`).
  - Cílový řešitel musí být aktivním členem stejné nástěnky (`CROSS_BOARD_ACCESS`).
  - Zákaz přístupu k neexistujícím, neautorizovaným nebo smazaným nástěnkám (`BOARD_DELETED`).
- **Důležité vymezení rozsahu:**
  - V tomto kroku záměrně **NEJSOU implementovány**: převzetí úkolu (`TakeOverTaskUseCase`), změna stavu a workflow, spoluřešitelé (připojení/odpojení spoluřešitele), archivace, mazání úkolu, osobní řazení (personal ordering), drag & drop, notifikace ani komentáře.
- **Testy a Quality Gates:** 42 nových unit testů v `tests/unit/task-edit-actions.test.ts`, celkem 664/664 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### Board Edit – Úprava metadat nástěnky (Dokončeno)
- **Komponenty editace nástěnky (Board Edit UI):**
  - Tlačítko `✏️ Upravit nástěnku` (`EditBoardButton`) v hlavičce detailu nástěnky (`/app/board/[boardId]`) zobrazené pro oprávněné role (`canEditBoard = isGlobalAdmin || role === "OWNER" || role === "MANAGER"`). Pro řadové členy (`MEMBER`) a nečleny je tlačítko skryté.
  - `EditBoardDialog`: modální formulář s React 19 `useActionState`, auto-focusem, předvyplněným aktuálním názvem a popisem nástěnky, klientskou i serverovou validací (název 1–255 znaků s trimem, volitelný popis max. 1000 znaků), zavřením na klávesu Escape a pending indikátorem.
- **Server Actions & Use Cases:**
  - `updateBoardAction` v `app/(authenticated)/app/board/[boardId]/board-actions.ts`: autoritativní serverový `ActorContext` ze session, validace přes `updateBoardSchema`, delegace na `UpdateBoardUseCase`.
  - `UpdateBoardUseCase`: autorizace přes `BoardPolicy` (`BOARD_EDIT`), kontrola existence a soft-delete stavu (`BOARD_DELETED`), aktualizace přes `BoardRepository.update()`.
  - Revalidace cache: automatická revalidace detailu `/app/board/[boardId]` i přehledu `/app` (Moje nástěnky).
- **Architektonická integrita a bezpečnost:**
  - `boards.created_by` se nikdy nemění (neměnný auditní údaj).
  - Aktuální vlastník je určován výhradně z `memberships.role = 'OWNER'`, nikoliv z `boards.created_by`.
- **Testy a Quality Gates:** 32 nových unit testů v `tests/unit/board-edit.test.ts`, celkem 696/696 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 5B – Task Status Workflow, Take Over, Participants & Lifecycle UI (Dokončeno)
- **Workflow stavů úkolu (Status Workflow UI):**
  - Interaktivní výběr stavu přímo na kartě úkolu (`TaskCard`) pro oprávněné uživatele (`OWNER`, `MANAGER`, řešitel, spoluřešitel a `ADMIN`).
  - Podpora přechodů mezi aktivními stavy (`NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`, `HOTOVO`) prostřednictvím `changeTaskStatusAction` a `ChangeTaskStatusUseCase`.
  - Automatické řízení `completedAt` (nastavení času dokončení při přechodu do `HOTOVO`, vynulování při návratu do aktivního stavu).
- **Převzetí úkolu (Take Over UI):**
  - Tlačítko *„Převzít úkol“* na kartě úkolu pro kteréhokoliv aktivního člena nástěnky nebo administrátora přes `takeOverTaskAction` a `TakeOverTaskUseCase`.
  - Pokud byl přebírající uživatel dosud spoluřešitelem, je automaticky ze spoluřešitelů vyjmut.
- **Správa spoluřešitelů (Participants UI):**
  - Zobrazení seznamu spoluřešitelů s čipy jmen na kartě úkolu.
  - Tlačítko *„+ Připojit se“* (`joinTaskAction` / `JoinTaskAsParticipantUseCase`) pro dobrovolné zapojení člena (vyžaduje existenci hlavního řešitele).
  - Tlačítko *„Opustit“* (`leaveTaskAction` / `LeaveTaskAsParticipantUseCase`) pro dobrovolné odpojení spoluřešitele od úkolu.
  - Tlačítko `✕` (`removeTaskParticipantAction` / `RemoveTaskParticipantUseCase`) u každého spoluřešitele pro nucené odebrání řešitelem, správcem, vlastníkem nebo administrátorem.
- **Archivace úkolu (Archive Task UI):**
  - Volba *„Archivovat úkol“* v kontextovém menu `⋯` na kartě úkolu s potvrzovacím dialogem přes `archiveTaskAction` a `ArchiveTaskUseCase`.
  - Přesun úkolu do stavu `ARCHIVOVÁNO` a zobrazení ve filtru *„Archivované“*.
  - Striktní read-only ochrana: archivovaný úkol nelze editovat, měnit jeho stav ani upravovat spoluřešitele; obnova z archivu (restore/unarchive) není podle schválených architektonických pravidel podporována.
- **Řízené definitivní smazání úkolu (Delete Task UI):**
  - Volba *„Smazat úkol“* v kontextovém menu `⋯` otevírající destruktivní modální dialog `DeleteTaskDialog`.
  - Nevratný hard-delete vyžadující přesné bezpečnostní potvrzení vepsáním textu `SMAZAT` (validováno Zodem, Server Action `deleteTaskAction` i `DeleteTaskUseCase`).
  - Kaskádové odstranění všech vazeb na spoluřešitele v `task_participants`.
- **Testy a Quality Gates:** 30 nových unit testů v `tests/unit/task-lifecycle-actions.test.ts`, celkem 726/726 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 6 – Personal Ordering (Dokončeno)
- **Perzistentní model per uživatel:**
  - Samostatná databázová tabulka `user_task_orders` (`id`, `user_id`, `task_id`, `board_id`, `position`, `created_at`, `updated_at`).
  - Složený unikátní index `[user_id, task_id]` zabraňující duplicitním pozicím pro stejnou dvojici.
  - Index `[board_id, user_id]` optimalizovaný pro rychlé načtení pozic nástěnky konkrétního uživatele v jednom dotazu.
  - Cizí klíče `user_id`, `task_id`, `board_id` s kaskádovým smazáním (`ON DELETE CASCADE`).
- **Normalizace pozic a řazení:**
  - `ReorderTaskUseCase` podporuje relativní posun nahoru (`UP`) a dolů (`DOWN`) i přímé umístění před/za referenční úkol (`BEFORE`, `AFTER`).
  - Normalizace při každé změně přepočítává celočíselné pozice s rozestupem 1000 (`1000, 2000, 3000...`) v rámci aktivního kontejneru (daná oblast nebo úkoly bez oblasti). Tím zcela eliminuje ztrátu přesnosti plovoucí řádové čárky i nutnost periodického rebalancování.
- **Sparse storage a deterministický fallback:**
  - Nově vytvořené a dosud nepřesunuté úkoly nevyžadují zápis do DB pro všechny uživatele.
  - `GetBoardTasksUseCase` řadí nepozicované úkoly deterministicky: nejprve podle priority (`SPĚCHÁ` před `BĚŽNÁ`), poté podle termínu splnění (nejdříve s termínem vzestupně, bez termínu na konec), data vytvoření (`createdAt DESC`) a ID úkolu.
  - Pozicované úkoly uživatele jsou řazeny přednostně podle jejich uložené osobní pozice vzestupně.
- **Invariant archivu:**
  - Při zobrazení archivu (`filter=ARCHIVED`) se osobní řazení neuplatňuje – archivované úkoly jsou vždy řazeny chronologicky podle času poslední aktualizace (`updatedAt DESC`).
- **Autorizace a bezpečnost:**
  - Akce `TASK_REORDER` v `TaskPolicy` povolena pro `OWNER`, `MANAGER`, `MEMBER` i globálního `ADMIN`.
  - Nečlenové a uživatelé na smazaných nástěnkách jsou striktně odmítnuti.
  - Cross-user izolace: změna pořadí uživatele A nemá žádný vliv na pořadí úkolů uživatele B.
  - Změna osobního pořadí nemění žádná sdílená týmová data úkolu (oblast, stav, priorita, řešitel, termín).
- **UI a ovládací prvky (`TaskCard`):**
  - Tlačítka posunu nahoru (`▲`) a dolů (`▼`) s popiskem `title` a plnou přístupností.
  - Nativní HTML5 Drag & Drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) s vizuální indikací tažení a optimalizovaným přenosem dat.
  - Server Action `reorderTaskAction` v `task-actions.ts` s autoritativním získáním `ActorContext` a revalidací cesty.
- **Kaskádové čištění:**
  - Při smazání úkolu (`DeleteTaskUseCase`), odebrání člena (`RemoveMemberUseCase`) nebo dobrovolném odchodu z nástěnky (`LeaveBoardUseCase`) se automaticky čistí příslušné záznamy v `user_task_orders`.
- **Testy a Quality Gates:** 19 nových unit a integračních testů v `tests/unit/personal-task-ordering.test.ts`, celkem 745/745 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 7 – Osobní pracovní prostor „Moje úkoly“ (Dokončeno)
- **Koncept a cíl:**
  - Poskytnout přihlášenému uživateli agregovaný osobní pohled (`/app/my-work`) na všechny úkoly, které se ho přímo týkají napříč všemi aktivními nástěnkami, k nimž má v daný okamžik přístup.
- **Bezpečnostní pravidla a scoping:**
  - Striktní backendová autorita: přístup je omezen výhradně na nástěnky získané z `findActiveBoardsForUser()` (nebo `findActiveBoardsForAdmin()` pro globálního administrátora).
  - Vyloučení pouhého autorství: samotné `created_by` bez vztahu řešitele (`assignee_id`) nebo spoluřešitele (`task_participants`) do přehledu Moje úkoly striktně nepatří.
  - Okamžitá reakce na změny členství: nečlenové, odebraní členové a členové po dobrovolném odchodu z nástěnky nemají k úkolům přístup.
  - Respektování soft-delete: smazané nástěnky (`deleted_at IS NOT NULL`) jsou vyloučeny na úrovni SQL.
  - Globální administrátor (`ADMIN`): v přehledu Moje úkoly vidí pouze úkoly, kde je sám řešitelem nebo spoluřešitelem (nevidí cizí úkoly, které se ho osobně netýkají).
- **Vztah uživatele k úkolu (Precedence):**
  - Pokud je uživatel současně hlavním řešitelem i spoluřešitelem, je vyhodnocena role Řešitel (`userRole = "ASSIGNEE"`).
- **Filtrování stavu (Status Filters):**
  - `Aktivní` (`ACTIVE` = `NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`; stav `HOTOVO` je striktně vyčleněn a do aktivních nepatří).
  - `Dokončené` (`COMPLETED` = `HOTOVO`).
  - `Archivované` (`ARCHIVED` = `ARCHIVOVÁNO`).
  - `Vše` (`ALL` = všechny úkoly bez ohledu na stav).
  - Výchozí filtr: `Aktivní`.
- **Filtrování rolí (Role Filters):**
  - `Všechny` (`ALL`, výchozí).
  - `Řešitel` (`ASSIGNEE`).
  - `Spoluřešitel` (`PARTICIPANT`).
- **Seskupení a UI prezentace:**
  - Úkoly jsou na stránce seskupeny podle jednotlivých nástěnek (seřazených abecedně dle názvu).
  - Každá skupina obsahuje záhlaví s názvem nástěnky, počítadlem zobrazených úkolů a přímým odkazem do detailu nástěnky (`/app/board/[boardId]`).
  - Karta úkolu (`MyTaskCard`): vizuální badge role uživatele (`Řešitel` / `Spoluřešitel`), badge stavu úkolu, badge priority `● Spěchá`, název oblasti, formátovaný termín splnění s červeným indikátorem po termínu a odkaz na nástěnku.
  - `MyTasksFilters`: klientský komponent pro přepínání stavových a rolových filtrů bez nutnosti reloadu stránky.
  - `AppHeader`: sdílená globální navigace propojující záložky `Moje nástěnky` (`/app`) a `Moje úkoly` (`/app/my-work`).
- **Zachování osobního řazení (Personal Ordering):**
  - Uvnitř každé nástěnky se prioritně uplatňuje osobní pořadí přihlášeného uživatele (`user_task_orders.position ASC`).
  - Nepozicované úkoly využívají deterministický fallback: priorita `SPĚCHÁ` před `BĚŽNÁ`, termín splnění vzestupně (nejdříve s termínem), datum vytvoření `createdAt DESC` a ID úkolu vzestupně.
- **Backend a Persistence:**
  - Rozšíření portu `TaskRepository` o metodu `findUserTasksAcrossBoards(userId: string, boardIds: string[]): Promise<TaskRecord[]>`.
  - Implementace v `DrizzleTaskRepository` s optimalizovaným SQL poddotazem `WHERE (tasks.assignee_id = userId OR tasks.id IN (SELECT task_id FROM task_participants WHERE user_id = userId)) AND tasks.board_id IN (...)`. Prázdný seznam `boardIds` okamžitě vrací prázdné pole bez zbytečného SQL volání.
  - Implementace use casu `GetMyTasksUseCase` v aplikační vrstvě s obohacením o `boardName`, `areaName`, `userRole` a aplikací filtrů a řazení.
- **Testy a Quality Gates:** 21 nových unit a integračních testů v `tests/unit/my-tasks.test.ts`, celkem 766/766 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 8 – Komentáře a diskuze k úkolům (Dokončeno)
- **Databázový model & migrace:**
  - Samostatná databázová tabulka `task_comments` (`id` UUID PK, `task_id` UUID FK s `ON DELETE CASCADE`, `author_id` UUID FK s `ON DELETE RESTRICT`, `content` TEXT NOT NULL, `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ).
  - Složený index `[task_id, created_at]` pro rychlé a deterministické načtení diskuze konkrétního úkolu chronologicky.
  - Index `[author_id]` pro integritu autorství a dohledatelnost komentářů.
  - Verzovaná Drizzle migrace `0003_lethal_galactus.sql` včetně odpovídajícího snapshotu v žurnálu.
- **Repozitář & Transakční UnitOfWork:**
  - Port `TaskCommentRepository` (`findById`, `findByTaskId`, `countByTaskIds`, `create`, `update`, `delete`, `deleteByTaskId`) definovaný v aplikační vrstvě úkolů.
  - Drizzle implementace `DrizzleTaskCommentRepository` registrovaná v `DrizzleUnitOfWork` pro plnou transakční bezpečnost a rollback při chybách.
  - Dávková metoda `countByTaskIds` pro načtení počtu komentářů pro sadu úkolů v jediném SQL dotazu bez N+1 zátěže.
- **Autorizační Policy Engine (TaskPolicy & TaskAuthorization):**
  - Nová práva: `TASK_COMMENT_VIEW`, `TASK_COMMENT_CREATE`, `TASK_COMMENT_EDIT_OWN`, `TASK_COMMENT_DELETE_OWN`.
  - **Author-only pravidlo bez výjimek:** Pouze autor komentáře (`comment.authorId === actor.actor_user_id`) smí svůj komentář upravit nebo smazat. Vlastník nástěnky (`OWNER`), správce (`MANAGER`) ani globální administrátor (`ADMIN`) nemají moderační výjimku měnit či mazat cizí komentáře (`NOT_COMMENT_AUTHOR`).
  - **Striktní read-only režim pro archiv:** U archivovaného úkolu (`task.status === "ARCHIVOVÁNO"`) jsou všechny zápisové operace s komentáři zakázány (`TASK_ARCHIVED`) i pro autora i pro ADMINa. Čtení komentářů zůstává plně povolené.
  - Zákaz operací pro nečleny nástěnky a soft-deleted entity (`BOARD_DELETED`).
- **Aplikační vrstva & Use Cases:**
  - `GetTaskCommentsUseCase`: autorizované načtení komentářů k úkolu seřazených chronologicky (`createdAt ASC`), dávkové načtení autorů přes `UserRepository.findByIds`, obohacení o jméno a e-mail autora, příznaky `canEdit` a `canDelete` pro aktuálního aktéra, detekce `isArchived`.
  - `AddTaskCommentUseCase`: validace obsahu (1–5000 znaků po trimu, Zod schéma), autorizace přes `TaskPolicy`, transakční uložení.
  - `UpdateTaskCommentUseCase`: ověření autorského práva, aktualizace obsahu a časového razítka `updatedAt`.
  - `DeleteTaskCommentUseCase`: ověření autorského práva, smazání komentáře z DB.
  - Obohacení `GetBoardTasksUseCase` a `GetMyTasksUseCase` o `commentsCount` pomocí dávkového volání `taskCommentRepo.countByTaskIds()`.
- **Server Actions & UI komponenty:**
  - Server Actions v `app/(authenticated)/app/board/[boardId]/comment-actions.ts`: `getTaskCommentsAction`, `addTaskCommentAction`, `updateTaskCommentAction`, `deleteTaskCommentAction`. Autoritativní serverový `ActorContext`, validace vstupů, revalidace cesty `/app/board/[boardId]`.
  - Modální dialog `TaskCommentsDialog`: responzivní design, automatické scrollování na nejnovější komentář, formulář pro přidání komentáře s počítadlem znaků a klávesovou zkratkou (Ctrl+Enter), inline editace komentáře s ukládáním i rušením, kontextové smazání s potvrzovacím dialogem, vizuální označení `(upraveno)` u editovaných komentářů a informační banner při archivovaném úkolu (*„Diskuze je uzamčena pro čtení.“*).
  - Tlačítko na `TaskCard` s dynamickým počítadlem komentářů (`💬 X komentářů`).
  - Odznak s počtem komentářů na kartě úkolu v osobním přehledu `MyTaskCard`.
- **Testy a Quality Gates:** 26 nových unit testů v `tests/unit/task-comments.test.ts`, celkem 792/792 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### Bezpečnostní oprava auth formulářů (Dokončeno)
- **Ochrana proti GET úniku přihlašovacích údajů:** Formuláře `LoginForm` a `RegisterForm` explicitně definují atribut `method="post"`. Tím se spolehlivě eliminuje implicitní HTML GET fallback při absenci či zpoždění React hydratace, takže heslo ani jiné citlivé údaje nemohou uniknout do URL parametrů.
- **Zachování autentizačního toku:** Vlastní přihlašování a registrace nadále využívají klientského Better Auth klienta (`authClient.signIn.email`, `authClient.signUp.email`) s `e.preventDefault()`.
- **Vymezení rozsahu:** Povolení síťového originu pro LAN přístup (`allowedDevOrigins` v Next.js a `trustedOrigins` v Better Auth) není součástí této opravy a je řešeno v navazujícím kroku.
- **Testy a Quality Gates:** 14 nových unit testů v `tests/unit/auth-form-security.test.ts`, celkem 806/806 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### Povolení autentizace ze síťové adresy v developmentu (Dokončeno)
- **Next.js development origin (`allowedDevOrigins`):** V `next.config.mjs` je nakonfigurováno pole `allowedDevOrigins` obsahující výchozí síťový vývojový origin `192.168.0.53` a `192.168.0.53:3000` (i dynamicky z `BETTER_AUTH_TRUSTED_ORIGINS`), čímž se zamezilo blokování dev prostředků a `/_next/hmr` (`Blocked cross-origin request to Next.js dev resource`).
- **Better Auth trusted origins (`trustedOrigins`):** Implementována pomocná funkce `resolveTrustedOrigins(env)` v `infrastructure/auth/better-auth.ts`. Sestavuje explicitní seznam povolených originů pro CSRF validaci (`BETTER_AUTH_URL`, v development prostředí fallback na `http://192.168.0.53:3000` a volitelný čárkou oddělený seznam z `BETTER_AUTH_TRUSTED_ORIGINS`). Tím se vyřešilo odmítnutí `403 INVALID_ORIGIN` při volání Better Auth API ze síťové adresy.
- **Konfigurace a fail-fast validace:** V `infrastructure/configuration/env.schema.ts` přidána volitelná proměnná `BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional()` a zdokumentována v `.env.example`.
- **Zachování bezpečnosti:** Striktně odmítány zástupné znaky (`*`) a cizí/neautorizované originy (např. `http://evil.com` skončí `403 INVALID_ORIGIN`).
- **Testy a Quality Gates:** 2 nové unit testy (`tests/unit/auth.test.ts` a `tests/unit/env.test.ts`), celkem 808/808 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### Rozšíření Moje úkoly – Editace úkolů a soukromé poznámky (Dokončeno)
- **Koncept a cíl:**
  - Rozšířit osobní workspace `/app/my-work` („Moje úkoly“) tak, aby uživatel mohl přímo z karty úkolu editovat data úkolu podle již existujících oprávnění a současně spravovat svou osobní soukromou poznámku k úkolu.
- **Funkce A – Editace úkolu z „Moje úkoly“:**
  - Na kartě `MyTaskCard` přidána akce `[ ✏️ Upravit ]` otevírající existující `EditTaskDialog`.
  - Maximální znovupoužití: volá existující `updateTaskAction` a doménové use casy (`UpdateTaskUseCase`, `ChangeTaskAssigneeUseCase`, `ChangeTaskAreaUseCase`, `ChangeTaskDueDateUseCase`, `ChangeTaskPriorityUseCase`).
  - Žádné nové blanket oprávnění typu `MY_TASK_EDIT` – plně zachována existující `TaskPolicy`. Skutečnost, že uživatel úkol v přehledu vidí (např. jako spoluřešitel), mu automaticky nedává právo měnit pole (změna oblasti a termínu vyžaduje status pracovníka úkolu `isTaskWorker`, roli Správce, Vlastníka nebo Administrátora).
  - Obousměrná revalidace cache: `updateTaskAction` revaliduje detail nástěnky (`/app/board/[boardId]`) i osobní workspace (`/app/my-work`).
- **Funkce B – Soukromé poznámky k úkolům (User Task Notes):**
  - **Zásadní oddělení od komentářů:** Soukromá poznámka je osobní obsah konkrétního uživatele, nikoliv veřejná týmová diskuze (`task_comments`). Nikdo jiný ji nesmí vidět.
  - **Databázový model & migrace:** Tabulka `user_task_notes` (`id`, `user_id`, `task_id`, `content` 1–5000 znaků, `created_at`, `updated_at`) s unikátním omezením `(user_id, task_id)` zaručujícím max. 1 aktivní poznámku na uživatele a úkol, cizím klíčem `task_id` s `ON DELETE CASCADE` a `user_id` s `ON DELETE CASCADE`. Verzovaná Drizzle migrace `0004_uneven_kronos.sql`.
  - **Repozitář & Transakční Unit of Work:** Port `UserTaskNoteRepository` (`findById`, `findByUserAndTask`, `findByUserAndTaskIds`, `upsert`, `delete`, `deleteAllForTask`, `deleteAllForUser`) s Drizzle implementací `DrizzleUserTaskNoteRepository` registrovanou v `DrizzleUnitOfWork`.
  - **Dávkové dotazování:** Metoda `findByUserAndTaskIds` v `GetMyTasksUseCase` načítá existenci poznámek pro celou sadu zobrazených úkolů bez N+1 dotazů a nastavuje příznak `hasPrivateNote` na `MyTaskView`.
  - **Striktní bezpečnostní model a autorizace v TaskPolicy:**
    - `TASK_PRIVATE_NOTE_VIEW_OWN`, `TASK_PRIVATE_NOTE_UPSERT_OWN`, `TASK_PRIVATE_NOTE_DELETE_OWN` jsou vyhrazeny **výhradně vlastníkovi poznámky** (`actor.actor_user_id === noteOwnerUserId`).
    - **Absolutní zákaz blanket přístupu pro ADMIN i správu:** Ani vlastník nástěnky (`OWNER`), provozní správce (`MANAGER`) ani globální administrátor (`ADMIN`) nesmí číst, měnit ani mazat cizí soukromou poznámku (`NOT_NOTE_OWNER`).
    - **Ochrana při odchodu z nástěnky:** Nečlen nástěnky (i po odchodu či odebrání) nesmí získat přístup ke své dřívější poznámce ani při znalosti `taskId` (`NOT_A_MEMBER`).
    - **Chování u dokončených a archivovaných úkolů:** Úkol ve stavu `HOTOVO` umožňuje plné čtení, úpravu i smazání poznámky. U archivovaného úkolu (`ARCHIVOVÁNO`) je povoleno pouze čtení existující poznámky; zápis a smazání jsou striktně zakázány (`TASK_ARCHIVED`) i pro vlastníka poznámky a administrátora.
    - **Serverová autorita identity:** Server nikdy nepřijímá `userId` z klienta; identita aktéra je určena výhradně ze serverové session (`ActorContext`).
  - **Aplikační vrstva & Use Cases:** `GetUserTaskNoteUseCase` (ověření členství a autorizace), `UpsertUserTaskNoteUseCase` (transakční vytvoření/úprava s kontrolou archivu a autorizace), `DeleteUserTaskNoteUseCase` (transakční smazání).
  - **Server Actions:** `getUserTaskNoteAction`, `upsertUserTaskNoteAction`, `deleteUserTaskNoteAction` v `app/(authenticated)/app/my-work/note-actions.ts`.
  - **UI komponenty:** Tlačítko `[ 📝 Moje poznámka ]` na kartě `MyTaskCard` (s vizuální indikací, pokud je poznámka uložena). Modální dialog `UserTaskNoteDialog` s jasným bezpečnostním upozorněním *„Soukromá poznámka – vidíte ji pouze vy.“*, textovou plochou, počítadlem znaků (1–5000), ukládáním, možností smazání a read-only bannerem u archivovaných úkolů.
- **Vymezení rozsahu:** Žádné notifikace, žádné audit history, žádné attachments, žádný globální search, žádný redesign celých Moje úkoly ani drag & drop mezi boardy.
- **Testy a Quality Gates:** 31 nových unit testů (`tests/unit/user-task-notes.test.ts` 14 testů, `tests/unit/my-tasks-edit.test.ts` 17 testů), celkem 839/839 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 9A – Quick Status v „Moje práce“ (Dokončeno)
- **Koncept a cíl:**
  - Umožnit přihlášenému uživateli přímo na kartě `MyTaskCard` v osobním workspace `/app/my-work` rychle změnit stav úkolu bez otevírání detailního dialogu `EditTaskDialog` a bez přecházení na nástěnku.
- **Architektonické znovupoužití a žádná duplikace:**
  - Znovupoužita existující Server Action `changeTaskStatusAction`, existující doménový use case `ChangeTaskStatusUseCase`, Zod validační schéma `changeTaskStatusSchema` a `TaskPolicy` (`TASK_CHANGE_STATUS`).
  - Nevznikl žádný paralelní use case typu `QuickChangeTaskStatusUseCase` ani žádná paralelní policy.
- **Serverová autorita identity (No UI Trust):**
  - Identita volajícího je získávána výhradně ze serverové session (`resolveActorContext`), Server Action nepřijímá `userId` z klienta.
- **Ochrana archivu (Striktní Read-Only):**
  - Úkoly ve stavu `ARCHIVOVÁNO` jsou v UI striktně read-only (zobrazuje se statický badge bez dropdownu).
  - V `TaskPolicy` je `TASK_CHANGE_STATUS` pro archivovaný úkol striktně odmítnut chybou `AuthorizationError (TASK_ARCHIVED)` pro všechny role včetně globálního administrátora (`ADMIN`).
- **Řízení `completedAt`:**
  - Při přechodu do stavu `HOTOVO` je nastaveno časové razítko dokončení úkolu; při návratu do jiného aktivního stavu je `completedAt` bezpečně vynulováno (`null`).
- **Okamžitá revalidace obou pohledů a reakce filtrů:**
  - `changeTaskStatusAction` revaliduje detail příslušné nástěnky (`/app/board/[boardId]`) i osobní workspace (`/app/my-work`).
  - Úkol po změně na `HOTOVO` okamžitě zmizí z výchozího filtru `Aktivní` a objeví se ve filtru `Dokončené` (a naopak).
- **Testy a Quality Gates:** 16 nových unit testů (`tests/unit/my-tasks-status.test.ts` 11 testů, `tests/unit/task-use-cases.test.ts` 2 testy, `tests/unit/task-policy.test.ts` 3 testy), celkem 855/855 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 9B – Audit Trail / Auditní stopa v1 (Dokončeno)
- **Koncept a cíl:**
  - Zaznamenávat významné business mutace dle schváleného **Audit Event Catalog v1** (26 událostí) přímo v aplikačních Use Cases skrze `UnitOfWork` ve stejné DB transakci jako doménová změna.
- **Audit Event Catalog v1 (26 událostí):**
  - **Board (4 události):** `BOARD_CREATED`, `BOARD_UPDATED`, `BOARD_OWNER_TRANSFERRED`, `BOARD_DELETED`.
  - **Membership (4 události):** `MEMBER_ADDED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `MEMBER_LEFT_BOARD`.
  - **Area (3 události):** `AREA_CREATED`, `AREA_UPDATED`, `AREA_DELETED`.
  - **Task (12 událostí):** `TASK_CREATED`, `TASK_TITLE_CHANGED`, `TASK_DESCRIPTION_CHANGED`, `TASK_STATUS_CHANGED`, `TASK_PRIORITY_CHANGED`, `TASK_DUE_DATE_CHANGED`, `TASK_AREA_CHANGED`, `TASK_ASSIGNEE_CHANGED`, `TASK_PARTICIPANT_ADDED`, `TASK_PARTICIPANT_REMOVED`, `TASK_ARCHIVED`, `TASK_DELETED`.
  - **Comments (3 události):** `TASK_COMMENT_CREATED`, `TASK_COMMENT_EDITED`, `TASK_COMMENT_DELETED`.
- **Privacy Policy a ochrana citlivých dat:**
  - `TASK_DESCRIPTION_CHANGED`: Text popisu úkolu se do auditu nikdy neukládá (zaznamenává se pouze příznak `{ hasDescription: boolean }`).
  - `TASK_COMMENT_*`: Text komentáře se do auditu nikdy neukládá (zaznamenává se pouze `{ taskId: string }`).
  - **Soukromé poznámky (User Task Notes):** STRIKTNĚ BEZ AUDITU (0 zápisů při upsertu, čtení i smazání poznámky).
  - **Čtení a zobrazení (Read / View):** Žádný audit.
- **Integrita a principy návrhu:**
  - **No-op ochrana:** Pokud se hodnota nezměnila (stejný název, popis, status, priorita, termín, role, obsah komentáře), auditní záznam se nezapisuje.
  - **1 operace = 1 událost:** `TransferOwnership` generuje pouze `BOARD_OWNER_TRANSFERRED` (žádný duplicitní `MEMBER_ROLE_CHANGED`); `ArchiveTask` generuje pouze `TASK_ARCHIVED` (žádný duplicitní `TASK_STATUS_CHANGED`).
  - **Transakční Unit of Work & Rollback:** Zápis do `audit_logs` je součástí transakce `UnitOfWork`. Při selhání auditu je celá doménová operace atomicky vrácena zpět (rollback).
- **Infrastruktura & adaptéry:**
  - Modul `modules/audit/`: definice `AUDIT_EVENTS`, `AuditEvent`, `AuditLogRecord` a aplikačního portu `AuditLogRepository`.
  - Drizzle adaptér `DrizzleAuditLogRepository` s integrací do transakčního kontextu `DrizzleUnitOfWork`.
  - Stávající DB tabulka `audit_logs` plně vyhovuje (žádná nová DB migrace).
- **Vymezení rozsahu:**
  - STEP 9B je čistě backendová / aplikační infrastruktura. Žádné UI komponenty pro zobrazení historie zatím nebyly vytvářeny.
- **Testy a Quality Gates:** 26 nových unit testů v `tests/unit/audit-trail.test.ts` ověřujících všech 26 událostí, privacy pravidla, no-op ochranu, neauditování soukromých poznámek i transakční rollback, celkem 881/881 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 9B-UI – Audit Trail UI (Dokončeno)
- **Koncept a cíl:**
  - Poskytnout přívětivé, bezpečné a autorizované UI pro zobrazení chronologické historie aktivit úkolů i celé nástěnky nad existující infrastrukturou Audit Trail v1.
- **Komponenty a dialogy:**
  - `AuditTimeline`: znovupoužitelná vizuální časová osa zobrazující chronologický přehled změn se skeletonem pro načítání, prázdným stavem (*„Historie změn je zatím prázdná.“*) a ošetřením chybových stavů.
  - `TaskAuditHistoryDialog`: modální dialog pro historii konkrétního úkolu, vyvolatelný z karty úkolu `TaskCard` (jak z patičky vedle diskuze, tak z kontextového menu `⋯`) i z osobního přehledu `MyTaskCard` v `/app/my-work`.
  - `BoardAuditHistoryDialog`: modální dialog pro historii aktivit celé nástěnky.
  - `BoardHistoryButton`: tlačítko v hlavičce detailu nástěnky `/app/board/[boardId]` otevírající historii nástěnky.
- **Čtecí aplikační Use Casy & Porty:**
  - `GetTaskAuditHistoryUseCase`: načtení auditní historie úkolu seřazené chronologicky sestupně, autorizace přes `TaskPolicy` (`TASK_VIEW`, povoleno všem členům i ADMINovi, i pro archivované úkoly), cross-board ověření, dávkové načtení autorů akcí přes `UserRepository.findByIds` (bez N+1).
  - `GetBoardAuditHistoryUseCase`: načtení historie nástěnky seřazené sestupně, autorizace přes `BoardPolicy` (`BOARD_VIEW`), dávkové načtení jmen autorů.
  - `DrizzleAuditLogRepository`: rozšíření o `findByTaskId` (vyhledávání podle `targetId` i komentářového JSONB `taskId`) a `findByBoardId` s volitelným limitem.
  - Drizzle migrace `0005_boring_network.sql`: složené indexy `audit_logs_board_id_timestamp_idx` a `audit_logs_target_id_timestamp_idx`.
- **Prezentační vrstva a Privacy Policy:**
  - `formatAuditEvent`: formátovač pokrývající všech 25 událostí do česky srozumitelných popisů se zobrazením přechodu hodnot (`oldValue → newValue`).
  - Striktní privacy invariant: NIKDY se nezobrazuje text popisu úkolu (`TASK_DESCRIPTION_CHANGED`) ani text komentářů (`TASK_COMMENT_*`). Soukromé poznámky uživatelů se v auditu nikdy nevyskytují.
- **Server Actions:**
  - `getTaskAuditHistoryAction` a `getBoardAuditHistoryAction` v `app/(authenticated)/app/board/[boardId]/audit-actions.ts` se serverovým `resolveActorContext` a validací vstupů.
- **Testy a Quality Gates:** 25 nových unit testů v `tests/unit/audit-trail-ui.test.ts` pokrývajících use casy, autorizaci, limity, cross-board ochranu, formatter všech 25 událostí i privacy invarianty, celkem 906/906 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

#### STEP 10 – NAS Deployment & Persistent Runtime (Dokončeno)
- **Koncept a cíl:**
  - Příprava projektu Nástěnka pro stabilní a bezpečný produkční běh v Dockeru na Synology NAS (DS725+ / Container Manager), dostupný v LAN na `http://192.168.0.250:3000`.
- **Infrastrukturní architektura:**
  - **Existující PostgreSQL:** Kontejner Nástěnky se připojuje k již běžícímu PostgreSQL serveru na NAS (společnému s aplikací Pronájmy) přes `DATABASE_URL`. Žádný nový PostgreSQL kontejner nebyl přidán ani měněn.
  - **Multi-stage Dockerfile:** Postaven na `node:20-alpine` (libc6-compat), deterministická instalace `npm ci`, oddělená fáze pro sestavení (`npm run build`), příprava čistých produkčních závislostí (`npm ci --omit=dev`), spouštění pod neprivilegovaným uživatelem `nextjs:nodejs` (UID 1001). Kontejner se spouští přes standardní `npm run start`.
  - **.dockerignore:** Hermetický build striktně chránící před únikem lokálních konfigurací (`.env*`, `.git`, `tests`, IDE soubory, logy).
  - **docker-compose.yml:** Provozní definice pro Synology Container Manager na portu 3000 (`3000:3000`), s restart policy `unless-stopped`, konfigurací rotace logů (max-size 10m, max-file 3) a liveness probe testem.
  - **Healthcheck & Monitoring:** Endpoint `/api/health` vracející HTTP 200 `{ status: "ok", timestamp: ... }` pro liveness probe v Dockeru a Synology Container Manageru bez zatížení databáze.
  - **Better Auth & LAN podpora:** Konfigurace `BETTER_AUTH_URL=http://192.168.0.250:3000` a `BETTER_AUTH_TRUSTED_ORIGINS`, integrace do `next.config.mjs` pro Server Actions CSRF ochranu bez narušení lokálního vývoje na PC (`http://localhost:3000`).
  - **Šablona produkční konfigurace:** `.env.production.example` dokumentující všechny povinné proměnné pro `/docker/App_nastenka/.env` na NAS s doporučením práv `chmod 600`.
  - **Řízené databázové migrace:** Produkční kontejner nespouští migrace automaticky při startu; dokumentován bezpečný postup spuštění Drizzle migrací z vývojového PC (`node --env-file=.env.production ./node_modules/drizzle-kit/bin.cjs migrate`) nebo jednorázově na NAS před startem aplikace.
  - **Ověření bezstavovosti:** Ověřeno, že aplikace nezapisuje do lokálního filesystému (stateless runtime).
- **Testy a Quality Gates:** 1 nový integrační unit test pro healthcheck endpoint v `tests/api/health.test.ts` a rozšíření `tests/unit/auth.test.ts` pro NAS origin, celkem 907/907 PASS, lint PASS, typecheck PASS, build PASS, db:check PASS.

---

# CURRENT – Aktuálně řešené

Sem patří aktuálně rozpracované úkoly.

| ID | Úkol | Stav | Poznámka |
|---|---|---|---|
| — | — | — | — |

---

# NEXT – Nejbližší kroky

Sem patří nejbližší schválené úkoly, které mají následovat.

1. **STEP 11 – Přílohy k úkolům (Attachments):**
   - Správa a nahrávání souborů a fotografií k úkolům.
   - Návrh persistentního úložiště na Synology NAS (Docker volume / namapovaný adresář).
   - Databázový model příloh, limity velikosti a typů souborů.
   - Autorizační pravidla pro nahrávání, stahování a mazání příloh.

---

# FUTURE – Budoucí rozvoj

Sem patří dlouhodobější nápady a plánované směry vývoje, které ještě nejsou aktuálním úkolem.

- Real-time notifikace
- Full-text search (PostgreSQL tsvector + pg_trgm)
- E-mailové notifikace
- Outbox worker (asynchronní zpracování událostí)

---

# TECHNICKÝ DLUH

Sem patří známé technické nedostatky a následná technická zjištění (Follow-up items), které nejsou bezprostředním blokátorem dokončených kroků.

## Běžný technický dluh
- `npm run test` odkazuje na neinstalovaný Vitest – nutno opravit v package.json (nízká priorita, testy fungují přes `node --test`).
- `"type": "module"` chybí v package.json – způsobuje Node.js varování při testech (výkon), nízká priorita.

## STEP 1 Code Review – Follow-up & Technical Debt (Membership Use Cases)
Krok **STEP 1 – Membership Use Cases** byl úspěšně dokončen a schválen (`READY FOR ACCEPTANCE: YES / COMPLETED`). Následující položky vzešly z architektonické a bezpečnostní prověrky (Code Review) jako technický dluh a náměty pro navazující refaktoring a designová rozhodnutí:

- **TD-01 – Sole Owner detection** (Priorita: HIGH)  
  Současný `RemoveMemberUseCase` používá `targetMembership.role === "OWNER"` jako indikátor sole Ownera. V konzistentním DB stavu je chování správné, ale označení `isSoleOwner` je zavádějící a implementace je křehká vůči případné nekonzistenci mezi Board a Membership daty.

- **TD-02 – Soft-deleted Board error semantics** (Priorita: MEDIUM)  
  Při práci se soft-deleted Boardem může být vrácen `AuthorizationError (403)` místo `NotFoundError (404)`. Je potřeba zvážit sjednocení chování tak, aby nebyla zbytečně odhalována existence Boardu.

- **TD-03 – Inactive target user error semantics** (Priorita: MEDIUM)  
  Neaktivní cílový uživatel je nyní odmítnut jako `ValidationError`. Je potřeba zvážit přesnější aplikační/domain error semantics.

- **TD-04 – Task cascade fallback** (Priorita: MEDIUM)  
  `RemoveMemberUseCase` obsahuje task cascade, která může tiše přeskočit část operace, pokud `tasks` nejsou dostupné v `UnitOfWork`. Je potřeba prověřit, zda má být takový stav explicitně odmítnut, nebo zda má být cascade povinnou součástí transakční operace.

- **TD-05 – Task cascade performance** (Priorita: MEDIUM)  
  Task cascade používá individuální DB operace v cyklu a může vést k N+M počtu databázových volání. Budoucí optimalizace by měla zvážit dávkové operace.

- **TD-06 – Duplicate participant removal** (Priorita: MEDIUM)  
  Při některých scénářích může dojít k duplicitnímu volání `removeParticipant` po `removeAllForTask`. Je potřeba zjednodušit cascade logiku tak, aby stejná vazba nebyla odstraňována vícekrát.

- **TD-07 – MEMBER self-removal / LeaveBoard** (STAV: VYŘEŠENO v rámci STEP 21 / STEP 3)  
  Vyřešeno implementací samostatného use casu `LeaveBoardUseCase` a doplněním doménové akce `MEMBER_LEAVE` do `MembershipPolicy`. Řadový člen (`MEMBER`) a provozní správce (`MANAGER`) mají právo dobrovolně opustit Nástěnku přes `LeaveBoardUseCase` (identita je určena bezpečně ze serverového `ActorContextu`). `RemoveMemberUseCase` zůstává vyhrazen výhradně pro administrativní odebrání člena z pozice `OWNER`/`MANAGER`. Vlastník (`OWNER`) má odchod ze své Nástěnky bez předchozího převodu vlastnictví striktně zakázán (`ConflictError` 409).

---

# ZÁSADY ROADMAPY

- Do roadmapy se zapisují pouze reálné a relevantní úkoly projektu.
- Dokončené položky se přesouvají do sekce `DONE`.
- `CURRENT` obsahuje pouze skutečně rozpracované úkoly.
- `NEXT` obsahuje nejbližší schválené kroky.
- `FUTURE` slouží pro dlouhodobější směr projektu.
- Technický dluh se eviduje odděleně od běžných vývojových úkolů.
- Roadmapa není náhradou za technickou dokumentaci.
