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

---

# CURRENT – Aktuálně řešené

Sem patří aktuálně rozpracované úkoly.

| ID | Úkol | Stav | Poznámka |
|---|---|---|---|
| — | — | — | — |

---

# NEXT – Nejbližší kroky

Sem patří nejbližší schválené úkoly, které mají následovat.

1. Board, Area & Task UI (Server Actions, UI komponenty pro nástěnky, oblasti a úkoly)
2. Membership UI (přidávání/odebírání členů, správa rolí)

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
