# 000 – Postup vzniku projektu s AI (Kuchařka a chronologický průvodce)

**Typ dokumentu:** Metodická kuchařka a chronologický průvodce vznikem projektu s AI<br>
**Stav:** Schváleno / Kompletní průvodce předimplementační fází<br>
**Verze:** 1.0.0<br>
**Datum:** 19. 9. 2026<br>
**Vychází z:** Skutečného vývoje projektu Nástěnka, `docs/020_Pozadavky.md`, `docs/030_Funkcni_model.md`, `docs/040_Uzivatelske_scenare.md`, `docs/050_Architektura.md` a Git historie

---

## Část I: Účel, principy a model spolupráce s AI

### 1. Účel tohoto dokumentu – Praktická kuchařka pro budoucí projekty

Tento dokument představuje **metodickou kuchařku a chronologického průvodce**, který vznikl na základě reálného vývoje projektu **Nástěnka**. Jeho účelem není pouze shrnout výsledný stav architektury, ale detailně zdokumentovat:
* **jak jsme projekt skutečně vytvářeli**,
* **v jakém přesném pořadí jsme činili klíčová rozhodnutí**,
* **jak jsme využívali synergii mezi člověkem a různými formami AI (ChatGPT a Antigravity)**,
* **jak jsme prováděli verifikaci a kontroly konzistence**,
* **jak jsme používali Git jako bezpečnostní síť procesu**,
* **proč jsme jednotlivé kroky dělali právě takto**.

Dokument slouží jako praktická odpověď na otázku:
> *„Kdybychom za rok začínali podobný projekt znovu od nuly, jak přesně máme postupovat v předimplementační fázi, než napíšeme první řádek produkčního kódu?“*

Dokument zachycuje **skutečný postup tohoto konkrétního projektu**, nikoliv abstraktní teorii vývoje.

---

### 2. Triádový model spolupráce: Člověk + ChatGPT + Antigravity

V průběhu přípravy projektu Nástěnka se osvědčil striktně oddělený triádový model spolupráce. Každý článek má svou nezaměnitelnou roli a jasně vymezené hranice odpovědnosti.

```text
       ┌──────────────────────────────────────────────┐
       │           Člověk / Product Owner             │
       │  - definuje reálnou potřebu a byznys vizi    │
       │  - činí a schvaluje klíčová rozhodnutí       │
       │  - provádí finální kontrolu výstupů          │
       │  - VÝHRADNĚ provádí ruční Git Push           │
       └──────────────────────┬───────────────────────┘
                              │ zadání a diskuze
                              ▼
       ┌──────────────────────────────────────────────┐
       │             ChatGPT / Architekt              │
       │  - analyzuje požadavky a hledá nejasnosti    │
       │  - navrhuje logické a technické varianty     │
       │  - formuluje architektonická pravidla        │
       │  - připravuje precizní a deterministické     │
       │    prompty pro implementačního agenta        │
       └──────────────────────┬───────────────────────┘
                              │ prováděcí prompty
                              ▼
       ┌──────────────────────────────────────────────┐
       │       Antigravity / Implementační agent      │
       │  - čte stávající projektové soubory a kontext│
       │  - provádí zadané úpravy v dokumentaci/kódu  │
       │  - spouští verifikační kontroly (diff, lints)│
       │  - vytváří lokální atomické Git commity      │
       │  - NIKDY neprovádí Git Push                  │
       └──────────────────────────────────────────────┘
```

#### Klíčová pravidla spolupráce:
1. **AI nenahrazuje rozhodování Product Ownera:** ChatGPT i Antigravity jsou poradní a realizační nástroje. Zásadní otázky (např. zda povolit trvalé smazání úkolu, zda zavést roli Správce, jaké notifikace odesílat na WhatsApp) vždy rozhoduje člověk.
2. **Architekt nepíše přímo do repozitáře:** ChatGPT slouží jako myšlenkový partner a analytik. Formuluje ucelená zadání, která obsahují přesné mantinely a kritéria úspěchu.
3. **Implementační agent má striktní mantinely:** Antigravity pracuje přímo v prostředí projektu (souborový systém, terminál). Má přesně zakázáno zasahovat do souborů mimo zadaný rozsah a nesmí si svévolně vymýšlet nová pravidla.

---

### 3. Zásadní princip: „Neprogramovat příliš brzy“

Nejčastější chybou softwarových projektů je ukvapené psaní kódu ve chvíli, kdy ještě nejsou vyjasněny základní funkční hranice, datové vztahy a bezpečnostní pravidla. V projektu Nástěnka jsme důsledně uplatnili sekvenční postup:

```text
Požadavky (020)
       ↓
Funkční model (030)
       ↓
Uživatelské scénáře (040)
       ↓
Logická architektura a doména (050 – Step 5 až 8)
       ↓
Systémové chování, session a události (050 – Step 9 až 12)
       ↓
UI/UX architektura a technické vrstvy (050 – Step 13 až 14)
       ↓
Technologický stack a ADR (050 – Step 15)
       ↓
TEPRVE NYNÍ: Příprava implementace a psaní kódu
```

#### Rizika, kterým jsme tímto postupem úspěšně předešli:
* **Přepisování hotového kódu:** Změna datového modelu nebo oprávnění v kódu stojí dny práce; v architektonické dokumentaci trvá minuty.
* **Nekonzistentní datový model a neplatné stavy:** Constrainty a kardinality byly navrženy a ověřeny dříve, než vznikla první databázová tabulka.
* **Falešná bezpečnost v UI:** Včasným oddělením vrstev bylo stanoveno, že frontendová omezení (skrytí tlačítka) nejsou bezpečnostním mechanismem. Backend je výhradní autorita.
* **Špatná technologická rozhodnutí:** Technologie byly vybrány až na základě detailně popsaných požadavků na transakce, outbox a concurrency, nikoliv podle momentální módy.
* **Předčasný overengineering:** Odmítnutí distribuovaných systémů, Kafky a microservices ve prospěch čistého modulárního monolitu ušetřilo měsíce budoucí údržby.

---

### 4. Metodika ADR (Architecture Decision Records)

V okamžiku přechodu k technickým rozhodnutím (Step 15) jsme zavedli formální proces **ADR (Architecture Decision Records)**. Každé klíčové rozhodnutí bylo zaznamenáno v jednotném formátu:
1. **Status:** Approved / Deferred / Rejected
2. **Context:** Jaký problém řešíme a jaké jsou architektonické požadavky.
3. **Decision:** Co konkrétně jsme zvolili.
4. **Alternatives considered:** Jaké alternativy jsme posuzovali a proč jsme je odmítli.
5. **Reasons:** Hlavní technické a byznysové argumenty.
6. **Consequences:** Pozitivní i negativní dopady volby.
7. **Migration / Replacement impact:** Jak náročná by byla budoucí výměna.
8. **Relation to previous architecture steps:** Provázanost na konkrétní kroky Step 5–14.

**Význam pro projekt:** ADR brání nekonečným diskuzím o již vyřešených věcech, zabraňuje svévolné změně architektury bez vědomí souvislostí a uchovává kontext rozhodnutí pro budoucí vývojáře.

---

### 5. Technologická minimalizace a volba modulárního monolitu

Jedním z nejvýznamnějších architektonických rozhodnutí bylo **vědomé odmítnutí zbytečné infrastruktury**. Projekt Nástěnka je záměrně navržen jako:
* **Modulární monolit:** Jedna nasaditelná aplikace s přísně oddělenými vrstvami a doménovými moduly.
* **Jedna primární databáze (PostgreSQL 18):** Využívá plnou sílu relačního modelu, nativního fulltextu, JSONB a transakčního Outbox patternu.
* **Žádný externí Message Broker:** Žádná Kafka, RabbitMQ ani Redis ve verzi 1.
* **Žádný Kubernetes ani složitý multi-cloud:** Produkční provoz je postaven na reprodukovatelném a spolehlivém Docker Compose.

**Důvod:** Nižší provozní složitost, okamžitá lokální replikovatelnost vývojového prostředí a nulová potřeba složité síťové orchestrace při zachování čisté cesty pro budoucí škálování.

---

## Část II: Chronologický postup vzniku projektu Nástěnka (Fáze 1 až 4)

### 6. Fáze 1 – Vize a cíl projektu (`docs/010_Vize_a_cil.md`)

* **Co jsme řešili:** Definici základního smyslu aplikace, jejího určení a hranic.
* **Proč:** Bylo nutné zabránit tomu, aby se z Nástěnky stala další těžkopádná Jira, Asana nebo Trello.
* **Jak jsme postupovali:** Product Owner definoval potřebu jednoduchého týmového nástroje pro reálné provozy (prodejna, dílna, rodinný podnik), kde lidé potřebují okamžitě vidět, co je potřeba udělat, kdo na tom dělá a v jaké je to oblasti.
* **Co jsme rozhodli:**
  * Projekt je zaměřen na maximální přehlednost a rychlost.
  * Záměrně nepodporuje složité Ganttovy diagramy, složité schvalovací procesy ani fakturaci.
* **Výsledný dokument:** `docs/010_Vize_a_cil.md`.
* **Co následovalo:** Přechod k detailní specifikaci požadavků.

---

### 7. Fáze 2 – Požadavky na systém (`docs/020_Pozadavky.md`)

* **Co jsme řešili:** Rozpracování vize do konkrétních funkčních požadavků a identifikace otevřených otázek.
* **Proč:** Bylo nutné přesně pojmenovat objekty, operace a pravidla dříve, než se začnou modelovat.
* **Jak jsme postupovali:** Průběžné třídění bodů do dvou stavů: **Stav: POTVRZENO** a **Stav: K DISKUZI**. Diskutované otázky byly předkládány Product Ownerovi k závaznému rozhodnutí.
* **Klíčová rozhodnutí Fáze 2:**
  * **Entity:** Nástěnka (Board), Oblast (Area), Úkol (Task).
  * **Dualita úkolu:** Úkol se skládá z týmové části (název, oblast, priorita, termín, stavy, komentáře, týmové přílohy, historie) a soukromých osobních prostorů jednotlivých řešitelů.
  * **Přiřazení:** Právě 1 hlavní Řešitel + volitelně 0 až N Spoluřešitelů.
  * **Priorita:** Pouze dvě hodnoty: `○ Běžná` a `🔴 Spěchá`.
  * **WhatsApp notifikace:** Při vzniku libovolného nového úkolu se odešle WhatsApp notifikace všem členům dané Nástěnky bez ohledu na přiřazení. Ostatní notifikace odloženy.
* **Výsledný dokument:** `docs/020_Pozadavky.md` (postupně rozpracován do verze 0.9.0).
* **Co následovalo:** Převod požadavků do uceleného funkčního modelu.

---

### 8. Fáze 3 – Funkční model (`docs/030_Funkcni_model.md`)

* **Co jsme řešili:** Systémové vazby mezi entitami, životní cykly a stavové přechody bez vazby na technologii.
* **Proč:** Samotný seznam požadavků nestačí; je nutné vědět, jak systém reaguje na konkrétní akce a jak se mění stavy.
* **Jak jsme postupovali:** Sestavení 20 konkrétních funkčních scénářů pokrývajících kompletní životní cyklus:
  * Vytvoření úkolu, přiřazení a změna řešitele, převzetí úkolu, připojení a odebrání spoluřešitele.
  * Společná práce více lidí, práce v osobním prostoru, dokončení úkolu (`HOTOVO`), znovuotevření.
  * Archivace úkolu, obnova z archivu, řízené trvalé smazání úkolu.
  * Správa oblastí (vytvoření, přejmenování, pravidla pro smazání oblasti obsahující úkoly).
  * Práce s komentáři a přílohami, odchod člena z týmu.
* **Klíčové rozhodnutí Fáze 3:** Důsledné oddělení **Role na Nástěnce** (Owner, Správce, Běžný člen) od **Vztahu k úkolu** (Hlavní řešitel, Spoluřešitel). Běžný člen může být hlavním řešitelem úkolu; Owner nemusí mít k danému úkolu žádný řešitelský vztah.
* **Výsledný dokument:** `docs/030_Funkcni_model.md` (verze 0.3.0).
* **Co následovalo:** Ověření modelu na reálných scénářích lidského chování.

---

### 9. Fáze 4 – Uživatelské scénáře (`docs/040_Uzivatelske_scenare.md`)

* **Co jsme řešili:** Popis interakcí ze subjektivního pohledu reálných uživatelů (Alena, Milan, Adam).
* **Proč:** Funkční model popisuje systém; uživatelské scénáře ověřují ergonomii, srozumitelnost a přirozenost pracovního toku.
* **Jak jsme postupovali:** Rozpracování 14 detailních situací: první vstup do aplikace, orientace v rozcestníku, přepínání nástěnek, souběžná práce na mobilním telefonu a PC, řešení situace při odchodu kolegy z firmy.
* **Klíčové poznání Fáze 4:** Uživatelské scénáře odhalily potřebu jasného rozlišení mezi týmovými daty úkolu a soukromými poznámkami řešitele (osobní prostor nesmí po změně řešitele uniknout novému řešiteli).
* **Výsledný dokument:** `docs/040_Uzivatelske_scenare.md` (verze 0.3.0).
* **Co následovalo:** Přechod do hlavní architektonické etapy.

---

## Část III: Architektonická etapa – Budování `050_Architektura.md` (Step 5 až 15)

Dokument `docs/050_Architektura.md` byl budován iterativně v jednotlivých krocích. Každý krok představoval samostatný milník s vlastní verifikací a Git commitem.

```text
Step 5 (v0.3.0) ──► Step 6 (v0.4.0) ──► Step 7 (v0.5.0) ──► Step 8 (v0.6.0)
       │                   │                   │                   │
   Oprávnění          Datový model          Operace             Schéma
  a role Boardu         a vztahy           a logické API      a DB integrita
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
Step 9 (v0.7.0) ──► Step 10 (v0.8.0) ─► Step 11 (v0.9.0) ─► Step 12 (v1.0.0)
       │                   │                   │                   │
  Autentizace,        Doménové události,  Souběžný přístup,    Vyhledávání,
session & Actor       Outbox & notifikace OCC & idempotence   scope & filtrace
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
Step 13 (v1.1.0) ─► Step 14 (v1.2.0) ─► Step 15 (v1.3.0) ─► IMPLEMENTACE
       │                   │                   │
     UI/UX              Technické          Technologický
  architektura       vrstvy a monolit       stack & ADR
```

---

### 10. Step 5 – Oprávnění a bezpečnostní hranice

* **Co jsme řešili:** Definici autorizačních rolí, hierarchie a bezpečnostních mantinelů.
* **Proč:** Bez jasného bezpečnostního modelu hrozilo riziko neoprávněných zásahů do cizích nástěnek nebo ztráty kontroly nad týmem.
* **Jak jsme postupovali:**
  * Zavedení globální systémové role `ADMIN` (správa uživatelů a platformy).
  * Zavedení rolí vázaných na konkrétní Nástěnku: `OWNER`, `MANAGER` (Správce), `MEMBER` (Běžný člen).
  * Formulace kardinálních pravidel: Na každé Nástěnce existuje **právě jeden OWNER** a **maximálně jeden MANAGER**.
  * Návrh protokolu pro atomický převod vlastnictví Nástěnky (`Transfer Ownership`).
* **Klíčové pravidlo:** **Backend je výhradní bezpečnostní autorita.** Frontendové skrytí tlačítka slouží pouze pro UX. Veškerá oprávnění musí být autorizována na serveru.
* **Výsledek v architektuře:** Kapitola 5 a 24 v `docs/050_Architektura.md` (verze 0.3.0).

---

### 11. Step 6 – Datový model a vztahy

* **Co jsme řešili:** Logický entitní model, vztahy, cizí klíče a doménové invarianty.
* **Proč:** Bylo nutné vytvořit robustní datový základ, který odpovídá funkčnímu modelu a vylučuje neplatné stavy.
* **Jak jsme postupovali:**
  * Definice základních entit: `User`, `Board`, `Membership`, `Area`, `Task`, `TaskParticipant`.
  * Vyjasnění kardinalit: `Board` 1:N `Area`, `Board` 1:N `Task`, `Board` 1:N `Membership`.
  * `Task` 1:1 k hlavnímu řešiteli (`assignee_id`, nullable), `Task` 1:N k `TaskParticipant` (spoluřešitelé).
  * Striktní oddělení role na Nástěnce (`Membership.role`) od odpovědnosti za úkol.
* **Výsledek v architektuře:** Kapitola 6 a 25 v `docs/050_Architektura.md` (verze 0.4.0).

---

### 12. Step 7 – Doménové operace, API a autorizační hranice

* **Co jsme řešili:** Návrh logického API kontraktu a autorizační matice pro všechny doménové operace.
* **Proč:** API musí být stabilním kontraktem nezávislým na konkrétním frameworku; každá operace musí mít přesně definované vstupy, oprávnění, validační pravidla a auditní dopad.
* **Jak jsme postupovali:**
  * Zavedení konceptu **`ActorContext` vs. `Target`**: Každý požadavek nese identitu volajícího (`Actor`), která je na serveru porovnána s cílovým objektem a jeho kontextem.
  * Zpracování operací nad Boardem, členstvím, oblastmi a úkoly.
  * Vyřešení destruktivních operací: Definováno **řízené trvalé smazání úkolu (`DELETE_TASK`)** vyžadující explicitní potvrzení slovem `SMAZAT`, oprávnění a zápis do nezávislého `AuditLog`.
* **Výsledek v architektuře:** Kapitola 7 a 26 v `docs/050_Architektura.md` (verze 0.5.0).

---

### 13. Step 8 – Databázové schéma, constrainty a transakční pravidla

* **Co jsme řešili:** Fyzický návrh relačního schématu, primární/cizí klíče, integritní omezení a transakční hranice.
* **Proč:** Aplikační kód může obsahovat chyby; databáze musí být poslední nepřekročitelnou linií integrity dat.
* **Jak jsme postupovali:**
  * Princip: **Backend určuje KDO smí akci provést, Databáze garantuje CO je dovoleno uložit.**
  * Zavedení unikátních indexů a parciálních constraintů:
    * Právě jeden Owner na Board (`UNIQUE (board_id) WHERE role = 'OWNER'`).
    * Maximálně jeden Manager na Board (`UNIQUE (board_id) WHERE role = 'MANAGER'`).
    * Cross-board integrita: Úkol nesmí být přiřazen členovi jiné Nástěnky ani patřit do cizí oblasti.
  * Definice transakčních hranic a perzistence `AuditLog` tabulky.
* **Výsledek v architektuře:** Kapitola 27 v `docs/050_Architektura.md` (verze 0.6.0).

---

### 14. Step 9 – Autentizace, identity, session a životní cyklus přihlášení

* **Co jsme řešili:** Bezpečné ověření identity, správu session tokenů a izolaci autentizace od autorizace.
* **Proč:** Session nesmí nést zastaralá oprávnění; odepření přístupu nebo deaktivace účtu musí mít okamžitý účinek.
* **Jak jsme postupovali:**
  * Pipeline: `Authentication` → `Session` → `ActorContext` → `Authorization`.
  * Oddělení autentizační identity (přihlašovací údaje) od interního `User.id`.
  * Zvolena **server-side databázová session**: Klient drží pouze kryptograficky bezpečný Opaque Token v `HttpOnly; Secure; SameSite=Lax` cookie.
  * Oprávnění se neukládají do tokenu, ale dynamicky se načítají v `ActorContext` při každém requestu.
  * Zavedení okamžité revokace session při odhlášení, změně hesla nebo deaktivaci uživatele.
* **Výsledek v architektuře:** Kapitola 28 v `docs/050_Architektura.md` (verze 0.7.0).

---

### 15. Step 10 – Doménové události, notifikace a systémové reakce

* **Co jsme řešili:** Architekturu událostí, oddělení domény od vedlejších účinků a spolehlivé doručování notifikací.
* **Proč:** Přímé odesílání notifikací z HTTP requestu vede k pádům, zpožděním a ztrátě dat při výpadku sítě.
* **Jak jsme postupovali:**
  * Důsledné rozlišení tří pojmů:
    * **`Domain Event`:** Fakt o tom, co se stalo v doméně (např. `TaskCreated`). Vzniká až po úspěšném databázovém commitu.
    * **`AuditLog`:** Neměnný forenzní záznam o tom, kdo, kdy a co změnil.
    * **`Notification`:** Uživatelské sdělení konkrétnímu příjemci (např. WhatsApp zpráva).
  * Zavedení **Transactional Outbox patternu**: Událost je uložena do DB v téže transakci jako doménová entita. Asynchronní worker ji spolehlivě vyzvedne a odbaví (garance At-Least-Once).
* **Výsledek v architektuře:** Kapitola 29 v `docs/050_Architektura.md` (verze 0.8.0).

---

### 16. Step 11 – Současný přístup, konflikty změn, idempotence a konzistence

* **Co jsme řešili:** Řešení kolizí při souběžné práci více členů týmu nad stejnými daty.
* **Proč:** V týmové aplikaci nesmí dojít k tichému přepsání cizí práce (Last Write Wins je zakázán).
* **Jak jsme postupovali:**
  * Implementace **Optimistic Concurrency Control (OCC)** pomocí číselné verze (`version`) nebo časového razítka.
  * Využití standardních HTTP hlaviček: `If-Match: "<version>"`. Při neshodě vrací server `409 Conflict`.
  * Rozlišení pojmů: **Idempotence (`Idempotency-Key`) řeší bezpečné opakování síťového požadavku, Concurrency Control řeší ochranu před souběžnou editací.** Jde o dva různé mechanismy.
* **Výsledek v architektuře:** Kapitola 30 v `docs/050_Architektura.md` (verze 0.9.0).

---

### 17. Step 12 – Vyhledávání, filtrování, řazení a stránkování

* **Co jsme řešili:** Bezpečné a efektivní dotazování nad daty, prevenci úniku informací a výkonové limity.
* **Proč:** Vyhledávání nesmí uživateli vrátit úkoly z Nástěnky, jejímž není členem; neomezené dotazy vedou k pádu paměti.
* **Jak jsme postupovali:**
  * Zásada **Authorized Query Scope**: Autorizační filtr (`WHERE board_id IN (...)`) je aplikován přímo v databázovém SQL dotazu, nikoliv až filtrováním v aplikační paměti.
  * Zákaz N+1 dotazů: Důsledné využívání JOINů a agregací.
  * Deterministické stránkování (keyset/offset) se stabilním řazením (vždy doplněno o `id` pro jednoznačnost).
* **Výsledek v architektuře:** Kapitola 31 v `docs/050_Architektura.md` (verze 1.0.0).

---

### 18. Step 13 – UI/UX architektura, navigace a struktura obrazovek

* **Co jsme řešili:** Návrh informační architektury, rozvržení obrazovek a stavové chování rozhraní.
* **Proč:** Vývojáři potřebují jasný přehled komponent a obrazovek, aniž by museli improvizovat v průběhu kódování.
* **Jak jsme postupovali:**
  * Definice klíčových obrazovek: Rozcestník nástěnek, Detail Nástěnky s oblastmi, Detail úkolu (dialog/panel), Osobní prostor „Moje práce“, Správa členů.
  * Návrh stavového chování: Každá obrazovka musí explicitně řešit stavy `Loading`, `Empty`, `Error` a `Conflict (409)`.
  * Responzivní strategie: Desktop (vícesloupcový layout) vs. mobilní zařízení (jednosloupcový, dotykově optimalizovaný layout).
  * **Role-aware UI:** Tlačítka a akce se zobrazují podle oprávnění uživatele pro maximalizaci komfortu, s vědomím, že skutečná autorizace probíhá na serveru.
* **Výsledek v architektuře:** Kapitola 32 v `docs/050_Architektura.md` (verze 1.1.0).

---

### 19. Step 14 – Technická architektura aplikace, vrstvy a odpovědnosti

* **Co jsme řešili:** Dekompozici systému do vrstev, definici závislostí a pravidla pro testovatelnost.
* **Proč:** Bez striktních vrstev hrozí vznik chaotického kódu (spaghetti code), kde se UI míchá s SQL dotazy.
* **Jak jsme postupovali:**
  * Definice vrstev a toku závislostí:
    ```text
    Frontend (UI / React Server Components)
           ↓
    API / Transport Layer (Next.js Route Handlers / Validace)
           ↓
    Authentication & Authorization Policy Layer (ActorContext)
           ↓
    Application Service Layer (Use Cases, Transakce, Outbox)
           ↓
    Domain Layer (Entity, Value Objects, Doménová pravidla)
           ↓
    Repository & Persistence Layer (Drizzle ORM)
           ↓
    PostgreSQL Database
    ```
  * Izolace infrastruktury: Infrastrukturní služby (Outbox worker, Notifikace, Audit, Logger) implementují rozhraní definovaná v aplikační vrstvě.
  * Invariant čisté domény: Doménová vrstva nesmí záviset na frameworku, HTTP ani konkrétní databázi.
* **Výsledek v architektuře:** Kapitola 33 v `docs/050_Architektura.md` (verze 1.2.0).

---

### 20. Step 15 – Výběr technologického stacku a Architecture Decision Records (ADR)

* **Co jsme řešili:** Výběr konkrétních produkčních technologií na základě požadavků ze Step 5–14 a sepsání 27 ADR.
* **Proč:** Teprve v tomto okamžiku jsme měli kompletní specifikaci potřebnou pro zodpovědný výběr nástrojů.
* **Jak jsme postupovali:**
  * Vyhodnocení 18 kritérií (typová bezpečnost, podpora SSR, integrita PostgreSQL, otevřenost kódu, absence vendor lock-in, licenční čistota).
  * Vypracování **ADR-001 až ADR-027** pokrývajících všechny oblasti systému.
* **Schválený produkční stack (výběr klíčových ADR):**
  * **Full-stack framework:** Next.js 16.x (App Router, Server Components) – ADR-001.
  * **UI a styling:** Tailwind CSS v4 + Radix UI primitives (Shadcn pattern) – ADR-002.
  * **Jazyk a runtime:** TypeScript (Strict Mode) na Node.js 24 LTS – ADR-003, ADR-004.
  * **Databáze a ORM:** PostgreSQL 18.x + Drizzle ORM + Drizzle Kit migrace – ADR-005, ADR-006, ADR-012.
  * **Autentizace a session:** Better Auth + server-side DB session v HttpOnly cookie – ADR-007, ADR-008.
  * **Autorizace a API:** Vlastní doménová Policy vrstva + REST-like HTTP JSON API s validací přes Zod – ADR-009, ADR-010, ADR-011.
  * **Události a notifikace:** PostgreSQL Transactional Outbox + in-process worker + In-app notifikace – ADR-014, ADR-015, ADR-019.
  * **Komunikace:** Smart Polling v1 (WebSockets a SSE bezpečně odloženy) – ADR-013.
  * **Vyhledávání:** PostgreSQL FTS (`tsvector`) + `pg_trgm` (žádný externí vyhledávač) – ADR-016.
  * **Testování a kvalita:** Vitest + Playwright + ESLint 9 + Prettier + `tsc` – ADR-021, ADR-023.
  * **Deployment:** Self-hosted Docker Compose – ADR-024.
* **Výsledek v architektuře:** Kapitola 34 v `docs/050_Architektura.md` (verze 1.3.0).

---

## Část IV: Git workflow, identita a milníky projektu

### 21. Git workflow projektu Nástěnka

Projekt Nástěnka uplatňuje striktní a bezpečný Git proces, který zaručuje absolutní kontrolu vlastníka projektu nad vzdáleným repozitářem na GitHubu.

```text
               Změna dokumentace nebo kódu
                            ↓
                    git diff (kontrola změn)
                            ↓
               git diff --check (kontrola whitespace)
                            ↓
                    git status (kontrola stromu)
                            ↓
                    git add <konkrétní_soubory>
                            ↓
                    git commit -m "..." (lokální commit)
                            ↓
                          STOP!
                            ↓
      ┌──────────────────────────────────────────────────┐
      │  ANTIGRAVITY ZDE KONČÍ SVOU PRÁCI                │
      │  NIKDY NEPROVÁDÍ PUSH                            │
      └─────────────────────┬────────────────────────────┘
                            │
                            ▼
      ┌──────────────────────────────────────────────────┐
      │  VLASTNÍK PROJEKTU (RUČNĚ V POWERSHELLU):        │
      │  git push                                        │
      └──────────────────────────────────────────────────┘
```

#### Závazná pravidla pro Git:
1. **Antigravity smí provádět výhradně lokální operace:** `git status`, `git diff`, `git diff --check`, `git add`, `git commit` a kontrolní čtení historie (`git log`).
2. **Absolutní zákaz Git Push pro Antigravity:** Antigravity nesmí za žádných okolností spustit `git push`, `git push origin`, `git push --force` ani žádnou obdobnou variantu. Odeslání kódu na GitHub je výhradním právem člověka – vlastníka projektu.
3. **Každý architektonický krok má vlastní commit:** Žádné hromadné commity přes více fází. Každý krok Step 5 až Step 15 má v historii repozitáře svůj izolovaný, zpětně dohledatelný záznam.

---

### 22. Model Git identity a GitHub remote

Při vývoji projektu je nutné důsledně rozlišovat mezi dvěma oddělenými mechanismy:
* **Lokální Git identita autora commitu:** Jméno a e-mail zapsané v metadatech commitu. V projektu Nástěnka je v lokálním `.git/config` nakonfigurováno:
  ```text
  user.name  = AgoMilan
  user.email = sperkyaa@gmail.com
  ```
* **SSH klíč a autentizace vůči GitHubu:** Autentizační mechanismus pro přístup ke vzdálenému repozitáři:
  ```text
  remote.origin.url = git@github-agomilan:AgoMilan/Nastenka_App.git
  ```
Tato konfigurace zajišťuje, že commity jsou správně připsány autorovi a komunikace s GitHubem probíhá přes dedikovaný SSH profil bez kolizí s globálním nastavením vývojového stroje.

---

### 23. Přehled reálných Git milníků projektu

Skutečná historie lokálního Git repozitáře dokládá deterministický postup projektu od inicializace až po dokončení architektonické fáze:

```text
d7c2af5 chore: initial project setup
0e92792 docs: update architecture to v0.5.0  (Step 7 – Doménové operace a API)
b807e7a docs: update architecture to v0.6.0  (Step 8 – DB schéma a constrainty)
6847308 docs: update architecture to v0.7.0  (Step 9 – Autentizace a session)
0ed308d docs: update architecture to v0.8.0  (Step 10 – Doménové události a outbox)
618cbd4 docs: update architecture to v0.9.0  (Step 11 – Souběžný přístup a OCC)
c7b2577 docs: update architecture to v1.0.0  (Step 12 – Vyhledávání a stránkování)
20e6ea0 docs: update architecture to v1.1.0  (Step 13 – UI/UX architektura)
52c1017 docs: update architecture to v1.2.0  (Step 14 – Technické vrstvy monolitu)
f6f1b32 docs: select technology stack v1.3.0 (Step 15 – Výběr stacku a ADR-001 až ADR-027)
```

Tato historie představuje pevnou páteř projektu. Každý commit zachycuje ucelený myšlenkový blok schválený Product Ownerem.

---

## Část V: Dnešní stav a přechod do implementace

### 24. Dnešní stav projektu před implementací

K dnešnímu dni (19. 9. 2026) je **předimplementační a architektonická fáze projektu Nástěnka kompletně dokončena**.

Všechny klíčové oblasti jsou vyřešeny a písemně fixovány:
* **Požadavky a vize:** `010_Vize_a_cil.md` a `020_Pozadavky.md` (v0.9.0).
* **Funkční a uživatelský model:** `030_Funkcni_model.md` (v0.3.0) a `040_Uzivatelske_scenare.md` (v0.3.0).
* **Kompletní systémová architektura:** `050_Architektura.md` (v1.3.0, kapitoly 1 až 34).
* **Stav:** Všechny architektonické nejasnosti byly odstraněny. Projekt má ucelený datový model, bezpečnostní pravidla, transakční hranice, návrh rozhraní i schválený technologický stack.

Projekt je připraven k bezpečnému zahájení implementace bez rizika koncepčního tápání.

---

### 25. Roadmapa přechodu do implementace (15 navazujících kroků)

Následující seznam představuje strukturovaný plán postupu pro implementační fázi:

```text
Krok 1:  Uzavření a revize dokumentace (tato kuchařka v1.0.0)
Krok 2:  Ruční Git Push všech dosavadních 10 commitů vlastníkem projektu
Krok 3:  Příprava adresářové struktury projektu podle vrstev ze Step 14
Krok 4:  Bootstrap Next.js 16 aplikace s App Routerem a TypeScriptem (Strict Mode)
Krok 5:  Konfigurace vývojového prostředí, ESLint 9, Prettier a Zod validace .env proměnných
Krok 6:  Definice databázového schématu v Drizzle ORM a spuštění úvodní migrace v PostgreSQL 18
Krok 7:  Implementace Better Auth autentizace a server-side session managementu
Krok 8:  Implementace autorizační vrstvy (ActorContext a dedikované doménové Policies)
Krok 9:  Implementace doménového modulu Board a Membership (včetně správy rolí a transferu)
Krok 10: Implementace doménového modulu Area a Task (včetně OCC verzování a transakcí)
Krok 11: Implementace PostgreSQL Transactional Outbox workeru a In-app notifikací
Krok 12: Implementace vyhledávání (PostgreSQL FTS + pg_trgm) a autorizovaného stránkování
Krok 13: Implementace klientského UI (Tailwind CSS v4 + Radix UI, layouty, obrazovky, stavy)
Krok 14: Pokrytí systému unit a integračními testy (Vitest) a klíčových toků přes E2E (Playwright)
Krok 15: Konfigurace produkčního Docker Compose prostředí a GitHub Actions CI pipeline
```

---

## Část VI: Klíčové lekce z procesu (10 hlavních zásad)

Zkušenost z tvorby projektu Nástěnka přinesla deset univerzálních ponaučení pro vývoj software s pomocí AI:

1. **Neprogramovat příliš brzy:** Nejdříve musí být stoprocentně jasné CO a PROČ má systém dělat. Psát kód do nejasného zadání je nejrychlejší cesta k selhání projektu.
2. **Oddělit globální a kontextové role:** Uživatel může mít v systému roli `ADMIN`, ale na konkrétní Nástěnce být pouhým pozorovatelem nebo vůbec nebýt členem. Globální role nesmí automaticky splývat s kontextovým členstvím.
3. **Backend je jediná bezpečnostní autorita:** Zákaz kliknutí v UI nebo skrytí tlačítka je pouhá ergonomie rozhraní (UX). Skutečná bezpečnost existuje pouze tehdy, když server každý požadavek autorizuje proti čerstvým datům.
4. **AuditLog není totéž co technický aplikační log:** Aplikační logy (Pino) slouží pro ladění chyb a monitoring. Auditní log je právní a byznysová stopa o změnách dat, která musí přežít smazání samotného objektu.
5. **Domain Event není totéž co Notification:** Doménová událost je fakt o změně stavu systému (vzniká při commitu). Notifikace je zpráva doručená konkrétním lidem. Jedna událost může vyvolat nula, jednu nebo sto notifikací.
6. **Idempotence není Concurrency Control:** Idempotence chrání systém před vícenásobným zpracováním stejného požadavku při výpadku sítě (`Idempotency-Key`). Concurrency Control chrání před souběžnou editací dvou různých lidí (`If-Match` / `409 Conflict`).
7. **Technologie se vybírají až po architektuře:** Volit framework nebo databázi před znalostí datových vztahů a transakčních pravidel je technologická nezodpovědnost.
8. **Minimalismus je vědomé a těžké rozhodnutí:** Je snadné podlehnout trendům a nasadit microservices, Kubernetes a Kafku. Skutečné inženýrské umění spočívá v tom postavit spolehlivý systém na modulárním monolitu a jedné robustní PostgreSQL databázi.
9. **Git checkpointy chrání postup práce:** Dělat lokální commit po každém logickém architektonickém kroku dává týmu jistotu, že se lze kdykoliv bezpečně vrátit k ověřenému stavu.
10. **Push zůstává pod absolutní kontrolou člověka:** Automatizovaný agent může připravit, zkontrolovat a lokálně commitovat práci, ale odeslání do světa na GitHub musí zůstat vědomým úkonem vlastníka projektu.

---

## Část VII: Historie verzí dokumentu

| Verze | Datum | Stav | Popis provedených změn | Autor |
| :--- | :--- | :--- | :--- | :--- |
| **0.1.0** | 19. 9. 2026 | Pracovní návrh | Původní pracovní verze obecné metodiky vzniku projektu s AI od vize přes požadavky až k přípravě implementace. | Product Owner / AI |
| **1.0.0** | 19. 9. 2026 | Schváleno | Kompletní transformace na praktickou kuchařku a chronologického průvodce projektu Nástěnka. Zdokumentován triádový model spolupráce (Člověk + ChatGPT + Antigravity), princip „neprogramovat příliš brzy“, detailní chronologie všech etap (Požadavky, Funkční model, Scénáře, Architektura Step 5–15 včetně 27 ADR), přísná pravidla pro Git workflow a identitu, milníky commitů, 10 klíčových lekcí a 15kroková implementační roadmapa. | Product Owner / Antigravity |

---

## Závěrečný princip metodiky

> **„Nejdříve rozumět problému. Potom definovat chování. Potom navrhnout systém. Potom vybrat technologie. A až nakonec programovat.“**

Tento postup zaručuje, že softwarový projekt má od prvního dne pevné základy, je odolný vůči chybám a plně připravený pro dlouhodobý a udržitelný rozvoj.
