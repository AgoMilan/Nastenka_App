# Architektura aplikace Nástěnka

**Typ dokumentu:** Logická architektura a doménový model systému  
**Stav:** Schválená architektura  
**Verze:** 0.4.0  
**Vychází z:** `docs/020_Pozadavky.md` (v0.9.0), `docs/030_Funkcni_model.md` (v0.3.0) a `docs/040_Uzivatelske_scenare.md` (v0.3.0)  
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

Vzhledem k množství referenčních vazeb (autorství úkolů, řešitelství, komentáře, auditní záznamy) je v systému zakázáno nekontrolované fyzické mazání dat z databáze (`HARD DELETE`).

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

## 10. Stavový model úkolu

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

## 11. Archiv a trvalé mazání

Architektura striktně odlišuje **Archivaci** od **Definitivního smazání**:

### Archivovaný úkol (`ARCHIVOVÁNO`)
* zůstává trvale uložen v systému a je dohledatelný v seznamu archivu,
* je **výhradně pro čtení (read-only)** – data nelze dodatečně měnit,
* **nemá funkci Obnovit / Vrátit z archivu** (obnova úkolu zpět do aktivního oběhu není podporována),
* nenachází se na aktivní ploše Nástěnky ani v běžném přehledu dokončených úkolů.

### Trvalé smazání úkolu (`SMAZAT`)
* představuje nevratné odstranění objektu ze systému,
* vyžaduje bezpečnostní potvrzení vepsáním přesného textu `SMAZAT`,
* trvale smazaný úkol není dostupný v aktivním pohledu, v archivu ani v historii změn.

### Smazání oblasti
* destruktivní organizační operace proveditelná pouze OWNEREM, MANAGEREM nebo ADMINEM,
* vyžaduje vepsání textu `SMAZAT`,
* **společně s oblastí se definitivně smažou také všechny úkoly, které daná oblast obsahuje** (úkoly se nepřesouvají do archivu ani koše, zanikají).

---

## 12. Historie změn a auditní stopa

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

## 13. Osobní pracovní prostor

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

## 14. Týmové přílohy

Logická součást sdíleného obsahu úkolu:

* **Typy dat:** fotografie z terénu, obrázky, technická PDF, naskenované faktury, běžné provozní soubory.
* **Pravidla přístupu:**
  * Jsou uloženy v týmové části úkolu.
  * Jsou plně přístupné k náhledu a stažení pro všechny členy dané Nástěnky.
  * Kterýkoliv člen Nástěnky může k úkolu nahrát přílohu nebo zastaralou přílohu odstranit.

---

## 15. Notifikační architektura

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

## 16. Izolace Nástěnek

Aplikace podporuje multi-board architekturu s přísnou datovou i procesní separací:

1. **Vizuální a přístupové oddělení:** Člen vidí v rozhraní pouze ty Nástěnky, do kterých byl zařazen jako člen. Výjimkou je globální role `ADMIN`, která má právo náhledu a dohledu nad všemi Nástěnkami pro řešení administrativních a krizových situací.
2. **Datové hranice:** Týmový obsah (oblasti, úkoly, komentáře, přílohy) jedné Nástěnky je naprosto nepřístupný pro členy jiné Nástěnky.
3. **Kontextové vyhodnocování rolí na Nástěnce:** Uživatelská role na Nástěnce (`OWNER`, `MANAGER`, `MEMBER`) se vždy vyhodnocuje výhradně v kontextu aktuálně otevřené Nástěnky. Uživatel může být na Nástěnce A Managerem a na Nástěnce B běžným členem. Globální role `ADMIN` stojí nad tímto kontextem jako systémová pojistka.

---

## 17. Odchod člena, deaktivace účtu a správa životního cyklu

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

## 18. Omezení rozsahu (Co se zatím záměrně neřeší)

V souladu s analytickou fází jsou následující technologická a implementační rozhodnutí **záměrně odložena do dalších fází**:

* konkrétní databázový engine a SQL tabulková schémata,
* definice API endpointů a datových struktur,
* volba konkrétního frontend a backend frameworku,
* autentizační provider a mechanismus správy hesel/tokenů,
* konkrétní WhatsApp API / integrační provider,
* konkrétní úložiště souborů (storage provider),
* kontejnerizace (Docker) a infrastruktura hostingu / NAS,
* konkrétní datové limity pro velikost a počet příloh,
* klientská instalace jako PWA (plánováno jako budoucí rozšíření),
* offline režim a offline synchronizace (pro 1. verzi se neřeší).

---

## 19. Otevřené otázky k architektuře

Otázka *„Může Hlavní Řešitel odebrat Spoluřešitele?“* byla k datu 19. 9. 2026 definitivně vyřešena a uzavřena schválením **Varianty 1**:
* Hlavní Řešitel může odebrat Spoluřešitele ze seznamu Spoluřešitelů daného úkolu.
* Odebraný uživatel není blokován a může se v budoucnu znovu k úkolu připojit, pokud má úkol Hlavního Řešitele.

V současné verzi architektury nejsou evidovány žádné další otevřené otázky.

---

## 20. Historie verzí

| Verze | Datum | Popis změny | Schválil / Zaznamenal |
|---|---|---|---|
| **0.1.0** | 18. 9. 2026 | Výchozí logická architektura systému a doménový model na základě schválených dokumentů `020 v0.8.0`, `030 v0.2.0` a `040 v0.2.0`. | Antigravity / Product Owner |
| **0.2.0** | 19. 9. 2026 | Přidána možnost Hlavního Řešitele odebrat Spoluřešitele a explicitně potvrzeno obecné právo všech členů Nástěnky přidělovat úkoly členům dané Nástěnky. | Antigravity / Product Owner |
| **0.3.0** | 19. 9. 2026 | Zapracován Krok 5 – Oprávnění a bezpečnostní hranice: definován model rolí (ADMIN globálně; OWNER, právě max. 1 MANAGER, MEMBER na Nástěnce), atomický převod vlastnictví, bezpečnostní pravidla a audit citlivých operací. | Antigravity / Product Owner |
| **0.4.0** | 19. 9. 2026 | Krok 6: Datový model a vztahy – definice User, Board, Membership, Task a TaskParticipant, globální role ADMIN, role OWNER / MANAGER / MEMBER v Membership, kardinality a databázové invarianty, vztahy Task → creator / assignee / participants, oddělení role na Boardu od odpovědnosti za Task, pravidla pro převod Ownera, pravidla pro deaktivaci Usera a soft-delete Boardu. | Antigravity / Product Owner |
