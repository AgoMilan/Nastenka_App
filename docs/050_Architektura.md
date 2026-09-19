# Architektura aplikace Nástěnka

**Typ dokumentu:** Logická architektura a doménový model systému<br>
**Stav:** Schválená architektura<br>
**Verze:** 1.0.0<br>
**Vychází z:** `docs/020_Pozadavky.md` (v0.9.0), `docs/030_Funkcni_model.md` (v0.3.0) a `docs/040_Uzivatelske_scenare.md` (v0.3.0)<br>
**Datum:** 19. 9. 2026

---

## 1. Účel dokumentu

Tento dokument definuje **logickou architekturu systému Nástěnka, jeho hlavní komponenty a vztahy mezi klíčovými doménovými objekty**.

Dokument je záměrně **technologicky neutrální**:
* popisuje logické vazby, toky dat, doménové entity, pravidla vlastnictví a bezpečnostní hranice,
* **nespecifikuje** konkrétní databázový engine, relační/nerelační tabulky, REST/GraphQL endpointy, programovací jazyky, frameworky, hostingové platformy, Docker kontejnery, WhatsApp providery ani konkrétní souborová úložiště.

Slouží jako závazný koncepční rámec pro budoucí technický návrh a implementaci.

---

## 2. Architektonické principy

Systém Nástěnka je postaven na šesti základních architektonických principech:

1. **Jednoduchost a přehlednost (Anti-Jira princip)**
   * Aplikace není robustním a složitým projektovým monstrem.
   * Maximální přehlednost a čistota mají vždy přednost před množstvím funkcí a konfiguračních voleb.
   * Hlavní obrazovka zobrazuje především přehled oblastí a jejich stručný stav; detailní informace se zobrazují až po otevření konkrétního objektu.

2. **Oddělení týmového a osobního prostoru**
   * Týmová část úkolu je společná pro všechny členy dané Nástěnky.
   * Osobní pracovní prostor je striktně soukromý a patří výhradně konkrétnímu uživateli.

3. **Přísná izolace jednotlivých Nástěnek**
   * Každá Nástěnka představuje samostatný, nezávislý týmový prostor.
   * Členství, role a oprávnění platí vždy výhradně v kontextu konkrétní Nástěnky a nepřestupují mezi nimi.

4. **Kontextové vyhodnocování oprávnění a model rolí**
   * Důsledně se oddělují úrovně:
     * **Globální systémová role:** `ADMIN` (systémová a administrativní pojistka pro celou aplikaci, nezávislá na členství v konkrétní Nástěnce).
     * **Role uživatele v rámci konkrétní Nástěnky:** `OWNER` (právě jeden vlastník), `MANAGER` (maximálně jeden provozní správce), `MEMBER` (běžný člen).
     * **Vztah uživatele ke konkrétnímu úkolu:** Hlavní Řešitel, Spoluřešitel.
   * Řešitel a Spoluřešitel nejsou rolemi na Nástěnce, ale konkrétní vazbou na daný úkol.
   * Role na Nástěnce nezakládá automatickou řešitelskou odpovědnost za úkoly.

5. **Responzivní webové rozhraní**
   * Aplikace je navržena pro bezproblémové použití na PC, notebooku, tabletu i v mobilním prohlížeči.
   * Všechny klíčové operace musí být ergonomicky proveditelné i z mobilního telefonu v terénu.

6. **UI není bezpečnostní hranice (Backend je autorita)**
   * Pouhé skrytí tlačítka či jeho deaktivace v uživatelském rozhraní nepředstavuje zabezpečení.
   * Každá změna dat, stavu, převodu vlastnictví nebo přiřazení rolí musí být autorizována a validována výhradně aplikační logikou na backendu nezávisle na rozhraní.

---

## 3. Hlavní logické části systému

Systém se skládá ze tří vrstev základního toku a tří podpůrných služeb:

```text
┌────────────────────────────────────────────────────────┐
│               1. Uživatelské rozhraní (UI)             │
│            (Responzivní web: PC / Tablet / Mobil)      │
└───────────────────────────┬────────────────────────────┘
                            │ požadavky uživatele
                            ▼
┌────────────────────────────────────────────────────────┐
│                 2. Aplikační logika                    │
│   (Řízení domény, autorizace, validace, stavový model) │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐   ┌─────────────────┐   ┌───────────────┐
│  3. Datová   │   │  4. Souborové   │   │5. Notifikační │
│    vrstva    │   │     úložiště    │   │    služba     │
│ (Entity, stav│   │(Týmové přílohy, │   │(v1: WhatsApp  │
│ a historie)  │   │  osobní data)   │   │ na nový úkol) │
└──────────────┘   └─────────────────┘   └───────────────┘
       ▲
       │
┌──────┴─────────────────────────────────────────────────┐
│        6. Autentizace a správa identit uživatelů       │
└────────────────────────────────────────────────────────┘
```

### 1. Uživatelské rozhraní (UI)
Zajišťuje zobrazení přehledu oblastí, detailu úkolů, diskuze, příloh i osobního dashboardu *„Moje úkoly“*. Zajišťuje ergonomii a čisté zobrazení na všech typech zařízení.

### 2. Aplikační logika
Centrální mozek systému. Přijímá akce z UI, striktně ověřuje oprávnění uživatele (na základě jeho role na Nástěnce a vztahu k úkolu), provádí stavové přechody, spouští auditní zápisy a řídí odesílání notifikací.

### 3. Datová vrstva
Zodpovídá za perzistenci a integritu doménových objektů, jejich relací, stavů úkolů, komentářů a chronologické historie změn.

### 4. Souborové úložiště
Logická komponenta spravující binární soubory (fotografie, technické PDF, faktury apod.). Fyzicky i logicky zajišťuje oddělení sdílených týmových příloh od soukromých souborů osobního prostoru.

### 5. Notifikační služba
Podpůrná komponenta reagující na doménové události. Pro 1. verzi zajišťuje doručení notifikace prostřednictvím WhatsApp všem členům dané Nástěnky při vzniku nového úkolu.

### 6. Autentizace a správa uživatelů
Zajišťuje bezpečné ověření identity přihlašujícího se uživatele a poskytuje aplikační logice ověřenou identitu pro autorizační kontroly.

---

## 4. Hlavní doménové objekty

Logický model definuje tyto základní doménové entity:

* **Uživatel (User):** Fyzická osoba vystupující v systému pod svou identitou. Může být členem jedné nebo více Nástěnek.
* **Globální role (Global Role – ADMIN):** Systémová role nezávislá na členství v konkrétní Nástěnce. Slouží jako bezpečnostní a administrativní pojistka pro celou aplikaci.
* **Nástěnka (Board):** Samostatný ohraničený pracovní a týmový prostor.
  * Uživatel, který Nástěnku založí, se **automaticky stává jejím OWNER**.
  * Každá Nástěnka má v každém okamžiku **právě jednoho OWNER**.
  * Každá Nástěnka může mít **maximálně jednoho MANAGER (0..1)**.
* **Členství a role na Nástěnce (Membership):** Vazební entita propojující Uživatele s konkrétní Nástěnkou. Definuje roli uživatele v rámci dané Nástěnky:
  * `OWNER` (Vlastník): právě jeden na Nástěnce, plné vlastnictví a správa.
  * `MANAGER` (Správce): maximálně jeden na Nástěnce (0..1), provozní správce Nástěnky.
  * `MEMBER` (Člen): běžný člen Nástěnky.
* **Oblast (Area):** Tematický, prostorový nebo organizační okruh na Nástěnce (např. *Sklad*, *Prodejna*, *Dílna*), který sdružuje úkoly.
* **Úkol (Task):** Základní pracovní jednotka patřící právě jedné Nástěnce a právě jedné Oblasti. Má jednoznačného autora (`created_by`) a volitelného odpovědného řešitele (`assignee_id`).
* **Hlavní Řešitel (Main Solver / Assignee):** Vztah uživatele k úkolu (0..1). Člen týmu nesoucí hlavní zodpovědnost za splnění úkolu (`Task.assignee_id`). Musí mít platné Membership ke stejné Nástěnce.
* **Účastník / Spoluřešitel úkolu (TaskParticipant):** Vazební entita propojující Úkol s Uživatelem (0..N) s rolí na úkolu (např. `CO_SOLVER`). Zajišťuje flexibilní evidenci více spoluřešitelů bez pevných polí v tabulce úkolu. Účastník musí mít platné Membership ke stejné Nástěnce.
* **Komentář (Comment):** Záznam v chronologické diskuzi úkolu. Má autora, čas vzniku a text. Patří do týmové části úkolu.
* **Týmová příloha (Team Attachment):** Soubor přiložený k úkolu (foto, dokument, PDF). Je společným majetkem Nástěnky v rámci úkolu.
* **Osobní pracovní prostor (Personal Workspace):** Soukromý prostor daného člena navázaný na konkrétní úkol. Slouží pro vlastní poznámky a mezikroky.
* **Stav úkolu (Task State):** Aktuální fáze životního cyklu úkolu (`NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`, `HOTOVO`, `ARCHIVOVÁNO`).
* **Priorita (Priority):** Úroveň naléhavosti úkolu s přesně 2 hodnotami: `○ Běžná` a `🔴 Spěchá`.
* **Termín (Due Date):** Volitelný cílový datum splnění úkolu.
* **Historie změn (Audit Log):** Neměnný chronologický záznam klíčových operací nad úkolem (změna řešitele, změna stavu, změna priority, změna termínu) a citlivých bezpečnostních/správních operací Nástěnky (převod vlastnictví, změna Managera, změna rolí, přidání/odebrání členů, zásahy Admina).
* **Archiv (Archive):** Logický stav a prostor pro dlouhodobé uložení dokončených úkolů mimo aktivní plochu Nástěnky. Slouží pouze k prohlížení.

---

## 5. Vztahy mezi hlavními objekty

Logická hierarchie a kardinality entit:

```text
GLOBÁLNÍ SYSTÉMOVÁ ROLE: ADMIN
   │ (administrativní a bezpečnostní dohled, nezávislý na členství)
   ▼
UŽIVATEL
   ↕ (1..N)
ČLENSTVÍ (Role na Nástěnce: právě 1 OWNER | 0..1 MANAGER | 0..N MEMBER)
   ↕ (1..N)
NÁSTĚNKA
   ├── OBLAST (1..N)
   │    └── ÚKOL (0..N)
   │         ├── Hlavní Řešitel (0..1)
   │         ├── Spoluřešitelé (0..N)
   │         ├── Komentáře (0..N)
   │         ├── Týmové přílohy (0..N)
   │         ├── Historie změn (1..N)
   │         └── Osobní pracovní prostory jednotlivých členů (0..N)
   └── ČLENOVÉ (1..N)
```

### Klíčová pravidla vazeb u úkolu
1. **Úkol patří právě jedné Nástěnce a právě jedné Oblasti.**
2. **Jeden úkol může mít maximálně jednoho hlavního Řešitele (0..1):**
   * Pokud řešitele nemá, je ve stavu `Nepřiřazeno`.
3. **Úkol může mít 0 až N Spoluřešitelů:**
   * **Podmínka existence:** Spoluřešitel může existovat **pouze tehdy, má-li úkol Hlavního Řešitele**.
   * U úkolu ve stavu `Nepřiřazeno` nemůže Spoluřešitel existovat.
   * Závazné pravidlo: **Nesmí nikdy vzniknout stav `Řešitel: nikdo + Spoluřešitel: někdo`**.
4. **Vztah Hlavního Řešitele a Spoluřešitele:**
   * Hlavní Řešitel může odebrat Spoluřešitele z úkolu (`Hlavní Řešitel → může odebrat → Spoluřešitele`).
   * Odebraný člen není zablokován; pokud má úkol nadále Hlavního Řešitele, může se v budoucnu znovu dobrovolně připojit přes `+ Připojit se k úkolu`.

---

## 6. Vlastnictví dat a přístup

Architektura striktně dodržuje zásadu:

> **Vlastnictví dat ≠ Oprávnění k manipulaci s daty.**

* **Týmový obsah Nástěnky:**
  * Úkol, jeho popis, týmové komentáře, přílohy i historie jsou majetkem celé Nástěnky (týmu), nikoliv osobním vlastnictvím autora, který úkol založil nebo komentář napsal.
  * Týmový obsah zůstává na Nástěnce i při odchodu autora nebo řešitele.
* **Soukromý osobní prostor:**
  * Osobní pracovní prostor patří konkrétnímu uživateli.
  * Žádný jiný člen (ani hlavní řešitel, ani MANAGER, OWNER či ADMIN) nemá k tomuto prostoru přístup ani oprávnění k nahlížení.
  * Při změně hlavního řešitele se osobní pracovní prostor původního řešitele **nepřenáší** na nového řešitele.
  * Každý člen týmu má k danému úkolu svůj vlastní, zcela oddělený osobní prostor.

---

## 7. Základní oprávnění

Oprávnění k operacím s úkolem jsou odvozena ze vztahu uživatele k danému úkolu a členství v Nástěnce.

### Souhrnná matice operací a oprávnění

| Operace | Běžný člen | Hlavní Řešitel | Spoluřešitel |
|---|---:|---:|---:|
| Přidělit úkol jinému členovi | ANO | ANO | ANO |
| Změnit na Nepřiřazeno | ANO | ANO | ANO |
| Připojit se jako Spoluřešitel | ANO* | ANO* | — |
| Odpojit se jako Spoluřešitel | — | — | ANO |
| Odebrat Spoluřešitele | NE | **ANO** | NE |

`*` *Pouze pokud má úkol Hlavního Řešitele.*

---

### 1. Běžný člen Nástěnky (bez vazby na řešení daného úkolu)
* **Může:**
  * zobrazit úkol a jeho týmový obsah,
  * vytvořit nový úkol,
  * upravit popis úkolu,
  * přidělit úkol kterémukoli jinému členovi dané Nástěnky (nastavit či změnit Hlavního Řešitele),
  * změnit přiřazení úkolu na `Nepřiřazeno`,
  * převzít Nepřiřazený úkol na sebe (stát se Hlavním Řešitelem),
  * převzít úkol od jiného Řešitele na sebe,
  * změnit prioritu úkolu (`○ Běžná` ↔ `🔴 Spěchá`),
  * přidat komentář do diskuze,
  * upravit nebo smazat **výhradně svůj vlastní komentář**,
  * nahrávat a stahovat týmové přílohy,
  * připojit se k úkolu jako Spoluřešitel (pokud úkol již má Hlavního Řešitele).
* **Nemůže (z pozice běžného člena):**
  * měnit stav úkolu,
  * přesunout úkol do jiné oblasti,
  * měnit či nastavit termín úkolu,
  * archivovat úkol,
  * odebrat Spoluřešitele z úkolu,
  * trvale smazat úkol,
  * spravovat strukturu oblastí Nástěnky.

### 2. Hlavní Řešitel úkolu
Má veškerá práva běžného člena a navíc výhradní operativní a koordinační pravomoci:
* měnit stav úkolu (volné přechody),
* měnit oblast úkolu (přesunout do jiné oblasti),
* měnit či nastavit termín úkolu,
* ručně archivovat úkol,
* **odebrat Spoluřešitele z úkolu** (uživatel je odebrán ze seznamu Spoluřešitelů; není blokován a může se v budoucnu znovu připojit přes `+ Připojit se k úkolu`),
* definitivně smazat úkol (vyžaduje zadat `SMAZAT`).

### 3. Spoluřešitel úkolu
Má **shodná operativní práva jako Hlavní Řešitel**:
* měnit stav úkolu,
* měnit oblast úkolu,
* měnit termín úkolu,
* ručně archivovat úkol,
* definitivně smazat úkol (vyžaduje zadat `SMAZAT`),
* odpojit se z vlastní vůle z pozice Spoluřešitele (`− Odpojit se od úkolu`),
* pracovat se všemi běžnými členskými funkcemi.

**Omezení Spoluřešitele:**
* **Nemůže odebrat jiného Spoluřešitele** (právo odebrat Spoluřešitele má výhradně Hlavní Řešitel).

**Rozdíl mezi Hlavním Řešitelem a Spoluřešitelem je v koordinační odpovědnosti:**
* Hlavní Řešitel = primární nositel zodpovědnosti za úkol, oprávněný spravovat tým Spoluřešitelů (odebrat Spoluřešitele).
* Spoluřešitel = spolupracující člen týmu s plnými pracovními a operativními právy k úkolu, který však nemůže zasahovat do účasti ostatních Spoluřešitelů.

---

## 8. Krok 5 – Oprávnění a bezpečnostní hranice

Tato kapitola definuje závazný model uživatelských rolí, bezpečnostní hranice a pravidla autorizace na úrovni celého systému a jednotlivých Nástěnek.

### 8.1 Schválený model rolí

Systém rozlišuje dvě striktně oddělené úrovně oprávnění:

1. **Globální systémová role:**
   * `ADMIN` – systémová role existující na úrovni celé aplikace nezávisle na konkrétní Nástěnce.

2. **Role v rámci konkrétní Nástěnky:**
   * `OWNER` (Vlastník)
   * `MANAGER` (Provozní správce)
   * `MEMBER` (Běžný člen)

> [!IMPORTANT]
> `ADMIN` je globální systémová role. `OWNER`, `MANAGER` a `MEMBER` jsou role uživatele výhradně v rámci konkrétní Nástěnky. Uživatel může mít v různých Nástěnkách různé role.

---

### 8.2 OWNER (Vlastník Nástěnky)

Každá Nástěnka má v každém okamžiku **právě jednoho `OWNER`**.

* **Vznik role:** Uživatel, který Nástěnku vytvoří, se automaticky stává jejím `OWNER`.
* **Práva a pravomoci:**
  * zobrazovat Nástěnku a veškerý její obsah,
  * upravovat nastavení Nástěnky,
  * přidávat nové členy do Nástěnky,
  * odebírat členy z Nástěnky,
  * měnit role ostatních členů (`MEMBER` ↔ `MANAGER`),
  * určit nebo změnit `MANAGER`,
  * převést vlastnictví Nástěnky na jiného člena (`současný OWNER → nový OWNER`),
  * smazat celou Nástěnku (s bezpečnostním potvrzením vepsáním textu `SMAZAT`),
  * spravovat obsah Nástěnky (oblasti, úkoly) podle běžných pravidel aplikace.
* **Bezpečnostní omezení:**
  * Owner **nesmí vytvořit druhého Ownera**. V každém okamžiku existuje pouze a právě jeden Owner.
  * Owner nemůže vlastnictví jednoduše „smazat“ nebo se jej vzdát bez předchozího převodu na jiného člena (viz pravidlo 8.8.4).

---

### 8.3 Převod vlastnictví (Transfer of Ownership)

Převod vlastnictví je explicitní, atomická a bezpečnostně chráněná operace:

`současný OWNER → nový OWNER`

#### Pravidla převodu vlastnictví:
1. **Podmínka členství cílového uživatele:** Nový Owner musí být uživatelem, který je již členem dané Nástěnky. Pokud cílový uživatel dosud není členem, musí být nejprve do Nástěnky přidán jako člen.
2. **Atomicita operace:** Převod vlastnictví musí proběhnout jako nedílná (atomická) transakce. Systém **nesmí nikdy připustit nekonzistentní stav**:
   * stav, kdy by Nástěnka měla dva Ownery,
   * stav, kdy by Nástěnka neměla žádného Ownera.
3. **Stav po úspěšném převodu:**
   * Cílový uživatel okamžitě získá roli `OWNER`.
   * Původní Owner ztrácí vlastnictví Nástěnky.
4. **Pravidlo pro původního Ownera:**
   * Původní Owner zůstává na Nástěnce v roli `MANAGER`, pokud je tato pozice volná (na Nástěnce zatím není jiný Manager).
   * Pokud již na Nástěnce jiný `MANAGER` existuje, původní Owner se stává řadovým členem s rolí `MEMBER` (je striktně dodržen limit maximálně 1 Managera na Nástěnku).
5. **Uživatelské potvrzení:** Převod vlastnictví je nevratná citlivá operace a musí v uživatelském rozhraní vyžadovat explicitní potvrzení uživatele.

---

### 8.4 MANAGER (Provozní správce Nástěnky)

Na jedné Nástěnce může být **maximálně jeden `MANAGER`** (kardinalita 0..1).

Manager vystupuje jako provozní správce konkrétní Nástěnky:

* **Může:**
  * zobrazovat Nástěnku a její obsah,
  * spravovat běžný provozní obsah Nástěnky (vytvářet a upravovat oblasti, smazat oblast s pojistkou `SMAZAT`),
  * spravovat úkoly v plném rozsahu běžných pravidel projektu,
  * přidávat nové členy do Nástěnky,
  * odebírat členy z Nástěnky,
  * provádět povolené organizační změny Nástěnky.
* **Nesmí:**
  * změnit Ownera,
  * převést vlastnictví Nástěnky,
  * vytvořit druhého Managera,
  * povýšit sám sebe na Ownera,
  * měnit role ostatních členů (`MEMBER` / `MANAGER`),
  * smazat celou Nástěnku (smazání Nástěnky je vyhrazeno pro ADMIN a OWNER),
  * jakkoli obejít bezpečnostní pravidla prostřednictvím UI nebo API.

---

### 8.5 MEMBER (Běžný člen Nástěnky)

`MEMBER` představuje řadového člena týmu dané Nástěnky:

* **Může (podle běžných pravidel aplikace):**
  * zobrazovat Nástěnku a její týmový obsah,
  * vytvářet nové úkoly,
  * přidělovat úkoly kterémukoli členovi Nástěnky nebo nastavit úkol do `Nepřiřazeno`,
  * převzít odpovědnost za úkol (stát se Hlavním Řešitelem),
  * upravovat úkoly, ke kterým má operativní oprávnění (z pozice Řešitele/Spoluřešitele měnit stav, termín, oblast apod.),
  * pracovat se svými úkoly a komentovat diskuzi,
  * plně využívat svůj soukromý osobní pracovní prostor.
* **Nesmí:**
  * měnit Ownera ani Managera,
  * převádět vlastnictví Nástěnky,
  * měnit role ostatních uživatelů,
  * přidávat nebo odebírat členy Nástěnky (pokud k tomu nemá explicitní oprávnění definované jinou částí systému),
  * spravovat globální strukturu a nastavení Nástěnky.

---

### 8.6 ADMIN (Globální systémová role)

`ADMIN` je globální systémová role nezávislá na členství v konkrétní Nástěnce:

* **Charakteristika:**
  * Admin má globální oprávnění pro celou aplikaci.
  * **Nemusí být členem Nástěnky**, aby mohl provést administrativní či bezpečnostní zásah.
  * Představuje bezpečnostní a administrativní pojistku systému pro řešení nestandardních, havarijních a zablokovaných stavů.
* **Pravomoci:**
  * vytvářet nové Nástěnky,
  * upravovat libovolnou Nástěnku,
  * mazat libovolnou Nástěnku,
  * zobrazovat a kontrolovat libovolnou Nástěnku v systému,
  * přidávat a odebírat členy na libovolné Nástěnce,
  * měnit role uživatelů na Nástěnce,
  * určit či změnit Managera,
  * direktivně změnit Ownera Nástěnky (např. při opuštěné Nástěnce či zablokovaném účtu),
  * převzít administrativní správu Nástěnky,
  * řešit zablokované nebo nekonzistentní stavy.

---

### 8.7 Souhrnný přehled oprávnění

Následující matice definuje autorizaci operací podle rolí v systému:

| Operace | ADMIN | OWNER | MANAGER | MEMBER |
|---|---:|---:|---:|---:|
| **Zobrazit nástěnku** | ANO | ANO | ANO | ANO |
| **Vytvořit nástěnku** | ANO | ANO | NE | NE |
| **Upravit nástěnku** | ANO | ANO | ANO* | NE |
| **Smazat nástěnku** | ANO | ANO | NE | NE |
| **Přidat člena** | ANO | ANO | ANO | NE |
| **Odebrat člena** | ANO | ANO | ANO | NE |
| **Změnit roli MEMBER/MANAGER** | ANO | ANO | NE | NE |
| **Změnit MANAGER** | ANO | ANO | NE | NE |
| **Převést OWNERA** | ANO | ANO | NE | NE |
| **Změnit OWNERA** | ANO | NE | NE | NE |
| **Spravovat úkoly** | ANO | ANO | ANO | ANO* |

#### Poznámky k matici oprávnění:
* `Upravit nástěnku (MANAGER = ANO*)`: Manager může provádět provozní organizační úpravy Nástěnky (vytvářet a upravovat oblasti, provozní konfiguraci), nesmí však celou Nástěnku smazat ani měnit její vlastnictví či role členů.
* `Změnit OWNERA vs. Převést OWNERA`: Owner může své vlastnictví iniciativně *převést* na jiného člena (`Převést OWNERA = ANO`), nemůže však direktivně změnit Ownera bez předání vlastního mandátu. Pouze globální `ADMIN` má pravomoc *direktivně dosadit/změnit* Ownera z titulu systémového dohledu (`Změnit OWNERA = ANO`).
* `Spravovat úkoly (MEMBER = ANO*)`: Řídí se detailními operativními pravidly úkolu (viz kapitola 7). Member může úkoly vytvářet, delegovat kterémukoli členovi Nástěnky, nastavovat do Nepřiřazeno, přebírat a komentovat. Operativní změny stavu, termínu, oblasti a trvalé mazání úkolu provádí výhradně Řešitel nebo Spoluřešitel daného úkolu.

---

### 8.8 Bezpečnostní hranice systému

Bezpečnostní architektura je postavena na šesti striktních pravidlech:

#### 8.8.1 Backend je autorita
* Uživatelské rozhraní (frontend) slouží výhradně k ergonomické prezentaci – zobrazuje či skrývá ovládací prvky podle role.
* **UI nepředstavuje bezpečnostní hranici.**
* Skutečné oprávnění k jakékoliv operaci musí být autorizováno a validováno výhradně na backendu (v aplikační logice).
* Nelze spoléhat na skrytí tlačítka, deaktivaci prvku v HTML ani na hodnotu role zaslanou klientem.

#### 8.8.2 Právě jeden Owner
* Datový model i aplikační logika garantují invariant: **každá Nástěnka má v každém okamžiku právě jednoho Ownera**.
* Nesmí nikdy vzniknout stav se dvěma Ownery ani stav bez Ownera.

#### 8.8.3 Právě jeden Manager
* Nástěnka může mít **maximálně jednoho Managera (0..1)**.
* Pokus o jmenování druhého Managera musí systém odmítnout, pokud nebyl stávající Manager nejprve odvolán nebo převeden na roli `MEMBER`.

#### 8.8.4 Nástěnka nesmí zůstat bez Ownera
* Operace typu `DELETE OWNER` nebo přímé odstranění role bez náhrady **není povolena**.
* Nelze zrušit členství aktuálního Ownera na Nástěnce, aniž by nejprve proběhl řádný převod vlastnictví:
  `OWNER A → OWNER B`
  Teprve po úspěšném převodu může původní uživatel Nástěnku opustit nebo ztratit vlastnictví.

#### 8.8.5 Owner může převést vlastnictví
* Pouze **současný Owner** nebo **globální Admin** může iniciovat a provést převod vlastnictví Nástěnky.
* Manager ani Member tuto operaci provést nemohou.

#### 8.8.6 Admin může zasáhnout
* Globální Admin má technickou a administrativní pravomoc vyřešit krizové a nestandardní situace:
  * nedostupný nebo dlouhodobě neaktivní Owner,
  * ztracený či zrušený účet Ownera,
  * chybná konfigurace Nástěnky,
  * zablokovaná Nástěnka,
  * administrativní spory s členstvím či rolí.
* Každý zásah Admina musí být povinně a nezaměnitelně auditován v systémovém logu.

---

### 8.9 Auditní stopa bezpečnostních a správních operací

Veškeré citlivé a správní operace nad Nástěnkou musí být auditovány v neměnné auditní stopě:

* **Povinně auditované operace:**
  * převod vlastnictví Nástěnky (`TRANSFER_OWNERSHIP`),
  * jmenování nebo změna Managera (`CHANGE_MANAGER`),
  * změna rolí členů (`CHANGE_ROLE`),
  * přidání nového člena (`ADD_MEMBER`),
  * odebrání člena z Nástěnky (`REMOVE_MEMBER`),
  * smazání Nástěnky (`DELETE_BOARD`),
  * administrativní a bezpečnostní zásah globálního Admina (`ADMIN_INTERVENTION`).
* **Minimální obsah auditního záznamu:**
  * **Kdo:** jednoznačná identifikace uživatele, který operaci vyvolal (iniciátor),
  * **Co:** typ operace (např. `TRANSFER_OWNERSHIP`),
  * **Kdy:** přesné systémové časové razítko (timestamp),
  * **Kde:** identifikace Nástěnky,
  * **Předchozí stav:** hodnota atributu před změnou (např. původní Owner),
  * **Nový stav:** hodnota atributu po provedení změny (např. nový Owner).

*Příklad auditního záznamu převodu vlastnictví:*
```text
Událost: TRANSFER_OWNERSHIP
Nástěnka: ID 101 ("Centrální provoz")
Původní Owner: Milan (User ID: 1)
Nový Owner: Adam (User ID: 2)
Původní Owner převeden na: MANAGER
Iniciátor operace: Milan (User ID: 1)
Časové razítko: 2026-09-19T16:00:00Z
```

---

### 8.10 Oddělení rolí na Nástěnce od řešitelství úkolů

Architektura striktně prosazuje oddělení správních rolí od operativního řešení:

> **Role uživatele na Nástěnce ≠ Odpovědnost za konkrétní úkol.**

* `Milan = OWNER nástěnky` neznamená, že Milan je automaticky řešitelem všech nebo jakéhokoli úkolu.
* Každý úkol má svou vlastní autonomní řešitelskou vrstvu:
  * **Role na Nástěnce:** `ADMIN`, `OWNER`, `MANAGER`, `MEMBER`.
  * **Atributy a vztahy k úkolu:** autor úkolu (creator), Hlavní Řešitel (assignee: 0..1), Spoluřešitelé (co-solvers: 0..N), případně stav `Nepřiřazeno`.

#### Závazné anti-implicitní pravidlo
V systému **nesmí existovat žádná implicitní automatická logika**:
1. Owner **neřeší automaticky** úkoly na Nástěnce.
2. Manager **neřeší automaticky** úkoly na Nástěnce.
3. Admin **nepatří automaticky do všech Nástěnek** jako běžný člen ani není řešitelem úkolů; v Nástěnkách vystupuje výhradně v režimu globálního dohledu či explicitního administrativního zásahu.

---

## 9. Krok 6 – Datový model a vztahy

Tato kapitola definuje logický datový model systému Nástěnka, atributy klíčových doménových entit, relační vazby, kardinality a závazné databázové invarianty. Specifikace přímo navazuje na schválený model rolí a bezpečnostních hranic z Kroku 5.

---

### 9.1 Základní princip datového modelu

Datový model striktně odděluje devět klíčových konceptů systému:
1. **Uživatele systému** (`User`),
2. **Nástěnku** (`Board`),
3. **Členství uživatele v Nástěnce** (`Membership`),
4. **Globální roli Admin** (`User.global_role`),
5. **Roli uživatele v konkrétní Nástěnce** (`Membership.role`),
6. **Úkol** (`Task`),
7. **Autora úkolu** (`Task.created_by`),
8. **Řešitele úkolu** (`Task.assignee_id`),
9. **Spoluřešitele a účastníky úkolu** (`TaskParticipant`).

#### Klíčové pravidlo datového modelu:
> **Role uživatele na Nástěnce je vlastností jeho členství (`Membership`), nikoliv globální vlastností uživatelského účtu (`User`).**

*Příklad:*
```text
Milan (User ID: 1)
 ├── Nástěnka "Prodejna"  ── Membership.role = OWNER
 ├── Nástěnka "Sklad"     ── Membership.role = MANAGER
 └── Nástěnka "Marketing" ── Membership.role = MEMBER
```

Globální systémová role `ADMIN` je naopak vlastností uživatelského účtu (`User.global_role`), která existuje nezávisle na konkrétních Nástěnkách.

---

### 9.2 Doménová entita User (Uživatel)

Entita `User` reprezentuje fyzickou osobu registrovanou v aplikaci:

```text
User
----
id           : ID (Primary Key)
name         : String (jméno a příjmení / zobrazované jméno)
email        : String (unikátní e-mail, přihlašovací identifikátor)
global_role  : Enum (globální systémová role: USER | ADMIN)
created_at   : Timestamp (čas registrace účtu)
updated_at   : Timestamp (čas poslední aktualizace účtu)
is_active    : Boolean (stav aktivity účtu: true = aktivní, false = deaktivovaný)
deleted_at   : Timestamp, Nullable (časové razítko logického smazání / soft-delete)
```

#### Pravidla pro entitu User:
* `global_role` obsahuje výhradně hodnoty:
  * `USER` – standardní uživatel aplikace,
  * `ADMIN` – globální administrátor systému.
* V entitě `User` **nesmí být nikdy použity role `OWNER`, `MANAGER` ani `MEMBER`**. Tyto role patří výhradně do vazební entity `Membership`.

---

### 9.3 Doménová entita Board (Nástěnka)

Entita `Board` reprezentuje samostatný týmový pracovní prostor:

```text
Board
-----
id           : ID (Primary Key)
name         : String (název Nástěnky)
description  : Text, Nullable (volitelný popis účelu Nástěnky)
created_by   : ID (Foreign Key → User.id, zakladatel Nástěnky)
created_at   : Timestamp (čas vytvoření Nástěnky)
updated_at   : Timestamp (čas poslední aktualizace nastavení)
deleted_at   : Timestamp, Nullable (časové razítko logického smazání / soft-delete)
```

#### Oddělení created_by a aktuálního OWNER:
* Atribut `created_by` představuje neměnnou referenci na uživatele, který Nástěnku historicky vytvořil.
* Aktuální vlastník Nástěnky je určen dynamicky prostřednictvím `Membership.role = OWNER`.
* Po převodu vlastnictví (`současný OWNER → nový OWNER`) zůstává hodnota `Board.created_by` nedotčena.

*Příklad:*
```text
1. Milan vytvoří Nástěnku "Prodejna":
   Board.created_by = Milan
   Membership(user=Milan, board=Prodejna, role=OWNER)

2. Milan převede vlastnictví na Petra:
   Board.created_by = Milan (zůstává zachováno)
   Membership(user=Petr, board=Prodejna, role=OWNER) (aktuální Owner)
   Membership(user=Milan, board=Prodejna, role=MANAGER nebo MEMBER)
```

---

### 9.4 Doménová entita Membership (Členství v Nástěnce)

Entita `Membership` představuje ústřední vazební a autorizační prvek celého systému:

```text
Membership
----------
id           : ID (Primary Key)
user_id      : ID (Foreign Key → User.id)
board_id     : ID (Foreign Key → Board.id)
role         : Enum (role na Nástěnce: OWNER | MANAGER | MEMBER)
created_at   : Timestamp (datum vzniku členství)
updated_at   : Timestamp (datum poslední změny role)
```

#### Sémantika členství:
> **Membership vyjadřuje: Uživatel X je členem Nástěnky Y a má na ní roli Z.**

Povolené hodnoty atributu `role`:
* `OWNER` – vlastník Nástěnky s plnou kontrolou nad nastavením, rolemi a vlastnictvím.
* `MANAGER` – provozní správce Nástěnky s právy správy běžného obsahu, úkolů a členů.
* `MEMBER` – řadový člen Nástěnky s pracovními právy k úkolům.

---

### 9.5 Unikátnost Membership a vazba User ↔ Board

Pro každou kombinaci uživatele a Nástěnky smí v systému existovat **pouze jedno platné členství**:

```text
UNIQUE(user_id, board_id)
```

* Jeden uživatel nesmí být na stejné Nástěnce evidován vícekrát pod různými rolemi.
* Změna role (např. povýšení `MEMBER → MANAGER`) je aktualizací existujícího záznamu `Membership`, nikoliv vytvořením dalšího záznamu.

#### Vztah a kardinality:
```text
USER (1) ───< má >─── (0..N) MEMBERSHIP (N) ───< patří do >─── (1) BOARD
```

* Jeden `User` může být členem 0 až N Nástěnek.
* Jedna `Board` má 1 až N členství (`Membership`).
* Každé `Membership` patří právě jednomu uživateli a právě jedné Nástěnce.

---

### 9.6 Datové invarianty pro OWNER a MANAGER

Datový model a doménová logika striktně vynucují tyto strukturální invarianty:

#### INVARIANT OWNER (Právě jeden vlastník):
Každá aktivní Nástěnka musí mít v každém okamžiku:
```text
exactly 1 Membership(role=OWNER)
```
Datová vrstva a aplikační logika musí transakčně zabránit stavu:
* 0 Ownerů (opuštěná Nástěnka bez vlastníka),
* 2 a více Ownerů (spoluvlastnictví není podporováno).

#### INVARIANT MANAGER (Maximálně jeden provozní správce):
Každá Nástěnka může mít v každém okamžiku:
```text
0..1 Membership(role=MANAGER)
```
Datová vrstva a aplikační logika musí transakčně zabránit stavu, kdy by na jedné Nástěnce existovali současně dva nebo více Managerů.

---

### 9.7 Převod vlastnictví v datovém modelu

Převod vlastnictví (`současný OWNER → nový OWNER`) probíhá jako transakční operace nad tabulkou `Membership`:

1. **Předpoklad:** Cílový uživatel musí mít existující `Membership` na dané Nástěnce. Pokud dosud není členem, musí být nejprve vytvořeno `Membership(user_id, board_id, role=MEMBER)`.
2. **Atomická transakce:**
   * `Membership(nový_owner, board_id).role = OWNER`
   * `Membership(původní_owner, board_id).role =` nová role původního Ownera.
3. **Pravidlo pro roli původního Ownera:**
   ```text
   pokud na Nástěnce NENÍ jiný MANAGER:
       původní_owner.role = MANAGER
   pokud na Nástěnce JIŽ EXISTUJE jiný MANAGER:
       původní_owner.role = MEMBER
   ```
4. **Garantovaný výsledek:** Před transakcí existuje právě 1 OWNER a max. 1 MANAGER; po dokončení transakce existuje právě 1 OWNER a max. 1 MANAGER. Nikdy nevznikne pozorovatelný mezistav s 0 či 2 Ownery.

---

### 9.8 Globální role ADMIN a vztah k Membership

Globální role `ADMIN` je uložena v `User.global_role = ADMIN`:

* **Nezávislost na Membership:** Admin nepotřebuje existenci záznamu v tabulce `Membership` k tomu, aby mohl Nástěnku zobrazit, spravovat nebo provést bezpečnostní zásah.
* **Vytvoření Nástěnky běžným uživatelem:**
  * Vzniká `Board` (`created_by = User.id`),
  * Vzniká `Membership` (`user_id = User.id, role = OWNER`).
  * Obě operace probíhají v jedné transakci.
* **Vytvoření Nástěnky Adminem:**
  * *Případ A (Admin vytváří Nástěnku pro sebe):*
    `Board.created_by = Admin.id`, vzniká `Membership(Admin.id, Board.id, role=OWNER)`.
  * *Případ B (Admin zakládá Nástěnku pro jiného uživatele):*
    `Board.created_by = Admin.id`, vzniká `Membership(CílovýUživatel.id, Board.id, role=OWNER)`. Admin zůstává bez Membership s globálním administrativním dohledem.
  * V obou případech má nová Nástěnka okamžitě právě jednoho Ownera.

---

### 9.9 Doménová entita Task (Úkol)

Entita `Task` reprezentuje konkrétní pracovní položku vázanou na Nástěnku:

```text
Task
----
id           : ID (Primary Key)
board_id     : ID (Foreign Key → Board.id, povinné)
area_id      : ID, Nullable (Foreign Key → Area.id, volitelné zařazení do oblasti)
title        : String (název úkolu)
description  : Text, Nullable (podrobný popis úkolu)
status       : Enum (stav: NOVÉ | PŘEVZATÉ | ROZPRACOVANÉ | ČEKÁ SE | HOTOVO | ARCHIVOVÁNO)
priority     : Enum (priorita: BĚŽNÁ | SPĚCHÁ)
due_date     : Date, Nullable (volitelný cílový termín splnění)
created_by   : ID (Foreign Key → User.id, autor úkolu)
assignee_id  : ID, Nullable (Foreign Key → User.id, Hlavní Řešitel; NULL = Nepřiřazeno)
created_at   : Timestamp (čas vzniku úkolu)
updated_at   : Timestamp (čas poslední úpravy)
completed_at : Timestamp, Nullable (čas přechodu do stavu HOTOVO)
```

Každý Task patří **právě jedné Nástěnce**:
```text
BOARD (1) ───< obsahuje >─── (0..N) TASK
```

---

### 9.10 Oddělení created_by × assignee_id a pravidlo členství

Model striktně odděluje dvě různé vazby uživatele na úkol:
* **`created_by` (Autor úkolu):** Uživatel, který úkol do systému vložil. Tato hodnota je trvalá a neměnná.
* **`assignee_id` (Hlavní Řešitel):** Uživatel, který nese operativní odpovědnost za vyřešení úkolu. Hodnota `NULL` představuje stav `Nepřiřazeno`.

#### Závazné pravidlo příslušnosti Assignee k Nástěnce:
> **Uživatel může být nastaven jako `assignee_id` úkolu pouze tehdy, má-li platné `Membership` ke stejné Nástěnce jako daný Task.**

```text
Task.assignee_id = User.id
  JE VALIDNÍ POUZE POKUD:
EXISTS Membership WHERE Membership.user_id = Task.assignee_id AND Membership.board_id = Task.board_id
```

Samotná existence uživatele v systému nestačí – uživatel z Nástěnky A nemůže být řešitelem úkolu na Nástěnce B.

---

### 9.11 Doménová entita TaskParticipant (Spoluřešitelé a účastníci úkolu)

Pro evidenci spoluřešitelů a dalších zapojených členů týmů se **nesmí používat pevná pole v tabulce Task** (např. `co_solver_1`, `co_solver_2`). Místo toho je použita vazební entita `TaskParticipant`:

```text
TaskParticipant
---------------
id           : ID (Primary Key)
task_id      : ID (Foreign Key → Task.id)
user_id      : ID (Foreign Key → User.id)
role         : Enum (role na úkolu: CO_SOLVER)
created_at   : Timestamp (datum a čas připojení k úkolu)
```

#### Pravidla pro TaskParticipant:
* **Vazba a unikátnost:** `UNIQUE(task_id, user_id)` – jeden uživatel může být u daného úkolu účastníkem maximálně jednou.
* **Podmínka členství:** Každý účastník musí mít platné `Membership` ke stejné Nástěnce, do které patří daný `Task`.
* **Kardinalita:** Jeden úkol může mít 0 až N účastníků (`TaskParticipant`).
* **Nezávislost na rolích Nástěnky:** Role na úkolu (`CO_SOLVER`) je striktně oddělena od správních rolí Nástěnky (`OWNER`, `MANAGER`, `MEMBER`).

---

### 9.12 Role na Nástěnce ≠ Odpovědnost za úkol

Architektura datového modelu striktně garantuje nezávislost správy Nástěnky na řešení úkolů:

> **Role uživatele na Nástěnce a odpovědnost za konkrétní úkol jsou dva zcela nezávislé koncepty.**

*Příklad platné konfigurace:*
* Milan: `role na Boardu = OWNER`
* Petr: `role na Boardu = MEMBER`
* Úkol X: `created_by = Milan`, `assignee_id = Petr`, `TaskParticipant = [Milan, Jana]`

V datovém modelu **neexistuje žádná implicitní vazba**:
* `OWNER` není automaticky nastaven jako `assignee` nového ani stávajícího úkolu.
* `MANAGER` není automaticky řešitelem úkolů.
* `ADMIN` není automaticky řešitelem ani účastníkem úkolů.

---

### 9.13 Životní cyklus, soft-delete a deaktivace

Architektura striktně rozlišuje mezi standardním mechanismem zachování historie a výslovně povolenými destruktivními zásahy:

* **Soft-delete (logické smazání / deaktivace):** Standardní mechanismus tam, kde je požadována obnova, auditovatelnost vazeb či dlouhodobé uchování historie objektu v celém kontextu systému (např. Nástěnka, uživatelský účet).
* **Controlled hard-delete (řízené trvalé smazání):** Výslovně povolená destruktivní doménová operace u objektů, u kterých to doménový návrh explicitně dovoluje (úkol `Task`, oblast `Area`). Nejde o nekontrolované mazání databáze, ale o přísně ohraničenou operaci:
  * je chráněna konkrétním oprávněním v autorizační matici,
  * vyžaduje bezpečnostní potvrzení vepsáním přesného textu `SMAZAT`,
  * probíhá atomicky v jediné transakci (včetně kaskádního vyčištění podřízených vazeb bez vzniku sirotků),
  * zanechává neměnnou stopu v nezávislém auditním protokolu (`DELETE_TASK`, `DELETE_AREA`),
  * po dokončení není smazaný objekt dostupný v aktivním seznamu, v archivu ani v běžné historii daného objektu.
* **Zákaz nekontrolovaného hard-delete:** Je přísně zakázáno jakékoliv nekontrolované, mimodoménové fyzické mazání dat z databáze, které by obcházelo autorizační kontrolu, transakční hranice či tvorbu auditní stopy a vedlo ke vzniku nekonzistencí či ztrátě dohledatelnosti.

#### 1. Deaktivace a soft-delete uživatele (`User`)
* Atributy: `is_active = false`, `deleted_at = Timestamp`.
* Účet je deaktivován, uživatel se nemůže přihlásit.
* Veškerá jím vytvořená data (úkoly `created_by`, komentáře, auditní stopa) zůstávají zachována pro integritu týmu.
* **Omezení pro Ownera:** Uživatel v roli `OWNER` **nesmí být deaktivován ani smazán**, dokud neproběhne převod vlastnictví na jiného člena nebo direktivní zásah Admina. Nástěnka nesmí zůstat bez platného Ownera.

#### 2. Logické smazání Nástěnky (`Board`)
* Atribut: `deleted_at = Timestamp`.
* Nástěnka je označena jako smazaná (soft-delete).
* **Důvody pro preferenci soft-delete před fyzickým smazáním:**
  * zachování úplné a neměnné auditní stopy,
  * možnost havarijní obnovy (recovery) při nechtěném smazání,
  * zachování referenční integrity v historických a bezpečnostních protokolech,
  * bezpečnost a ochrana dat před neoprávněnými destruktivními zásahy.

#### 3. Řízené trvalé smazání úkolu (`Task`) a oblasti (`Area`)
* Představuje aplikaci principu **controlled hard-delete**.
* **Úkol (`Task`):** Po autorizovaném potvrzení textem `SMAZAT` je trvale odstraněn ze systému; transakčně jsou odstraněny také jeho vazby (např. `TaskParticipant`).
* **Oblast (`Area`):** Po autorizovaném potvrzení textem `SMAZAT` je trvale odstraněna společně se všemi úkoly, které obsahuje (kaskádní řízený hard-delete bez vzniku osiřelých entit).
* V obou případech se do nezávislého auditního logu Nástěnky zapíše záznam `DELETE_TASK` resp. `DELETE_AREA` zachovávající metadata o tom, kdo, kdy a co smazal.

---

### 9.14 Finální logický ER diagram vztahů

Následující diagram znázorňuje kompletní logickou strukturu entit a jejich vazeb:

```text
                         ┌───────────────────────┐
                         │         USER          │
                         ├───────────────────────┤
                         │ id (PK)               │
                         │ name                  │
                         │ email (UNIQUE)        │
                         │ global_role           │
                         │ is_active             │
                         │ created_at            │
                         │ updated_at            │
                         │ deleted_at (nullable) │
                         └──────────┬────────────┘
                                    │
                             1:N    │ (má členství)
                                    ▼
                         ┌───────────────────────┐
                         │      MEMBERSHIP       │
                         ├───────────────────────┤
                         │ id (PK)               │
                         │ user_id (FK, UNIQUE)  │◄──┐
                         │ board_id (FK, UNIQUE) │   │ UNIQUE(user_id, board_id)
                         │ role                  │   │
                         │ created_at            │   │
                         │ updated_at            │   │
                         └──────────┬────────────┘   │
                                    │                │
                             N:1    │ (patří do)     │
                                    ▼                │
                         ┌───────────────────────┐   │
                         │         BOARD         │   │
                         ├───────────────────────┤   │
                         │ id (PK)               │───┘
                         │ name                  │
                         │ description           │
                         │ created_by (FK→User)  │
                         │ created_at            │
                         │ updated_at            │
                         │ deleted_at (nullable) │
                         └──────────┬────────────┘
                                    │
                             1:N    │ (obsahuje úkoly)
                                    ▼
                         ┌───────────────────────┐
                         │         TASK          │
                         ├───────────────────────┤
                         │ id (PK)               │
                         │ board_id (FK→Board)   │
                         │ area_id (FK→Area,opt) │
                         │ title                 │
                         │ description           │
                         │ status                │
                         │ priority              │
                         │ due_date (nullable)   │
                         │ created_by (FK→User)  │
                         │ assignee_id (FK→User) │ (podmínka: musí mít Membership v board_id)
                         │ created_at            │
                         │ updated_at            │
                         │ completed_at (null)   │
                         └──────────┬────────────┘
                                    │
                             1:N    │ (má spoluřešitele)
                                    ▼
                         ┌───────────────────────┐
                         │   TASK_PARTICIPANT    │
                         ├───────────────────────┤
                         │ id (PK)               │
                         │ task_id (FK→Task)     │
                         │ user_id (FK→User)     │ (podmínka: musí mít Membership v board_id)
                         │ role (CO_SOLVER)      │
                         │ created_at            │
                         └───────────────────────┘
```

---

### 9.15 Souhrnné kardinality doménových vazeb

| Entita A | Vztah | Entita B | Popis a kardinalita |
|---|:---:|---|---|
| **USER** | `1 : 0..N` | **MEMBERSHIP** | Uživatel může mít členství v žádné, jedné nebo více Nástěnkách. |
| **BOARD** | `1 : 1..N` | **MEMBERSHIP** | Nástěnka má minimálně jednoho člena; má **právě 1 OWNER**, **0..1 MANAGER** a **0..N MEMBER**. |
| **BOARD** | `1 : 0..N` | **TASK** | Nástěnka sdružuje libovolný počet úkolů. Každý úkol patří právě jedné Nástěnce. |
| **TASK** | `N : 1` | **USER (creator)** | Každý úkol má právě jednoho autora (`created_by`). |
| **TASK** | `N : 0..1` | **USER (assignee)** | Každý úkol má nula nebo jednoho Hlavního Řešitele (`assignee_id`). Null = `Nepřiřazeno`. |
| **TASK** | `1 : 0..N` | **TASK_PARTICIPANT** | Úkol může mít libovolný počet spoluřešitelů. |
| **TASK_PARTICIPANT** | `N : 1` | **USER** | Každý záznam účastníka ukazuje na jednoho člena stejné Nástěnky. |

---

### 9.16 Klíčové databázové invarianty

Následujících šest invariantů představuje závazné podmínky integrity systému, které **musí být garantovány databázovou a transakční aplikační vrstvou** (nikoliv pouze logikou frontendu):

#### INVARIANT 1: Unikátnost členství na Nástěnce
```sql
UNIQUE (user_id, board_id) v tabulce Membership
```
Jeden uživatel nesmí mít v rámci jedné Nástěnky více než jeden záznam členství.

#### INVARIANT 2: Právě jeden Owner na aktivní Nástěnku
Každá aktivní Nástěnka (`deleted_at IS NULL`) musí mít v tabulce `Membership` **přesně jeden záznam s `role = 'OWNER'`**. Stav bez Ownera nebo stav se dvěma a více Ownery je neplatný a systém jej nesmí povolit.

#### INVARIANT 3: Maximálně jeden Manager na Nástěnku
V tabulce `Membership` smí pro danou Nástěnku existovat **maximálně jeden záznam s `role = 'MANAGER'`** (kardinalita 0..1). Pokus o vytvoření druhého záznamu musí být odmítnut.

#### INVARIANT 4: Příslušnost řešitelů ke stejné Nástěnce
Uživatel nastavený jako `Task.assignee_id` nebo zapsaný v `TaskParticipant.user_id` **musí mít platné členství (`Membership`) na stejné Nástěnce (`Task.board_id`)**. Zásah z cizí Nástěnky je striktně nepřípustný.

#### INVARIANT 5: Atomický převod vlastnictví (Transfer of Ownership)
Operace převodu vlastnictví Nástěnky musí být provedena v rámci **jediné izolované databázové transakce**. V průběhu transakce je nový uživatel povýšen na `OWNER` a původní Owner převeden na `MANAGER` (nebo `MEMBER`), přičemž po commitu transakce jsou stoprocentně splněny Invarianty 2 a 3.

#### INVARIANT 6: Atomické vytvoření Nástěnky a Owner Membership
Vytvoření nového záznamu `Board` a odpovídajícího záznamu `Membership` s rolí `OWNER` pro zakládajícího uživatele (případně cílového uživatele určeného Adminem) **musí proběhnout v rámci jediné atomické transakce**. Nástěnka nesmí po vytvoření ani na okamžik zůstat bez přiřazeného Ownera.

---

### 9.17 Provázanost s Krokem 5

Krok 6 je v plné a stoprocentní shodě se schváleným modelem oprávnění a bezpečnostních hranic z Kroku 5:
* Model rolí: globální role `ADMIN` (na entitě `User`) vs. role na Nástěnce `OWNER`, `MANAGER`, `MEMBER` (na entitě `Membership`).
* Kardinality rolí na Nástěnce: `1 OWNER`, `0..1 MANAGER`, `0..N MEMBER`.
* Oddělení správy Nástěnky od řešení úkolů: Role na Nástěnce nezakládá automatickou odpovědnost za úkoly.
* Bezpečnostní hranice: Veškerá pravidla (včetně prevence 0/2 Ownerů, kontroly členství assignee a atomicity) jsou vynucována na backendu a v databázi, nikoliv ve frontendu.

---

## 10. Step 7 – Doménové operace, API a autorizační hranice

Tato kapitola definuje logický kontrakt aplikačního rozhraní (API), katalog podporovaných doménových operací, pravidla autorizace na straně serveru, transakční hranice a invarianty, které musí systém zachovat při každém požadavku. Dokument představuje **architektonický návrh kontraktu**, nikoliv konkrétní implementační specifikaci či technologickou volbu (REST/GraphQL/gRPC).

---

### 10.1 Princip autority backendu

Architektura striktně vychází ze zásady, že klientská část aplikace (uživatelské rozhraní) je pouze prezentační vrstvou:

* **Role frontendu:** Frontend dynamicky přizpůsobuje zobrazení, skrývá nepovolená tlačítka a deaktivuje formulářové prvky podle známé role uživatele za účelem ergonomie (UX).
* **Frontend není bezpečnostní autorita:** Pouhé skrytí či znepřístupnění prvku v uživatelském rozhraní nepředstavuje žádnou úroveň zabezpečení.
* **Serverové ověření každého požadavku:** Každý příchozí chráněný API požadavek musí backend/server plně a nezávisle autorizovat a validovat dříve, než provede jakoukoliv změnu stavu či dat.
* **Kontrolní seznam backendu před provedením operace:**
  1. **Autentizace volajícího:** Je volající ověřeným systémovým uživatelem?
  2. **Existence a stav cílového objektu:** Existuje cílová entita a není v logicky smazaném stavu (`deleted_at`)?
  3. **Vztah k Nástěnce (Membership):** Je volající členem dané Nástěnky, nebo disponuje globální rolí `ADMIN`?
  4. **Autorizace role:** Má role volajícího oprávnění vyvolat tuto konkrétní operaci?
  5. **Doménová pravidla a invarianty:** Splňuje požadavek veškerá kontextová pravidla (např. platnost přiřazení k Nástěnce, existence řešitele při přidání spoluřešitele, transakční limity)?
* **Zákaz implicitního oprávnění:** Samotný fakt, že klient odeslal korektně zformátovaný HTTP požadavek, nesmí být nikdy interpretován jako oprávnění k jeho vykonání.

> [!IMPORTANT]
> **Frontend UX omezení ≠ bezpečnostní omezení.**
> Bezpečnost systému je garantována výhradně autorizační logikou backendu.

---

### 10.2 Kontext volajícího: Actor vs. Target

Každý chráněný požadavek je v aplikační vrstvě vyhodnocován v explicitním kontextu volání. Architektura důsledně rozlišuje tyto pojmy:

* **Actor (Iniciátor):** Uživatelský účet, který operaci vyvolává a jehož autentizační identita je spojena s příchozím požadavkem (`actor_user_id`, `actor_global_role`, `actor_board_role`).
* **Target (Cíl operace):** Uživatel, entita nebo datový objekt, kterého se prováděná operace bezprostředně týká (`target_user_id`, `target_board_id`, `target_task_id`).
* **Kontextový rámec požadavku obsahuje:**
  * `actor_user_id`: jednoznačná identita volajícího,
  * `global_role`: systémová role volajícího (`USER` | `ADMIN`),
  * `board_id`: kontext konkrétní Nástěnky, v němž operace probíhá,
  * `target`: identifikace cílového objektu či entity,
  * `operation`: název vyvolávané doménové akce.

*Příklad:*
```text
Operace: Převod vlastnictví Nástěnky
Actor  : Milan (ID: 1, současný OWNER)
Target : Jan (ID: 2, budoucí OWNER)
Board  : Nástěnka "Prodejna" (ID: 101)
```
Toto rozlišení je klíčové pro správné vyhodnocení autorizace (zda Actor smí manipulovat s Targetem) i pro zápis do auditní stopy (kdo změnu vyvolal vs. koho/čeho se změna týká).

---

### 10.3 Operace nad Board (Nástěnka)

#### 1. Vytvoření Nástěnky (`POST /boards`)
* **Účel:** Založení nového samostatného týmového prostoru.
* **Actor:** Běžný uživatel (`USER`) nebo administrátor (`ADMIN`).
* **Požadované oprávnění:** Kterýkoliv přihlášený aktivní uživatel.
* **Pravidla a transakční chování:**
  * Operace je **striktně atomická** – v rámci jedné transakce vznikne `Board`, zakladatelské `Membership` a je nastavena výchozí role `OWNER`.
  * *Běžný uživatel:* Zakladatel (`actor_user_id`) je zapsán do `Board.created_by` a zároveň získává `Membership(role = OWNER)`.
  * *ADMIN pro sebe:* Admin je zapsán do `Board.created_by` a získává `Membership(role = OWNER)`.
  * *ADMIN pro jiného uživatele:* Admin zadá cílového uživatele (`target_user_id`); `Board.created_by` = Admin, avšak `Membership(role = OWNER)` je vytvořeno pro cílového uživatele. Admin nemusí být členem Nástěnky.
* **Validační podmínky:** Název Nástěnky nesmí být prázdný; target uživatel musí existovat a být aktivní.
* **Audit:** Zapisuje se vznik Nástěnky.

#### 2. Úprava Nástěnky (`PATCH /boards/{boardId}`)
* **Účel:** Změna názvu, popisu a běžných provozních metadat Nástěnky.
* **Actor a oprávnění:**
  * `OWNER`: ANO (plná správa metadat).
  * `MANAGER`: ANO (pokud jde o běžnou organizační správu Nástěnky a oblastí).
  * `ADMIN`: ANO (administrativní zásah).
  * `MEMBER`: NE (zakázáno).
* **Oddělení kompetencí:** Tato operace slouží výhradně pro běžná metadata Nástěnky. Změny členství, rolí a převod vlastnictví jsou samostatné specializované endpointy a **nesmí být přes tuto operaci proveditelné**.
* **Validační podmínky:** Nástěnka musí existovat a nesmí být soft-deleted.

#### 3. Smazání Nástěnky (`DELETE /boards/{boardId}`)
* **Účel:** Logické odstranění Nástěnky ze systému.
* **Actor a oprávnění:**
  * `OWNER`: ANO (vyžaduje bezpečnostní potvrzení).
  * `ADMIN`: ANO (administrativní odstranění / havarijní zásah).
  * `MANAGER`: NE (zakázáno).
  * `MEMBER`: NE (zakázáno).
* **Mechanismus provedení:** **Soft-delete** – nastavení `Board.deleted_at = Timestamp`. Nedochází k okamžitému fyzickému smazání řádků z databáze, aby zůstala zachována referenční integrita a historie.
* **Audit:** Povinný auditní záznam `DELETE_BOARD`.

---

### 10.4 Operace nad Membership (Správa členství a rolí)

#### 1. Přidání člena do Nástěnky (`POST /boards/{boardId}/members`)
* **Účel:** Zařazení nového uživatele mezi členy Nástěnky.
* **Actor a oprávnění:**
  * `OWNER`: ANO (může přidat člena s rolí `MEMBER` nebo `MANAGER`, pokud pozice Managera není obsazena).
  * `MANAGER`: ANO (může přidat člena s rolí `MEMBER` v rámci běžné provozní správy týmu).
  * `ADMIN`: ANO.
  * `MEMBER`: NE.
* **Hlavní vstupy:** `target_user_id`, volitelně `role` (výchozí `MEMBER`).
* **Validační podmínky:**
  * Cílový uživatel musí existovat a mít `is_active = true`.
  * Cílový uživatel dosud nesmí být členem dané Nástěnky (`UNIQUE(user_id, board_id)`).
  * Nelze tímto endpointem vytvořit druhého `OWNER`.
* **Audit:** Povinný auditní záznam `ADD_MEMBER`.

#### 2. Odebrání člena z Nástěnky (`DELETE /boards/{boardId}/members/{userId}`)
* **Účel:** Ukončení členství uživatele na Nástěnce.
* **Actor a oprávnění:**
  * `OWNER`: ANO (může odebrat jakéhokoliv Managera či Membera).
  * `MANAGER`: ANO (může odebrat běžného člena `MEMBER`; nesmí odebrat Ownera ani sám sebe povýšit).
  * `MEMBER`: ANO (výhradně pro dobrovolný odchod sebe sama z Nástěnky).
  * `ADMIN`: ANO.
* **Kritická validační pravidla:**
  * **Zákaz odebrání posledního Ownera:** Pokus odebrat uživatele s rolí `OWNER` musí backend striktně odmítnout chybou `409 Conflict`. Owner musí nejprve převést vlastnictví!
  * **Ošetření úkolů:** Úkoly, kde byl odebraný uživatel Hlavním Řešitelem, přejdou automaticky do `Nepřiřazeno`. U úkolů, kde byl spoluřešitelem, je vazba zrušena.
* **Audit:** Povinný auditní záznam `REMOVE_MEMBER`.

#### 3. Změna role člena (`PATCH /boards/{boardId}/members/{userId}/role`)
* **Účel:** Povýšení či změna role existujícího člena Nástěnky (`MEMBER` ↔ `MANAGER`).
* **Actor a oprávnění:**
  * `OWNER`: ANO (může jmenovat Managera nebo jej převést na Membera).
  * `ADMIN`: ANO.
  * `MANAGER`: NE (Manager nesmí měnit role ostatních uživatelů, nesmí jmenovat druhého Managera ani se povýšit na Ownera).
  * `MEMBER`: NE.
* **Validační pravidla a invarianty:**
  * Cílová role smí být pouze `MANAGER` nebo `MEMBER`.
  * **Zákaz nastavení role OWNER:** Roli `OWNER` nelze nastavit běžnou změnou role; k tomu slouží výhradně převod vlastnictví.
  * **Dodržení limitu Managera:** Povýšení na `MANAGER` je povoleno pouze tehdy, pokud Nástěnka aktuálně žádného jiného Managera nemá (`0..1 MANAGER`).
* **Audit:** Povinný auditní záznam `CHANGE_ROLE` nebo `CHANGE_MANAGER`.

---

### 10.5 Převod vlastnictví (Transfer of Ownership)

Operace převodu vlastnictví představuje samostatný, vysoce chráněný doménový proces:

`POST /boards/{boardId}/transfer-ownership`

* **Účel:** Atomické předání vlastnického mandátu Nástěnky z aktuálního Ownera na nového člena.
* **Actor:** Výhradně aktuální `OWNER` dané Nástěnky nebo globální `ADMIN`.
* **Target:** Uživatel (`target_user_id`), který se má stát novým Ownerem.
* **Závazná procesní pravidla:**
  1. **Ověření Actora:** Pouze stávající ověřený Owner (nebo Admin) může převod iniciovat. Manager ani Member tuto operaci nesmí vyvolat.
  2. **Podmínka členství Targetu:** Cílový uživatel musí být členem dané Nástěnky. Pokud dosud členem není, backend operaci odmítne (uživatel musí být nejprve přidán do týmu).
  3. **Striktní transakční atomicita:** Celý proces proběhne uvnitř jediné izolované databázové transakce.
  4. **Pravidlo pro nového a starého Ownera po převodu:**
     * Target získává roli `OWNER`.
     * Původní Owner ztrácí roli `OWNER`.
     * Pokud Nástěnka aktuálně nemá Managera, původní Owner získává roli `MANAGER`.
     * Pokud na Nástěnce již jiný Manager existuje, původní Owner získává roli `MEMBER` (je striktně dodržen invariant max. 1 Managera).
  5. **Vyloučení nekonzistence:** V žádném okamžiku nesmí nastat stav se dvěma Ownery ani stav bez Ownera.
  6. **Administrativní zásah Admina:** Pokud je původní Owner nedostupný (např. zrušený účet), globální Admin může direktivně určit nového Ownera ze stávajících členů Nástěnky.
* **Audit:** Povinný auditní záznam `TRANSFER_OWNERSHIP` (včetně původního a nového stavu obou dotčených uživatelů).

---

### 10.6 Operace nad Task (Správa úkolů)

#### 1. Vytvoření úkolu (`POST /tasks`)
* **Účel:** Založení nové pracovní položky.
* **Actor:** Kterýkoliv člen dané Nástěnky (`MEMBER`, `MANAGER`, `OWNER`), případně `ADMIN`.
* **Vstupy:** `board_id`, `title`, volitelně `description`, `priority` (výchozí `BĚŽNÁ`), `area_id`, `due_date`, volitelně `assignee_id`.
* **Pravidla a chování:**
  * Úkol patří právě jedné Nástěnce (`board_id`).
  * `Task.created_by` je automaticky a nezměnitelně nastaven na `actor_user_id`.
  * Pokud je zadán `assignee_id`, musí jít o člena stejné Nástěnky. Není-li zadán, úkol vzniká ve stavu `Nepřiřazeno`.
  * Vyvolá odeslání notifikace (WhatsApp) všem členům Nástěnky bez ohledu na přiřazení.

#### 2. Úprava atributů a stavu úkolu (`PATCH /tasks/{taskId}`)
* **Účel:** Modifikace parametrů úkolu a přechody životního cyklu.
* **Oprávnění podle typu změny (v souladu se sekcí 7 a 8):**
  * *Popis, název a priorita (`BĚŽNÁ` ↔ `SPĚCHÁ`):* Může upravit **kterýkoliv člen Nástěnky**.
  * *Stav úkolu (přechody stavového modelu):* Smí měnit **Hlavní Řešitel (`assignee_id`)**, **Spoluřešitelé (`TaskParticipant`)**, provozní správce (`MANAGER`), vlastník (`OWNER`) a `ADMIN`.
  * *Termín splnění (`due_date`) a přesun oblasti (`area_id`):* Smí měnit Hlavní Řešitel, Spoluřešitel, Manager, Owner a Admin.
* **Validační podmínky:** Úkol musí existovat na dané Nástěnce; stavový přechod musí odpovídat povoleným stavům; termín musí mít platný formát.

#### 3. Změna řešitele úkolu (`PATCH /tasks/{taskId}/assignee`)
* **Účel:** Přidělení úkolu, převzetí na sebe nebo uvolnění do stavu Nepřiřazeno.
* **Actor a oprávnění:** **Kterýkoliv člen dané Nástěnky** (`MEMBER`, `MANAGER`, `OWNER`, `ADMIN`).
* **Pravidla:**
  * Uživatel může úkol převzít na sebe (stát se Hlavním Řešitelem).
  * Uživatel může úkol delegovat kterémukoli jinému členovi dané Nástěnky.
  * Uživatel může úkol nastavit na `Nepřiřazeno` (`assignee_id = NULL`).
  * **Podmínka členství:** Cílový řešitel (`target_assignee_id`) musí být aktivním členem stejné Nástěnky.
* **Audit:** Zaznamenává se změna řešitele v historii změn úkolu.

#### 4. Řízené trvalé smazání úkolu (`DELETE /tasks/{taskId}`)
* **Účel:** Vědomě definovaná a řízená destruktivní doménová operace trvalého odstranění úkolu ze systému (controlled hard-delete, nikoliv nekontrolované mazání dat).
* **Actor a oprávnění:** Hlavní Řešitel daného úkolu, Spoluřešitel daného úkolu, Provozní správce (`MANAGER`), Vlastník (`OWNER`) nebo `ADMIN`.
* **Podmínka provedení:** Vyžaduje striktní bezpečnostní potvrzení vepsáním přesného textu `SMAZAT` v těle požadavku.
* **Transakční chování:** Operace probíhá atomicky v jediné transakci – fyzicky odstraní záznam `Task`, kaskádně odstraní přiřazené vazby (`TaskParticipant`) bez vzniku sirotčích dat a zapíše nezávislý auditní záznam `DELETE_TASK`.
* **Důsledek:** Úkol definitivně zaniká; po smazání není dostupný v aktivním seznamu, v archivu ani v běžné historii úkolu.
* **Nezávislá auditní stopa:** Záznam `DELETE_TASK` se zapisuje do nezávislého auditního logu Nástěnky, kde zůstává trvale zachován i po fyzickém zániku samotného úkolu.
* **Hlavní chybové stavy:**
  * `401 Unauthorized`: Volající není autentizován.
  * `403 Forbidden`: Volající není řešitelem, spoluřešitelem ani správcem dané Nástěnky.
  * `404 Not Found`: Úkol neexistuje nebo byl již smazán.
  * `422 Unprocessable Entity`: Chybějící nebo nesprávný potvrzovací text (rozdílný od `SMAZAT`).

#### 5. Připojení spoluřešitele (`POST /tasks/{taskId}/participants`)
* **Účel:** Dobrovolné zapojení dalšího člena týmu do řešení úkolu.
* **Actor:** Kterýkoliv člen dané Nástěnky, který se připojuje sám za sebe (`+ Připojit se k úkolu`).
* **Podmínka existence:** Úkol **musí mít Hlavního Řešitele** (`assignee_id IS NOT NULL`). U úkolu ve stavu `Nepřiřazeno` se nelze stát spoluřešitelem.
* **Omezení:** Neexistuje funkce pro vnucené přidání cizího člena jako spoluřešitele jiným členem.

#### 6. Odpojení / odebrání spoluřešitele (`DELETE /tasks/{taskId}/participants/{userId}`)
* **Účel:** Odstranění uživatele ze seznamu spoluřešitelů.
* **Oprávnění:**
  * *Dobrovolné odpojení:* Spoluřešitel se může sám kdykoliv odpojit (`actor_user_id == target_user_id`).
  * *Odebrání Hlavním Řešitelem:* Hlavní Řešitel (`assignee_id`) může Spoluřešitele z úkolu odebrat.
  * *Správní zásah:* Manager, Owner a Admin mohou spoluřešitele odebrat z titulu správy.
  * *Zákaz:* Jiný Spoluřešitel ani běžný člen cizího spoluřešitele odebrat nesmí.
* **Důsledek:** Odebraný člen není blokován a může se v budoucnu znovu připojit, pokud má úkol Hlavního Řešitele.

---

### 10.7 Operace nad Area (Správa oblastí)

#### 1. Řízené smazání oblasti (`DELETE /boards/{boardId}/areas/{areaId}`)
* **Účel:** Vědomě definovaná a řízená destruktivní doménová operace trvalého odstranění organizační oblasti Nástěnky včetně všech úkolů, které do ní patří (controlled hard-delete).
* **Actor a oprávnění:** Provozní správce (`MANAGER`), Vlastník (`OWNER`) nebo `ADMIN` (běžný člen `MEMBER` nemá oprávnění mazat oblasti).
* **Podmínka provedení:** Vyžaduje striktní bezpečnostní potvrzení vepsáním přesného textu `SMAZAT` v těle požadavku.
* **Transakční atomicita:** Celá operace probíhá jako jediná nedílná transakce (vše nebo nic). V rámci této transakce dojde k:
  1. ověření existence oblasti v rámci zadané Nástěnky (`board_id`),
  2. vyhledání všech úkolů náležejících do této oblasti (`Task.area_id == areaId`),
  3. kaskádnímu trvalému odstranění všech těchto úkolů a jejich vazeb (`TaskParticipant`),
  4. trvalému odstranění samotné entity `Area`,
  5. zápisu auditního záznamu `DELETE_AREA` do nezávislého auditního logu Nástěnky.
* **Smazání obsažených Tasků:** Všechny úkoly zařazené do mazané oblasti definitivně zanikají podle schváleného pravidla (úkoly se nepřesouvají do archivu ani koše a nevznikají žádné sirotčí vazby).
* **Auditní stopa:** Záznam `DELETE_AREA` (včetně identifikace oblasti a metadat o smazaných úkolech) zůstává trvale zachován v nezávislém auditním protokolu Nástěnky.
* **Hlavní chybové stavy:**
  * `401 Unauthorized`: Volající není autentizován.
  * `403 Forbidden`: Volající je pouze v roli `MEMBER` (nedostatečná oprávnění pro destruktivní organizační zásah).
  * `404 Not Found`: Nástěnka nebo oblast neexistuje, případně oblast nepatří k zadané Nástěnce.
  * `409 Conflict`: Souběžná operace nad oblastí nebo pokus o smazání již neexistující oblasti.
  * `422 Unprocessable Entity`: Chybějící nebo nesprávný potvrzovací řetězec (rozdílný od `SMAZAT`).

---

### 10.8 Pravidla pro přiřazení Tasku a integrita členství

Backend striktně vymáhá pravidlo teritoriální integrity Nástěnky:

> **Assignee i všichni Spoluřešitelé úkolu musí mít v okamžiku přiřazení platné a aktivní členství (`Membership`) na stejné Nástěnce, do které daný úkol patří.**

```text
POŽADAVEK: Nastavit Task(board_id = B).assignee_id = User(U)
BACKEND OVĚŘUJE:
EXISTS Membership WHERE user_id = U AND board_id = B AND is_active = true
POKUD NEEXISTUJE → HTTP 422 Unprocessable Entity ("Uživatel není členem dané Nástěnky")
```

#### Řešení zániku členství uživatele:
Pokud uživatel Nástěnku opustí nebo je odebrán:
1. **Aktivní přiřazení:** U úkolů, kde byl Hlavním Řešitelem, systém automaticky nastaví `assignee_id = NULL` (přechod do stavu `Nepřiřazeno`).
2. **Spoluřešitelství:** Uživatel je automaticky odstraněn ze všech záznamů `TaskParticipant` na dané Nástěnce.
3. **Historická data:** Hodnota `Task.created_by` (autorství), dřívější komentáře a záznamy v auditním logu zůstávají plně zachovány pod identifikátorem uživatele pro zajištění historické konzistence.

---

### 10.9 Stavové a validační chyby

Systém implementuje jednotnou sémantiku chybových stavů:

* **`401 Unauthorized` (Neautentizovaný požadavek):**
  * Požadavek neobsahuje platnou autentizační relaci či token.
  * Identita volajícího není známa.
* **`403 Forbidden` (Nedostatečné oprávnění):**
  * Actor je autentizován, ale nemá oprávnění operaci provést (např. Member zkouší měnit role; Manager zkouší převést vlastnictví; uživatel není členem dané Nástěnky a není Admin).
* **`404 Not Found` (Objekt nenalezen):**
  * Cílový `Board`, `Task`, `Area`, `Membership` nebo `User` v systému neexistuje, případně byl logicky smazán (`deleted_at IS NOT NULL`).
* **`409 Conflict` (Konflikt stavu a invariantů):**
  * Pokus o porušení strukturálních invariantů systému:
    * pokus jmenovat druhého Managera, když pozice již existuje (`0..1 MANAGER`),
    * pokus odstranit posledního Ownera Nástěnky bez předchozího převodu,
    * pokus o vytvoření duplicitního členství téhož uživatele na Nástěnce,
    * pokus o smazání oblasti, která již byla smazána jiným uživatelem.
* **`422 Unprocessable Entity` (Sémantická validační chyba):**
  * Požadavek je syntakticky v pořádku, ale porušuje doménová pravidla:
    * pokus přiřadit úkol uživateli, který není členem dané Nástěnky,
    * pokus připojit se jako Spoluřešitel k úkolu ve stavu `Nepřiřazeno`,
    * chybějící nebo nesprávný potvrzovací text při mazání (nebylo zadáno přesně `SMAZAT`),
    * prázdný název Nástěnky nebo úkolu.

---

### 10.10 Autorizační matice API operací

Následující tabulka definuje oprávnění k vyvolání jednotlivých API operací podle rolí v systému:

| Operace / Endpoint | ADMIN | OWNER | MANAGER | MEMBER |
|---|:---:|:---:|:---:|:---:|
| **Vytvořit board** (`POST /boards`) | ANO | ANO | ANO | ANO |
| **Upravit board** (`PATCH /boards/{id}`) | ANO | ANO | ANO* | NE |
| **Smazat board** (`DELETE /boards/{id}`) | ANO | ANO | NE | NE |
| **Smazat oblast** (`DELETE /boards/{id}/areas/{areaId}`) | ANO | ANO | ANO | NE |
| **Přidat člena** (`POST /boards/{id}/members`) | ANO | ANO | Dle pravidel* | NE |
| **Odebrat člena** (`DELETE /boards/{id}/members/{uid}`) | ANO | ANO | Dle pravidel* | NE* |
| **Změnit roli člena** (`PATCH /members/{uid}/role`) | ANO | ANO | Omezeně* | NE |
| **Změnit OWNERA** (direktivně) | ANO | NE | NE | NE |
| **Převést OWNERA** (`POST /transfer-ownership`) | ANO | ANO | NE | NE |
| **Vytvořit task** (`POST /tasks`) | ANO* | ANO | ANO | ANO |
| **Upravit task** (`PATCH /tasks/{id}`) | ANO* | ANO | ANO | Dle pravidel tasku* |
| **Smazat task** (řízený hard-delete) (`DELETE /tasks/{id}`) | ANO* | ANO | ANO | Dle pravidel tasku* |
| **Změnit assignee** (`PATCH /tasks/{id}/assignee`) | ANO* | ANO | ANO | Dle pravidel tasku* |
| **Spravovat participanty** (`/tasks/{id}/participants`) | ANO* | ANO | ANO | Dle pravidel tasku* |

#### Podrobná pravidla a vysvětlivky k matici:
* `ADMIN (ANO*)`: Globální Admin má právo administrativního zásahu do kteréhokoliv objektu pro řešení krizových a zablokovaných stavů, aniž by musel být členem dané Nástěnky.
* `Upravit board (MANAGER = ANO*)`: Manager smí upravovat běžná provozní metadata a oblasti, nesmí však Nástěnku smazat ani měnit vlastnictví.
* `Smazat oblast (MEMBER = NE)`: Běžný člen nesmí mazat organizační oblasti Nástěnky. Právo náleží výhradně Managerovi, Ownerovi a Adminovi s potvrzením `SMAZAT`.
* `Přidat člena (MANAGER = Dle pravidel*)`: Manager smí přidávat nové členy výhradně s výchozí rolí `MEMBER`.
* `Odebrat člena (MANAGER = Dle pravidel*)`: Manager smí odebrat řadového člena (`MEMBER`), nesmí však odebrat Ownera ani sám sebe povýšit.
* `Odebrat člena (MEMBER = NE*)`: Běžný člen nemůže odebírat ostatní členy; má však právo sám z Nástěnky vystoupit (odebrat sebe sama).
* `Změnit roli člena (MANAGER = Omezeně*)`: Manager nesmí měnit role existujících členů ani jmenovat druhého Managera.
* `Upravit task (MEMBER = Dle pravidel tasku*)`: Řadový člen smí upravit název, popis a prioritu jakéhokoliv úkolu. Změnu stavu, termínu splnění a oblasti smí provést pouze tehdy, je-li Hlavním Řešitelem nebo Spoluřešitelem daného úkolu.
* `Smazat task (MEMBER = Dle pravidel tasku*)`: Řadový člen smí trvale smazat úkol pouze tehdy, je-li jeho Hlavním Řešitelem nebo Spoluřešitelem, a to výhradně s potvrzením `SMAZAT`.
* `Změnit assignee (MEMBER = Dle pravidel tasku*)`: Každý člen Nástěnky smí přidělit úkol kterémukoli členovi dané Nástěnky, převzít jej na sebe nebo nastavit na `Nepřiřazeno`.
* `Spravovat participanty (MEMBER = Dle pravidel tasku*)`: Člen se smí sám připojit jako Spoluřešitel (pokud má úkol řešitele) nebo se sám odpojit. Cizího spoluřešitele smí odebrat pouze Hlavní Řešitel úkolu.

---

### 10.11 Auditované operace a struktura protokolu

Všechny bezpečnostně citlivé, správní a destruktivní operace musí být po úspěšném transakčním provedení zapsány do neměnného auditního logu.

* **Katalog povinně auditovaných operací:**
  * `TRANSFER_OWNERSHIP`: převod vlastnictví Nástěnky,
  * `CHANGE_MANAGER`: jmenování, odvolání nebo změna Managera,
  * `CHANGE_ROLE`: změna role člena Nástěnky,
  * `ADD_MEMBER`: přijetí nového člena,
  * `REMOVE_MEMBER`: odebrání člena nebo opuštění Nástěnky,
  * `DELETE_BOARD`: logické smazání Nástěnky (soft-delete),
  * `DELETE_TASK`: řízené trvalé smazání úkolu (controlled hard-delete),
  * `DELETE_AREA`: řízené trvalé smazání organizační oblasti a jejích obsažených úkolů (controlled hard-delete),
  * `ADMIN_INTERVENTION`: jakýkoliv administrativní zásah provedený globálním Adminem.
* **Nezávislost auditní stopy na životním cyklu entit:**
  Auditní záznamy destruktivních operací (`DELETE_TASK`, `DELETE_AREA`, `DELETE_BOARD`) se zapisují do nezávislého auditního úložiště Nástěnky. Auditní záznam **nesmí být uložen pouze jako součást mazaného objektu** a nesmí podléhat kaskádnímu odstranění při zániku entity. Záznam zůstává trvale zachován v auditní historii i po úplném fyzickém odstranění Tasku nebo Area.
* **Minimální obsahová struktura auditního záznamu:**
  * `actor_id`: jednoznačná identita uživatele, který operaci vyvolal,
  * `timestamp`: přesný čas provedení operace na serveru (UTC),
  * `board_id`: identifikace Nástěnky, v jejímž kontextu změna proběhla,
  * `operation`: název operace (např. `DELETE_TASK`, `DELETE_AREA`, `TRANSFER_OWNERSHIP`),
  * `target_id`: identifikace uživatele nebo entity, které se změna týká (např. ID smazaného úkolu či oblasti),
  * `previous_state`: hodnota stavu / klíčová metadata před provedením změny (např. původní název a stav úkolu, název oblasti a počet obsažených úkolů),
  * `new_state`: hodnota stavu po provedení změny (např. `PERMANENTLY_DELETED`),
  * `metadata`: volitelná doplňková metadata (např. potvrzovací řetězec `SMAZAT`, důvod administrativního zásahu).

> [!IMPORTANT]
> **Audit skutečného stavu:** Auditní záznam se vytváří výhradně po úspěšném dokončení a commitu transakce. Zaznamenává reálně nastalou změnu, nikoliv pouhý pokus o operaci.

---

### 10.12 Atomické operace a transakční hranice

Následující operace představují kritické transakční hranice systému a **musí být databázově provedeny jako jediná nedílná (atomická) operace**:

1. **Vytvoření Nástěnky:**
   * Atomicky vzniká záznam `Board` a odpovídající záznam `Membership(role = OWNER)`.
   * Nesmí nastat stav, kdy vznikne záznam Nástěnky bez přiřazeného Ownera.
2. **Převod vlastnictví Nástěnky:**
   * Atomicky probíhá: povýšení Targetu na `OWNER` + odebrání vlastnictví původnímu Ownerovi + jeho převedení na `MANAGER` (nebo `MEMBER`).
   * Zaručuje, že v žádném okamžiku neexistuje stav 0 ani 2 Ownerů.
3. **Změna Managera Nástěnky:**
   * Atomicky ověřuje a obsazuje pozici Managera tak, aby byla vyloučena souběžná existence dvou Managerů na téže Nástěnce.
4. **Kritické administrativní zásahy Admina:**
   * Zásahy Admina podléhají stejným transakčním pravidlům a integritním omezením jako běžné operace.
5. **Řízené trvalé smazání úkolu (`DELETE_TASK`):**
   * Atomicky probíhá: fyzické odstranění `Task` + kaskádní odstranění přiřazených účastníků (`TaskParticipant`) + zápis auditního záznamu `DELETE_TASK` do nezávislého auditního protokolu.
   * Zaručuje, že nevzniknou žádné sirotčí vazby a auditní záznam je garantovaně uložen.
6. **Smazání oblasti (`DELETE_AREA`):**
   * Atomicky probíhá: ověření existence oblasti + vyhledání všech obsažených úkolů + kaskádní trvalé odstranění těchto úkolů a jejich vazeb + odstranění samotné entity `Area` + zápis auditního záznamu `DELETE_AREA` do nezávislého auditního protokolu.
   * Zaručuje, že nevzniknou žádné sirotčí vazby, úkoly zanikají společně s oblastí podle schváleného pravidla a operace se provede buď celá, nebo vůbec.

---

### 10.13 API jako logický architektonický kontrakt

Specifikované operace a endpointy představují **logický architektonický kontrakt** domény Nástěnka:
* Nejsou vázány na konkrétní transportní technologii, knihovnu ani framework.
* Každá operace definuje:
  * svůj doménový účel,
  * Actora a vyžadovaná oprávnění,
  * povinné a volitelné vstupy,
  * validační a integrační podmínky na backendu,
  * garantovaný výsledek a návratový stav,
  * chybové odpovědi,
  * transakční hranice (atomicita),
  * požadavek na zápis do auditní stopy.

---

### 10.14 Doménové invarianty po provedení operací

Každá API operace musí zanechat systém v konzistentním stavu splňujícím následujících deset kritických invariantů:

1. **Právě jeden Owner:** Každá aktivní Nástěnka má v každém okamžiku přesně jednoho platného uživatele v roli `OWNER`.
2. **Maximálně jeden Manager:** Žádná Nástěnka nemá v žádném okamžiku více než jednoho uživatele v roli `MANAGER` (`0..1`).
3. **Unikátnost členství:** Dvojice `(user_id, board_id)` je unikátní; jeden uživatel nemůže mít na stejné Nástěnce více členství.
4. **Příslušnost řešitele:** `Task.assignee_id` musí být vždy aktivním členem stejné Nástěnky, do které daný úkol patří.
5. **Příslušnost spoluřešitelů:** Každý `TaskParticipant.user_id` musí mít aktivní členství na stejné Nástěnce jako daný úkol.
6. **Ochrana Ownera před odstraněním:** Uživatele v roli `OWNER` nelze z Nástěnky odebrat ani jeho účet deaktivovat bez předchozího převodu vlastnictví nebo administrativního zásahu Admina.
7. **Atomicita převodu vlastnictví:** Převod vlastnictví je nedílná transakce garantující okamžitý přechod z jednoho Ownera na druhého.
8. **Atomicita založení Nástěnky:** Nástěnka a její výchozí Owner vznikají společně v jedné transakci.
9. **Konzistence smazané Nástěnky:** Soft-deleted Nástěnka (`deleted_at IS NOT NULL`) je nepřístupná pro běžný provoz a nepřijímá nové operace.
10. **Oddělení rolí Nástěnky od úkolů:** Role na Nástěnce nezakládá automatickou řešitelskou odpovědnost za úkoly; správa Nástěnky a řešení úkolů zůstávají striktně autonomními vrstvami.

---

## 11. Step 8 – Databázové schéma, constrainty a transakční pravidla

Tato kapitola převádí schválený logický doménový model (Krok 6) a doménové operace s autorizačními hranicemi (Step 7) do formální úrovně databázového schématu, integritních omezení (constraints) a transakčních pravidel.

Návrh je koncipován v souladu s relačními principy, avšak zůstává **technologicky neutrální** – nepředepisuje konkrétní databázový produkt (PostgreSQL, SQLite, MySQL apod.) ani nespecifikuje fyzické SQL DDL skripty či migrační soubory. Definuje však závazná strukturální, typová a relační pravidla, která musí jakákoliv budoucí implementace databázové vrstvy striktně garantovat.

### 11.1 Základní princip dělby odpovědnosti (DB vs. Backend)
Architektura striktně rozlišuje dvě vrstvy ochrany integrity:
* **Aplikační vrstva (Backend):** Je jedinou autoritou rozhodující o tom, *KDO* smí operaci spustit (autentizace a autorizace rolí) a *ZDA* má požadavek platný obchodní kontext v souladu s doménovými pravidly. Databázový constraint nesmí být nikdy považován za náhradu autorizace.
* **Databázová vrstva:** Je garantem toho, *CO* je vůbec přípustné v úložišti uchovat. Pomocí integritních omezení (PK, FK, UNIQUE, CHECK, NOT NULL) a transakčních záruk (ACID) představuje poslední neprostupnou linii ochrany před vznikem nekonzistentních, neúplných či osiřelých dat.

---

### 11.2 Databázové entity a sloupce

Systém definuje sedm základních databázových entit: `User`, `Board`, `Membership`, `Area`, `Task`, `TaskParticipant` a `AuditLog`.

#### 11.2.1 Tabulka `User` (Uživatelský účet)
Reprezentuje fyzickou osobu registrovanou v systému.

```text
User
----
id           : ID (Primary Key, NOT NULL, neměnný)
name         : String (NOT NULL, zobrazované jméno uživatele)
email        : String (NOT NULL, přihlašovací e-mail, celosystémově unikátní)
global_role  : String / Enum (NOT NULL, povolené hodnoty: 'USER', 'ADMIN', výchozí: 'USER')
is_active    : Boolean (NOT NULL, výchozí: true; určuje možnost přihlášení a řešení)
created_at   : Timestamp (NOT NULL, čas registrace)
updated_at   : Timestamp (NOT NULL, čas poslední změny údajů)
deleted_at   : Timestamp, Nullable (čas logického smazání / deaktivace; NULL = aktivní)
```

*Pravidla a constrainty pro User:*
* `UNIQUE(email)`: Zaručuje celosystémovou jednoznačnost e-mailové identity.
* `CHECK(global_role IN ('USER', 'ADMIN'))`: V tabulce `User` jsou povoleny výhradně globální systémové role. Role `OWNER`, `MANAGER` a `MEMBER` **nesmí být nikdy uloženy v tabulce `User`** – jedná se výhradně o kontextové role v rámci konkrétní Nástěnky uložené v tabulce `Membership`.
* `is_active` a `deleted_at`: Slouží k deaktivaci a soft-delete uživatelského účtu. Fyzický záznam zůstává trvale v databázi pro ochranu historické a referenční integrity (autorské vazby `created_by`, záznamy v `AuditLog`).
* **Integritní ochrana OWNERa:** Uživatel, který je aktuálním OWNERem jakékoliv aktivní Nástěnky, **nesmí být deaktivován ani smazán**, dokud neproběhne řádný převod vlastnictví na jiného člena nebo direktivní zásah Admina.

#### 11.2.2 Tabulka `Board` (Nástěnka)
Reprezentuje samostatný pracovní prostor s vlastními oblastmi, úkoly a členy.

```text
Board
-----
id           : ID (Primary Key, NOT NULL, neměnný)
name         : String (NOT NULL, neprázdný název Nástěnky)
description  : String / Text, Nullable (volitelný popis Nástěnky)
created_by   : ID (Foreign Key → User.id, NOT NULL, historický zakladatel)
created_at   : Timestamp (NOT NULL, čas vytvoření Nástěnky)
updated_at   : Timestamp (NOT NULL, čas poslední aktualizace metadat)
deleted_at   : Timestamp, Nullable (čas logického smazání; NULL = aktivní, hodnota = soft-deleted)
```

*Pravidla a constrainty pro Board:*
* `created_by` představuje **pouze historického zakladatele Nástěnky** a je neměnný.
* **Aktuální OWNER Nástěnky se nikdy neurčuje z `Board.created_by`**, nýbrž výhradně z aktivního záznamu v tabulce `Membership`, kde `role = 'OWNER'`.
* **Kritický invariant:** Každá aktivní Nástěnka (`deleted_at IS NULL`) musí mít v každém okamžiku **přesně jednoho platného OWNERa**.
* `deleted_at`: Slouží k soft-delete Nástěnky. Soft-deleted Nástěnka je skryta z běžného provozu a nepřijímá nové operace.

#### 11.2.3 Tabulka `Membership` (Členství v Nástěnce)
Relační entita propojující uživatele s konkrétní Nástěnkou a definující jeho kontextová práva.

```text
Membership
----------
id           : ID (Primary Key, NOT NULL, neměnný)
user_id      : ID (Foreign Key → User.id, NOT NULL)
board_id     : ID (Foreign Key → Board.id, NOT NULL)
role         : String / Enum (NOT NULL, povolené hodnoty: 'OWNER', 'MANAGER', 'MEMBER')
created_at   : Timestamp (NOT NULL, čas vzniku členství)
updated_at   : Timestamp (NOT NULL, čas poslední změny role)
```

*Pravidla a constrainty pro Membership:*
* `UNIQUE(user_id, board_id)`: Každý uživatel může mít na téže Nástěnce nejvýše jedno členství.
* `CHECK(role IN ('OWNER', 'MANAGER', 'MEMBER'))`: Omezuje přípustné role na Nástěnce.
* Jeden uživatel může být členem více Nástěnek současně a na každé z nich mít zcela odlišnou roli.
* **Kritické invarianty kardinality rolí:**
  * Právě jeden `OWNER` na aktivní Nástěnku (kardinalita `1`).
  * Maximálně jeden `MANAGER` na Nástěnku (kardinalita `0..1`).
  * Libovolný počet členů v roli `MEMBER` (kardinalita `0..N`).
* **Jednoduchý constraint vs. business invariant:**
  * Unikátnost `UNIQUE(user_id, board_id)` je jednoduchý relační constraint vynutitelný přímo unikátním indexem.
  * Omezení „právě 1 OWNER“ a „max. 1 MANAGER“ představují cross-row invarianty, které v databázi vyžadují parciální unikátní indexy (např. `UNIQUE(board_id) WHERE role = 'OWNER'` a `UNIQUE(board_id) WHERE role = 'MANAGER'`) v kombinaci s transakční kontrolou backendu, aby Nástěnka nikdy nezůstala bez Ownera.

#### 11.2.4 Tabulka `Area` (Organizační oblast Nástěnky)
Reprezentuje organizační, tematický či prostorový okruh úkolů na konkrétní Nástěnce.

```text
Area
----
id           : ID (Primary Key, NOT NULL, neměnný)
board_id     : ID (Foreign Key → Board.id, NOT NULL)
name         : String (NOT NULL, neprázdný název oblasti)
description  : String / Text, Nullable (volitelný popis oblasti)
created_at   : Timestamp (NOT NULL, čas vytvoření oblasti)
updated_at   : Timestamp (NOT NULL, čas poslední změny)
```

*Pravidla a constrainty pro Area:*
* Oblast patří **výhradně jedné Nástěnce** (`board_id`). Nesmí být sdílena mezi různými Nástěnkami.
* `UNIQUE(board_id, name)`: Název oblasti je v rámci dané Nástěnky jednoznačný.
* Oblasti jsou **uživatelsky definované** (např. *Prodejna*, *Sklad*, *Chata*, *Dům*, *Koláčkova*). Nejedná se o pevný systémový číselník či enum.
* Oblast nemá atribut `deleted_at`. Odstranění oblasti probíhá jako **controlled hard-delete** (viz podkapitola 11.7.6).

#### 11.2.5 Tabulka `Task` (Úkol)
Základní pracovní jednotka patřící konkrétní Nástěnce.

```text
Task
----
id           : ID (Primary Key, NOT NULL, neměnný)
board_id     : ID (Foreign Key → Board.id, NOT NULL)
area_id      : ID (Foreign Key → Area.id, Nullable; volitelné zařazení do oblasti)
title        : String (NOT NULL, neprázdný název úkolu)
description  : Text / String, Nullable (podrobný popis úkolu)
status       : String / Enum (NOT NULL, výchozí: 'NOVÉ')
priority     : String / Enum (NOT NULL, výchozí: 'BĚŽNÁ')
due_date     : Date / Timestamp, Nullable (termín splnění)
created_by   : ID (Foreign Key → User.id, NOT NULL, historický autor úkolu)
assignee_id  : ID (Foreign Key → User.id, Nullable; NULL = 'Nepřiřazeno')
created_at   : Timestamp (NOT NULL, čas vytvoření úkolu)
updated_at   : Timestamp (NOT NULL, čas poslední aktualizace úkolu)
completed_at : Timestamp, Nullable (čas dokončení úkolu / přechodu do HOTOVO)
```

*Pravidla a constrainty pro Task:*
* `CHECK(status IN ('NOVÉ', 'PŘEVZATÉ', 'ROZPRACOVANÉ', 'ČEKÁ SE', 'HOTOVO', 'ARCHIVOVÁNO'))`
* `CHECK(priority IN ('BĚŽNÁ', 'SPĚCHÁ'))`
* Úkol patří **právě jedné Nástěnce** (`board_id`).
* Pokud má úkol vyplněnou oblast (`area_id IS NOT NULL`), musí tato oblast patřit ke stejné Nástěnce (`Area.board_id == Task.board_id`).
* `created_by` je neměnná autorská vazba; autor zůstává zachován i po odchodu uživatele z Nástěnky či deaktivaci jeho účtu.
* `assignee_id` představuje aktuálního Hlavního Řešitele:
  * Hodnota `NULL` znamená stav `Nepřiřazeno`.
  * Pokud je zadán, musí mít aktivní `Membership` na stejné Nástěnce (`Task.board_id`).
* Striktní autonomie vrstev: `created_by ≠ assignee_id` (autor nerovná se řešitel). Role na Nástěnce (`Membership.role`) nezakládá automatické řešitelství úkolu.
* Trvalé smazání úkolu probíhá jako **controlled hard-delete** (viz podkapitola 11.7.5).

#### 11.2.6 Tabulka `TaskParticipant` (Spoluřešitelé úkolu)
Vazební entita pro evidenci spoluřešitelů podílejících se na řešení úkolu.

```text
TaskParticipant
---------------
id           : ID (Primary Key, NOT NULL, neměnný)
task_id      : ID (Foreign Key → Task.id, NOT NULL)
user_id      : ID (Foreign Key → User.id, NOT NULL)
role         : String / Enum (NOT NULL, povolená hodnota: 'SPOLUŘEŠITEL', výchozí: 'SPOLUŘEŠITEL')
created_at   : Timestamp (NOT NULL, čas připojení k úkolu)
```

*Pravidla a constrainty pro TaskParticipant:*
* `UNIQUE(task_id, user_id)`: Jeden uživatel nesmí být k témuž úkolu připojen jako spoluřešitel duplicitně.
* `CHECK(role = 'SPOLUŘEŠITEL')`
* **Podmínka členství:** Spoluřešitel (`user_id`) musí mít platné aktivní členství (`Membership`) na stejné Nástěnce, do které patří daný úkol.
* **Podmínka existence řešitele:** Záznam v `TaskParticipant` smí existovat pouze u úkolu, který má platného Hlavního Řešitele (`Task.assignee_id IS NOT NULL`). U úkolu ve stavu `Nepřiřazeno` nesmí existovat žádný spoluřešitel.
* Role spoluřešitele vůči úkolu je zcela nezávislá na jeho roli na Nástěnce (`Membership.role`).

#### 11.2.7 Tabulka `AuditLog` (Nezávislý auditní protokol)
Samostatná, vysoce chráněná entita pro neměnný chronologický záznam bezpečnostních, správních a destruktivních událostí.

```text
AuditLog
--------
id             : ID (Primary Key, NOT NULL, neměnný)
actor_id       : ID (Foreign Key → User.id, NOT NULL, iniciátor operace)
timestamp      : Timestamp (NOT NULL, přesný čas operace v UTC)
board_id       : ID (Foreign Key → Board.id, Nullable pro systémové zásahy, jinak NOT NULL)
operation      : String (NOT NULL, identifikátor typu operace)
target_id      : String / ID (NOT NULL, identifikátor cílové entity či uživatele)
previous_state : Text / JSON / String, Nullable (stav či metadata před operací)
new_state      : Text / JSON / String, Nullable (stav či metadata po operaci)
metadata       : Text / JSON / String, Nullable (kontext: potvrzení SMAZAT, počet smazaných položek)
```

*Kritická pravidla pro AuditLog:*
* **Nezávislost na životním cyklu cílového objektu:** AuditLog je navržen jako samostatná, kaskádně nemažeelná entita:
  * Smazání úkolu (`DELETE_TASK`) nesmí smazat odpovídající záznamy v `AuditLog`.
  * Smazání oblasti (`DELETE_AREA`) nesmí smazat odpovídající záznamy v `AuditLog`.
  * Logické smazání Nástěnky (`DELETE_BOARD`) nesmí smazat odpovídající záznamy v `AuditLog`.
  * Deaktivace uživatelského účtu nesmí smazat ani změnit jeho historické záznamy v `AuditLog`.
* **Append-only charakter:** Záznamy v `AuditLog` vznikají výhradně po úspěšném commitu transakce. Jakákoliv dodatečná modifikace (`UPDATE`) nebo smazání (`DELETE`) záznamů v `AuditLog` je na databázové i aplikační úrovni přísně zakázána.

---

### 11.3 Primární a cizí klíče (Katalog relačních vazeb)

Následující přehled formalizuje všechny relační vazby systému, jejich kardinality a chování z hlediska referenční integrity:

| Vazba (Foreign Key) | Cílová entita | Kardinalita | Nullable | Význam vazby | Chování při odstranění cíle |
|---|---|:---:|:---:|---|---|
| `Board.created_by` | `User.id` | N:1 | NE | Historický zakladatel Nástěnky | `RESTRICT` (uživatele nelze fyzicky smazat, pokud založil Nástěnku) |
| `Membership.user_id` | `User.id` | N:1 | NE | Uživatel s členstvím na Nástěnce | `RESTRICT` při běžném provozu; `CASCADE` pouze při fyzickém purge |
| `Membership.board_id` | `Board.id` | N:1 | NE | Nástěnka, ke které členství náleží | `CASCADE` při trvalém odstranění Boardu; při soft-delete zůstává |
| `Area.board_id` | `Board.id` | N:1 | NE | Nástěnka, do které oblast patří | `CASCADE` při trvalém odstranění Boardu |
| `Task.board_id` | `Board.id` | N:1 | NE | Nástěnka, do které úkol patří | `CASCADE` při trvalém odstranění Boardu |
| `Task.area_id` | `Area.id` | N:1 | ANO | Organizační oblast úkolu | `CASCADE` v rámci controlled hard-delete oblasti (viz 11.7.6) |
| `Task.created_by` | `User.id` | N:1 | NE | Původní autor úkolu | `RESTRICT` (historická autorská vazba musí přetrvat) |
| `Task.assignee_id` | `User.id` | N:1 | ANO | Aktuální Hlavní Řešitel (`NULL` = Nepřiřazeno) | `SET NULL` při odchodu člena / deaktivaci řešitele |
| `TaskParticipant.task_id` | `Task.id` | N:1 | NE | Úkol, ke kterému účast náleží | `CASCADE` při trvalém smazání úkolu (řízený hard-delete) |
| `TaskParticipant.user_id` | `User.id` | N:1 | NE | Spoluřešitel úkolu | `CASCADE` při vystoupení/odebrání uživatele z Nástěnky |
| `AuditLog.actor_id` | `User.id` | N:1 | NE | Iniciátor auditované operace | `RESTRICT` (audit nesmí ztratit vazbu na původce) |
| `AuditLog.board_id` | `Board.id` | N:1 | ANO | Nástěnka auditované události | `RESTRICT` / zachování hodnoty i při soft-delete Boardu |

---

### 11.4 Ochrana proti cross-board vazbám (Teritoriální integrita Nástěnky)

Jedním z nejdůležitějších bezpečnostních invariantů systému Nástěnka je **striktní izolace jednotlivých Nástěnek**. Datový model a aplikační vrstva musí absolutně vyloučit vznik nekonzistentních křížových vazeb mezi Nástěnkami (tzv. cross-board anomálie):

> [!IMPORTANT]
> **Pravidlo teritoriální integrity Nástěnky:**
> 1. Úkol patřící Nástěnce A **nesmí mít oblast (`area_id`) z Nástěnky B**.
> 2. Úkol patřící Nástěnce A **nesmí mít řešitele (`assignee_id`), který není aktivním členem Nástěnky A**.
> 3. Úkol patřící Nástěnce A **nesmí mít spoluřešitele (`TaskParticipant.user_id`), který není aktivním členem Nástěnky A**.

#### Rozlišení jednoduché a kontextové integrity:
1. **Jednoduchá referenční integrita (DB úroveň):**
   * Běžný cizí klíč ověřuje pouze fyzickou existenci cílového řádku: `Task.board_id → Board.id`, `Task.area_id → Area.id`, `Task.assignee_id → User.id`.
   * Samotný jednoduchý FK však nepozná, zda `Area` a `Task` patří ke stejnému `Boardu`, ani zda má `User` na daném `Boardu` záznam v tabulce `Membership`.
2. **Kontextová integrita (složené DB vazby a transakční logika):**
   * *Ochrana Task ↔ Area:* Lze v DB podpořit složeným cizím klíčem `FOREIGN KEY (board_id, area_id) REFERENCES Area(board_id, id)` za předpokladu unikátního indexu `UNIQUE(board_id, id)` v tabulce `Area`, případně striktní kontrolou v aplikační transakci před uložením.
   * *Ochrana Task ↔ Assignee a Task ↔ Participant:* Vyžaduje kontextové ověření existence aktivního členství:
     ```text
     EXISTS (SELECT 1 FROM Membership WHERE user_id = :user_id AND board_id = :board_id)
     ```
   * Backend je autorita a garantuje tuto kontrolu atomicky v rámci transakce každé změny řešitele či účastníka.

---

### 11.5 Unikátní omezení a doménové constrainty (CHECK & UNIQUE)

Pro zajištění datové integrity na úrovni databázového úložiště jsou definována následující omezení:

1. **Unikátní constrainty (UNIQUE):**
   * `UNIQUE(User.email)`: Vylučuje vznik dvou uživatelských účtů se stejným e-mailem.
   * `UNIQUE(Membership.user_id, Membership.board_id)`: Vylučuje vícenásobné členství jednoho uživatele v téže Nástěnce.
   * `UNIQUE(Area.board_id, name)`: Vylučuje existenci dvou oblastí se shodným názvem v rámci jedné Nástěnky.
   * `UNIQUE(TaskParticipant.task_id, user_id)`: Vylučuje duplicitní přiřazení téhož spoluřešitele k úkolu.
2. **Strukturální parciální unikátní constrainty (Role v Membership):**
   * `UNIQUE(board_id) WHERE role = 'OWNER'`: Zajišťuje, že pro každou Nástěnku může v tabulce `Membership` existovat **nejvýše jeden řádek s rolí OWNER**.
   * `UNIQUE(board_id) WHERE role = 'MANAGER'`: Zajišťuje, že pro každou Nástěnku může v tabulce `Membership` existovat **nejvýše jeden řádek s rolí MANAGER**.
3. **Doménové CHECK constrainty (Výčtové hodnoty):**
   * `CHECK (User.global_role IN ('USER', 'ADMIN'))`
   * `CHECK (Membership.role IN ('OWNER', 'MANAGER', 'MEMBER'))`
   * `CHECK (Task.status IN ('NOVÉ', 'PŘEVZATÉ', 'ROZPRACOVANÉ', 'ČEKÁ SE', 'HOTOVO', 'ARCHIVOVÁNO'))`
   * `CHECK (Task.priority IN ('BĚŽNÁ', 'SPĚCHÁ'))`
   * `CHECK (TaskParticipant.role = 'SPOLUŘEŠITEL')`
4. **NOT NULL omezení:**
   * Povinná pole jsou striktně označena `NOT NULL`: `User.email`, `User.name`, `User.global_role`, `Board.name`, `Board.created_by`, `Membership.role`, `Area.name`, `Task.title`, `Task.status`, `Task.priority`, `Task.created_by`, `AuditLog.operation`, `AuditLog.actor_id`.

---

### 11.6 Strukturální invarianty rolí OWNER a MANAGER

Systém definuje striktní kardinalitu rolí pro každou aktivní Nástěnku:

```text
┌────────────────────────────────────────────────────────┐
│               KARDINALITA ROLÍ NA NÁSTĚNCE              │
├────────────────────────────────────────────────────────┤
│  OWNER   : právě 1 (přesně 1 platný vlastník)          │
│  MANAGER : 0..1    (maximálně 1 provozní správce)      │
│  MEMBER  : 0..N    (libovolný počet běžných členů)     │
└────────────────────────────────────────────────────────┘
```

#### Jak databázová vrstva a transakce brání porušení invariantů:
1. **Prevence dvou Ownerů (žádné zdvojení vlastnictví):**
   * Parciální unikátní index v DB `UNIQUE(board_id) WHERE role = 'OWNER'` okamžitě zablokuje jakýkoliv pokus o vložení nebo povýšení druhého člena na roli `OWNER`.
2. **Prevence nulového Ownera (žádná Nástěnka bez vlastníka):**
   * Založení Nástěnky a přiřazení prvního Ownera probíhá v jediné atomické transakci (`CREATE_BOARD`).
   * Běžné odebrání člena (`REMOVE_MEMBER`) odmítne smazat řádek, pokud `Membership.role == 'OWNER'` (HTTP 409 Conflict).
   * Převod vlastnictví probíhá atomicky (povýšení nového + sesazení starého v jednom transakčním bloku).
3. **Prevence dvou Managerů:**
   * Parciální unikátní index `UNIQUE(board_id) WHERE role = 'MANAGER'` fyzicky vylučuje souběžnou existenci dvou řádků s rolí `MANAGER` na téže Nástěnce. Pokus o jmenování druhého Managera selže na úrovni DB i aplikační validace (HTTP 409 Conflict).

---

### 11.7 Transakční hranice klíčových operací

Každá níže uvedená operace představuje **ucelenou atomickou jednotku práce (ACID transakci)**. Pokud kterýkoliv krok transakce selže nebo poruší integritní omezení, transakce je celá vrácena zpět (`ROLLBACK`) a v databázi nevznikne žádný nekonzistentní mezistav.

#### 11.7.1 Vytvoření Nástěnky (`CREATE_BOARD`)
Atomický transakční proces:
1. Vložení záznamu `Board` (`name`, `created_by = actor_id`, `created_at`).
2. Vložení záznamu `Membership` pro vlastníka (`board_id = Board.id`, `user_id = target_owner_id`, `role = 'OWNER'`).
   * *Poznámka:* Pokud Nástěnku zakládá běžný uživatel, je `target_owner_id == actor_id`. Pokud Nástěnku zakládá globální Admin pro jiného uživatele, `created_by = Admin.id` a `Membership(user_id = target_owner_id, role = 'OWNER')`.
3. Zápis do `AuditLog` (`operation = 'CREATE_BOARD'`).
*Výsledek:* Nástěnka a její Owner vznikají současně; Nástěnka bez Ownera nikdy nevznikne.

#### 11.7.2 Převod vlastnictví Nástěnky (`TRANSFER_OWNERSHIP`)
Atomický transakční proces:
1. Ověření platnosti volajícího (`actor` je současný `OWNER` nebo globální `ADMIN`).
2. Ověření cílového uživatele (`target_user_id` je platný, aktivní uživatel).
3. Případné založení `Membership` pro cílového uživatele, pokud ještě není členem.
4. Aktualizace role původního Ownera:
   * Pokud pozice Managera na Nástěnce není obsazena a je požadováno: `Membership.role = 'MANAGER'`.
   * V opačném případě: `Membership.role = 'MEMBER'`.
5. Aktualizace role cílového uživatele: `Membership.role = 'OWNER'`.
6. Ověření invariantu: na Nástěnce existuje právě jeden `OWNER` a max. jeden `MANAGER`.
7. Zápis do nezávislého `AuditLog` (`operation = 'TRANSFER_OWNERSHIP'`).
*Výsledek:* Okamžitý atomický přechod bez rizika vzniku 0 nebo 2 vlastníků.

#### 11.7.3 Správa členství a jmenování Managera (`MEMBERSHIP_OPERATIONS`)
* **Přidání člena (`ADD_MEMBER`):**
  1. Kontrola oprávnění (Owner, Manager nebo Admin).
  2. Kontrola neexistence duplicity: `NOT EXISTS Membership(user_id, board_id)`.
  3. Vložení `Membership` (výchozí role `MEMBER`).
  4. Zápis do `AuditLog`.
* **Odebrání člena (`REMOVE_MEMBER`):**
  1. Kontrola oprávnění: Uživatel v roli `OWNER` nesmí být odebrán (`role != 'OWNER'`).
  2. U všech úkolů dané Nástěnky, kde byl odcházející člen Hlavním Řešitelem (`Task.assignee_id == user_id`), systém nastaví `assignee_id = NULL` (přechod do `Nepřiřazeno`).
  3. Smazání všech vazeb z tabulky `TaskParticipant`, kde `TaskParticipant.user_id == user_id` v rámci dané Nástěnky.
  4. Smazání záznamu z tabulky `Membership`.
  5. Zachování všech jím dříve vytvořených entit (`Task.created_by`) a komentářů.
  6. Zápis do `AuditLog` (`operation = 'REMOVE_MEMBER'`).
* **Změna role člena (`CHANGE_ROLE` / `CHANGE_MANAGER`):**
  1. Kontrola oprávnění (Owner nebo Admin).
  2. Pokud je cílová role `MANAGER`, ověření, že na Nástěnce dosud není žádný jiný aktivní Manager.
  3. Aktualizace `Membership.role`.
  4. Zápis do `AuditLog`.

#### 11.7.4 Přiřazení řešitele a účastníků (`ASSIGN_TASK`, `ADD_PARTICIPANT`)
* **Přiřazení řešitele (`PATCH /tasks/{id}/assignee`):**
  1. Kontrola teritoriální integrity: ověření, že `target_assignee_id` (není-li `NULL`) má aktivní `Membership` na stejné Nástěnce jako úkol (`Task.board_id`).
  2. Aktualizace `Task.assignee_id` (a případný posun stavu z `NOVÉ` na `PŘEVZATÉ`).
  3. Zápis do historie změn úkolu.
* **Připojení spoluřešitele (`POST /tasks/{id}/participants`):**
  1. Ověření existence Hlavního Řešitele: `Task.assignee_id IS NOT NULL`.
  2. Kontrola teritoriální integrity: `user_id` musí být aktivním členem dané Nástěnky.
  3. Kontrola neexistence duplicity: `NOT EXISTS TaskParticipant(task_id, user_id)`.
  4. Vložení záznamu `TaskParticipant`.
  5. Zápis do historie změn úkolu.

#### 11.7.5 Řízený hard-delete úkolu (`DELETE_TASK`)
Atomický transakční proces trvalého odstranění úkolu:
1. Ověření autorizace (volající je Řešitel, Spoluřešitel, Manager, Owner nebo Admin).
2. Ověření bezpečnostního potvrzovacího řetězce `SMAZAT`.
3. Ověření existence úkolu a načtení jeho původních metadat pro audit.
4. Kaskádní odstranění všech přiřazených záznamů `TaskParticipant` daného úkolu.
5. Fyzické odstranění samotného záznamu `Task` z databáze.
6. Zápis auditního záznamu `DELETE_TASK` do **nezávislé tabulky `AuditLog`** (záznam obsahuje ID smazaného úkolu, název, původní stav a iniciátora).
*Výsledek:* Úkol trvale zaniká, nevznikají žádné sirotčí vazby a auditní stopa zůstává trvale uložena.

#### 11.7.6 Řízený hard-delete oblasti (`DELETE_AREA`)
Atomický transakční proces trvalého odstranění organizační oblasti:
1. Ověření autorizace (volající je Manager, Owner nebo Admin; Member nemá oprávnění).
2. Ověření bezpečnostního potvrzovacího řetězce `SMAZAT`.
3. Ověření existence oblasti na dané Nástěnce (`Area.board_id == boardId`).
4. Vyhledání všech úkolů náležejících do této oblasti (`SELECT id FROM Task WHERE area_id = areaId`).
5. Kaskádní odstranění všech záznamů `TaskParticipant` vázaných na tyto nalezené úkoly.
6. Fyzické odstranění všech těchto úkolů z tabulky `Task`.
7. Fyzické odstranění samotného záznamu `Area` z databáze.
8. Zápis auditního záznamu `DELETE_AREA` do **nezávislé tabulky `AuditLog`** (včetně metadat o počtu smazaných úkolů).
*Výsledek:* Oblast i všechny její úkoly zanikají v jediné nedílné transakci; nevznikají sirotčí úkoly bez oblasti a audit zůstává zachován.

#### 11.7.7 Logické smazání Nástěnky (`DELETE_BOARD`)
1. Ověření autorizace (výhradně Owner nebo Admin).
2. Ověření potvrzení `SMAZAT`.
3. Nastavení `Board.deleted_at = NOW()`.
4. Veškerá podřízená data (Membership, Area, Task, AuditLog) zůstávají fyzicky zachována.
5. Zápis auditního záznamu `DELETE_BOARD` do nezávislé tabulky `AuditLog`.

---

### 11.8 Životní cyklus dat: Soft-delete vs. Controlled Hard-delete

Architektura striktně definuje, které entity podléhají logickému smazání (soft-delete) a které řízenému fyzickému zániku (controlled hard-delete):

```text
┌─────────────────────────┬─────────────────────────┬───────────────────────────────────────────┐
│ ENTITA                  │ TYP SMAZÁNÍ             │ MECHANISMUS A DŮSLEDEK                    │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ User (Uživatelský účet) │ Soft-delete             │ is_active = false, deleted_at = Timestamp │
│                         │ (Deaktivace)            │ Data zachována pro referenční integritu.  │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Board (Nástěnka)        │ Soft-delete             │ deleted_at = Timestamp                    │
│                         │ (Logické smazání)       │ Nástěnka skryta, obnova možná Adminem.    │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Area (Oblast)           │ Controlled hard-delete  │ Fyzické smazání Area i obsažených Tasků   │
│                         │ (Řízené trvalé smazání) │ s pojistkou SMAZAT; nezávislý audit.      │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Task (Úkol)             │ Controlled hard-delete  │ Fyzické smazání Tasku a účastníků         │
│                         │ (Řízené trvalé smazání) │ s pojistkou SMAZAT; nezávislý audit.      │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ AuditLog                │ NIKDY SE NEMAŽE         │ Trvalý append-only protokol, přežívá      │
│                         │ (Trvalá auditní stopa)  │ smazání Tasku, Area i Boardu.             │
└─────────────────────────┴─────────────────────────┴───────────────────────────────────────────┘
```

---

### 11.9 Referenční akce při odstranění dat (`RESTRICT`, `CASCADE`, `SET NULL`)

Koncepční chování databázových cizích klíčů při mazání:

1. **`CASCADE` (Kaskádní smazání):**
   * Používá se výhradně tam, kde podřízená entita tvoří neoddělitelnou součást nadřazeného celku a její existence bez nadřazeného objektu postrádá jakýkoliv smysl:
     * `TaskParticipant` při smazání `Task` (spoluřešitelé zanikají s úkolem).
     * `Task` a `TaskParticipant` při controlled hard-delete `Area` (úkoly zanikají s oblastí podle schváleného pravidla).
     * `Area` a `Membership` při případném úplném fyzickém purge Nástěnky z databáze.
2. **`RESTRICT` (Zákaz smazání):**
   * Brání destrukci historických a autorských referencí:
     * Zákaz fyzického smazání uživatele z tabulky `User`, pokud existují úkoly s jeho `created_by` nebo auditní záznamy s jeho `actor_id`.
     * Zákaz smazání `Board`, pokud existují neuzavřené vazby, které neprošly řízeným procesem.
3. **`SET NULL` (Uvolnění vazby):**
   * Používá se tam, kde entita může pokračovat v existenci i po uvolnění vazby:
     * `Task.assignee_id`: Při odchodu člena z Nástěnky přechází úkol do stavu `Nepřiřazeno` nastavením `assignee_id = NULL`. Úkol zůstává plně zachován na Nástěnce.
4. **Oddělení DB kaskády od bezpečnostního oprávnění:**
   * Databázové pravidlo `CASCADE` je pouze nástroj technické referenční integrity, nikoliv náhrada autorizace. Kaskádní odstranění smí být vyvoláno výhradně přes řádně autorizovaný doménový endpoint s potvrzením `SMAZAT`.

---

### 11.10 Souhrnná matice transakční atomicity

Následující tabulka specifikuje, které doménové operace musí být v databázi zpracovány jako jediná atomická transakce a jaký je důvod tohoto požadavku:

| Operace | Atomická | Důvod / Zajištění integrity |
|---|:---:|---|
| `CREATE_BOARD` | **ANO** | Garantuje současný vznik `Board` a `Membership(OWNER)`. Vylučuje Nástěnku bez vlastníka. |
| `TRANSFER_OWNERSHIP` | **ANO** | Garantuje současné povýšení nového a sesazení původního Ownera. Vylučuje stav s 0 nebo 2 vlastníky. |
| `CHANGE_MANAGER` | **ANO** | Ověřuje a obsazuje roli Manager tak, aby nevznikli 2 Manageři na jedné Nástěnce (`0..1`). |
| `ADD_MEMBER` | **ANO** | Zajišťuje unikátnost členství a vytvoření záznamu s výchozí rolí v jednom kroku. |
| `REMOVE_MEMBER` | **ANO** | Atomicky uvolní úkoly do `Nepřiřazeno`, odstraní spoluřešitelství a zruší členství bez sirotků. |
| `CHANGE_ROLE` | **ANO** | Ověřuje integritní omezení rolí a provádí změnu oprávnění. |
| `ASSIGN_TASK` | **ANO** | Ověřuje teritoriální příslušnost řešitele k Nástěnce a aktualizuje úkol. |
| `ADD_TASK_PARTICIPANT` | **ANO** | Ověřuje existenci řešitele, členství na Nástěnce a zabraňuje duplicitní účasti. |
| `DELETE_TASK` | **ANO** | Atomicky odstraní `Task`, jeho vazby `TaskParticipant` a vytvoří nezávislý audit `DELETE_TASK`. |
| `DELETE_AREA` | **ANO** | Atomicky odstraní `Area`, všechny její obsažené `Tasky`, jejich účastníky a zapíše `DELETE_AREA`. |
| `DELETE_BOARD` | **ANO** | Nastaví `deleted_at` a vytvoří auditní záznam `DELETE_BOARD`. |

---

### 11.11 Dělba odpovědnosti: DB constraint vs. Backend doménové pravidlo

Databázová integrita a aplikační logika se vzájemně doplňují, ale plní odlišné úlohy:
* **Backend doménová vrstva rozhoduje:** *KDO* (který uživatel v jaké roli) smí operaci provést a *ZDA* má požadavek platný obchodní kontext.
* **Databázová vrstva garantuje:** *CO* je vůbec přípustné v úložišti uchovat, a představuje poslední neprostupnou linii ochrany konzistence dat.

| Pravidlo / Integritní požadavek | DB constraint | Backend / Doména | Obojí | Vysvětlení dělby odpovědnosti |
|---|:---:|:---:|:---:|---|
| Primární klíče (PK entit) | **ANO** | - | - | Fyzická jednoznačnost záznamu v úložišti. |
| Cizí klíče (FK vazby) | **ANO** | - | - | Základní referenční integrita (odkazovaná entita existuje). |
| Unikátnost emailu (`User.email`) | **ANO** | ANO | **OBOJÍ** | DB vynucuje unikátní index; backend vrací přívětivou validační chybu 409/422. |
| Unikátnost členství `(user_id, board_id)` | **ANO** | ANO | **OBOJÍ** | DB garantuje složený unikátní klíč; backend brání duplicitnímu přidání. |
| Unikátnost účastníka `(task_id, user_id)` | **ANO** | ANO | **OBOJÍ** | DB garantuje složený unikátní klíč; backend kontroluje oprávnění k připojení. |
| Unikátnost názvu oblasti na Nástěnce | **ANO** | ANO | **OBOJÍ** | DB garantuje `UNIQUE(board_id, name)`; backend validuje při vytváření. |
| Platné výčtové hodnoty (Enumy) | **ANO** | ANO | **OBOJÍ** | DB hlídá `CHECK`; backend zajišťuje serializaci a typovou bezpečnost. |
| Právě jeden OWNER na Nástěnce | Parciální index | Transakce | **OBOJÍ** | DB index brání 2 Ownerům; transakce backendu zaručuje, že nevznikne 0 Ownerů. |
| Maximálně jeden MANAGER (`0..1`) | Parciální index | Transakce | **OBOJÍ** | DB index brání 2 Managerům; backend kontroluje obsazenost pozice. |
| Assignee patří do stejného Boardu | - | Transakce | **Backend** | Kontextová vazba přes `Membership`; vyžaduje aplikační ověření v transakci. |
| Účastník patří do stejného Boardu | - | Transakce | **Backend** | Kontextová vazba přes `Membership`; vyžaduje aplikační ověření v transakci. |
| Oblast patří do stejného Boardu | Složený FK / - | Transakce | **OBOJÍ** | Ověřeno před zápisem, případně složeným FK `(board_id, area_id)`. |
| Účastník pouze u úkolu s řešitelem | - | Transakce | **Backend** | Čistě doménové pravidlo životního cyklu; backend brání přidání k Nepřiřazeno. |
| Atomický převod vlastnictví | - | Transakce | **Backend** | Komplexní multi-row transakce řízená aplikačním transakčním manažerem. |
| Autorizace operací (Role a práva) | - | Autorizace | **Backend** | Databáze neřeší práva uživatele; autorizaci striktně řídí backend. |
| Auditní záznam při operaci | - | Transakce | **Backend** | Backend v transakci garantuje povinný zápis do neměnné tabulky `AuditLog`. |

---

### 11.12 Závazné databázové invarianty (15 pilířů integrity)

Systém po provedení jakékoliv operace musí splňovat následujících patnáct kritických invariantů:

1. **Právě jeden Owner:** Každá aktivní Nástěnka má v každém okamžiku přesně jednoho platného uživatele s `Membership.role = 'OWNER'`.
2. **Maximálně jeden Manager:** Žádná Nástěnka nemá v žádném okamžiku více než jednoho uživatele s `Membership.role = 'MANAGER'` (`0..1`).
3. **Unikátnost členství:** Dvojice `(user_id, board_id)` je unikátní; jeden uživatel nemůže mít na stejné Nástěnce více záznamů v `Membership`.
4. **Teritorialita oblasti:** Každá `Area` patří právě jedné Nástěnce a její název je v rámci dané Nástěnky unikátní.
5. **Teritorialita úkolu:** Každý `Task` patří právě jedné Nástěnce (`board_id`).
6. **Konzistence úkolu a oblasti:** Pokud má úkol přiřazenou oblast (`area_id IS NOT NULL`), musí tato oblast patřit ke stejné Nástěnce jako úkol (`Area.board_id == Task.board_id`).
7. **Příslušnost řešitele k Nástěnce:** Pokud má úkol řešitele (`assignee_id IS NOT NULL`), musí tento uživatel mít aktivní platné `Membership` na stejné Nástěnce jako úkol.
8. **Příslušnost spoluřešitele k Nástěnce:** Každý uživatel evidovaný v `TaskParticipant` musí mít aktivní platné `Membership` na stejné Nástěnce, do které daný úkol patří.
9. **Unikátnost spoluřešitele:** Dvojice `(task_id, user_id)` v tabulce `TaskParticipant` je unikátní; vícenásobné přiřazení je vyloučeno.
10. **Nedělitelnost založení Nástěnky:** Nástěnka a její výchozí Owner vznikají společně v jedné transakci; Nástěnka bez platného Ownera nesmí v databázi existovat.
11. **Atomicita převodu vlastnictví:** Převod vlastnictví je nedílná operace zaručující okamžitý přechod vlastnictví bez mezistavu s 0 nebo 2 vlastníky.
12. **Ochrana Ownera před odstraněním:** Uživatele v roli `OWNER` nelze z Nástěnky odebrat ani jeho účet deaktivovat bez předchozího převodu vlastnictví nebo zásahu Admina.
13. **Nezávislost a trvalost auditu:** Záznamy v `AuditLog` jsou neměnné, trvalé a přežívají controlled hard-delete úkolu, oblasti i soft-delete Nástěnky.
14. **Integrita řízeného mazání:** Controlled hard-delete úkolu nebo oblasti probíhá transakčně a nesmí zanechat v databázi žádné osiřelé záznamy (`TaskParticipant`, osiřelé úkoly).
15. **Izolace smazané Nástěnky:** Soft-deleted Nástěnka (`deleted_at IS NOT NULL`) je nepřístupná pro běžné provozní operace a nepřijímá nové úkoly ani členy.

---

### 11.13 Kompletní relační ER diagram systému

Následující diagram znázorňuje finální relační strukturu databázových entit, cizích klíčů a kardinalit:

```text
       ┌────────────────────────┐
       │          USER          │
       ├────────────────────────┤
       │ id (PK)                │
       │ name                   │
       │ email (UNIQUE)         │
       │ global_role            │
       │ is_active              │
       │ created_at, updated_at │
       │ deleted_at (nullable)  │
       └───┬───────┬───────┬────┘
           │       │       │
      1:N  │       │       │ 1:N (historický autor / zakladatel)
  (člen)   │       │       ├──────────────────────┐
           ▼       │       ▼                      ▼
┌──────────────┐   │ ┌──────────────┐    ┌──────────────────┐
│  MEMBERSHIP  │   │ │    BOARD     │    │     AUDIT_LOG    │
├──────────────┤   │ ├──────────────┤    ├──────────────────┤
│ id (PK)      │   │ │ id (PK)      │    │ id (PK)          │
│ user_id (FK) ├───┼─┤ created_by   │◄───┤ actor_id (FK)    │
│ board_id (FK)│   │ │ name         │    │ board_id (FK,opt)│
│ role         │   │ │ description  │    │ operation        │
│ created_at   │   │ │ created_at   │    │ target_id        │
│ updated_at   │   │ │ updated_at   │    │ previous_state   │
└──────────────┘   │ │ deleted_at   │    │ new_state        │
 UNIQUE(user,board)│ └───┬──────┬───┘    │ metadata         │
                   │     │      │        └──────────────────┘
                   │ 1:N │      │ 1:N
                   │     ▼      ▼
                   │   ┌──────────────┐
                   │   │     AREA     │
                   │   ├──────────────┤
                   │   │ id (PK)      │
                   │   │ board_id (FK)│
                   │   │ name         │
                   │   │ description  │
                   │   │ created_at   │
                   │   │ updated_at   │
                   │   └──────┬───────┘
                   │          │ UNIQUE(board_id, name)
                   │          │
                   │          │ 1:N (volitelně)
                   │          ▼
                   │   ┌────────────────────────┐
                   │   │          TASK          │
                   │   ├────────────────────────┤
                   │   │ id (PK)                │
                   │   │ board_id (FK)          │
                   │   │ area_id (FK, nullable) │
                   │   │ title, description     │
                   │   │ status, priority       │
                   │   │ due_date, completed_at │
                   │   │ created_by (FK → User) │
                   ├───┼─┤ assignee_id (FK, opt)  │
                   │   │ created_at, updated_at │
                   │   └──────────┬─────────────┘
                   │              │
                   │              │ 1:N
                   │              ▼
                   │   ┌────────────────────────┐
                   │   │    TASK_PARTICIPANT    │
                   │   ├────────────────────────┤
                   │   │ id (PK)                │
                   │   │ task_id (FK)           │
                   └───┼─┤ user_id (FK)           │
                       │ role ('SPOLUŘEŠITEL')  │
                       │ created_at             │
                       └────────────────────────┘
                        UNIQUE(task_id, user_id)
```

---

## 12. Stavový model úkolu

Životní cyklus úkolu definuje stavy:

```text
       ┌───────────────┐
       │     NOVÉ      │ ◄── výchozí stav nového úkolu
       └───────┬───────┘
               │  ▲
               ▼  │ (volné přechody)
       ┌───────────────┐
       │   PŘEVZATÉ    │ ◄── úkol převzat, vzniká Hlavní Řešitel
       └───────┬───────┘
               │  ▲
               ▼  │
       ┌───────────────┐
       │ ROZPRACOVANÉ  │
       └───────┬───────┘
               │  ▲
               ▼  │
       ┌───────────────┐
       │    ČEKÁ SE    │
       └───────┬───────┘
               │  ▲
               ▼  │
       ┌───────────────┐
       │    HOTOVO     │ ◄── dokončení práce (skryto z výchozího pohledu)
       └───────┬───────┘
               │
               │ (automaticky po 10 dnech nebo ručně dříve)
               ▼
       ┌───────────────┐
       │  ARCHIVOVÁNO  │ ◄── uloženo v archivu, pouze pro čtení (read-only)
       └───────────────┘
```

### Zásady stavového modelu
1. **Volné přechody (žádná rigidní sekvence):**
   * Uživatel s oprávněním (Hlavní Řešitel, Spoluřešitel, MANAGER, OWNER, ADMIN) může úkol přepnout přímo do kteréhokoliv relevantního stavu (např. přímý skok `NOVÉ → HOTOVO`).
   * Stav `PŘEVZATÉ` není povinným mezikrokem.
2. **Význam stavu HOTOVO:**
   * Práce je dokončena. Úkol se automaticky skryje z výchozího zobrazení Nástěnky i osobního přehledu *„Moje úkoly“*.
   * Úkol zůstává plně zachován a dohledatelný v režimu zobrazení dokončených úkolů (s přeškrtnutým textem).
3. **Přechod do archivu:**
   * Po 10 po sobě jdoucích dnech ve stavu `HOTOVO` systém úkol automaticky přesune do stavu `ARCHIVOVÁNO`.
   * Oprávněný uživatel může úkol do archivu přesunout ručně i dříve.

---

## 13. Archiv a trvalé mazání

Architektura striktně odlišuje **Archivaci** od **Definitivního smazání**:

### Archivovaný úkol (`ARCHIVOVÁNO`)
* zůstává trvale uložen v systému a je dohledatelný v seznamu archivu,
* je **výhradně pro čtení (read-only)** – data nelze dodatečně měnit,
* **nemá funkci Obnovit / Vrátit z archivu** (obnova úkolu zpět do aktivního oběhu není podporována),
* nenachází se na aktivní ploše Nástěnky ani v běžném přehledu dokončených úkolů.

### Trvalé smazání úkolu (`SMAZAT`)
* představuje nevratné odstranění objektu ze systému (řízený hard-delete / controlled hard-delete),
* vyžaduje bezpečnostní potvrzení vepsáním přesného textu `SMAZAT`,
* probíhá atomicky v jediné transakci a zanechává neměnný záznam `DELETE_TASK` v nezávislém auditním logu Nástěnky,
* trvale smazaný úkol není dostupný v aktivním pohledu, v archivu ani v běžné historii úkolu.

### Smazání oblasti
* destruktivní organizační operace proveditelná pouze OWNEREM, MANAGEREM nebo ADMINEM,
* vyžaduje vepsání textu `SMAZAT`,
* probíhá atomicky v jediné transakci a zanechává neměnný záznam `DELETE_AREA` v nezávislém auditním logu Nástěnky,
* **společně s oblastí se definitivně smažou také všechny úkoly, které daná oblast obsahuje** (řízený hard-delete bez vzniku sirotčích vazeb; úkoly se nepřesouvají do archivu ani koše, zanikají).

---

## 14. Historie změn a auditní stopa

Systém udržuje neměnný chronologický záznam klíčových událostí na dvou úrovních:

### 1. Auditní stopa úkolu (Audit Log úkolu)
Zaznamenává operativní události v životním cyklu konkrétního úkolu:
* **Zaznamenávané atributy:**
  * kdo změnu provedl (identifikace uživatele),
  * co se změnilo (atribut),
  * původní hodnota,
  * nová hodnota,
  * časové razítko operace.
* **Předmět auditu:**
  * změna Hlavního Řešitele (např. *Adam → Milan* nebo *Nepřiřazeno → Adam*),
  * připojení a odpojení Spoluřešitele (včetně odebrání Spoluřešitele Hlavním Řešitelem),
  * změna priority (*Běžná → Spěchá*),
  * změna stavu úkolu,
  * změna oblasti (přesun úkolu),
  * změna termínu splnění,
  * nahrání a smazání týmové přílohy.

### 2. Auditní stopa Nástěnky a bezpečnostních zásahů
Detailně specifikováno v podkapitole **8.9 Auditní stopa bezpečnostních a správních operací**. Zahrnuje povinný audit operací:
* převod vlastnictví Nástěnky (`TRANSFER_OWNERSHIP`),
* změna Managera (`CHANGE_MANAGER`),
* změna rolí členů (`CHANGE_ROLE`),
* přidání a odebrání člena (`ADD_MEMBER`, `REMOVE_MEMBER`),
* smazání Nástěnky (`DELETE_BOARD`),
* administrativní zásahy globálního Admina (`ADMIN_INTERVENTION`).

---

## 15. Osobní pracovní prostor

Logická součást úkolu vyhrazená konkrétnímu uživateli:

* **Obsah:** soukromé pracovní poznámky, pomocné checklisty, dílčí koncepty, pracovní dokumenty, soukromé náčrtky či fotky.
* **Vlastnosti:**
  * **Přísná izolace:** obsah není týmový, ostatní členové týmu jej nevidí a nemají k němu přístup.
  * **Nepřenositelnost:** při změně Hlavního Řešitele nebo odpojení Spoluřešitele se osobní prostor nepředává novému řešiteli.
  * **Řazení v osobním dashboardu:** Uživatel si své úkoly v pohledu *„Moje úkoly“* organizuje nezávisle na ostatních:
    * ručním přetažením (drag & drop),
    * rychlým seřazením (podle *termínu*, *priority* nebo *data vzniku*).
    Toto řazení je čistě klientským osobním pohledem a nemění data pro zbytek týmu.
* **Životní cyklus při zániku účtu:**
  * Při trvalém zániku uživatelského účtu se smažou výhradně osobní/soukromá data daného uživatele. Týmový obsah úkolů zůstává nedotčen.

---

## 16. Týmové přílohy

Logická součást sdíleného obsahu úkolu:

* **Typy dat:** fotografie z terénu, obrázky, technická PDF, naskenované faktury, běžné provozní soubory.
* **Pravidla přístupu:**
  * Jsou uloženy v týmové části úkolu.
  * Jsou plně přístupné k náhledu a stažení pro všechny členy dané Nástěnky.
  * Kterýkoliv člen Nástěnky může k úkolu nahrát přílohu nebo zastaralou přílohu odstranit.

---

## 17. Notifikační architektura

Pro 1. verzi aplikace je závazný jediný prioritní notifikační tok:

```text
NOVÝ ÚKOL (vytvoření na Nástěnce)
               │
               ▼
      Notifikační služba
               │
               ▼ (WhatsApp zpráva)
Všichni členové dané Nástěnky (bez výjimky)
```

### Pravidla notifikací pro v1
* **Spouštěč:** Vytvoření libovolného nového úkolu na Nástěnce.
* **Příjemci:** Všichni členové dané Nástěnky bez výjimky.
* **Nezávislost na přiřazení:** Notifikace se odesílá vždy, i když je úkol ve stavu `Nepřiřazeno`. Rozhodující je členství v dané Nástěnce.
* **Ostatní notifikace:** Změny stavu, priority, komentáře, termíny ani archivace se v 1. verzi do WhatsApp neodesílají (odloženo do budoucích verzí).
* **Technologická neutralita:** Konkrétní WhatsApp provider, API, konektor ani komunikační brána nejsou v této fázi specifikovány.

---

## 18. Izolace Nástěnek

Aplikace podporuje multi-board architekturu s přísnou datovou i procesní separací:

1. **Vizuální a přístupové oddělení:** Člen vidí v rozhraní pouze ty Nástěnky, do kterých byl zařazen jako člen. Výjimkou je globální role `ADMIN`, která má právo náhledu a dohledu nad všemi Nástěnkami pro řešení administrativních a krizových situací.
2. **Datové hranice:** Týmový obsah (oblasti, úkoly, komentáře, přílohy) jedné Nástěnky je naprosto nepřístupný pro členy jiné Nástěnky.
3. **Kontextové vyhodnocování rolí na Nástěnce:** Uživatelská role na Nástěnce (`OWNER`, `MANAGER`, `MEMBER`) se vždy vyhodnocuje výhradně v kontextu aktuálně otevřené Nástěnky. Uživatel může být na Nástěnce A Managerem a na Nástěnce B běžným členem. Globální role `ADMIN` stojí nad tímto kontextem jako systémová pojistka.

---

## 19. Odchod člena, deaktivace účtu a správa životního cyklu

Architektura v souladu s datovým modelem (viz podkapitola 9.13) striktně rozlišuje tyto události:

### 1. Běžný odchod člena z Nástěnky
* **Člen v roli OWNER:** Nemůže Nástěnku opustit bez předchozího převodu vlastnictví na jiného člena (viz pravidlo 8.8.4 a Invariant 5 v podkapitole 9.16). Nástěnka nesmí nikdy zůstat bez Ownera.
* **Člen v roli MANAGER nebo MEMBER:** Záznam v tabulce `Membership` je zrušen nebo označen jako ukončený.
* **Úkoly, kde byl Hlavním Řešitelem:** Automaticky přejdou do stavu `Nepřiřazeno` (`Task.assignee_id = NULL`). Úkoly zůstávají v plném rozsahu na Nástěnce k dispozici ostatním.
* **Úkoly, kde byl Spoluřešitelem:** Záznam uživatele je odstraněn z tabulky `TaskParticipant`; Hlavní Řešitel a ostatní pokračují v práci.
* **Týmový obsah:** Veškeré úkoly jím vytvořené (`Task.created_by`), komentáře a přílohy zůstávají plně zachovány pro tým.
* **Osobní prostor:** Soukromý prostor odcházejícího člena zůstává soukromý, nepředává se jinému členovi a v této chvíli se nemaže.

### 2. Deaktivace a soft-delete uživatelského účtu (`User`)
* Provedeno nastavením `is_active = false` a `deleted_at = Timestamp`.
* Fyzická data se nemažou (zachování referenční integrity, auditní stopy a autorských vazeb).
* Dochází k uzamčení soukromého osobního prostoru daného uživatele.
* Týmový obsah úkolů zůstává v plném rozsahu zachován.
* Pokud je uživatel Ownerem některé Nástěnky, deaktivace účtu vyžaduje předchozí převod vlastnictví nebo direktivní zásah Admina.

### 3. Logické smazání Nástěnky (`Board`)
* Provedeno nastavením `Board.deleted_at = Timestamp` (soft-delete).
* Nástěnka a její úkoly mizí z aktivního zobrazení, ale veškeré referenční a auditní vazby zůstávají uloženy pro možnost obnovy či audit.

---

## 20. Omezení rozsahu (Co se zatím záměrně neřeší)

V souladu s analytickou fází jsou následující technologická a implementační rozhodnutí **záměrně odložena do dalších fází**:

* konkrétní databázový engine a SQL tabulková schémata,
* fyzická implementace API endpointů a technologických formátů (Step 7 definuje logický architektonický kontrakt operací),
* volba konkrétního frontend a backend frameworku,
* autentizační provider a mechanismus správy hesel/tokenů,
* konkrétní WhatsApp API / integrační provider,
* konkrétní úložiště souborů (storage provider),
* kontejnerizace (Docker) a infrastruktura hostingu / NAS,
* konkrétní datové limity pro velikost a počet příloh,
* klientská instalace jako PWA (plánováno jako budoucí rozšíření),
* offline režim a offline synchronizace (pro 1. verzi se neřeší).

---

## 21. Otevřené otázky k architektuře

Otázka *„Může Hlavní Řešitel odebrat Spoluřešitele?“* byla k datu 19. 9. 2026 definitivně vyřešena a uzavřena schválením **Varianty 1**:
* Hlavní Řešitel může odebrat Spoluřešitele ze seznamu Spoluřešitelů daného úkolu.
* Odebraný uživatel není blokován a může se v budoucnu znovu k úkolu připojit, pokud má úkol Hlavního Řešitele.

V současné verzi architektury nejsou evidovány žádné další otevřené otázky.

---

## 23. Step 9 – Autentizace, identity, session a životní cyklus přihlášení

Tato kapitola definuje logickou autentizační architekturu systému Nástěnka, způsob správy uživatelských identit, životní cyklus přihlašovacích relací (session) a jejich striktní oddělení od autorizační vrstvy zavedené v předchozích krocích.

Architektura je formulována technologicky neutrálně: definuje požadované vlastnosti, bezpečnostní hranice a doménové invarianty bez předčasné volby konkrétního autentizačního software či knihovny.

---

### 23.1 Autentizace vs. autorizace

Systém striktně odděluje dvě základní bezpečnostní fáze:

* **Autentizace (Kdo jsi?):**
  * Proces ověření deklarované identity uživatele na základě předložených přihlašovacích údajů či kryptografických artefaktů.
  * Výsledkem úspěšné autentizace je ověřená interní identita uživatele (`User.id`) a navázaný serverový kontext platné relace (`Session`).
* **Autorizace (Smíš tuto operaci provést?):**
  * Proces vyhodnocení, zda autentizovaný uživatel vystupující v roli volajícího (**Actor**) smí provést konkrétní doménovou operaci nad cílovým objektem (**Target**) v daném kontextu (konkrétní Nástěnka, oblast, úkol).
  * Autorizační logika (detailně specifikovaná v kapitole 10 – Step 7) vyhodnocuje kombinaci:
    * `actor_user_id` (identita Actora),
    * `User.global_role` (globální role `USER` nebo `ADMIN`),
    * `Membership.role` (kontextová role na dané Nástěnce: `OWNER`, `MANAGER`, `MEMBER`),
    * stav cílové entity (např. zda úkol není archivován, zda Nástěnka není soft-deleted).

#### Závazný bezpečnostní princip
> [!IMPORTANT]
> **Úspěšná autentizace automaticky neznamená oprávnění k libovolné operaci.**
> Autentizace pouze spolehlivě prokazuje identitu volajícího; každá jednotlivá operace musí projít nezávislým autorizačním vyhodnocením na backendu podle schválené autorizační matice.

---

### 23.2 Uživatelská identita (User Identity)

V návaznosti na datový model (kapitola 9 – Krok 6) a databázové schéma (kapitola 11 – Step 8) slouží:

```text
User.id
```

jako **jediný kanonický interní identifikátor uživatele** v celém systému.

#### Vlastnosti interní identity
1. **Stabilita a neměnnost:** `User.id` je generován při vzniku uživatelského účtu a po celou dobu existence záznamu se nikdy nemění.
2. **Nezávislost na vnějších atributech:** Změna e-mailové adresy, změna zobrazovaného jména ani reset hesla nemají žádný vliv na hodnotu `User.id`.
3. **Relační integrita:** `User.id` vystupuje jako cizí klíč ve všech vazbách systému:
   * `Membership.user_id` (členství na Nástěnce),
   * `Board.created_by` (zakladatel Nástěnky),
   * `Task.created_by` (autor úkolu),
   * `Task.assignee_id` (Hlavní Řešitel úkolu),
   * `TaskParticipant.user_id` (Spoluřešitel úkolu),
   * `AuditLog.actor_id` (identifikace původce bezpečnostní či doménové události).
4. **Vystupování v bezpečnostním kontextu:** `User.id` je jedinou hodnotou, která se dosazuje do systémového kontextu `actor_user_id` při autorizaci požadavků.

#### Striktní zákaz záměny identit
Interní `User.id` nesmí být v doménové logice ani v databázových vazbách zaměňován s:
* **E-mailem (`User.email`):** E-mail slouží jako přihlašovací jméno a komunikační kanál, nikoliv jako stabilní primární klíč.
* **Zobrazovaným jménem (`User.name`):** Uživatelské jméno je pouze prezentační údaj pro UI.
* **Identifikátorem session (`session_id`):** Session je dočasná relace, nikoliv trvalá identita.
* **Externím Provider ID:** Pokud bude v budoucnu integrován externí zprostředkovatel identity (např. Google/Microsoft OAuth či OIDC), externí identifikátor (např. `sub` / `provider_user_id`) se mapuje jako samostatný atribut na interní `User.id`, nikdy interní ID nenahrazuje.

---

### 23.3 Vznik uživatelského účtu a životní cyklus identity

Životní cyklus identity od jejího vzniku až po autorizované použití probíhá v následujících logických fázích:

```text
┌────────────────────────────────────────┐
│      Registrace / vytvoření účtu       │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│  Ověření identity / aktivační proces   │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│     Aktivní uživatel (User.id)         │  ◄── User.is_active = true
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│       Přihlášení uživatele (Login)     │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│    Aktivní přihlašovací relace         │  ◄── Session.state = ACTIVE
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│     Autorizované doménové operace      │  ◄── vyhodnocení actor_user_id
└────────────────────────────────────────┘
```

#### Pravidla pro vznik účtu
* Konkrétní mechanismus registrace (self-service registrace, e-mailové potvrzení, pozvánka administrátorem nebo pozvánka Ownerem Nástěnky) je otevřenou implementační otázkou.
* Vytvoření uživatelského účtu musí vždy vést ke vzniku jednoznačné a nezaměnitelné identity `User` s novým unikátním `id`.
* Zadaný e-mail musí respektovat schválené pravidlo unikátnosti (case-insensitive normalizace, zákaz duplicit dle Step 8).
* **Běžný nově registrovaný účet získává výhradně roli `User.global_role = 'USER'`.**
* Globální role `ADMIN` nesmí nikdy vzniknout pouhou registrací běžného uživatele. Získání role `ADMIN` vyžaduje explicitní administrativní povýšení nebo bezpečný systémový provisioning při instalaci aplikace.

---

### 23.4 Globální role ADMIN

Architektura systému důsledně odděluje globální systémovou roli od lokálního členství na Nástěnkách:

```text
User.global_role ∈ {'USER', 'ADMIN'}
```

#### Pravidla a chování globální role
1. **Globální systémová působnost:** Role `ADMIN` je uložena přímo na entitě `User`. Reprezentuje provozního správce celého systému.
2. **Rovnost v autentizaci:** Uživatel s rolí `ADMIN` podléhá naprosto stejným autentizačním pravidlům jako jakýkoliv jiný uživatel. Musí předložit platné přihlašovací údaje, projít ověřením a získat platnou session.
3. **Nezávislost na členství v Nástěnkách:** `ADMIN` nemusí mít záznam v tabulce `Membership` konkrétní Nástěnky, aby mohl provádět dohled a krizové zásahy (jak je definováno v kapitolách 8 a 10).
4. **Striktní oddělení od rolí na Nástěnce:**
   * Role `OWNER`, `MANAGER` a `MEMBER` jsou definovány výhradně v kontextu vazby `Membership` k dané Nástěnce.
   * Tyto role NIKDY neslouží jako globální ani autentizační role a nesmí být ukládány do profilu uživatele.
5. **Nepodvrhnutelnost role:** Klient nesmí mít možnost deklarovat roli `ADMIN` v žádném parametru požadavku. Informaci o roli `ADMIN` načítá backend výhradně z autoritativního datového záznamu uživatele přiřazeného k ověřené session.

---

### 23.5 Login a proces autentizace

Logický proces přihlášení uživatele probíhá v následujících povinných krocích:

1. **Předložení údajů:** Klient odešle přihlašovací údaje (např. e-mail a heslo nebo autentizační artefakt) na autentizační endpoint serveru.
2. **Ověření údajů:** Autentizační vrstva serveru ověří platnost předložených přihlašovacích údajů proti uloženým bezpečnostním datům (např. ověření kryptografického hashe hesla).
3. **Vyhledání identity:** Backend na základě úspěšného ověření identifikuje konkrétní entitu `User` a její primární klíč `User.id`.
4. **Kontrola stavu účtu:** Backend ověří, že uživatelský účet je aktivní:
   * Pokud je `User.is_active = false` nebo `User.deleted_at IS NOT NULL`, proces přihlášení je okamžitě ukončen a server vrátí chybu (účet je deaktivován).
5. **Vytvoření relace (Session):** Backend vytvoří novou instanci `Session`, prováže ji s `User.id`, nastaví časová razítka (`created_at`, `expires_at`, `last_activity_at`) a zaznamená její stav jako `ACTIVE`.
6. **Předání credential:** Bezpečný identifikátor či token relace je předán klientovi (např. prostřednictvím zabezpečené HTTP cookie).
7. **Vyhodnocení Actora pro další požadavky:** Veškeré následné příchozí chráněné požadavky klienta jsou autorizovány jako operace daného `actor_user_id`.

#### Závazný bezpečnostní princip: Zákaz důvěry v klientský actor_user_id
> [!CAUTION]
> **Backend nesmí za žádných okolností převzít `actor_user_id` z nedůvěryhodných dat klienta.**
> Požadavek klienta nesmí obsahovat parametr typu `actor_user_id = 25`, který by server slepě použil jako identitu volajícího.
> Identita `actor_user_id` musí být vždy bez výjimky odvozena serverem z ověřené, aktivní a platné relace (`Session`).

---

### 23.6 Logický koncept Session

Systém Nástěnka definuje logický koncept přihlašovací relace (**Session**) nezávisle na konkrétní implementační technologii.

#### Klíčové vlastnosti Session
* **Jednoznačná identifikace:** Relace je identifikována kryptograficky silným, nepředvídatelným identifikátorem (`session_id`).
* **Vazba na entitu User:** Každá session náleží právě jednomu uživateli (`User.id`).
* **Časové omezení:** Session má striktně stanovenou dobu platnosti (absolutní expirace i neaktivní timeout).
* **Okamžitá odvolatelnost (Revokovatelnost):** Server má kdykoliv možnost relaci explicitně zneplatnit.
* **Serverová validace:** Server při každém chráněném požadavku ověřuje platnost relace proti autoritativnímu stavu.

#### Konceptuální model Session
Pro účely logické architektury je Session popsána následující sadou atributů:

```text
┌────────────────────────────────────────────────────────┐
│                        SESSION                         │
├────────────────────────────────────────────────────────┤
│ session_id        : String / UUID (kryptograficky silný│
│ user_id           : FK -> User.id                      │
│ created_at        : Timestamp                          │
│ expires_at        : Timestamp                          │
│ last_activity_at  : Timestamp                          │
│ revoked_at        : Timestamp (nullable)               │
└────────────────────────────────────────────────────────┘
```

#### Technologická neutralita úložiště session
Fyzické uložení a správa session dat může v budoucí implementaci využívat:
* databázovou tabulku v relační databázi,
* rychlé server-side in-memory úložiště (např. Redis či obdobný session store),
* hybridní model s kryptograficky podepsanými tokeny ověřovanými proti revokačnímu seznamu.

Architektura záměrně nenařizuje bezstavové JWT tokeny jako jediný model. Pokud by byl zvolen tokenový mechanismus, musí splňovat požadavek na spolehlivou a okamžitou serverovou odvolatelnost relace.

---

### 23.7 Ochrana session a transportní bezpečnost

Ochrana přihlašovací relace před kompromitací vyžaduje dodržení následujících bezpečnostních standardů:

1. **Kryptografická nepředvídatelnost:** Identifikátory session musí být generovány kryptograficky bezpečným generátorem pseudonáhodných čísel (CSPRNG) s minimální entropií 128 bitů, aby se vyloučilo jejich odhadnutí útočníkem.
2. **Ochrana proti skriptům třetích stran (XSS):** Autentizační credential relace nesmí být snadno dostupný klientským skriptům v DOMu stránky.
3. **Transportní šifrování (TLS):** Veškerá komunikace mezi klientem a serverem přenášející autentizační údaje či session identifikátory musí probíhat výhradně přes zabezpečený protokol HTTPS/TLS.
4. **Časová expirace:** Relace musí mít stanoven pevný časový limit platnosti (`expires_at`) i limit pro nečinnost uživatele (sliding expiration na základě `last_activity_at`).
5. **Možnost explicitního zneplatnění:** Uživatel i administrátor musí mít možnost relaci okamžitě ukončit.
6. **Ověření při každém požadavku:** Backend musí při každém příchozím volání chráněného API endpointu ověřit, že relace existuje, je ve stavu `ACTIVE`, nevypršela a nebyla odvolána.

#### Požadavky pro cookie-based implementaci
Pokud bude v implementaci zvolen mechanismus HTTP cookies, musí být relace chráněna konfiguračními atributy:
* `HttpOnly`: Zabraňuje přístupu klientského JavaScriptu k cookie (ochrana proti zcizení relace přes XSS).
* `Secure`: Zajišťuje, že prohlížeč odešle cookie výhradně přes šifrované spojení HTTPS.
* `SameSite=Lax` nebo `SameSite=Strict`: Poskytuje základní ochranu proti útokům typu Cross-Site Request Forgery (CSRF).

---

### 23.8 Životní cyklus session

Přihlašovací relace prochází během své existence deterministickým stavovým cyklem:

```text
       ┌───────────────┐
       │    CREATED    │ ◄── Vznik při úspěšném login
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐        Uplynutí doby platnosti
       │    ACTIVE     │ ──────────────────────────────────► ┌───────────────┐
       └───────┬───────┘                                     │    EXPIRED    │
               │                                             └───────────────┘
               │ Explicitní zneplatnění (logout / incident /
               │ deaktivace / změna hesla / zásah Admina)
               ▼
       ┌───────────────┐
       │    REVOKED    │
       └───────────────┘
```

#### Význam stavů
* **CREATED:** Relace byla právě vytvořena a inicializována v rámci úspěšného přihlášení.
* **ACTIVE:** Relace je platná, časově aktuální a opravňuje provádět operace jménem příslušného uživatele.
* **EXPIRED:** Relace překročila maximální povolenou dobu platnosti nebo limit neaktivity. Požadavky s touto relací jsou serverem okamžitě odmítnuty.
* **REVOKED:** Relace byla explicitně předčasně ukončena a zneplatněna. Záznam nese časové razítko `revoked_at`.

#### Události vedoucí k revokaci session
Session musí být okamžitě přepnuta do stavu `REVOKED` při:
* uživatelském odhlášení (`POST /auth/logout`),
* zjištěném bezpečnostním incidentu nebo podezření na zcizení relace,
* změně hesla uživatele (revokace všech ostatních aktivních relací),
* úspěšném dokončení obnovy hesla (password recovery),
* deaktivaci uživatelského účtu (`User.is_active = false`),
* administrativním bezpečnostním zásahu administrátora (`ADMIN`).

---

### 23.9 Logout (Odhlášení)

Odhlášení je explicitní operace ukončení přihlašovací relace:

```text
POST /auth/logout
```

#### Pravidla provádění logoutu
1. **Zneplatnění relace:** Server přepne aktuální session do stavu `REVOKED` (nastaví `revoked_at = Timestamp`).
2. **Konec autorizace:** Jakékoliv další požadavky předkládající tuto session jsou vyhodnoceny jako neautentizované (`401 Unauthorized`).
3. **Vyčištění klienta:** Server instruuje klientský prohlížeč k vymazání session credential (např. vypršením autentizační cookie).
4. **Integrita doménových dat:** Logout **nikdy nemění entitu User**, nemění členství v Nástěnce (`Membership`), nemění stav Nástěnky (`Board`) ani řešitelské vazby na úkolech (`Task`).

#### Striktní oddělení logoutu od deaktivace účtu
> [!NOTE]
> Architektura důsledně rozlišuje **ukončení session (Logout)** od **deaktivace účtu (Deactivation)**:
> * Logout ukončuje pouze jednu konkrétní dočasnou relaci. Účet uživatele zůstává plně aktivní a uživatel se může kdykoliv znovu přihlásit.
> * Deaktivace účtu je trvalý administrativní zásah do entity `User`, který znemožňuje jakékoliv budoucí přihlášení a zneplatňuje veškeré existující relace.

---

### 23.10 Deaktivovaný uživatel (is_active = false)

V návaznosti na pravidla z kapitol 9, 11 a 19 platí pro deaktivovaného uživatele (`User.is_active = false`, případně `User.deleted_at IS NOT NULL`):

1. **Zákaz přihlášení:** Deaktivovaný uživatel se nesmí úspěšně přihlásit. Pokus o login okamžitě končí chybou.
2. **Okamžitá revokace relací:** Veškeré existující aktivní sessions deaktivovaného uživatele musí být v okamžiku deaktivace okamžitě přepnuty do stavu `REVOKED`.
3. **Zákaz nových operací:** Nově příchozí chráněné požadavky nesmí být autorizovány. Server vrátí chybu `401 Unauthorized`.
4. **Zachování historických dat a integrity:**
   * Fyzická data v databázi se nemažou.
   * Veškeré vytvořené úkoly (`Task.created_by`), komentáře, přílohy i auditní záznamy zůstávají v plném rozsahu zachovány.
   * Záznamy v `Membership` a auditní vazby nesmí být nekontrolovaně smazány.
5. **Ochranné pravidlo pro roli OWNER:**
   * Uživatele, který je aktuálním `OWNEREM` libovolné aktivní Nástěnky, **nelze deaktivovat bez předchozího převodu vlastnictví Nástěnky** na jiného člena nebo direktivního zásahu globálního administrátora (ochrana Invariantu 1 a Invariantu 6 z kapitoly 10).

---

### 23.11 Rozlišení stavů: is_active vs. deleted_at vs. Session State

Architektura striktně definuje tři nezávislé a vzájemně nezaměnitelné pojmy:

| Stavový atribut | Účel a sémantika | Hodnoty / Význam |
|---|---|---|
| `User.is_active` | Určuje, zda účet smí normálně používat systém, přihlašovat se a vykonávat akce. | `true`: aktivní účet<br>`false`: deaktivovaný účet (blokován) |
| `User.deleted_at` | Časové razítko logického vyřazení účtu (soft-delete). Slouží k archivaci a referenční integritě. | `NULL`: běžný účet<br>`Timestamp`: datum logického smazání |
| `Session State` | Určuje, zda konkrétní dočasná přihlašovací relace má stále platné oprávnění zastupovat uživatele. | `CREATED`, `ACTIVE`, `EXPIRED`, `REVOKED` |

Platná a použitelná přihlašovací relace může existovat **výhradně tehdy, jsou-li současně splněny všechny tři podmínky**:
1. `User.is_active = true`,
2. `User.deleted_at IS NULL`,
3. `Session.state = ACTIVE` (současně platí `now() < expires_at` a `revoked_at IS NULL`).

---

### 23.12 Serverový kontext volajícího (Actor Context)

Po úspěšné autentizaci server vytvoří pro zpracování každého požadavku bezpečný serverový kontext:

```text
ActorContext {
    actor_user_id : User.id,
    global_role   : User.global_role ('USER' | 'ADMIN'),
    session_id    : Session.session_id,
    is_active     : Boolean
}
```

#### Tok vyhodnocení identity a autorizace
```text
HTTP Požadavek s credential
            │
            ▼
    Ověření Session
            │
            ▼
    Ověření entity User (is_active, deleted_at)
            │
            ▼
    Vytvoření ActorContextu na serveru
            │
            ▼
    Autorizační vrstva (Step 7)
    (vyhodnocení Membership.role a cílové entity)
            │
            ▼
    Provedení doménové operace (Step 7 / Step 8)
```

Klient nesmí mít možnost identitu v `ActorContext` nijak pozměnit, přepsat ani obejít.

---

### 23.13 Session a dynamické vyhodnocování rolí

Zásadní architektonický princip systému Nástěnka zní:

> [!IMPORTANT]
> **Session slouží výhradně k identifikaci přihlášeného uživatele, nikoliv jako statické autorizační úložiště jeho práv a rolí.**

#### Důvody pro dynamické vyhodnocování
V průběhu aktivní session může v systému dojít k významným organizačním změnám:
* uživateli byla změněna role na Nástěnce (`Membership.role: MEMBER → MANAGER`),
* na uživatele bylo převedeno vlastnictví Nástěnky (`OWNER`),
* uživatel byl z Nástěnky odebrán (`DELETE /boards/{id}/members/{userId}`),
* uživateli byla přidělena nebo odebrána globální role `ADMIN`,
* uživatelský účet byl zablokován či deaktivován.

Backend při každém autorizačním rozhodování (Step 7) **načítá aktuální stav oprávnění a členství z databáze**, nikoliv ze zastaralých informací zachycených v okamžiku přihlášení. Tím je garantováno, že změna práv člena se projeví okamžitě při dalším API požadavku bez nutnosti čekat na vypršení platnosti session nebo nucené znovupřihlášení.

---

### 23.14 Změna hesla a autentizačních údajů

Při změně autentizačních údajů (např. změna hesla či e-mailu) platí následující logická pravidla:

1. **Neměnnost identity:** Změna hesla ani e-mailu nesmí nikdy změnit `User.id` ani vytvořit nový uživatelský účet.
2. **Bezpečnostní revokace ostatních relací:** Pokud uživatel změní své heslo, backend zneplatní (`REVOKED`) všechny ostatní aktivní sessions tohoto uživatele s výjimkou aktuální relace, v níž změna proběhla.
3. **Ochrana před převzetím identity:** Změna autentizačních údajů vyžaduje potvrzení stávajícím heslem (u přihlášeného uživatele) nebo jednorázovým autorizovaným tokenem (při obnově přístupu).
4. **Zákaz ukládání hesel v otevřeném textu:** Uživatelská hesla se v systému **nikdy neukládají v otevřeném (plaintext) tvaru**. Musí být bezpečně hashována moderním jednosměrným algoritmem s unikátní kryptografickou solí.

---

### 23.15 Obnova přístupu (Password reset / recovery)

Proces bezpečné obnovy přístupu při zapomenutém heslu probíhá v následujících logických fázích:

```text
1. Požadavek na obnovu (POST /auth/recovery/request s emailem)
                    │
                    ▼
2. Generování jednorázového Recovery Tokenu (časově omezený)
                    │
                    ▼
3. Bezpečné doručení tokenu / odkazu uživateli (např. e-mailem)
                    │
                    ▼
4. Zadání nového hesla s tokenem (POST /auth/recovery/complete)
                    │
                    ▼
5. Ověření platnosti a jednorázovosti tokenu serverem
                    │
                    ▼
6. Nastavení nového hesla, zneplatnění tokenu a revokace sessions
```

#### Bezpečnostní pravidla procesu obnovy
* **Jednorázovost a krátká expirace:** Recovery token je striktně jednorázový a má krátkou dobu platnosti (např. 15–30 minut). Po úspěšném použití je token okamžitě zneplatněn.
* **Ochrana integrity:** Token je svázán s konkrétním `User.id`; nelze jej zneužít k manipulaci s cizím účtem.
* **Ochrana tajemství:** Hodnota recovery tokenu se nesmí ukládat v otevřeném textu a nesmí být zapisována do žádného auditního ani aplikačního logu.
* **Revokace relací:** Po úspěšném nastavení nového hesla přes recovery proces jsou okamžitě zneplatněny veškeré dosavadní aktivní sessions uživatele.

---

### 23.16 Ochrana proti enumeration útokům

Endpointy autentizačního subsystému musí být navrženy tak, aby minimalizovaly možnost zjišťování existence uživatelských účtů (account enumeration):

1. **Neutrální odpověď na požadavek obnovy hesla:** Endpoint `POST /auth/recovery/request` vrací vždy identickou neutrální úspěšnou odpověď (např. *„Pokud zadaný e-mail existuje, byly na něj odeslány instrukce pro obnovu hesla.“*), bez ohledu na to, zda e-mail v databázi existuje či nikoliv.
2. **Jednotné chybové hlášení při neúspěšném přihlášení:** Chybová odpověď endpointu `POST /auth/login` nesmí rozlišovat mezi neexistujícím uživatelem a chybným heslem (vrací obecné sdělení typu *„Neplatné přihlašovací údaje“*).

---

### 23.17 Bezpečnostní hranice a autorita serveru

Architektura striktně vymezuje, co klient **nesmí nikdy samostatně určovat**:

Klient nesmí sám stanovit:
* `actor_user_id` (kdo je volajícím),
* `User.global_role` (`USER` nebo `ADMIN`),
* `Membership.role` (`OWNER`, `MANAGER`, `MEMBER`),
* oprávnění k operaci,
* stav své relace (`ACTIVE` / `REVOKED`),
* platnost své autentizace.

Klient smí pouze předložit svůj požadavek a prokázat se session identifikátorem.

Backend autoritativně vyhodnocuje:
```text
1. Kdo je Actor? (zjištěno z ověřené serverové session)
2. Je session platná a aktivní?
3. Je uživatelský účet aktivní (is_active = true)?
4. Jaká je globální role uživatele (USER / ADMIN)?
5. Jaké má uživatel členství na dané Nástěnce?
6. Má uživatel oprávnění provést požadovanou operaci nad cílovým objektem?
```

---

### 23.18 API autentizačního kontraktu

Logický architektonický kontrakt definuje následující sadu autentizačních operací:

#### 1. Přihlášení uživatele (`POST /auth/login`)
* **Účel:** Ověření uživatelských přihlašovacích údajů a založení aktivní relace.
* **Volající:** Kdokoliv (veřejný endpoint).
* **Autentizace:** Nevyžaduje se.
* **Ověření serveru:** Shoda přihlašovacích údajů, kontrola `User.is_active = true` a `User.deleted_at IS NULL`.
* **Výsledek:** Vytvoření instance `Session` ve stavu `ACTIVE`, bezpečné předání session credential klientovi.
* **Typické chyby:** `401 Unauthorized` (neplatné přihlašovací údaje nebo deaktivovaný účet), `422 Unprocessable Entity` (neplatný formát vstupu).

#### 2. Odhlášení uživatele (`POST /auth/logout`)
* **Účel:** Bezpečné a okamžité ukončení aktuální relace uživatele.
* **Volající:** Přihlášený uživatel.
* **Autentizace:** Vyžaduje platnou session.
* **Ověření serveru:** Existence a aktivní stav relace.
* **Výsledek:** Session je přepnuta do stavu `REVOKED`, klientské session credential je zneplatněno.
* **Typické chyby:** `401 Unauthorized` (neplatná, expirovaná či revokovaná session).

#### 3. Získání informací o aktuální relaci (`GET /auth/session`)
* **Účel:** Zjištění identity přihlášeného uživatele a jeho základních profilových údajů pro inicializaci UI.
* **Volající:** Přihlášený uživatel.
* **Autentizace:** Vyžaduje platnou session.
* **Ověření serveru:** Validita relace a aktivní stav účtu.
* **Výsledek:** Bezpečný profil uživatele: `id`, `name`, `email`, `global_role` (nikdy neobsahuje tajemství, hashe hesel ani privátní tokeny).
* **Typické chyby:** `401 Unauthorized` (uživatel není přihlášen nebo session vypršela).

#### 4. Požadavek na obnovu hesla (`POST /auth/recovery/request`)
* **Účel:** Zahájení procesu bezpečné obnovy přístupu při zapomenutém heslu.
* **Volající:** Kdokoliv (veřejný endpoint).
* **Autentizace:** Nevyžaduje se.
* **Ověření serveru:** Validita formátu e-mailové adresy.
* **Bezpečnostní pravidlo:** Neutrální odpověď (ochrana proti enumeration).
* **Výsledek:** Vygenerování jednorázového časově omezeného tokenu a odeslání e-mailové zprávy (pokud účet existuje a je aktivní).
* **Typické chyby:** `422 Unprocessable Entity` (syntakticky neplatná adresa).

#### 5. Dokončení obnovy hesla (`POST /auth/recovery/complete`)
* **Účel:** Nastavení nového hesla na základě předloženého platného jednorázového tokenu.
* **Volající:** Kdokoliv s platným tokenem.
* **Autentizace:** Ověření platnosti tokenu.
* **Ověření serveru:** Existence tokenu, kontrola expirace, ověření, že token nebyl dříve použit, splnění bezpečnostních zásad pro nové heslo.
* **Výsledek:** Zápis nového hashe hesla, okamžitá likvidace tokenu, revokace existujících sessions uživatele.
* **Typické chyby:** `400 Bad Request` / `401 Unauthorized` (neplatný, expirovaný nebo již použitý token), `422 Unprocessable Entity` (heslo nesplňuje požadavky).

#### 6. Změna hesla přihlášeným uživatelem (`POST /auth/password/change` – volitelný endpoint)
* **Účel:** Řádná změna hesla uživatelem, který zná své stávající heslo.
* **Volající:** Přihlášený uživatel.
* **Autentizace:** Vyžaduje platnou session.
* **Ověření serveru:** Správnost stávajícího hesla, splnění požadavků na nové heslo.
* **Výsledek:** Aktualizace hashe hesla, revokace všech ostatních relací daného uživatele.
* **Typické chyby:** `401 Unauthorized` (chybné původní heslo), `422 Unprocessable Entity`.

---

### 23.19 Chybový model autentizace (Auth errors)

V návaznosti na obecný chybový model systému ze Step 7 (podkapitola 10.12) rozlišuje autentizační vrstva následující standardní chybové stavy:

* **`401 Unauthorized`:**
  * Požadavek postrádá autentizační údaje (chybějící session).
  * Session identifikátor je neplatný, neexistující nebo poškozený.
  * Session překročila dobu platnosti (`EXPIRED`).
  * Session byla explicitně zneplatněna (`REVOKED`).
  * Byly předloženy nesprávné přihlašovací údaje při přihlašování.
  * Pokus o autentizaci uživatele, jehož účet je deaktivován (`is_active = false`).
  * Recovery token je neplatný, expirovaný nebo již dříve použitý.
* **`403 Forbidden`:**
  * Uživatel byl úspěšně autentizován, ale nemá dostatečná oprávnění k provedení požadované operace (např. uživatel bez role `ADMIN` se pokouší o administrativní zásah).
* **`422 Unprocessable Entity`:**
  * Požadavek je syntakticky správný, ale obsahuje sémanticky neplatné údaje (např. neplatný formát e-mailové adresy, heslo nesplňující minimální délku či komplexitu).
* **`409 Conflict`:**
  * Konflikt v identitních datech (např. pokus o registraci s e-mailovou adresou, která již v systému existuje).

---

### 23.20 Audit autentizačních a bezpečnostních událostí

Systém Nástěnka důsledně odděluje:
* **Business/Domain Events:** Události v životním cyklu Nástěnek, úkolů, členství a oblastí (detailně popsané v kapitolách 10, 11 a 14).
* **Security/Auth Events:** Události v životním cyklu uživatelských identit, přihlašovacích relací a bezpečnostních rolí.

#### Zaznamenávané bezpečnostní události
Bezpečnostní auditní stopa zaznamenává minimálně následující události:
* `LOGIN_SUCCESS`: Úspěšné přihlášení uživatele (identifikátor `user_id`, časové razítko, metadata relace).
* `LOGIN_FAILURE`: Neúspěšný pokus o přihlášení (pokusný e-mail, důvod odmítnutí, časové razítko).
* `LOGOUT`: Řádné odhlášení uživatele a ukončení relace.
* `SESSION_REVOKED`: Nucená revokace session (s uvedením důvodu: změna hesla, deaktivace účtu, zásah Admina).
* `ACCOUNT_DEACTIVATED`: Deaktivace uživatelského účtu (`is_active = false`).
* `PASSWORD_CHANGED`: Změna hesla provedená přihlášeným uživatelem.
* `PASSWORD_RECOVERY_COMPLETED`: Úspěšné dokončení obnovy hesla přes recovery token.
* `GLOBAL_ROLE_CHANGED`: Povýšení uživatele na roli `ADMIN` nebo odebrání role `ADMIN`.

#### Závazné pravidlo ochrany tajemství
> [!CAUTION]
> **Citlivé autentizační údaje a tajemství se NIKDY nesmí ukládat do auditní stopy.**
> Do auditního logu, provozních logů ani chybových zpráv nesmí být nikdy zapsáno heslo v otevřeném textu, hash hesla, session identifikátor/tajemství ani jednorázový recovery token.
> Auditní záznam uchovává výhradně fakt, že k bezpečnostní události došlo, čas události, identitu aktéra a kontextové ID, nikoliv samotná tajemství.

---

### 23.21 Globální role ADMIN a nouzové administrativní zásahy

Vztah globální role `ADMIN` k autentizační a autorizační architektuře:

1. **Povinná autentizace:** Uživatel s rolí `ADMIN` nemá žádnou zadní výjimku z autentizačního procesu. Musí projít standardním ověřením své identity a získat platnou session.
2. **Autorizační oprávnění:** Zvýšená oprávnění (převod opuštěné Nástěnky, zásahy v krizových situacích, deaktivace účtů) získává uživatel výhradně na základě serverového ověření hodnoty `User.global_role = 'ADMIN'`.
3. **Nezávislost na členství:** `ADMIN` smí provádět definované krizové zásahy i na Nástěnkách, kde není evidován jako člen v tabulce `Membership`.
4. **Zákaz klientského deklarování role:** Klient nemůže v požadavku deklarovat `global_role = 'ADMIN'`, aby obešel bezpečnostní kontrolu.
5. **Povinný audit administrativních zásahů:** Každý zásah provedený z titulu role `ADMIN` musí vytvořit neměnný záznam v auditním logu s typem operace `ADMIN_INTERVENTION` a identifikací daného administrátora.

---

### 23.22 Ochrana proti impersonaci

Architektura přísně zamezuje jakékoliv možnosti vydávat se za jiného uživatele (impersonace):

#### Zákaz klientského určování Actora
Pokud klient odešle API požadavek, server striktně rozlišuje sémantiku parametrů:

```text
POST /boards/101/transfer-ownership
Payload: { "target_user_id": 25 }
```

* `target_user_id = 25` je legitimní parametr určující **cíl operace (Target)** – uživatele, na kterého má být vlastnictví převedeno.
* Kdo je **vykonavatelem operace (Actor)**, však server určuje **výhradně z ověřené session**.
* Pokud by klient do těla požadavku přidal `actor_user_id = 10`, backend tento atribut zcela ignoruje (nebo jej odmítne jako nevalidní).
* Identita Actora je determinována výhradně serverovým kontextem relace. Pokud uživatel navázaný na tuto relaci není stávajícím Ownerem Nástěnky 101 ani Adminem, server operaci neprodleně zamítne chybou `403 Forbidden`.

---

### 23.23 Souhrnný přehled životního cyklu identity a session

Následující schémata shrnují klíčové toky identit a relací v systému:

#### 1. Standardní průchod operací
```text
User vytvořen
     │
     ▼
Role přidělena (USER / ADMIN)
     │
     ▼
Aktivní účet (is_active = true)
     │
     ▼
Přihlášení (POST /auth/login)
     │
     ▼
Session ACTIVE
     │
     ▼
API Požadavek s credential
     │
     ▼
Sestavení ActorContextu (backend)
     │
     ▼
Autorizační kontrola (Step 7)
     │
     ▼
Provedení doménové operace (Step 7 / Step 8)
```

#### 2. Ukončení session odhlášením (Logout)
```text
ACTIVE SESSION  ──►  POST /auth/logout  ──►  Session REVOKED  ──►  Následné požadavky: 401
```

#### 3. Vypršení session časem (Timeout / Expiration)
```text
ACTIVE SESSION  ──►  Timeout / nečinnost  ──►  Session EXPIRED  ──►  Následné požadavky: 401
```

#### 4. Deaktivace uživatelského účtu
```text
Aktivní uživatel (User)  ──►  Deaktivace (is_active = false)
                                     │
                                     ├──►  Všechny sessions: REVOKED
                                     │
                                     └──►  Nový login: ZABLOKOVÁN (401)
```

---

### 23.24 Bezpečnostní invarianty autentizace

Architektura autentizačního subsystému garantuje dodržení následujících sedmnácti bezpečnostních invariantů:

1. **Ověřená identita:** Každý požadavek na chráněný zdroj musí mít ověřenou identitu uživatele.
2. **Autorita serveru nad Actor:** Identita volajícího (`actor_user_id`) je vždy určena serverem ze zvalidované session, nikdy z klientského vstupu.
3. **Stabilita interní identity:** `User.id` je stabilní a kanonický identifikátor, který se nikdy nemění při změnách e-mailu či profilu.
4. **Separace globální role a členství:** Globální role `User.global_role` (`USER` / `ADMIN`) je striktně oddělena od lokální role `Membership.role` (`OWNER`, `MANAGER`, `MEMBER`).
5. **Blokace deaktivovaného účtu:** Uživatel s `is_active = false` nebo s vyplněným `deleted_at` se nemůže úspěšně přihlásit.
6. **Okamžitá revokace relací deaktivovaného účtu:** Deaktivace uživatele okamžitě činí všechny jeho existující sessions neplatnými (`REVOKED`).
7. **Zákaz expirovaných a revokovaných relací:** Expirovaná nebo revokovaná session nesmí autorizovat žádný požadavek.
8. **Odolnost session:** Identifikátory session musí být chráněny proti předvídatelnosti, odposlechu a krádeži (kryptografická entropie, TLS, bezpečnostní atributy).
9. **Dynamická autorizace:** Session reprezentuje ověřenou identitu uživatele, nikoliv statickou kopii jeho oprávnění; autorizační vrstva vyhodnocuje aktuální stav práv při každém požadavku.
10. **Okamžitý dopad změn rolí:** Změna v `Membership.role` nebo `User.global_role` se musí projevit v autorizačním rozhodování okamžitě bez nutnosti nového loginu.
11. **Nepodvrhnutelnost role ADMIN:** Roli `ADMIN` nelze získat manipulací s klientskými daty v požadavku.
12. **Zákaz plaintext hesel:** Uživatelská hesla se nikdy neukládají v otevřeném textu; musí být použito bezpečné jednosměrné kryptografické hashování se solí.
13. **Jednorázovost a časové omezení recovery mechanismu:** Tokeny pro obnovu přístupu jsou časově přísně omezené, jednorázově spotřebitelné a po použití okamžitě zanikají.
14. **Čistota auditní stopy:** Žádná autentizační tajemství (hesla, tokeny, session secrets) nesmí být součástí auditních ani provozních záznamů.
15. **Nezaměnitelnost identity s prezentačními atributy:** Interní identita `User.id` nesmí být v doménových vazbách zaměňována s e-mailem, jménem ani externím provider ID.
16. **Ochrana dat při ukončení relace:** Ukončení relace (logout) ani revokace session neodstraňuje historická data uživatele ani jeho doménové vazby.
17. **Striktní vrstvení autentizace a autorizace:** Autentizace a autorizace představují samostatné, nezaměnitelné a vzájemně oddělené systémové vrstvy.

---

### 23.25 Rozhodnutí odložená do implementační fáze

Následující technologická a implementační rozhodnutí **nejsou v tomto architektonickém kroku schválena ani závazně vybrána** a jejich konkrétní volba je záměrně odložena do implementační fáze:

* **Konkrétní autentizační provider či knihovna:** Volba konkrétního řešení (např. Auth.js / NextAuth, Supabase Auth, Clerk, Firebase Auth či vlastní implementace) zůstává otevřená.
* **Fyzické úložiště session:** Konkrétní technologické uložení relací (relační databázová tabulka, Redis, in-memory store či zabezpečený server-side session store) bude zvoleno při implementaci.
* **Mechanismus transportu session credential:** Konkrétní volba mezi zabezpečenými HTTP cookies a Authorization bearer hlavičkami bude určena podle zvolené frontendové a backendové architektury.
* **Kryptografický algoritmus pro hashování hesel:** Volba konkrétního algoritmu (Argon2id, bcrypt, PBKDF2) a jeho parametrů náročnosti bude specifikována v technickém návrhu.
* **Poskytovatel e-mailových služeb:** Konkrétní integrační služba pro odesílání odkazů na obnovu hesla (SMTP, Resend, SendGrid, Postmark apod.) bude vybrána v integrační fázi.
* **Vícefaktorová autentizace (MFA / 2FA):** Zavedení TOTP či SMS kódů je plánováno jako budoucí volitelné rozšíření bezpečnosti.
* **Rate limiting a ochrana proti brute-force útokům:** Konkrétní limity četnosti pokusů o přihlášení a blokovací mechanismy budou definovány v implementaci API brány.
* **Federovaná identita (OAuth / OIDC / SSO):** Případné přihlašování přes externí poskytovatele (Google, Microsoft, Apple) není pro 1. verzi systému vyžadováno a zůstává otevřené pro budoucí verze.

> [!NOTE]
> Step 9 stanovuje závazné funkční a bezpečnostní požadavky, hranice a invarianty, nikoliv konkrétní implementační software. Výše uvedená rozhodnutí budou učiněna v navazujících technických krocích vývoje.

---

## 25. Step 10 – Doménové události, notifikace a systémové reakce

Tato kapitola definuje logickou architekturu pro **doménové události, systémové reakce a notifikace uživatelů** v systému Nástěnka.

Stanovuje koncepční odpověď na otázku:
**„Co se v systému stane po významné doménové změně a kdo se o tom smí dozvědět.“**

Architektura je technologicky neutrální: nestanovuje závazně konkrétní message broker, frontu, WebSocket server, SSE knihovnu ani push/e-mailového poskytovatele. Definuje logické toky, datové kontrakty, recipient policy, spolehlivost doručení, idempotenci a striktní bezpečnostní hranice.

---

### 25.1 API požadavek ≠ Doménová událost

Architektura striktně rozlišuje mezi **záměrem klienta provést změnu** a **skutečností, že změna v doméně proběhla**:

* **API operace (Požadavek / Command):**
  * Vyjadřuje úmysl: *„Uživatel / klient žádá systém o provedení operace.“*
  * Příklad: `POST /tasks` (žádost o vytvoření úkolu).
  * API požadavek může kdykoliv selhat – na autentizaci, autorizaci, validačních pravidlech, doménových constraintech či při pádu databázové transakce.
* **Doménová událost (Domain Event):**
  * Vyjadřuje nezvratný fakt: *„V systému úspěšně proběhla významná doménová změna.“*
  * Příklad: `TASK_CREATED` (úkol byl vytvořen a trvale uložen).

#### Závazný princip vzniku události
> [!IMPORTANT]
> **Doménová událost nesmí nikdy vzniknout pouhým přijetím API požadavku.**
> Událost se stává publikovatelnou VÝHRADNĚ po úspěšném a úplném dokončení databázové transakce (COMMIT).
> Pokud databázová transakce selže nebo dojde k rollbacku, žádná doménová událost nesmí být publikována a systém se nesmí tvářit, že ke změně došlo.

```text
┌────────────────────────────────────────────────────────┐
│                   Klient odešle request                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│   Autentizace (Kdo jsi?) & Autorizace (Smíš to?)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Doménová validace & Business pravidla          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Databázová transakce                   │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        [COMMIT: ÚSPĚCH]            [ROLLBACK: CHYBA]
              │                           │
              ▼                           ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│ Vzniká Domain Event       │    │ ŽÁDNÁ událost nevzniká!   │
│ (publikovatelná událost)  │    │ Vrácena chybová odpověď   │
└───────────────────────────┘    └───────────────────────────┘
```

---

### 25.2 Rozlišení konceptů: Doménová událost vs. AuditLog vs. Notifikace

Jedna doménová operace může v systému vyvolat paralelní reakce v různých vrstvách. Tyto mechanismy však plní zcela odlišné funkce a nesmí být vzájemně zaměňovány:

| Koncept | Primární účel | Příjemce / Cíl | Životní cyklus a persistence |
|---|---|---|---|
| **Domain Event** | Sděluje: *„V doméně nastala událost X.“* | Systémové komponenty, asynchronní handlery, notifikační procesor. | Provozní zpráva. Po úspěšné distribuci a zpracování může být archivována či rotována. |
| **AuditLog** | Sděluje: *„Kdo (Actor), kdy, jakou operaci provedl a jaký byl původní a nový stav.“* | Bezpečnostní dohled, compliance, administrátoři. | Neměnný append-only záznam. Zůstává trvale uložen nezávisle na smazání objektu. |
| **Notification** | Sděluje: *„Uživateli Y se oznamuje zpráva Z.“* | Konkrétní člověk (koncový uživatel systému). | Osobní stavový záznam (`UNREAD` / `READ`). Může být uživatelem smazán bez vlivu na doménu. |

Příklad: Operace `TRANSFER_OWNERSHIP` (převod vlastnictví Nástěnky):
1. Zapíše do databáze změnu Ownera v tabulce `Membership` (doménový stav).
2. Zapíše neměnný záznam `TRANSFER_OWNERSHIP` do tabulky `AuditLog` (bezpečnostní audit).
3. Publikuje doménovou událost `OWNERSHIP_TRANSFERRED` (systémová reakce).
4. Na základě události vzniknou 2 osobní notifikace: pro nového Ownera a pro původního Ownera.

---

### 25.3 Taxonomie doménových událostí

Systém Nástěnka definuje uzavřenou taxonomii doménových událostí reprezentujících významné změny stavu v souladu s dosud schválenou architekturou:

#### 1. Události Nástěnky (Board Events)
* `BOARD_CREATED`: Byla vytvořena nová Nástěnka a její výchozí Owner.
* `BOARD_UPDATED`: Byly upraveny metadata Nástěnky (název, popis).
* `BOARD_DELETED`: Nástěnka byla logicky smazána (soft-delete).

#### 2. Události členství (Membership Events)
* `MEMBER_ADDED`: Do Nástěnky byl zařazen nový člen.
* `MEMBER_REMOVED`: Člen byl odebrán z Nástěnky (nebo sám Nástěnku opustil).
* `MEMBER_ROLE_CHANGED`: Členovi byla změněna role na Nástěnce (`MEMBER ↔ MANAGER`).
* `OWNERSHIP_TRANSFERRED`: Vlastnictví Nástěnky bylo atomicky převedeno na jiného člena (`OWNER`).

#### 3. Události úkolů (Task Events)
* `TASK_CREATED`: Na Nástěnce vznikl nový úkol.
* `TASK_UPDATED`: Byly změněny atributy úkolu (název, popis, termín, priorita, oblast).
* `TASK_ASSIGNED`: Úkol získal nového Hlavního Řešitele (převzetím či přidělením).
* `TASK_UNASSIGNED`: Úkol ztratil Hlavního Řešitele a přešel do stavu `Nepřiřazeno`.
* `TASK_COMPLETED`: Úkol byl přepnut do stavu `HOTOVO`.
* `TASK_REOPENED`: Dokončený úkol byl vrácen zpět do řešení.
* `TASK_PARTICIPANT_ADDED`: K úkolu se připojil (nebo byl přiřazen) nový Spoluřešitel.
* `TASK_PARTICIPANT_REMOVED`: Spoluřešitel byl od úkolu odpojen (nebo odebrán Hlavním Řešitelem).
* `TASK_DELETED`: Úkol byl řízeným způsobem trvale odstraněn ze systému (`SMAZAT`).

#### 4. Události oblastí (Area Events)
* `AREA_DELETED`: Byla smazána oblast včetně všech v ní obsažených úkolů (`SMAZAT`).

#### 5. Události uživatelského účtu (User Events)
* `USER_DEACTIVATED`: Uživatelský účet byl zablokován / deaktivován (`is_active = false`).

#### Striktní oddělení od Security Events
Události autentizačního subsystému (např. `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `SESSION_REVOKED`, `PASSWORD_CHANGED`, `PASSWORD_RECOVERY_COMPLETED`) definované ve Step 9 představují **Security Events**. Nejsou doménovými událostmi Nástěnky, nevstupují do notifikačního toku Nástěnky a slouží výhradně bezpečnostnímu auditu.

---

### 25.4 Vznik události a transakční hranice

V návaznosti na transakční pravidla z kapitoly 11 (Step 8) platí pro publikaci událostí striktní posloupnost:

```text
Začátek transakce (BEGIN TRANSACTION)
          │
          ▼
Provedení doménových změn (INSERT / UPDATE / DELETE)
          │
          ▼
Zápis do AuditLogu (pokud operace vyžaduje audit)
          │
          ▼
Kryptografická příprava záznamu události
          │
          ▼
Potvrzení transakce (COMMIT)
          │
          ▼
Událost se stává PUBLIKOVATELNOU (Publishable Event)
```

Pro kritické atomické operace:
* `CREATE_BOARD`,
* `TRANSFER_OWNERSHIP`,
* `CHANGE_MANAGER`,
* `ADD_MEMBER`,
* `REMOVE_MEMBER`,
* `CHANGE_ROLE`,
* `ASSIGN_TASK`,
* `ADD_TASK_PARTICIPANT`,
* `DELETE_TASK`,
* `DELETE_AREA`,
* `DELETE_BOARD`,

musí být zaručeno, že **událost nikdy nepředbíhá commit**. Pokud transakce z jakéhokoliv důvodu selže, událost nesmí být vypuštěna do distribuční vrstvy.

---

### 25.5 Spolehlivé publikování událostí (Reliable Event Publication)

Architektura řeší fundamentální problém distribuovaných systémů:
*„Co se stane, když databázový commit projde, ale následné odeslání události do notifikačního subsystému či zprostředkovatele selže?“*

#### Architektonický princip Outbox
Pro zajištění spolehlivosti systém aplikuje architektonický vzor **Transactional Outbox** (na logické úrovni):

1. **Atomické uložení s doménovou změnou:** Záznam o vzniklé události je trvale uložen v databázi v rámci **téže databázové transakce** jako samotná změna doménových entit.
2. **Nezávislost na dostupnosti transportu:** Selhání sítě, pád e-mailového provideru ani výpadek WebSocket serveru nemůže způsobit ztrátu události ani rollback již potvrzené doménové změny.
3. **Garance At-Least-Once Delivery:** Jakmile je transakce potvrzena, asynchronní distribuční mechanismus garantuje, že událost bude doručena notifikačnímu subsystému minimálně jednou.

```text
┌────────────────────────────────────────────────────────┐
│                   DATABÁZOVÁ TRANSAKCE                 │
│                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │  Doménová tabulka     │  │  Transactional Outbox │  │
│  │  (např. Task.status)  │  │  (uložená událost)    │  │
│  └───────────────────────┘  └───────────────────────┘  │
│                                                        │
└───────────────────────────┬────────────────────────────┘
                            │ COMMIT
                            ▼
┌────────────────────────────────────────────────────────┐
│           Asynchronní Event Dispatcher / Worker        │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              ▼                           ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │ Generování In-App    │    │ Odeslání Real-Time / │
   │ Notifikací           │    │ Asynchronní transport│
   └──────────────────────┘    └──────────────────────┘
```

---

### 25.6 Idempotence a ochrana proti duplicitám

Protože asynchronní distribuce událostí pracuje na principu *at-least-once* (garance minimálně jednoho doručení), může v důsledku síťových chyb, retry mechanismů či restartu služeb dojít k opakovanému doručení téže události.

Architektura striktně rozlišuje:
* **Unique Event (Jedinečná událost):** Unikátní doménová skutečnost identifikovaná stabilním `event_id`.
* **Delivery Attempt (Pokus o doručení):** Technické předání téže události ke zpracování.

#### Zásada idempotentního zpracování
Každý příjemce a zpracovatel událostí (zejména generátor notifikací) musí být **idempotentní**:
1. Opakované doručení události se stejným `event_id` nesmí vytvořit duplicitní uživatelskou notifikaci.
2. Systém sleduje již zpracovaná `event_id` pro daného příjemce.
3. Pokud již byla pro danou dvojici `(event_id, recipient_user_id)` notifikace vygenerována, další pokus o zpracování je tiše a bezpečně ignorován.

---

### 25.7 Struktura Domain Event (Datový kontrakt události)

Logická doménová událost nese minimální standardizovanou sadu atributů:

```text
DomainEvent {
    event_id        : UUID / String (unikátní kryptografický identifikátor),
    event_type      : String (např. 'TASK_ASSIGNED'),
    occurred_at     : Timestamp (autoritativní čas vzniku v UTC na serveru),
    actor_user_id   : User.id (ověřená identita původce akce ze serverové session),
    board_id        : Board.id (ID Nástěnky, nullable pro systémové události),
    target_type     : String ('Task' | 'Board' | 'Membership' | 'Area' | 'User'),
    target_id       : String / Integer (ID dotčené entity),
    payload         : Object (specifická minimalistická data události),
    correlation_id  : String (trasovací ID celého byznys toku / requestu),
    causation_id    : String (ID bezprostředního impulzu, např. request_id)
}
```

#### Bezpečnostní zásada pro event payload
* Payload obsahuje výhradně **data nezbytná pro vyhodnocení reakce a sestavení textu notifikace** (např. název úkolu, nově nastavený stav, jméno řešitele).
* Payload **nesmí obsahovat kompletní dump objektu** ani skrytá/soukromá data.
* Payload **nikdy nesmí obsahovat citlivá autentizační data** (hesla, tokeny, session secrets) ani soukromé poznámky z osobního pracovního prostoru úkolu.

---

### 25.8 Rozlišení Actor vs. Target v událostech

V návaznosti na Step 7 a Step 9 systém důsledně odděluje:
* **Actor (`actor_user_id`):** Uživatel, který akci fyzicky provedl (původce). Získán výhradně ze serverové session.
* **Target (`target_id` / `target_user_id`):** Subjekt nebo uživatel, jehož se akce týká (cíl).

#### Příklad:
Milan (`actor_user_id = 10`) přiřadí úkol Janovi (`target_user_id = 25`):
```text
event_type     : 'TASK_ASSIGNED'
actor_user_id  : 10 (Milan)
board_id       : 1
target_type    : 'Task'
target_id      : 101
payload: {
    assignee_user_id : 25 (Jan),
    previous_assignee: null,
    task_title       : 'Oprava elektroinstalace'
}
```
Zde je `actor ≠ target`. Záměna těchto rolí v notifikačním systému je přísně vyloučena.

---

### 25.9 Pravidla pro určení příjemců (Recipient Determination Policy)

Příjemci notifikací se **nikdy neurčují plošně na základě globální ani lokální role** (např. neexistuje pravidlo *„Manager vidí každou notifikaci“*).

Příjemce je vždy determinován **specifickou politikou pro daný typ události (Event-Specific Recipient Policy)**:

| Doménová událost | Primární příjemci (Recipient Policy) |
|---|---|
| `TASK_ASSIGNED` | Nový Hlavní Řešitel (`assignee_user_id`). |
| `TASK_UNASSIGNED` | Předchozí Hlavní Řešitel (byl-li odebrán jiným uživatelem). |
| `TASK_PARTICIPANT_ADDED` | Nově připojený / přiřazený Spoluřešitel. |
| `TASK_PARTICIPANT_REMOVED` | Odebraný Spoluřešitel (pokud byl odebrán Hlavním Řešitelem). |
| `TASK_COMPLETED` | Autor úkolu (`created_by`), případně Spoluřešitelé (pokud úkol dokončil někdo jiný). |
| `TASK_REOPENED` | Hlavní Řešitel a Spoluřešitelé daného úkolu. |
| `TASK_DELETED` | Hlavní Řešitel a autor úkolu (pokud úkol smazal Manager/Owner/Admin). |
| `MEMBER_ADDED` | Nově přidaný uživatel (informace o vstupu na Nástěnku). |
| `MEMBER_REMOVED` | Odebraný uživatel (informace o odebrání z Nástěnky). |
| `MEMBER_ROLE_CHANGED` | Dotčený uživatel, kterému byla role změněna. |
| `OWNERSHIP_TRANSFERRED` | Nový OWNER i původní OWNER. |

---

### 25.10 Vlastní akce Actora (Pravidlo potlačení self-notifikace)

Základní ergonomické a systémové pravidlo notifikačního subsystému zní:

> [!NOTE]
> **Samotný Actor běžně nedostává notifikaci o operaci, kterou sám vyvolal.**

Pokud Milan přiřadí úkol Milanovi (`actor_user_id = Milan`, `target_user_id = Milan`), recipient policy potlačí vytvoření notifikace pro Milana. Uživatel o svém vlastním kroku ví přímo z interakce s aplikací; generování notifikace pro sebe samého by způsobovalo nežádoucí zahlcení uživatelského rozhraní.

Výjimkou mohou být pouze explicitní bezpečnostní potvrzení (např. potvrzení o změně hesla zaslané e-mailem), která však spadají pod Security Events.

---

### 25.11 Typy a kanály notifikací

Architektura počítá se čtyřmi logickými notifikačními kanály:

1. **In-App Notification (Centrum notifikací v aplikaci):**
   * Základní a prioritní kanál systému Nástěnka.
   * Ukládá se do osobního notifikačního seznamu uživatele v databázi.
   * Uživatel vidí přehled nepřečtených a přečtených oznámení (ikona zvonečku, seznam).
2. **Real-Time Notification (Okamžitá aktualizace otevřeného UI):**
   * Okamžité doručení informace do právě otevřené klientské relace uživatele.
   * Slouží k dynamické aktualizaci dat na obrazovce (např. změna stavu úkolu na ploše Nástěnky) bez nutnosti ručního obnovení stránky (F5).
3. **E-mail Notification (E-mailové zprávy):**
   * Asynchronní doručování souhrnů či důležitých zpráv na ověřený e-mail uživatele.
   * Plánováno jako volitelné rozšíření podle preferencí uživatele.
4. **Push Notification (Mobilní / Webové push notifikace):**
   * Asynchronní oznámení na mobilní zařízení či do prohlížeče (např. v rámci budoucího PWA režimu).

Konkrétní síťové technologie (WebSocket, Server-Sent Events, WebPush API, SMTP brána) jsou technologicky neutrální a budou vybrány v implementační fázi.

---

### 25.12 Logický datový model entity Notification (In-App)

Osobní notifikace je logicky reprezentována entitou s následující strukturou:

```text
┌────────────────────────────────────────────────────────┐
│                      NOTIFICATION                      │
├────────────────────────────────────────────────────────┤
│ id                : UUID / Integer (PK)                │
│ recipient_user_id : FK -> User.id (příjemce)           │
│ event_id          : UUID / String (reference na Event) │
│ type              : String (např. 'TASK_ASSIGNED')     │
│ title             : String (krátký titulek zprávy)     │
│ message           : Text (srozumitelný popis události) │
│ created_at        : Timestamp                          │
│ read_at           : Timestamp (nullable)               │
│ expires_at        : Timestamp (nullable, pro expiraci) │
└────────────────────────────────────────────────────────┘
```

#### Význam stavu přečtení
* `read_at IS NULL`: Notifikace je **nepřečtená** (indikována v UI jako nová).
* `read_at IS NOT NULL`: Notifikace byla uživatelem **přečtena** (časové razítko zaznamenává okamžik přečtení).

---

### 25.13 Kardinalita: Notification ≠ Event (1:N vztah)

Mezi doménovou událostí a uživatelskou notifikací existuje vztah **1 : 0..N**:

```text
                             ┌───────────────────────────────┐
                             │          DomainEvent          │
                             └───────────────┬───────────────┘
                                             │ 1
                                             │
                                             ▼ 0..N
                             ┌───────────────────────────────┐
                             │         Notification          │
                             └───────────────────────────────┘
```

* **0 notifikací:** Událost nemá v daném kontextu žádného externího příjemce (např. úkol byl přiřazen samému sobě a self-notifikace byla potlačena, nebo jde o čistě technickou organizační změnu).
* **1 notifikace:** Událost se týká jednoho příjemce (např. `TASK_ASSIGNED` vytvoří notifikaci pro nového řešitele).
* **N notifikací:** Událost se týká více osob (např. `OWNERSHIP_TRANSFERRED` vytvoří notifikaci pro nového i starého Ownera).

Každá instance `Notification` náleží **právě jednomu konkrétnímu příjemci (`recipient_user_id`)**. Neexistují žádné „sdílené týmové notifikace“.

---

### 25.14 Životní cyklus notifikace

Jednotlivá notifikace prochází jednoduchým a deterministickým životním cyklem:

```text
┌────────────────────────┐
│        CREATED         │ ◄── Vygenerováno na základě DomainEvent
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│         UNREAD         │ ◄── read_at IS NULL (zobrazuje se jako nová)
└───────────┬────────────┘
            │
            │ Uživatel označí jako přečtené (PATCH /read nebo /read-all)
            ▼
┌────────────────────────┐
│          READ          │ ◄── read_at = Timestamp
└───────────┬────────────┘
            │
            │ Uplynutí retenční doby (expires_at) nebo smazání uživatelem
            ▼
┌────────────────────────┐
│        DELETED         │ ◄── Odstraněno z databáze (bez vlivu na doménu)
└────────────────────────┘
```

---

### 25.15 Notifikace a soukromý prostor uživatele

V souladu s principem soukromí a osobního pracovního prostoru (kapitola 15) platí:

1. **Výhradní osobní vlastnictví:** Notifikace jsou osobními daty uživatele (`recipient_user_id`).
2. **Přísná izolace uživatelů:** Uživatel vidí výhradně a pouze své vlastní notifikace.
3. **Zákaz nahlížení jinými členy:** Žádný jiný člen Nástěnky (včetně rolí `MANAGER` a `OWNER`) nesmí mít přístup k osobním notifikacím jiného uživatele.
4. **Ochrana před globálním ADMINEM:** Globální role `ADMIN` nemá z titulu své funkce žádné oprávnění zobrazovat obsah osobních notifikací jiných uživatelů. Notifikace neslouží jako auditní nástroj; pro dohled slouží výhradně `AuditLog`.

---

### 25.16 Ochrana proti úniku informací v notifikacích

Notifikační systém nesmí být zneužit jako vektor pro únik dat:

* **Respektování hranic Nástěnek:** Notifikace nesmí zpřístupnit data z Nástěnky uživateli, který není jejím členem (ochrana multi-board izolace dle kapitoly 18).
* **Zákaz úniku soukromých poznámek:** Notifikace k úkolu nesmí nikdy obsahovat soukromé poznámky, checklisty ani náčrtky z osobního pracovního prostoru řešitele.
* **Časová validace členství:** Před doručením notifikace musí recipient policy ověřit aktuální stav členství. Pokud uživatel mezi vznikem události a odesláním notifikace Nástěnku opustil, notifikace mu nesmí být doručena.

---

### 25.17 Vliv změn Membership na notifikace

Při událostech spojených se změnou členství platí:
* `MEMBER_ADDED`: Uživatel obdrží notifikaci o zařazení na Nástěnku.
* `MEMBER_REMOVED`: Uživatel může obdržet notifikaci o tom, že jeho členství bylo ukončeno. **Tímto okamžikem však definitivně zaniká jeho právo přijímat jakékoliv další notifikace z dané Nástěnky.**
* `MEMBER_ROLE_CHANGED`: Uživatel obdrží oznámení o změně své role (`MEMBER ↔ MANAGER`).
* `OWNERSHIP_TRANSFERRED`: Původní i nový vlastník obdrží oznámení o převodu vlastnictví Nástěnky.

**Historický audit a aktuální notifikační oprávnění nejsou totéž:** I když auditní stopa navždy eviduje, že uživatel byl v minulosti řešitelem či členem, notifikace o novém dění jsou doručovány výhradně aktuálním oprávněným členům.

---

### 25.18 Notifikační scénáře pro Task

| Událost | Popis scénáře a pravidla doručení |
|---|---|
| `TASK_CREATED` | Podle schválené notifikační architektury (kapitola 17) vzniká notifikace pro členy dané Nástěnky. |
| `TASK_ASSIGNED` | Notifikaci obdrží nově přiřazený Hlavní Řešitel (`assignee_user_id`), pokud akci neprovedl sám sobě. |
| `TASK_UNASSIGNED` | Notifikaci může obdržet původní řešitel, byl-li odebrán jiným uživatelem. |
| `TASK_PARTICIPANT_ADDED` | Notifikaci obdrží nově přidaný Spoluřešitel (není-li sám aktérem). |
| `TASK_PARTICIPANT_REMOVED` | Notifikaci obdrží odebraný Spoluřešitel, byl-li odebrán Hlavním Řešitelem. |
| `TASK_COMPLETED` | Notifikaci obdrží autor úkolu (`created_by`), případně další řešitelé, pokud úkol dokončil jiný člen. |
| `TASK_REOPENED` | Notifikaci obdrží Hlavní Řešitel a Spoluřešitelé jako výzvu k obnovení práce. |
| `TASK_DELETED` | **Zvláštní opatrnost:** Cílový úkol již fyzicky neexistuje (řízený hard-delete). Notifikace nesmí odkazovat na neexistující entitu; nese pouze bezpečný textový záznam z payloadu (název úkolu, Nástěnka, kdo smazal). |

---

### 25.19 Notifikační scénáře pro Membership a Board

* **Přidání člena (`MEMBER_ADDED`):** Informuje nového člena o přístupu k Nástěnce. Ostatní členové nejsou plošně notifikováni, aby nedocházelo k informačnímu šumu.
* **Odebrání člena (`MEMBER_REMOVED`):** Informuje odebraného člena o zrušení členství.
* **Změna role (`MEMBER_ROLE_CHANGED`):** Informuje dotčeného uživatele o nabytí či pozbytí role `MANAGER`.
* **Převod vlastnictví (`OWNERSHIP_TRANSFERRED`):** Informuje nového Ownera o převzetí plné odpovědnosti a starého Ownera o přechodu do role běžného člena (`MEMBER`).
* **Smazání Nástěnky (`BOARD_DELETED`):** Může informovat členy Nástěnky o jejím zrušení.

---

### 25.20 Schéma vztahů: Event / Notification / AuditLog

Následující schéma znázorňuje kompletní architekturu toku od klientského požadavku přes atomickou transakci až po paralelní větve bezpečnostního auditu a notifikací:

```text
                     Klientský API Požadavek (Command)
                                   │
                                   ▼
                       Ověření identity & oprávnění
                                   │
                                   ▼
                       Doménová operace (Service)
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    DATABÁZOVÁ TRANSAKCE (ATOMIC)                     │
│                                                                      │
│  1. Změna doménových dat (Task, Board, Membership, Area)             │
│  2. Zápis do AuditLogu (Auditní záznam – neměnný, trvalý)            │
│  3. Zápis do Transactional Outboxu (Příprava Domain Event)           │
│                                                                      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼ COMMIT
                                   │
                     Událost úspěšně publikována
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      DOMAIN EVENT DISPATCHER                         │
│                                                                      │
│  Event ID, Event Type, Actor, Target, Occurred At, Minimal Payload   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   RECIPIENT DETERMINATION POLICY                     │
│                                                                      │
│  - Vyhodnocení typu události                                         │
│  - Potlačení self-notifikace pro Actora                              │
│  - Kontrola aktuálního členství a soukromí                           │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    0..N In-App Notifikací                  Asynchronní kanály
  (tabulka Notification pro příjemce)    (Real-time push, e-mail)
```

#### Klíčové oddělení:
* `AuditLog ≠ Domain Event`: AuditLog je právní a bezpečnostní kronika; Domain Event je provozní signál.
* `Domain Event ≠ Notification`: Domain Event je systémová zpráva o změně; Notification je osobní sdělení člověku.
* `Notification ≠ API Response`: API Response informuje volajícího o výsledku jeho požadavku; Notification informuje ostatní dotčené příjemce asynchronně.

---

### 25.21 Synchronní vs. asynchronní systémové reakce

Systémové reakce jsou striktně rozděleny na dvě fáze:

#### Synchronní reakce (součást hlavní transakce před commit)
Musí být dokončeny okamžitě jako podmínka úspěchu operace:
1. Validace integrity a oprávnění.
2. Zápis doménových změn do databáze.
3. Povinný zápis do `AuditLogu` u bezpečnostních a kritických operací.
4. Uložení události do Outboxu.

#### Asynchronní reakce (po úspěšném commitu)
Probíhají na pozadí a nesmí blokovat klienta:
1. Zpracování recipient policy a vytvoření záznamů v tabulce `Notification`.
2. Odeslání zpráv přes externí poskytovatele (e-mail, push, WhatsApp).
3. Real-time websocket/SSE broadcast na připojené klienty.

#### Zásada nezávislosti domény
> [!CAUTION]
> **Selhání asynchronní notifikace nesmí nikdy způsobit rollback již potvrzené doménové změny.**
> Pokud selže odeslání e-mailu, push notifikace nebo pád websocketového spojení, doménová operace (např. převzetí úkolu, vytvoření úkolu) zůstává 100% platná a potvrzená.

---

### 25.22 Chování při chybách a strategie Retry

Pokud selže asynchronní zpracování nebo doručení notifikace:

```text
Doménová operace: ÚSPĚCH (COMMIT)
        │
        ▼
Doručení notifikace: SELHÁNÍ (Timeout / Síťová chyba)
        │
        ▼
   [NESMÍ NASTAT ROLLBACK DOMÉNY!]
        │
        ▼
Opakování doručení (Retry s exponenciálním zpožděním)
        │
        ▼
Při trvalém selhání: Záznam do Dead-Letter / Error logu pro správce
```

* **Retry s exponenciálním zpožděním (Exponential Backoff):** Dočasné výpadky transportu jsou řešeny opakovanými pokusy.
* **Deduplikace při retry:** Díky unikátnímu `event_id` a idempotenci zpracovatelů nezpůsobí opakovaný pokus duplicitní notifikaci příjemci, který ji již obdržel.

---

### 25.23 Časování, pořadí a kauzalita událostí

1. **Autoritativní čas serveru:** Časové razítko `occurred_at` je generováno výhradně serverem v UTC. Čas klienta je považován za nedůvěryhodný.
2. **Kauzální návaznost (Correlation & Causation):**
   * `correlation_id`: Provazuje všechny události a logy vzniklé v rámci jednoho uceleného požadavku.
   * `causation_id`: Identifikuje bezprostřední příčinu události (např. ID příchozího API požadavku).
3. **Objektové pořadí:** V rámci jednoho objektu (např. životní cyklus jednoho Tasku) jsou události řazeny sekvenčně podle serverového času a transakčního pořadí.

---

### 25.24 Bezpečnost událostí (Event Security)

* **Minimalizace dat:** Payload události obsahuje pouze minimální nutnou sadu atributů pro notifikační účely.
* **Absolutní zákaz tajemství v payloadu:** Payload nesmí za žádných okolností obsahovat hesla, hashe hesel, session tokeny, jednorázové recovery tokeny ani privátní šifrovací klíče.
* **Ochrana soukromí:** Osobní pracovní poznámky řešitele se do doménových událostí ani notifikací nepřenášejí.

---

### 25.25 Retence a životní cyklus událostí (Event Retention)

Architektura odděluje životní cyklus dat:
* **Provozní události (Outbox / Event queue):** Po úspěšném zpracování a vygenerování notifikací mohou být po uplynutí krátké retenční doby (např. 7–30 dní) z provozních tabulek promazány či rotovány.
* **Auditní záznamy (`AuditLog`):** Podléhají dlouhodobé archivační politice a nemažou se společně s provozními událostmi.
* **In-app notifikace (`Notification`):** Zůstávají v osobním seznamu uživatele, dokud je uživatel nesmaže, nebo do vypršení stanovené expirace (`expires_at`, např. 90 dní).

---

### 25.26 Notifikační uživatelské preference

Architektura definuje koncepční rámec pro budoucí konfiguraci uživatelských preferencí:
* možnost volby kanálů (např. In-app vždy, e-mail pouze pro důležité, push pro přiřazení),
* tichý režim (Quiet Hours) pro mobilní a externí kanály,
* filtrace typů událostí podle zájmu uživatele.

#### Závazná bezpečnostní zásada:
> [!IMPORTANT]
> **Kritická systémová a bezpečnostní oznámení nelze uživatelsky potlačit.**
> Informace o odebrání z Nástěnky, deaktivaci účtu či bezpečnostních incidentech jsou doručovány vždy bez ohledu na volitelné preference.

---

### 25.27 API kontrakt pro notifikace

Architektonický kontrakt definuje následující logické endpointy pro správu osobních notifikací:

#### 1. Získání notifikací uživatele (`GET /notifications`)
* **Účel:** Načtení seznamu osobních notifikací přihlášeného uživatele.
* **Volající:** Přihlášený uživatel (`actor_user_id`).
* **Parametry (volitelné):** `unread_only=true`, stránkování (`limit`, `offset`).
* **Autorizace:** Server vrací VÝHRADNĚ záznamy, kde `recipient_user_id == actor_user_id`.
* **Typické chyby:** `401 Unauthorized` (nepřihlášen).

#### 2. Označení notifikace jako přečtené (`PATCH /notifications/{notificationId}/read`)
* **Účel:** Změna stavu konkrétní notifikace na přečtenou.
* **Volající:** Vlastník notifikace.
* **Autorizace:** Backend ověří, že notifikace existuje a náleží volajícímu (`recipient_user_id == actor_user_id`).
* **Výsledek:** Nastavení `read_at = NOW()`.
* **Typické chyby:** `401 Unauthorized`, `404 Not Found` / `403 Forbidden` (notifikace neexistuje nebo patří jinému uživateli).

#### 3. Hromadné označení všech notifikací jako přečtených (`POST /notifications/read-all`)
* **Účel:** Označení všech nepřečtených notifikací volajícího uživatele jako přečtených.
* **Volající:** Přihlášený uživatel.
* **Výsledek:** Nastavení `read_at = NOW()` pro všechny záznamy daného `recipient_user_id`, kde bylo `read_at IS NULL`.
* **Typické chyby:** `401 Unauthorized`.

#### 4. Smazání notifikace (`DELETE /notifications/{notificationId}` – volitelný endpoint)
* **Účel:** Odstranění přečtené či nepotřebné notifikace z osobního seznamu uživatele.
* **Volající:** Vlastník notifikace.
* **Autorizace:** Povoleno pouze pro záznamy, kde `recipient_user_id == actor_user_id`.
* **Výsledek:** Smazání záznamu z tabulky `Notification` (nemá žádný vliv na původní `DomainEvent` ani na doménový stav úkolů/Nástěnek).
* **Typické chyby:** `401 Unauthorized`, `403 Forbidden` / `404 Not Found`.

---

### 25.28 Autorizační hranice notifikací

Při jakékoliv práci s notifikačním API backend nekompromisně ověřuje:
1. **Identitu Actora:** Zjištěna ze zvalidované serverové session (`actor_user_id`).
2. **Vlastnictví notifikace:** Actor smí číst a upravovat výhradně notifikace, jejichž je přímým příjemcem (`recipient_user_id`).
3. **Zákaz manipulace s parametry:** Klient nesmí mít možnost změnou `notification_id`, `recipient_user_id` ani `board_id` nahlížet do notifikací jiných členů týmu či cizích Nástěnek.

---

### 25.29 Konceptuální datový návrh entity Notification

```text
Tabulka: Notification
─────────────────────────────────────────────────────────────────────────────
id                 UUID / BigInt    PK, not null
recipient_user_id  UUID / BigInt    FK -> User.id, not null, on delete cascade
event_id           UUID / String    not null, indexováno
type               Varchar(64)      not null (např. 'TASK_ASSIGNED')
title              Varchar(255)     not null
message            Text             not null
created_at         Timestamp        not null, default now()
read_at            Timestamp        nullable
expires_at         Timestamp        nullable
─────────────────────────────────────────────────────────────────────────────
Indexy a constrainty:
- INDEX idx_notifications_recipient_unread (recipient_user_id, read_at)
- UNIQUE (recipient_user_id, event_id, type) -- ochrana proti duplicitám
```

---

### 25.30 Integrita mezi Event a Notification

Architektura garantuje následující integritní pravidla:
1. **Nezávislost domény:** Notifikace je odvozený pohled na událost; její vytvoření, přečtení či smazání nezpětně neovlivňuje stav úkolu, Nástěnky ani historii v `AuditLogu`.
2. **Jednoznačná vazba příjemce:** Každá notifikace má přesně jednoho příjemce.
3. **Sledovatelnost původu:** Každá notifikace nese odkaz na původní `event_id`, což umožňuje přesné trasování a spolehlivou deduplikaci.

---

### 25.31 Bezpečnostní invarianty Step 10

Architektura událostí a notifikací závazně garantuje dodržení následujících osmnácti invariantů:

1. **Vznik události po úspěchu:** Doménová událost vzniká výhradně po úspěšném provedení operace a commmitu transakce.
2. **Zákaz publikace při chybě:** Neúspěšná transakce nesmí nikdy publikovat potvrzenou doménovou událost.
3. **Oddělení Domain Event od AuditLogu:** Doménová událost není totožná s auditním záznamem; slouží odlišným účelům a má jiný životní cyklus.
4. **Oddělení Domain Event od Notifikace:** Doménová událost vyjadřuje systémovou změnu, nikoliv samotné osobní sdělení uživateli.
5. **API požadavek není událost:** Příchozí API request reprezentuje pouhý záměr klienta, nikoliv potvrzenou událost.
6. **Jednoznačnost události:** Každá doménová událost má unikátní a stabilní `event_id`.
7. **Autorita serveru nad Actor:** Identita původce události (`actor_user_id`) pochází výhradně ze serverového autentizačního kontextu.
8. **Striktní oddělení Actor a Target:** Původce akce (`actor`) je nezaměnitelný s cílem či subjektem akce (`target`).
9. **Event-specific recipient policy:** Příjemci notifikací jsou určováni podle specifické sémantiky konkrétní události, nikoliv paušálně podle rolí.
10. **Oprávněný příjem notifikace:** Uživatel obdrží pouze takovou notifikaci, k jejímuž obsahu má v daném okamžiku platné přístupové oprávnění.
11. **Osobní soukromí notifikací:** Uživatel smí vidět výhradně své vlastní osobní notifikace.
12. **Omezení přístupu ADMINA:** Globální role `ADMIN` nemá z titulu své funkce automatický přístup k osobním notifikacím jiných uživatelů.
13. **Respektování hranic Nástěnek:** Notifikace nesmí obejít členství v Nástěnce ani zpřístupnit data nečlenům.
14. **Nezávislost doménového stavu na asynchronních chybách:** Selhání asynchronního doručení notifikace nesmí způsobit rollback potvrzené doménové operace.
15. **Spolehlivost distribuce a retry:** Notifikační transport musí umožňovat opakované doručení při dočasných výpadcích.
16. **Idempotence zpracování:** Opakované doručení téže události nesmí vyvolat duplicitní uživatelskou notifikaci ani vícenásobný vedlejší účinek.
17. **Zákaz citlivých tajemství v událostech:** Autentizační tajemství, hesla a privátní tokeny se nikdy nesmí nacházet v payloadu událostí ani v notifikacích.
18. **Autonomie AuditLogu:** Životní cyklus `AuditLogu` je nezávislý na smazání notifikací, událostí v Outboxu i cílových doménových objektů.

---

### 25.32 Rozhodnutí odložená do implementační fáze

Následující technologická a implementační rozhodnutí **nejsou v tomto architektonickém kroku schválena ani závazně vybrána** a jejich volba je záměrně odložena do implementační fáze:

* **Konkrétní Event Bus a Message Broker:** Volba konkrétního brokeru či transportu (např. Redis Pub/Sub, Kafka, RabbitMQ, in-memory EventEmitter, PostgreSQL LISTEN/NOTIFY).
* **Fyzická Outbox implementace:** Zda bude Outbox tabulka v PostgreSQL/SQLite, samostatná fronta či systémové řešení frameworku.
* **Technologie pro Real-Time komunikaci:** Volba mezi WebSockets, Server-Sent Events (SSE), HTTP long-polling či externími službami (Pusher, Firebase).
* **Poskytovatel externích notifikací:** Konkrétní e-mailový provider (Resend, SendGrid, Postmark, SMTP) a push provider (WebPush, Firebase Cloud Messaging, OneSignal).
* **Konkrétní knihovna pro front-end notifikace:** Toast knihovna a správa stavu notifikací na klientovi.
* **Časové limity expirace a retence:** Konkrétní počty dní pro uchovávání přečtených notifikací a rotaci Outbox tabulky.
* **Mechanismus Dead-Letter Queue:** Způsob ukládání a monitorování trvale nedoručitelných událostí.

> [!NOTE]
> Step 10 definuje závaznou logickou architekturu událostí, invarianty a bezpečnostní hranice. Konkrétní technologické nástroje budou vybrány až v technické implementační fázi.

---

## 27. Step 11 – Současný přístup, konflikty změn, idempotence a konzistence dat

Tato kapitola definuje logickou architekturu systému Nástěnka pro zvládání **souběžného přístupu více uživatelů (concurrency), detekci a řešení konfliktů při změnách, idempotenci API operací a garanci transakční konzistence**.

Základní postulát této kapitoly zní:
> [!IMPORTANT]
> **V systému Nástěnka nikdy nesmí dojít k tichému přepsání platné změny jiného uživatele bez vědomého rozhodnutí architektury (zákaz implicitního Last-Write-Wins).**

---

### 27.1 Pojem souběžného přístupu (Concurrent Access) a typické scénáře

Souběžný přístup nastává v okamžiku, kdy dva či více nezávislých uživatelů (či procesů) pracují ve stejném čase nad totožnými datovými entitami. V kolaborativním prostředí Nástěnky jde o standardní provozní situaci.

#### Typické souběžné scénáře:

##### Scénář A – Dva uživatelé současně upravují stejný úkol (Task Update Collision)
```text
1. Milan načte Task (verze 5).
2. Jan načte tentýž Task (verze 5).
3. Milan provede úpravu popisu a úspěšně uloží ──► Task je nyní ve verzi 6.
4. Jan se zpožděním odesílá svou úpravu termínu, vycházející z původní verze 5.
```
*Riziko bez ochrany:* Pokud by server Janovu změnu slepě přijal, přepsal by Milanův nově upravený popis Janovým starým stavem popisu (tzv. *Lost Update*).
*Architektonické řešení:* Janův požadavek je detekován jako práce se zastaralými daty a je odmítnut chybou `409 Conflict`.

##### Scénář B – Dva uživatelé současně mění Hlavního Řešitele (Assignee Collision)
```text
1. Milan přiřazuje úkol Janovi (POST /tasks/{id}/assignee -> Jan).
2. Petr v témže okamžiku přiřazuje tentýž úkol Evě (POST /tasks/{id}/assignee -> Eva).
```
*Architektonické řešení:* Pouze jedna transakce uspěje a posune stav. Druhý požadavek narazí na změněnou verzi a vrátí `409 Conflict`. Úkol v žádném okamžiku nesmí mít dva řešitele ani nekonzistentní stav.

##### Scénář C – Současný převod vlastnictví Nástěnky (Ownership Collision)
```text
1. Aktuální OWNER zahájí převod vlastnictví Nástěnky na Jana.
2. Globální ADMIN v téže chvíli provádí krizový administrativní zásah a převádí Nástěnku na Petra.
```
*Architektonické řešení:* Jde o kritickou operaci. Transakce musí být serializována; nesmí vzniknout stav dvou souběžných Ownerů ani Nástěnka bez Ownera. Jeden požadavek projde, druhý je zamítnut.

##### Scénář D – Současné smazání a úprava (Delete vs. Update Collision)
```text
1. Uživatel A provede řízené smazání úkolu (DELETE /tasks/{id} s potvrzením SMAZAT).
2. Uživatel B v témže okamžiku odesílá úpravu atributů (PATCH /tasks/{id}).
```
*Architektonické řešení:* Jakmile je úkol transakčně smazán, souběžný požadavek na úpravu je odmítnut (úkol již neexistuje). Nedochází k žádnému vytvoření osiřelých dat ani oživení smazaného objektu.

---

### 27.2 Výchozí přístup: Optimistic Concurrency Control (OCC)

Pro běžné úpravy doménových entit (`Task`, `Area`, `Board`, `Membership`) systém Nástěnka volí jako výchozí strategii **Optimistic Concurrency Control (OCC)**:

1. **Předpoklad nízkého konfliktu:** Systém předpokládá, že ke kolizím dochází v menšině případů. Nezamyká proto databázové záznamy během doby, kdy si uživatel data v prohlížeči prohlíží či edituje.
2. **Koncepce verzování:** Každá verze entity nese jednoznačný concurrency indikátor:
   * celočíselná verze (`version` – monotonně rostoucí sekvence),
   * časové razítko poslední změny (`updated_at`),
   * nebo kryptografický hash stavu (ETag).
3. **Závazný princip OCC:**
   > [!IMPORTANT]
   > Klient smí aktualizovat objekt pouze tehdy, pokud serveru prokáže, že jeho změna vychází ze stejné verze objektu, jaká se aktuálně nachází v databázi.

---

### 27.3 Práce se zastaralými daty (Stale Data)

* **Stale Data (Zastaralá data):** Reprezentace doménového objektu držená klientem, jejíž verze je nižší než aktuální verze evidovaná autoritativním backendem (`client_version < server_version`).
* **Zákaz tiché akceptace:** Požadavek na úpravu postavený na zastaralých datech nesmí být serverem nikdy tvořen jako nová platná verze.
* Pokus o uložení zastaralých dat představuje stavový konflikt, který musí být explicitně signalizován volajícímu.

---

### 27.4 Konfliktní odpověď: HTTP 409 Conflict

V návaznosti na chybový model ze Step 7 a Step 9 slouží pro signalizaci souběžných konfliktů stavový kód:

```text
HTTP 409 Conflict
```

#### Přísné rozlišení chybových stavů:
* **`403 Forbidden` (Chyba oprávnění):** Volající (Actor) nemá právo operaci provést (např. není členem Nástěnky, není Ownerem). Zde se vůbec nezkoumá verze dat; operace je zamítnuta v autorizační vrstvě.
* **`409 Conflict` (Stavový konflikt):** Volající má platné oprávnění operaci provést, ale operaci nelze aplikovat z důvodu konfliktu se současným stavem cílového objektu (zastaralá verze, kolize souběžné změny, objekt mezitím smazán).
* **`422 Unprocessable Entity` (Validační chyba):** Data zaslaná v požadavku jsou syntakticky či sémanticky neplatná (např. prázdný název úkolu, neplatné datum).

---

### 27.5 Protokol a pravidla Optimistic Locking

Proces optimistického zamykání probíhá v následujících pěti krocích:

```text
1. READ:     Klient načte objekt ──► obdrží data a aktuální token (version = 5)
2. EDIT:     Uživatel upravuje data v UI
3. WRITE:    Klient odesílá změnu s očekávanou verzí (expected_version = 5)
4. VERIFY:   Backend v transakci atomicky ověří:
             UPDATE tasks SET title = :newTitle, version = version + 1
             WHERE id = :taskId AND version = :expected_version
5. OUTCOME:
   ├── Zasažen 1 řádek  ──► SUCCESS: verze se posunula na 6, COMMIT, vrací 200 OK
   └── Zasaženo 0 řádků ──► CONFLICT: mezitím změnil někdo jiný, ROLLBACK, vrací 409 Conflict
```

* Při úspěchu je atomicky inkrementována verze a transakce je potvrzena.
* Při neshodě verzí databáze neprovede žádnou úpravu dat, transakce je vrácena a klient obdrží `409 Conflict`. Aktuální stav v databázi zůstává netknut.

---

### 27.6 Vztah: Atomicita vs. Concurrency Control

Architektura striktně rozlišuje tyto dva vzájemně se doplňující koncepty:

* **Atomicita (Databázová transakce):**
  * Zajišťuje integritu operace z technického hlediska (*All-or-Nothing*).
  * Garantuje, že skupina změn (např. smazání oblasti + smazání jejích úkolů + zápis do AuditLogu) proběhne celá, nebo vůbec.
* **Concurrency Control (Řízení souběhu):**
  * Zajišťuje logickou a byznysovou integritu v čase.
  * Garantuje, že uživatel nepřepíše cizí práci a že operace vychází z pravdivého stavu reality.

Transakce nechrání před ztrátou změn způsobenou pomalým uživatelem; optimistické zamykání zase nenahrazuje atomickou transakci. Obě vrstvy musí fungovat společně.

---

### 27.7 Souběhy (Race Conditions) a jejich prevence

**Race condition (souběh)** je stav, kdy konečný výsledek systému závisí na náhodném časovém pořadí, v němž server zpracuje souběžné požadavky.

Systém Nástěnka definuje povinnou ochranu proti race conditions u všech kritických operací:
1. **Převod vlastnictví (`TRANSFER_OWNERSHIP`):** Nesmí vzniknout 2 vlastníci ani stav bez vlastníka.
2. **Správa provozního manažera (`CHANGE_MANAGER`):** Nesmí vzniknout 2 manažeři (maximálně 1 Manager na Nástěnku).
3. **Přidání člena (`ADD_MEMBER`):** Dva administrátoři přidávající téhož uživatele nesmí vytvořit duplicitní členství (`UNIQUE(user_id, board_id)`).
4. **Změna rolí a odebrání člena:** Souběžné odebrání a povýšení člena musí skončit konzistentním stavem.
5. **Řízený hard-delete úkolu a oblasti (`DELETE_TASK`, `DELETE_AREA`):** Mazání nesmí kolidovat s editací ani vytvářet osiřelé záznamy.

---

### 27.8 Přehled concurrency ochrany u kritických doménových operací

Následující matice definuje povinné mechanismy ochrany pro doménové operace systému:

| Doménová operace | Concurrency ochrana (OCC / Lock) | Atomická transakce | Primární ochranný mechanismus |
|---|---|---|---|
| `CREATE_BOARD` | Ano (Idempotence) | Ano | Transakce (Board + Owner Membership) |
| `TRANSFER_OWNERSHIP` | Ano (Serializace / OCC) | Ano | Řádkový zámek / Serializovatelná transakce |
| `CHANGE_MANAGER` | Ano (OCC / Constraint) | Ano | Transakce + kontrola max. 1 Managera |
| `ADD_MEMBER` | Ano (Idempotence) | Ano | `UNIQUE(user_id, board_id)` constraint |
| `REMOVE_MEMBER` | Ano (OCC) | Ano | Transakce + kontrola ochrany Ownera |
| `CHANGE_ROLE` | Ano (OCC) | Ano | Transakční verifikace aktuální role |
| `ASSIGN_TASK` | Ano (OCC) | Ano | Verze Tasku + kontrola členství řešitele |
| `ADD_TASK_PARTICIPANT` | Ano (Constraint / OCC) | Ano | `UNIQUE(task_id, user_id)` constraint |
| `DELETE_TASK` | Ano (OCC + Confirmation) | Ano | Atomický hard-delete + AuditLog + potvrzení SMAZAT |
| `DELETE_AREA` | Ano (OCC + Confirmation) | Ano | Kaskádový atomický hard-delete + AuditLog |
| `DELETE_BOARD` | Ano (OCC) | Ano | Soft-delete transakce + AuditLog |

---

### 27.9 Pravidla pro souběžnou změnu Tasku

Při souběžných úpravách atributů úkolu (`title`, `description`, `priority`, `due_date`, `status`, `area_id`) platí:

1. **Zákaz automatického tichého slučování (No Auto-Merge):**
   * Systém v 1. verzi neprovádí žádný implicitní 3-cestný merge textových polí.
   * Pokus o úpravu úkolu, jehož verze neodpovídá verzi na serveru, je vždy odmítnut jako celek chybou `409 Conflict`.
2. **Zachování integrity vazeb:**
   * Pokud jeden uživatel přesouvá úkol do jiné oblasti (`area_id`) a druhý uživatel oblast mezitím smaže, přesun úkolu selže na neexistenci cílové oblasti.
3. **Deterministický postup:**
   * Konflikt (`409`) ──► Klient načte aktuální stav ──► Uživatel vidí aktuální hodnoty a vědomě rozhodne o dalším postupu.

---

### 27.10 Souběh při změně řešitele (Assignee Concurrency)

Operace změny Hlavního Řešitele (`PATCH /tasks/{id}/assignee`) podléhá striktnímu verzování:

```text
Výchozí stav: Task #42 (verze 10, assignee: null)

1. Požadavek A (Milan): Nastav assignee = Jan, očekávaná verze = 10
2. Požadavek B (Petr):  Nastav assignee = Eva, očekávaná verze = 10

Server zpracuje Požadavek A:
- Verze 10 odpovídá.
- Assignee nastaven na Jan, verze posunuta na 11.
- COMMIT. Vráceno 200 OK.

Server zpracuje Požadavek B:
- Očekávaná verze 10 neodpovídá (aktuální je 11).
- Změna neprovedena, ROLLBACK.
- Vráceno 409 Conflict s informací, že úkol byl mezitím přiřazen Janovi.
```

Tímto je vyloučeno, aby došlo k přepsání řešitele bez vědomí uživatele.

---

### 27.11 Souběžné změny členství a rolí (Membership Concurrency)

Při operacích nad členstvím Nástěnky vystupují jako poslední nepřekročitelná linie integrity databázové constrainty:

1. **Souběžné přidání stejného člena:** Pokud dva správci současně přidávají téhož uživatele, transakce, která doběhne jako druhá, narazí na `UNIQUE(user_id, board_id)`. Požadavek je zachycen a ošetřen jako idempotentní úspěch nebo `409 Conflict`.
2. **Souběžné jmenování Managera:** Pokud dva uživatelé současně jmenují různé členy do role `MANAGER`, aplikační transakční kontrola a případný parciální unikátní index zajistí, že Nástěnka nebude mít v žádném okamžiku více než jednoho platného Managera. Druhý požadavek selže na porušení Invariantu 2.
3. **Odebrání vs. změna role:** Pokud je uživatel jedním správcem z Nástěnky odebírán a druhým správcem povyšován na Managera, operace odebrání musí zrušit členství dříve, než by mohla vzniknout neplatná osiřelá role. Druhý požadavek obdrží chybu o neexistujícím členství.

---

### 27.12 Současný převod vlastnictví (Kritický scénář)

Převod vlastnictví Nástěnky (`TRANSFER_OWNERSHIP`) je nejcitlivější doménovou operací. Pokud nastane souběh (např. stávající Owner převádí Nástěnku na člena A, zatímco globální Admin direktivně převádí Nástěnku na člena B):

1. **Serializace přístupu:** Operace uzamyká řádek Nástěnky (`Board`) a příslušné záznamy `Membership` pro update v rámci nejpřísnější transakční izolace.
2. **Pravidlo jediného vítěze:** První transakce provede atomickou záměnu rolí (`stávající OWNER → MEMBER`, `nový člen → OWNER`) a commitne se.
3. **Odmítnutí druhého požadavku:** Druhá transakce po uvolnění zámku zjistí, že původní předpoklad (kdo je stávající Owner) již neplatí. Transakce je odmítnuta chybou `409 Conflict`.
4. **Garantovaný výsledek:** Na Nástěnce existuje v každém okamžiku **přesně jeden platný OWNER**. Vznik stavu s 0 nebo 2 Owneri je fyzicky nemožný.

---

### 27.13 Souběh při mazání (Concurrent DELETE)

#### 1. `DELETE_TASK` vs. `PATCH_TASK`
* Pokud uživatel A smaže úkol v čase $T_1$ a uživatel B odešle úpravu téhož úkolu v čase $T_2$ ($T_2 > T_1$):
  * Požadavek B zjistí, že úkol s daným `id` v databázi neexistuje.
  * Server vrátí `404 Not Found` (případně `409 Conflict`).
  * Nedochází k žádnému obnovení smazaného úkolu ani vzniku sirotčích záznamů.

#### 2. `DELETE_AREA` vs. Úprava či vytvoření Tasku v dané oblasti
* Smazání oblasti (`DELETE_AREA`) provádí kaskádový atomický hard-delete oblasti i všech v ní obsažených úkolů.
* Pokud souběžný požadavek zkouší přidat úkol do mazané oblasti nebo upravit stávající úkol v této oblasti:
  * Transakce smazání oblasti drží zámek nad oblastí.
  * Souběžný požadavek selže buď na neexistenci cizího klíče `area_id` (cizí klíč selže), nebo na optimistickém zámku.
  * V systému nikdy nevznikne úkol odkazující na neexistující oblast.

---

### 27.14 Idempotence API operací

Architektura striktně definuje pojem idempotence:

> [!NOTE]
> **Idempotentní operace:** Operace, jejíž opakované provedení se stejnými parametry zanechá systém ve stejném stavu jako její jednorázové provedení a nezpůsobí nekontrolované opakování vedlejších účinků.

#### Rozlišení úrovní idempotence:
1. **HTTP Idempotence:**
   * Garantována protokolem HTTP pro metody `GET`, `PUT`, `DELETE`.
   * Příklad: `DELETE /tasks/42` – první volání úkol smaže (204), opakované volání konstatuje, že úkol neexistuje (404), ale stav systému (úkol neexistuje) zůstává identický.
2. **Byznysová / Doménová Idempotence:**
   * Týká se netriviálních operací s metodou `POST` (které v HTTP standardu idempotentní nejsou).
   * Příklad: Opakované odeslání požadavku na vytvoření Nástěnky, vytvoření úkolu či přiřazení řešitele v důsledku výpadku sítě nesmí vytvořit dva duplicitní úkoly.

---

### 27.15 Mechanismus Idempotency Key

Pro netriviální vytvářecí a stav měnící operace (např. `POST /boards`, `POST /tasks`) architektura zavádí koncept **Idempotency Key**:

* Klient při odeslání požadavku vygeneruje unikátní klientský identifikátor (např. UUID v hlavičce `Idempotency-Key`).
* Backend před provedením operace ověří, zda již požadavek s tímto klíčem pro daného `actor_user_id` nezpracoval:
  * **Nový klíč:** Server transakčně provede operaci, uloží výsledek a asociuje jej s tímto klíčem.
  * **Již zpracovaný klíč:** Server operaci **znovu neprovádí**, ale vrátí dříve uloženou odpověď (stejný payload i status kód).
  * **Klíč právě zpracovávaný:** Server odmítne souběžný identický pokus (např. `409 Conflict` s informací, že požadavek se zpracovává).

---

### 27.16 Timeout, výpadek sítě a strategie opakování (Retry)

Typický rizikový scénář v mobilním či nestabilním prostředí:

```text
1. Klient odešle: POST /tasks (vytvoř úkol "Revize kotle", Idempotency-Key: X)
2. Server operaci úspěšně provede, úkol zapíše do DB a commitne.
3. Síťové spojení selže dříve, než server stihne klientovi doručit odpověď 201 Created.
4. Klientovi vyprší timeout. Klient neví, zda úkol vznikl, a provede RETRY se stejným klíčem X.
5. Server rozpozná Idempotency-Key X ──► NEVYTVÁŘÍ druhý úkol, vrací původní 201 Created.
```

Díky kombinaci Idempotency Key a transakční integrity systém garantuje, že v databázi nevzniknou duplicitní úkoly ani duplicitní členství.

---

### 27.17 Rozlišení: Idempotence vs. Concurrency Control

Tento rozdíl je zásadní pro správné pochopení architektury:

* **Idempotence** chrání systém před **opakovaným odesláním TÉHOŽ požadavku** (např. v důsledku retry po timeoutu sítě).
* **Concurrency Control** chrání systém před **souběžným odesláním RŮZNÝCH požadavků** nad stejnými daty (např. dva různí lidé měnící stejný úkol).

Mechanismus pro idempotenci (např. `Idempotency-Key`) nenahrazuje verzování dat (`version` v OCC) a naopak.

---

### 27.18 Bezpečnostní pravidla pro Retry mechanismus

Pokud klient nebo middleware provádí opakování (retry) neúspěšného či přerušeného požadavku:

1. **Žádné obcházení autorizace:** Každý retry požadavek musí projít plnou a novou autorizační kontrolou vůči aktuálnímu stavu účtu a členství.
2. **Žádné obcházení OCC:** Pokud byl požadavek odmítnut na `409 Conflict`, prostý slepý retry se stejnou verzí je zakázán (vedl by ke stejnému odmítnutí). Uživatel musí nejdříve načíst nový stav.
3. **Žádné obcházení bezpečnostních potvrzení:** U destruktivních operací (`DELETE_TASK`, `DELETE_AREA`) nesmí být potvrzovací řetězec `SMAZAT` znovupoužit mimo kontext jediné autorizované operace.
4. **Zákaz multiplikace doménového účinku:** Žádný retry nesmí vygenerovat vícenásobný zápis do `AuditLogu` ani vícenásobné doménové události.

---

### 27.19 Úrovně izolace transakcí (Transaction Isolation)

Architektura specifikuje koncepční požadavky na úroveň transakční izolace nezávisle na konkrétním databázovém stroji:

* **Read Committed (Základní provoz):**
  * Výchozí úroveň pro běžné čtení a jednoduché jednorázové zápisy.
  * Zabraňuje čtení nepotvrzených dat (*Dirty Reads*).
* **Repeatable Read (Konzistentní pohled a OCC):**
  * Vhodné pro transakce provádějící kontrolu verzí a aktualizaci doménových objektů.
  * Zajišťuje, že data načtená během transakce se po dobu jejího trvání nezmění jinou potvrzenou transakcí.
* **Serializable (Kritické organizační operace):**
  * Vyžadováno pro operace, které kontrolují globální invarianty a následně mění stav:
    * `TRANSFER_OWNERSHIP` (kontrola a garantování právě 1 Ownera),
    * `CHANGE_MANAGER` (kontrola a garantování max. 1 Managera),
    * `DELETE_AREA` (kaskádový rozpad bez vzniku sirotků).
  * Zaručuje absolutní serializaci, jako by operace proběhly přísně sekvenčně za sebou.

---

### 27.20 Odmítnutí strategie Last-Write-Wins

Architektura Nástěnky výslovně stanovuje:

> [!CAUTION]
> **Implicitní strategie „Last-Write-Wins“ (poslední zápis vyhrává) je pro editaci sdílených dat v systému Nástěnka ZAKÁZÁNA.**

Pokud by byla použita strategie Last-Write-Wins, docházelo by k nebezpečným a nezjistitelným ztrátám dat (např. přepsání nově schváleného popisu úkolu starým konceptem). Každá editace sdíleného objektu musí být podmíněna ověřením verze (OCC). Výchozím stavem při zjištění neshody verzí je **vždy `409 Conflict`**.

---

### 27.21 Uživatelský zážitek a řešení konfliktu (UX Conflict Resolution)

Chování uživatelského rozhraní při vzniku konfliktu je navrženo transparentně a bezpečně:

1. **Okamžitá zpětná vazba:** Při návratovém kódu `409 Conflict` aplikace uživatele srozumitelně informuje: *„Tento úkol byl před okamžikem upraven jiným členem týmu.“*
2. **Zobrazení rozdílů (Diff / Current State):** UI nabídne uživateli náhled na aktuální data na serveru s vyznačením, co se změnilo.
3. **Vědomé rozhodnutí uživatele:** Uživatel má možnost:
   * převzít aktuální data ze serveru (Reload),
   * upravit svou změnu v kontextu nových dat a odeslat ji znovu s novým číslem verze,
   * operaci zrušit.
4. **Zákaz skrytého auto-merge:** Žádný textový obsah nesmí být sloučen automaticky na pozadí bez vědomí a schválení uživatelem.

---

### 27.22 Vazba souběhu na doménové události (Domain Events)

V návaznosti na Step 10 platí striktní pravidlo integrity mezi souběhem a událostmi:

* **Při vzniku konfliktu (`409 Conflict`):**
  * Transakce neprovede commit.
  * **Nevzniká žádná doménová událost.**
  * Systém nesmí publikovat např. `TASK_UPDATED` o změně, která byla z důvodu konfliktu verzí odmítnuta.
* **Při úspěšném vyřešení (Commit):**
  * Verze entity se posune na novou hodnotu.
  * Doménová událost je zapsána do Outboxu a následně publikována s novým číslem verze v payloadu.

---

### 27.23 Vazba souběhu na auditní stopu (AuditLog)

Auditní stopa systému (`AuditLog`) slouží k záznamu skutečné historie doménových změn:

* Do tabulky `AuditLog` se zapisují **výhradně úspěšně potvrzené změny stavu** (`previous_state` ──► `new_state`).
* Konfliktní odmítnutí požadavku (`409 Conflict`) se do doménového auditu nezapisuje jako změna stavu objektu, neboť žádná změna stavu nenastala.
* Případné bezpečnostní monitorování neobvykle vysokého počtu konfliktů může být vedeno v technických/bezpečnostních systémových logách, nikoliv však v doménovém AuditLogu Nástěnky.

---

### 27.24 Soft-delete a souběžný přístup

Pro entity podléhající logickému smazání (např. `Board.deleted_at`, `User.deleted_at`, `User.is_active`):

1. **Zákaz souběžných úprav smazaného objektu:** Jakmile transakce nastaví `deleted_at = Timestamp`, jakýkoliv souběžný požadavek na úpravu tohoto objektu je vyhodnocen jako konflikt (`409 Conflict`) nebo neexistující entita (`404 Not Found`).
2. **Konzistence deaktivovaného účtu:** Pokud je uživatelský účet deaktivován (`is_active = false`), souběžné požadavky přicházející s dřívější session tohoto uživatele jsou okamžitě odmítnuty a nemohou provést zápis do databáze.

---

### 27.25 Řízený hard-delete a souběžný přístup

Pro nevratné operace `DELETE_TASK` a `DELETE_AREA`:

1. **Validace verze před smazáním:** Požadavek na smazání musí specifikovat očekávanou verzi objektu. Pokud byl úkol mezitím zásadním způsobem změněn jiným uživatelem, pokus o smazání narazí na `409 Conflict`, aby se předešlo nechtěnému smazání čerstvě aktualizované práce.
2. **Atomický rozpad závislostí:** Při smazání oblasti probíhá odstranění oblasti, všech jejích úkolů, účastníků a týmových příloh v jediné transakci. Souběžný požadavek nemůže vytvořit sirotčí úkol bez oblasti.
3. **Nezávislost auditu:** Po fyzickém odstranění záznamů z provozních tabulek zůstává v databázi trvale zachován záznam `DELETE_TASK` resp. `DELETE_AREA` v `AuditLogu`.

---

### 27.26 Bezpečnostní invarianty Step 11

Architektura souběžného přístupu, konfliktů a idempotence garantuje dodržení následujících osmnácti invariantů:

1. **Zákaz tichého přepisu:** Tichý přepis cizí změny (implicitní Last-Write-Wins) je v celém systému zakázán.
2. **Detekovatelnost zastaralých dat:** Systém vždy spolehlivě detekuje práci klienta se zastaralou verzí dat.
3. **Povinné optimistické zamykání:** Běžné úpravy sdílených doménových entit podléhají verifikačnímu mechanismu OCC (nebo ekvivalentnímu spolehlivému zámku).
4. **Transakční ochrana kritických rolí:** Operace manipulující s rolemi a vlastnictvím jsou transakčně serializovatelné.
5. **Právě jeden Owner:** Aktivní Nástěnka nemá v žádném časovém okamžiku dva a více Ownerů.
6. **Žádná Nástěnka bez Ownera:** Vlastnictví Nástěnky nelze opustit ani převést tak, aby Nástěnka zůstala bez platného Ownera.
7. **Maximálně jeden Manager:** Žádná Nástěnka nemá v žádném okamžiku více než jednoho platného Managera (`0..1`).
8. **Unikátnost členství:** Dvojice `(user_id, board_id)` je unikátní; souběžné požadavky nemohou vytvořit duplicitní členství.
9. **Zákaz sirotčích stavů:** Souběžné operace nad Tasky a Oblastmi nesmí vytvořit úkol bez Nástěnky ani úkol odkazující na smazanou oblast.
10. **Atomicita řízeného hard-delete:** Fyzické odstranění úkolu či oblasti probíhá v nedělitelné transakci včetně auditního zápisu.
11. **Idempotence vytvářecích operací:** Opakování požadavku se stejným Idempotency Key nesmí vytvořit duplicitní záznam.
12. **Nezávislost konceptů:** Idempotence a Concurrency Control jsou samostatné mechanismy řešící odlišná rizika.
13. **Sémantická čistota HTTP 409:** Kód `409 Conflict` reprezentuje výhradně skutečný stavový konflikt dat či verzí.
14. **Čistota událostí při konfliktu:** Neúspěšná či konfliktovaná transakce nikdy nepublikuje potvrzující doménovou událost.
15. **Integrita AuditLogu:** Do doménového auditu se zapisují pouze skutečně potvrzené změny stavu.
16. **Revalidace při Retry:** Každý opakovaný pokus musí znovu projít plnou autorizační kontrolou.
17. **Oddělení verze od autorizace:** Znalost správného čísla verze objektu nezakládá oprávnění k jeho editaci; autorizace se vyhodnocuje nezávisle.
18. **Constraint jako poslední linie obrany:** Databázová integritní omezení zůstávají finální a nepřekročitelnou bariérou proti nekonzistentním stavům.

---

### 27.27 Rozhodnutí odložená do implementační fáze

Následující technologická a implementační rozhodnutí **nejsou v tomto architektonickém kroku schválena ani závazně vybrána** a jejich volba je záměrně odložena do technické fáze:

* **Konkrétní reprezentace OCC tokenu:** Zda bude použito celočíselné pole `version`, časové razítko `updated_at`, nebo HTTP hlavičky `ETag` / `If-Match`.
* **Fyzické úložiště Idempotency klíčů:** Zda budou klíče ukládány v dedikované relační tabulce, v cache (Redis) či v aplikační paměti.
* **Doba retence Idempotency klíčů:** Konkrétní časový limit pro uchovávání výsledků zpracovaných klíčů (např. 24 až 48 hodin).
* **Konkrétní databázový locking mechanismus:** Volba mezi explicitním `SELECT ... FOR UPDATE`, optimistickým update filtrem, či specifickou transakční izolací relačního enginu.
* **Technické detaily UX pro řešení konfliktů:** Zda bude v rozhraní integrována vizuální diff komponenta či standardní dialog s výzvou k obnovení dat.
* **Případná strategie distribuovaného zamykání:** Pro multi-node infrastrukturu (např. Redlock algoritmus) – pro 1. verzi není vyžadováno.

> [!NOTE]
> Step 11 definuje logická pravidla, bezpečnostní bariéry a konzistenční invarianty. Konkrétní programové knihovny a databázové struktury budou zvoleny v navazujících implementačních krocích.

---

## 28. Step 12 – Vyhledávání, filtrování, řazení, stránkování a práce s daty

Tato kapitola definuje architekturu pro efektivní, bezpečné a předvídatelné čtení a dotazování dat v systému Nástěnka. Stanovuje pravidla pro vyhledávání, filtrování, řazení a stránkování s důrazem na to, že **i samotné čtení dat představuje plnohodnotnou autorizovanou doménovou operaci**.

---

### 28.1 Cíl a architektonický rozsah

Architektura práce s daty jednoznačně odpovídá na 18 základních otázek fungování systému:
1. **Načítání Boardů:** Prostřednictvím autorizovaného endpointu vracejícího výhradně Nástěnky s aktivním členstvím uživatele.
2. **Načítání Oblastí (Area):** Výhradně v kontextu konkrétní Nástěnky a oprávněného členství.
3. **Načítání Úkolů (Task):** Omezeno na autorizovaný datový rozsah (`authorized query scope`) dané Nástěnky.
4. **Filtrování Úkolů:** Kombinace stavů, řešitelů, spoluřešitelů, oblastí, priorit a termínů pomocí striktně validovaných doménových filtrů.
5. **Vyhledávání:** Cílené prohledávání názvů a popisů uvnitř autorizovaného rozsahu bez rizika úniku dat.
6. **Řazení výsledků:** Pouze pomocí povoleného seznamu řadicích klíčů (whitelist) se zákazem přímých databázových identifikátorů od klienta.
7. **Stránkování:** Architektura podporuje jak offsetové, tak kurzorové stránkování s jasně vymezeným účelem pro každý typ.
8. **Práce s velkým množstvím Úkolů:** Vynucené stránkování, přísné serverové limity a vynechání drahého výpočtu celkového počtu záznamů.
9. **Autorizace při čtení:** Zásada „Authorization-First Filtering“ zaručující, že klient nemůže obdržet ani filtrovat neautorizovaná data.
10. **Dynamické změny během stránkování:** Použití stabilního kurzorového stránkování (keyset pagination) eliminující duplicity a přeskakování položek při změnách na pozadí.
11. **Stabilní pořadí výsledků:** Každé řazení povinně obsahuje deterministické sekundární a terciární klíče (tie-breakers).
12. **Prázdné výsledky:** Deterministická sémantika rozlišující prázdný výsledek dotazu (`200 OK` s `items: []`) od neexistence zdroje (`404 Not Found`).
13. **Neplatné filtry:** Striktní serverová validace a okamžité odmítnutí neplatných či nebezpečných dotazů (`400 Bad Request` / `422 Unprocessable Entity`).
14. **Oddělení aktivního a archivního obsahu:** Výchozí pohledy zobrazují aktivní data; archivní obsah je přístupný pouze explicitním filtrem.
15. **Hledání v osobním prostoru uživatele:** Absolutní oddělení soukromého prostoru od týmových dotazů Nástěnky.
16. **Full-text versus přesná shoda:** Koncepční rozlišení exact match, substring/prefix a budoucího full-text vyhledávání.
17. **Ochrana soukromých dat:** Výsledek vyhledávání nesmí sloužit jako orákulum pro zjištění existence cizích nebo skrytých entit.
18. **Výkon bez předčasné optimalizace:** Řešení N+1 problémů dávkovým čtením a minimalizace přenášených dat oddělením seznamové a detailní reprezentace bez závislosti na konkrétním DB enginu.

---

### 28.2 Architektura čtení (Read Architecture)

Základní bezpečnostní premisou architektury Nástěnky je:

> [!IMPORTANT]
> **Čtení dat je plnohodnotná autorizovaná operace.**
> Backend nesmí nikdy předpokládat: *„Uživatel smí vidět Nástěnku, takže smí automaticky vidět veškeré její informace bez další kontroly.“*

Každý požadavek na čtení dat musí na backendu striktně respektovat:
* platnost a integritu autentizované relace (`Session`),
* aktivní stav uživatele (`User.is_active = true`),
* platné členství na dané Nástěnce (`Membership`) a roli (`OWNER`, `MANAGER`, `MEMBER`),
* případnou globální roli (`ADMIN`),
* pravidla izolace osobního prostoru uživatele,
* stav cílové entity (např. `Board.deleted_at IS NULL`),
* soukromost dat a přístupová práva k jednotlivým atributům.

Frontend nesmí v žádném případě sloužit jako bezpečnostní filtr (např. stažení všech záznamů a následné „vyfiltrování“ na klientovi). Backend je jedinou a konečnou bezpečnostní autoritou.

---

### 28.3 Princip „Authorization-First Filtering“ a Authorized Query Scope

Architektura zavádí zásadní bezpečnostní princip **Authorization-First Filtering**. Server před spuštěním jakéhokoliv uživatelského vyhledávání či filtrování nejdříve vymezí maximální povolenou množinu dat – tzv. **Authorized Query Scope**.

#### Schéma toku zpracování dotazu:

```text
Actor (Požadavek z klienta)
 ↓
Authentication (Ověření identity a aktivní relace)
 ↓
Authorization / Scope (Sestavení nepřekročitelného autorizačního rámce)
 ↓
Accessible dataset (Authorized Query Scope)
 ↓
Filter (Aplikace doménových filtrů nad autorizovaným rozsahem)
 ↓
Search (Aplikace textového vyhledávání uvnitř autorizovaného rozsahu)
 ↓
Sort (Deterministické řazení dle schválených klíčů)
 ↓
Pagination (Stránkování výsledků)
 ↓
Response (Minimální seznamová reprezentace)
```

> [!CAUTION]
> **Zákaz post-filtrování:** Je přísně zakázán postup:
> `Všechny Tasky v databázi ──► Filtruj ──► Odstraň nepovolené záznamy pro uživatele`
> Tento postup způsobuje závažná bezpečnostní rizika (únik informací přes celkový počet záznamů či měření času odezvy), rozpadá stránkování a vede k fatální degradaci výkonu.

#### Koncept Authorized Query Scope
Authorized Query Scope představuje logickou hranici, za kterou se dotaz nemůže dostat. Například:
```text
Kontext dotazu:
- Board ID = 101
- Actor ID = 25
- Členství = MEMBER
- Board.deleted_at IS NULL
```
Backend vytvoří dotaz pevně ukotvený v tomto rozsahu. Uživatelský filtr (např. `status=active`) nebo textové hledání (`search=faktura`) se vykonává výhradně jako dodatečná omezující podmínka uvnitř tohoto rozsahu. Tím je fyzicky vyloučeno, aby chybný či manipulovaný filtr zpřístupnil data z jiné Nástěnky nebo cizího osobního prostoru.

---

### 28.4 Načítání a seznam Nástěnek (Board Listing)

Endpoint:
```http
GET /boards
```

Pravidla pro načítání seznamu Nástěnek:
1. **Běžný uživatel:** Získává výhradně seznam Nástěnek, na kterých má aktivní a platné členství (`Membership`).
2. **Globální role ADMIN:** Může využít administrativní přístup pro správu systému dle pravidel definovaných ve Step 5 až Step 9.
3. **Vyloučení smazaných Nástěnek:** Logicky smazané Nástěnky (`deleted_at IS NOT NULL`) se v běžném provozním seznamu nezobrazují.
4. **Izolace osobních/systémových Nástěnek:** Osobní pracovní prostory a interní systémové entity nesmí být nikdy vráceny přes tento obecný listing endpoint.
5. **Rozlišení existence a oprávnění:** Systém striktně rozlišuje mezi stavem *„Nástěnka existuje v databázi“* a *„Uživatel je oprávněn Nástěnku zobrazit“*. Pokud uživatel není členem dané Nástěnky, její existence mu nesmí být odhalena.

---

### 28.5 Detail Nástěnky (Board Detail)

Endpoint:
```http
GET /boards/{boardId}
```

Tento endpoint vrací detailní informace o Nástěnce pouze tehdy, pokud volající splní pětistupňové ověření na backendu:
1. **Autenticita session:** Relace je platná, neexpirovaná a podepsaná.
2. **Aktivní User:** Uživatelský účet je aktivní (`is_active = true`, `deleted_at IS NULL`).
3. **Existence Boardu:** Záznam Nástěnky existuje v databázi.
4. **Stav Boardu:** Nástěnka není logicky smazána (`deleted_at IS NULL`).
5. **Membership nebo ADMIN:** Actor má platné členství v dané Nástěnce (`OWNER`, `MANAGER`, `MEMBER`) nebo je globální `ADMIN`.

> [!WARNING]
> Pouhá znalost či odhad identifikátoru `boardId` nezakládá oprávnění k získání dat (ochrana proti IDOR). Neoprávněný požadavek je striktně odmítnut.

---

### 28.6 Načítání a seznam Oblastí (Area Listing)

Endpoint:
```http
GET /boards/{boardId}/areas
```

Pravidla pro načítání Oblastí:
1. **Kontext Nástěnky:** Každá Oblast (`Area`) náleží právě jedné Nástěnce (`board_id`).
2. **Omezení výsledků:** Dotaz vrací pouze oblasti náležející k zadané Nástěnce v rámci Authorized Query Scope.
3. **Životní cyklus Oblastí:** Oblasti ve stavu `deleted` (nebo neaktivní dle svého životního cyklu) se v běžném seznamu nezobrazují.
4. **Ochrana před nečleny:** Uživatel bez platného členství na Nástěnce nesmí seznam oblastí získat.
5. **Dynamická povaha oblastí:** Systém respektuje koncepty oblastí schválené v doménových požadavcích (např. *Prodejna*, *Chata*, *Dům*, *Koláčkova*). Tyto hodnoty nepředstavují pevný databázový enum, ale konfigurovatelné entity v rámci Nástěnky.

---

### 28.7 Seznam a načítání Úkolů (Task Listing & Query Contract)

Endpoint:
```http
GET /boards/{boardId}/tasks
```

Kontrakt dotazu definuje následující podporované parametry:
* `area`: filtrace dle konkrétního ID oblasti,
* `status`: filtrace dle stavu úkolu (vychází ze schváleného stavového modelu),
* `priority`: filtrace dle priority úkolu,
* `assignee`: filtrace dle Hlavního Řešitele (ID uživatele nebo hodnota `unassigned`),
* `participant`: filtrace dle přítomnosti uživatele mezi Spoluřešiteli (ID uživatele),
* `created_by`: filtrace dle autora úkolu (ID uživatele),
* `due_date`: filtrace dle termínu splnění (relativní klíče nebo interval),
* `overdue`: boolean příznak pro vyfiltrování úkolů po termínu,
* `search`: textový řetězec pro vyhledávání,
* `sort`: řadicí klíč ze schváleného whitelistu,
* `order`: směr řazení (`asc` / `desc`),
* `page` / `cursor`: stránkovací identifikátor nebo číslo stránky,
* `limit`: požadovaný počet položek na stránku.

---

### 28.8 Filtrování dat (Filtering Engine)

Filtrovací mechanismus podporuje standardní doménové dimenze:

#### 1. Status
Hodnoty striktně vycházejí ze schváleného stavového modelu Nástěnky:
* `Nepřiřazeno` (nově vytvořený úkol bez řešitele),
* `Aktivní` / `V řešení` (úkol s přiřazeným řešitelem v běhu),
* `Dokončeno` (vyřešený úkol),
* `Archivováno` (odložený či archivovaný úkol).

#### 2. Assignee (Hlavní Řešitel)
* konkrétní ID uživatele,
* hodnota `unassigned` (úkoly nemající Hlavního Řešitele).

#### 3. Area (Oblast)
* konkrétní ID oblasti v rámci Nástěnky.

#### 4. Priority (Priorita)
* hodnoty dle schváleného modelu priorit (např. Nízká, Normální, Vysoká, Kritická).

#### 5. Due Date (Termín splnění)
* předdefinované filtry: `dnes`, `tento_tyden`, `po_terminu`, `bez_terminu`,
* časový interval: `od` – `do`.

#### Pravidlo kombinace filtrů
* **Různé filtry se kombinují logickým operátorem AND:**
  ```text
  status = 'AKTIVNI' AND area = 4 AND assignee = 12
  ```
* **Vícenásobné hodnoty uvnitř téže dimenze se kombinují operátorem OR:**
  ```text
  status IN ('NEPRIRAZENO', 'AKTIVNI')
  ```
Systém nezavádí zbytečně složitý uživatelský dotazovací jazyk; filtry zůstávají přímočaré, jednoznačné a bezpečné.

---

### 28.9 Vyhledávání (Search Engine & Text Matching)

Vyhledávání prostřednictvím parametru `search` slouží k rychlému nalezení relevantních úkolů:
* **Výchozí prohledávaná pole:** `Task.title` (název úkolu) a `Task.description` (popis úkolu).
* **Možná budoucí rozšíření:** `Area.name` (název oblasti), jméno Hlavního Řešitele či autora úkolu.

#### Úrovně textové shody:
1. **Exact Match (Přesná shoda):** Nalezení přesného řetězce včetně velkých/malých písmen či specifického číselného kódu.
2. **Prefix / Substring:** Nalezení části slova či podřetězce (vhodné pro dynamické vyhledávání v reálném čase během psaní).
3. **Full-text Search:** Jazykově pokročilejší vyhledávání s odstraněním diakritiky, tokenizací a relevančním řazením.

Vyhledávání probíhá **vždy výhradně uvnitř Authorized Query Scope**. Konkrétní technologické řešení (databázový full-text, trigramy, dedikovaný search engine) zůstává otevřené pro budoucí implementaci.

---

### 28.10 Ochrana soukromí při vyhledávání (Search Privacy)

Architektura stanovuje striktní bezpečnostní pravidlo:

> [!CAUTION]
> **Výsledek vyhledávání nesmí dokazovat existenci dat, ke kterým actor nemá oprávnění.**

Důsledky pro návrh systému:
1. **Zákaz úniků informací přes chybové stavy či počty:** Pokud neoprávněný uživatel provede dotaz na cizí Nástěnku, nesmí z chování API (ani z počtu výsledků `0` versus `404`) zjistit, zda daný výraz na Nástěnce existuje.
2. **Ochrana před orákulem:** Vyhledávání nesmí fungovat jako orákulum pro zjišťování existence citlivých klíčových slov (např. neveřejných projektů, osobních jmen, finančních údajů).
3. **Časová nezávislost (Timing Attacks):** Doba odezvy dotazu nesmí prozradit existenci dat mimo oprávněný rozsah uživatele.

---

### 28.11 Řazení dat a stabilní pořadí (Sorting & Stable Ordering)

Klient nesmí předávat libovolné názvy sloupců z databáze. Řadit lze pouze podle schváleného seznamu povolených klíčů (**Whitelist**):

#### Povolené řadicí klíče (`allowed_sort_fields`):
* `created_at` – datum a čas vytvoření,
* `updated_at` – datum a čas poslední změny,
* `due_date` – termín splnění úkolu,
* `priority` – priorita úkolu,
* `status` – stav úkolu,
* `title` – název úkolu,
* `assignee` – řešitel úkolu.

#### Povolené směry řazení (`allowed_sort_directions`):
* `asc` – vzestupně,
* `desc` – sestupně.

#### Princip stabilního deterministického řazení
Při stránkování je kritické, aby pořadí výsledků bylo absolutně deterministické. Pokud primární řadicí klíč obsahuje stejné hodnoty (např. více úkolů se stejnou prioritou nebo termínem), musí být automaticky aplikován sekundární a terciární klíč:

```text
Uživatelský požadavek:
sort = priority, order = desc

Interní deterministické řazení na backendu:
ORDER BY priority DESC, created_at DESC, id DESC
```

Díky jednoznačnému tie-breakeru (`id DESC`) je vyloučeno náhodné přeskakování položek mezi stránkami při interním přeskupení plánovačem dotazů.

---

### 28.12 Modely stránkování (Pagination Models)

Systém specifikuje dva přístupy ke stránkování:

| Vlastnost | Offset Pagination (`page`, `limit`) | Cursor / Keyset Pagination (`cursor`, `limit`) |
|---|---|---|
| **Princip** | Přeskočení prvních $N$ řádků (`OFFSET N LIMIT M`) | Dotaz od poslední známé hodnoty klíče a ID (`WHERE (key, id) < (:last_key, :last_id)`) |
| **Výhody** | Jednoduchost, možnost přímého skoku na libovolné číslo stránky | Dokonalá stabilita při změnách dat na pozadí, stabilní výkon $O(1)$ |
| **Nevýhody** | Degradace výkonu při velkých datech ($O(N)$), nestabilita při souběžném vkládání/mazání | Nemožnost náhodného skoku na libovolnou stránku, pouze sekvenční procházení |
| **Použití v systému** | Malé, statické administrativní seznamy | Dynamické seznamy (Tasky, Notifikace, Auditní záznamy) |

---

### 28.13 Doporučený model stránkování a souběžné změny

V návaznosti na Step 11 architektura stanovuje:

> [!NOTE]
> **Doporučený model pro dynamické seznamy:**
> Pro seznamy úkolů (`GET /boards/{boardId}/tasks`), notifikací (`GET /notifications`) a auditních logů je preferovaným modelem **Cursor / Keyset pagination**.

#### Chování při souběžných změnách:
1. **Vložení nového úkolu na pozadí:** Uživatel prohlíží 1. stránku. Jiný uživatel vytvoří nový úkol. Při vyžádání 2. stránky pomocí cursoru nedojde k posunu indexu ani k zobrazení duplicitní položky, kterou uživatel viděl na 1. stránce.
2. **Smazání položky na pozadí:** Fyzicky smazaný úkol (`DELETE_TASK`) se již v žádné další stránce neobjeví.
3. **Soft-delete Nástěnky:** Smazaná Nástěnka je automaticky vyloučena z dalších výpisů.
4. **Neprolomitelnost autorizace:** Předaný `cursor` je kryptograficky bezpečný nebo validovaný stavový token a nesmí umožnit obejít Authorized Query Scope ani nahlédnout do cizích dat.

---

### 28.14 Limity a ochrana před přetížením (Rate & Limit Boundaries)

Pro zajištění stability systému a ochrany před nechtěným přetížením či útoky DoS platí přísná pravidla:
1. **Zákaz neomezeného čtení:** Žádný seznamový endpoint nesmí umožnit načtení neomezeného počtu záznamů bez stránkování.
2. **Výchozí limit (`default limit`):** 25 položek na stránku (výchozí návrhová hodnota pro běžné zobrazení).
3. **Maximální limit (`max limit`):** 100 položek na stránku (nepřekročitelná serverová bezpečnostní hranice).
4. **Omezení vyhledávacího řetězce:** Maximální délka dotazu (např. 100 znaků) a minimální délka pro prefixové vyhledávání (např. 2–3 znaky).
5. **Odmítnutí extrémních filtrů:** Požadavky s neplatným či překročeným limitem jsou buď automaticky zredukovány na maximum, nebo odmítnuty chybovým stavem `422 Unprocessable Entity`.

---

### 28.15 Sémantika výsledků, prázdné seznamy a validace

Architektura přesně vymezuje sémantiku návratových kódů:

#### Prázdné výsledky (Empty Results)
* **Prázdný seznam není chyba:** Pokud uživatelský filtr (např. `status=archived`) nenalezne žádný úkol, server vrátí kód **`200 OK`** s prázdným polem položek (`items: []`).
* **Zákaz mapování na 404:** Absence výsledků se NIKDY nesmí mapovat na `404 Not Found`. Kód `404` náleží výhradně situaci, kdy neexistuje samotná dotazovaná entita (např. Nástěnka `GET /boards/999/tasks`).

#### Validace parametrů dotazu
Server striktně validuje všechny vstupní parametry:
* platnost hodnoty filtru vůči doménovým číselníkům (status, priorita),
* číselnou integritu a existenci identifikátorů (Area ID, Assignee ID),
* přítomnost řadicího klíče ve whitelistu,
* směr řazení (`asc`, `desc`),
* formát stránkovacího kurzoru a limity.

Syntakticky poškozené dotazy vrací `400 Bad Request`. Sémanticky neplatné hodnoty filtrů vrací `422 Unprocessable Entity`.

---

### 28.16 Datová efektivita, N+1 problém a formát reprezentace

Systém je navržen s důrazem na datovou efektivitu a prevenci známých výkonnostních úskalí:

#### Zásada prevence N+1 dotazů
> [!IMPORTANT]
> **Čtecí vrstva nesmí při běžném seznamu Úkolů vyvolávat nekontrolované množství individuálních dotazů do databáze.**

Při načtení stránky 25 úkolů nesmí systém provést 1 dotaz na úkoly + 25 dotazů na řešitele + 25 dotazů na oblasti + 25 dotazů na spoluřešitele. Data musí být načtena konsolidovaně (např. pomocí JOINů nebo dávkového načtení entit v jediné transakci).

#### Rozlišení reprezentací:
1. **List Representation (Seznamová reprezentace):**
   * Optimalizovaná pro rychlé načtení a minimální přenos dat.
   * Obsahuje pouze klíčové atributy pro zobrazení přehledu a karet: `id`, `title`, `status`, `priority`, `area_id`, `area_name`, `assignee_id`, `assignee_name`, `due_date`, `participants_count`, `version` (pro OCC).
   * Neobsahuje dlouhý text popisu, binární přílohy ani kompletní auditní historii.
2. **Detail Representation (Detailní reprezentace):**
   * Načítá se až po explicitním otevření konkrétního úkolu.
   * Zahrnuje kompletní popis (`description`), plný seznam spoluřešitelů, metadata příloh a historii změn.

---

### 28.17 Rozlišení Seznam vs. Detail entity (List vs. Detail Endpoint)

Architektura striktně odděluje seznamové a detailní endpointy:
* Seznam úkolů: `GET /boards/{boardId}/tasks`
* Detail úkolu: `GET /tasks/{taskId}`

Bezpečnostní pravidlo pro detail úkolu:
> [!CAUTION]
> **Detail endpoint musí znovu a nezávisle ověřit oprávnění.**
> Nelze předpokládat: *„Když klient zná taskId, má automaticky právo na zobrazení detailu.“*

Backend při požadavku na `GET /tasks/{taskId}` dohledá Nástěnku, do které úkol náleží, a prověří, zda má volající na této Nástěnce platné členství (`Membership`) nebo globální roli `ADMIN`. Pokud ne, přístup je okamžitě odepřen (`403 Forbidden` / `404 Not Found`).

---

### 28.18 Osobní a soukromý prostor uživatele (Personal Space Query Isolation)

V návaznosti na princip oddělení týmového a osobního prostoru:
1. **Přísná izolace domén:** Týmová Nástěnka a osobní pracovní prostor uživatele jsou zcela odděleny.
2. **Zákaz prolínání dat:** Obecný dotaz na týmovou Nástěnku (`GET /boards/{boardId}/tasks`) nesmí nikdy vrátit soukromé záznamy, osobní poznámky či neveřejné koncepty uživatele.
3. **Samostatné rozhraní:** Osobní prostor uživatele má vlastní vyhrazené rozhraní a přístup je vyhrazen pouze danému přihlášenému uživateli.

---

### 28.19 Seznam a načítání Notifikací (Notifications Listing)

Endpoint:
```http
GET /notifications
```

V návaznosti na Step 10 platí pro notifikační seznam:
1. **Striktní vlastnictví:** Uživatel má přístup výhradně ke svým vlastním notifikacím (`recipient_user_id == actor_user_id`). Přístup k cizím notifikacím je vyloučen.
2. **Filtrování dle stavu:** Podpora filtrace dle stavu přečtení (`status = 'unread'` / `status = 'read'`).
3. **Povinné stránkování:** Seznam je vždy stránkován (doporučeno keyset pagination).
4. **Deterministické řazení:** Výchozí stabilní řazení dle času vytvoření sestupně s tie-breakerem:
   ```text
   ORDER BY created_at DESC, id DESC
   ```

---

### 28.20 Datový tok: Search, Autorizace a Soft-Delete

Kompletní architektonický datový tok dotazovací vrstvy:

```text
Authentication (Ověření platnosti session a identity Actora)
      ↓
Actor Context (Zjištění stavu účtu a globální role ADMIN)
      ↓
Authorization Scope (Omezení na Boardy s aktivním Membershipem)
      ↓
Exclude Deleted Data (Odfiltrování soft-deleted Boardů a neaktivních entit)
      ↓
Search (Vyhledávání řetězce v rámci povolených polí a oprávněného scope)
      ↓
Filters (Aplikace doménových filtrů: status, priority, area, assignee, due_date)
      ↓
Sort (Deterministické kompozitní řazení na základě whitelistovaných klíčů)
      ↓
Pagination (Aplikace limitu a keyset/offset stránkování)
      ↓
Response (Vrácení odlehčené seznamové reprezentace)
```

Databázový plánovač může fyzicky optimalizovat pořadí operací (např. využít složený index), avšak logický bezpečnostní význam zůstává nepřekročitelný: **nejdříve je vymezen bezpečný a autorizovaný rozsah dat**.

---

### 28.21 Caching a Stale Reads

#### Zásady pro využití mezipaměti (Cache)
* **Kde cache dává smysl:** Statická či málo proměnlivá metadata (globální číselníky, konfigurace systému, seznam základních oblastí).
* **Kde je vyžadována maximální opatrnost:**
  * Role a členství na Nástěnce (`Membership`) nesmí být cachovány způsobem, který by způsobil zpoždění při odebrání přístupu.
  * Soukromá data, osobní prostor a notifikace nepodléhají sdílené mezipaměti.
* **Hlavní pravidlo cache:**
  > [!IMPORTANT]
  > **Mezipaměť (Cache) nesmí nikdy obejít ani oslabit aktuální autorizační kontrolu.**

#### Rozlišení Stale Read a Stale Write (Vazba na Step 11)
* **Stale Read (Čtení staršího stavu):** V distribuovaném či souběžném prostředí může klient na zlomek sekundy zobrazit stav, který byl těsně předtím na pozadí změněn. V běžném rozhraní je tento jev akceptovatelný (a může být aktualizován doménovými událostmi).
* **Stale Write (Zápis na základě starého stavu):** Pokud se uživatel pokusí provést změnu nad daty, která mezitím někdo jiný upravil, systém zápis striktně zablokuje mechanismem OCC s chybou `409 Conflict`.

---

### 28.22 Struktura odpovědi a celkový počet (Result Structure & Total Count)

#### Návrh struktury odpovědi (Cursor Pagination):
```json
{
  "items": [
    {
      "id": "tsk_01H...",
      "title": "Dokončit inventuru",
      "status": "V_RESENI",
      "priority": "VYSOKA",
      "area_id": "are_01H...",
      "area_name": "Prodejna",
      "assignee_id": "usr_01H...",
      "assignee_name": "Milan",
      "due_date": "2026-09-25",
      "version": 4
    }
  ],
  "pagination": {
    "next_cursor": "eyJkdWVfZGF0ZSI6IjIwMjYtMDktMjUiLCJpZCI6InRza18wMUh..."}
    "has_more": true
  }
}
```

#### Pravidlo k celkovému počtu záznamů (`total count`)
> [!NOTE]
> **Celkový počet záznamů (`total`) nemusí být automaticky vracen u každého stránkovaného dotazu.**

Výpočet `COUNT(*)` nad rozsáhlou a dynamicky filtrovanou tabulkou je pro databázi výpočetně náročný. Pro běžný plynulý průchod seznamem (infinite scroll či tlačítko „Další“) plně postačují hodnoty `has_more` a `next_cursor`. Pokud je přesný součet nezbytný (např. pro manažerský přehled), je řešen dedikovaným dotazem.

---

### 28.23 Zabezpečení dotazovacího rozhraní (Query Security & Whitelisting)

Systém uplatňuje striktní zásady zabezpečení dotazů proti injektážím a zneužití:
* **Zákaz klientských výrazů:** Klient nesmí předávat libovolné databázové výrazy, fragmenty SQL, názvy interních tabulek ani libovolné WHERE podmínky.
* **Serverový Whitelist:** Veškeré filtry a řadicí klíče jsou mapovány výhradně na předem schválené bezpečné seznamy (`allowed_filters`, `allowed_sort_fields`, `allowed_sort_directions`).
* **Typová kontrola:** Každý parametr je před sestavením interního dotazu validován na očekávaný datový typ.

---

### 28.24 Soulad se Step 5 až Step 11

Navržená architektura čtení a práce s daty je v plném a striktním souladu se všemi předchozími architektonickými kroky:
* **User (Step 6, 8, 9):** Čtení je umožněno pouze aktivnímu uživateli (`is_active = true`); deaktivovaný uživatel neobdrží žádná data.
* **Membership a Role (Step 5, 6, 7):** Hranice Nástěnky a role `OWNER`, `MANAGER`, `MEMBER` deterministicky vymezují Authorized Query Scope.
* **Board (Step 6, 7, 8):** Soft-deleted Nástěnka je automaticky vyloučena z běžných dotazů; přístup k ní je zablokován.
* **Area (Step 6, 7, 8):** Patří výhradně dané Nástěnce; smazané oblasti se nezobrazují a vylučují úniky.
* **Task a TaskParticipant (Step 6, 7, 8):** Úkoly a spoluřešitelé jsou načítáni v rámci transakčních a dávkových hranic zabraňujících N+1 dotazům.
* **AuditLog (Step 7, 8, 10, 11):** Auditní záznamy jsou přístupné pouze přes dedikované autorizované rozhraní.
* **Notification (Step 10):** Přísně personalizovaný výpis přístupný výhradně adresátovi.
* **Session a Actor (Step 9):** Každý požadavek transparentně identifikuje `actor_user_id` pro bezpečné vyhodnocení scopu.
* **Concurrency a Version (Step 11):** Seznamová reprezentace vrací číslo verze (`version`), čímž připravuje podklady pro následný bezpečný zápis chráněný OCC.

---

### 28.25 Závazné invarianty Step 12

Architektura vyhledávání, filtrování, řazení, stránkování a práce s daty garantuje dodržení následujících dvaceti dvou invariantů:

1. **Každý read request je autorizovaný:** Neexistuje anonymní ani neautorizovaný přístup k datům; každé čtení podléhá ověření identity a práv.
2. **Frontend není bezpečnostní filtr:** Bezpečnostní hranice dat je definována výhradně na backendu; filtrování v UI má pouze ergonomický význam.
3. **Authorization scope je vytvořen na serveru:** Server sestavuje maximální povolený dataset před aplikací uživatelských filtrů.
4. **Search probíhá pouze v oprávněném scope:** Vyhledávání nesmí prohledávat ani prozradit data mimo autorizovaný rozsah dané Nástěnky.
5. **Filter nemůže rozšířit authorized scope:** Žádná kombinace parametrů filtru nemůže zpřístupnit data z jiné Nástěnky či cizího osobního prostoru.
6. **Sort používá pouze whitelistovaná pole:** Řazení je dovoleno pouze podle předem schválených a bezpečných klíčů.
7. **Klient nemůže poslat libovolný query / SQL výraz:** Přímé předávání SQL fragmentů či libovolných WHERE podmínek z klienta je striktně zakázáno.
8. **List endpointy jsou stránkované:** Všechny seznamové endpointy povinně implementují stránkování; neexistuje neomezený výpis záznamů.
9. **Server omezuje maximální limit:** Server vynucuje nepřekročitelnou horní hranici počtu vrácených položek na jednu stránku.
10. **Stránkované pořadí je deterministické:** Každé řazení povinně obsahuje sekundární a terciární unikátní klíče pro zaručení stability pořadí.
11. **Dynamická data preferují stabilní cursor/keyset pagination:** Pro často aktualizované seznamy (úkoly, notifikace) je upřednostněno keyset stránkování.
12. **Stale read není totéž co stale write:** Zobrazení mírně staršího stavu při čtení je tolerováno, avšak zápis na základě zastaralého stavu je vždy zablokován (OCC).
13. **Hard-deleted objekty se nemohou objevit v nových výsledcích:** Fyzicky smazaný objekt je okamžitě nedostupný pro jakékoliv navazující stránkovací dotazy.
14. **Soft-deleted Board není běžně vracen:** Logicky smazaná Nástěnka je automaticky vyloučena z běžných seznamů Nástěnek.
15. **Detail endpoint znovu ověřuje authorization:** Přístup na detail entity vyžaduje plnohodnotné ověření práv; znalost ID nestačí.
16. **Osobní data nejsou součástí týmových query bez explicitního oprávnění:** Osobní pracovní prostor uživatele je striktně izolován od týmové Nástěnky.
17. **Uživatel vidí pouze vlastní Notification:** Dotaz na notifikace vrací výhradně záznamy určené přihlášenému příjemci.
18. **Cache nesmí obejít autorizaci:** Mezipaměť nesmí způsobit zobrazení neautorizovaných dat ani prodloužit platnost odebraných práv.
19. **Prázdný seznam není automaticky chyba:** Absence odpovídajících dat vrací kód HTTP 200 s prázdným polem, nikoliv chybový stav 404.
20. **Neexistující resource a prázdné výsledky jsou rozlišeny:** Neexistence Nástěnky (404) je striktně odlišena od prázdného seznamu jejích úkolů (200 OK s prázdným polem).
21. **List response nevrací automaticky zbytečná detailní data:** Seznamový endpoint vrací odlehčenou reprezentaci pro minimalizaci přenosu a ochranu soukromí.
22. **Query API nesmí umožnit nekontrolované zatížení systému:** Délka vyhledávacích řetězců, limity stránek a struktura filtrů jsou chráněny proti přetížení a zneužití.

---

### 28.26 Rozhodnutí odložená do implementační fáze

Následující technologická a implementační rozhodnutí **nejsou v tomto architektonickém kroku schválena ani závazně vybrána** a jejich volba je záměrně odložena do navazující implementační fáze:
* **Konkrétní query builder / ORM framework:** Volba konkrétní knihovny pro sestavování databázových dotazů.
* **Konkrétní full-text search engine:** Výběr konkrétní technologie pro plnotextové vyhledávání (databázové indexy PostgreSQL tsvector, SQLite FTS5, externí engine apod.).
* **Databázové indexy:** Přesná podoba kompozitních, částečných či pokrývajících indexů pro jednotlivé kombinace filtrů.
* **Formát kódování cursoru:** Způsob serializace kurzorového tokenu (např. Base64 encoded JSON, kryptograficky podepsaný token).
* **Konkrétní knihovny pro pagination:** Volba specifických programových modulů pro obsluhu stránkování.
* **Konkrétní cache engine:** Výběr technologie mezipaměti (např. Redis, Memcached či in-memory cache).
* **Implementace rate limiting:** Konkrétní algoritmy (Token Bucket, Leaky Bucket) a limity počtu dotazů za časovou jednotku.
* **Normalizace vyhledávání:** Specifická pravidla pro odstraňování diakritiky, transformaci velkých/malých písmen a transliteraci.
* **Podpora fuzzy vyhledávání:** Způsob implementace tolerantního vyhledávání s překlepy (Levenshtein, trigramy).
* **Algoritmy pro relevance ranking:** Přesná matematická formulace vah a hodnocení relevance výsledků hledání.
* **Materializované pohledy (Materialized Views):** Případné využití předpočítaných agregací pro náročné analytické pohledy.
* **Čtecí repliky (Read Replicas):** Případné oddělení čtecí a zápisové databázové vrstvy pro vysokou zátěž.
* **Monitoring a profilování výkonu query:** Konkrétní nástroje APM a metriky pro sledování pomalých dotazů (slow query logs).

> [!NOTE]
> Step 12 definuje logickou a bezpečnostní architekturu práce s daty. Konkrétní knihovny, frameworky a úložné systémy budou zvoleny až v navazujících technických krocích.

---

## 29. Historie verzí

| Verze | Datum | Popis změny | Schválil / Zaznamenal |
|---|---|---|---|
| **0.1.0** | 18. 9. 2026 | Výchozí logická architektura systému a doménový model na základě schválených dokumentů `020 v0.8.0`, `030 v0.2.0` a `040 v0.2.0`. | Antigravity / Product Owner |
| **0.2.0** | 19. 9. 2026 | Přidána možnost Hlavního Řešitele odebrat Spoluřešitele a explicitně potvrzeno obecné právo všech členů Nástěnky přidělovat úkoly členům dané Nástěnky. | Antigravity / Product Owner |
| **0.3.0** | 19. 9. 2026 | Zapracován Krok 5 – Oprávnění a bezpečnostní hranice: definován model rolí (ADMIN globálně; OWNER, právě max. 1 MANAGER, MEMBER na Nástěnce), atomický převod vlastnictví, bezpečnostní pravidla a audit citlivých operací. | Antigravity / Product Owner |
| **0.4.0** | 19. 9. 2026 | Krok 6: Datový model a vztahy – definice User, Board, Membership, Task a TaskParticipant, globální role ADMIN, role OWNER / MANAGER / MEMBER v Membership, kardinality a databázové invarianty, vztahy Task → creator / assignee / participants, oddělení role na Boardu od odpovědnosti za Task, pravidla pro převod Ownera, pravidla pro deaktivaci Usera a soft-delete Boardu. | Antigravity / Product Owner |
| **0.5.0** | 19. 9. 2026 | Step 7: Doménové operace, API a autorizační hranice – princip autority backendu, kontext actor vs. target, logické API operace nad Board, Membership, Task a Area (včetně řízeného hard-delete Tasku a smazání oblasti), autorizační matice, nezávislý audit destruktivních operací (DELETE_TASK, DELETE_AREA), atomické transakce a doménové invarianty. | Antigravity / Product Owner |
| **0.6.0** | 19. 9. 2026 | Step 8 – Databázové schéma, primární a cizí klíče, constrainty, referenční integrita, transakční hranice a databázové invarianty. | Antigravity / Product Owner |
| **0.7.0** | 19. 9. 2026 | Step 9 – Autentizace, identity, session, životní cyklus přihlášení, ochrana identity Actor a oddělení autentizace od autorizace. | Antigravity / Product Owner |
| **0.8.0** | 19. 9. 2026 | Step 10 – Doménové události, systémové reakce, notifikační model, recipient policy, spolehlivé předávání událostí, idempotence a oddělení Event / Notification / Audit. | Antigravity / Product Owner |
| **0.9.0** | 19. 9. 2026 | Step 11 – Souběžný přístup, optimistic concurrency control, stale data, race conditions, konflikty změn, idempotence, retry a transakční konzistence. | Antigravity / Product Owner |
| **1.0.0** | 19. 9. 2026 | Step 12 – Vyhledávání, filtrování, řazení, stránkování, autorizovaný query scope, stabilní pořadí, výkonové hranice a bezpečné čtení dat. | Antigravity / Product Owner |
