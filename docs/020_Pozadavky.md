# Požadavky na aplikaci Nástěnka

**Typ dokumentu:** Pracovní dokument požadavků (živý dokument)  
**Stav:** Rozpracováno / K diskuzi  
**Verze:** 0.9.0  
**Poslední aktualizace:** 19. 9. 2026  

---

## 1. Účel dokumentu

Tento dokument slouží jako **hlavní pracovní dokument požadavků** pro aplikaci **Nástěnka**. Odpovídá na otázku:

> **CO má aplikace Nástěnka umět a jak se má z pohledu uživatele chovat?**

Dokument záměrně neřeší technickou architekturu, volbu databáze, frameworků ani infrastruktury (*JAK to naprogramovat*). Slouží jako podklad pro společnou analýzu, diskuzi a postupné upřesňování funkčních požadavků mezi týmem a Product Ownerem.

Jednotlivé body jsou označeny stavem:
* **Stav: POTVRZENO** – dohodnuté, pevně stanovené požadavky.
* **Stav: K DISKUZI** – navržené řešení nebo otevřená otázka, která čeká na potvrzení či dopracování.

---

## 2. Základní koncept

**Stav: POTVRZENO**

Aplikace Nástěnka je **jednoduchá týmová aplikace pro organizaci práce**. Nejedná se o rozsáhlý a složitý projektový nástroj (typu Jira nebo Asana), ale o přehlednou **digitální týmovou nástěnku**, kde tým na jednom místě vidí:
* co je potřeba udělat,
* v jaké oblasti činnosti,
* kdo se danému úkolu věnuje (hlavní řešitel a případní spoluřešitelé),
* v jakém stavu se úkol nachází.

### Koncepční hierarchie

```text
NÁSTĚNKA
  ↓
TÝM NÁSTĚNKY
  ↓
OBLASTI
  ↓
ÚKOLY
  ↓
PŘIŘAZENÍ (ŘEŠITEL / SPOLUŘEŠITELÉ)
  ↓
OSOBNÍ PRACOVNÍ PROSTORY
```

---

## 3. Nástěnky, týmy a role

### 3.1 Více nástěnek
**Stav: POTVRZENO**
* Aplikace podporuje **více samostatných nástěnek**.
* Jedna instalace aplikace nereprezentuje pouze jeden tým nebo jedinou nástěnku.
* Každá nástěnka má vlastní tým a vlastní obsah (oblasti, úkoly).

Příklad:
```text
Nástěnka A
└── Tým
    ├── Alena
    ├── Adam
    └── Milan

Nástěnka B
└── jiný tým

Nástěnka C
└── jiný tým
```

### 3.2 Členství uživatele ve více nástěnkách
**Stav: POTVRZENO**
* Jeden uživatel může být členem **více nástěnek**, a tím pádem více týmů.
* Členství v jedné nástěnce nijak neznamená, že uživatel musí být členem ostatních nástěnek (nástěnky jsou vzájemně oddělené).

Příklad:
```text
Milan
├── Nástěnka A → tým Alena, Adam, Milan
├── Nástěnka B → jiný tým
└── Nástěnka C → jiný tým
```

### 3.3 Role na nástěnce

#### Owner (Vlastník nástěnky)
**Stav: POTVRZENO**
* Každá nástěnka má svého **Ownera (vlastníka)**.
* Owner rozhoduje o správě nástěnky a má nejvyšší úroveň oprávnění v rámci dané nástěnky.

#### Správce nástěnky
**Stav: POTVRZENO**
* Kromě Ownera může na nástěnce existovat role **Správce**.
* Owner může v případě potřeby určit jednoho či více správců nástěnky.
* **Výchozí stav:** Owner je zároveň výchozím správcem.
* **Pravomoci Správce:**
  * **Správce má stejné pravomoci jako Owner**, ale **výhradně v rámci konkrétní Nástěnky**.
  * Správce nemá automaticky správcovská práva nad jinými Nástěnkami, jejichž je členem.

#### Role na Nástěnce vs. vztah k úkolu
**Stav: POTVRZENO**
Důsledně se rozlišuje mezi rolí uživatele v rámci Nástěnky a jeho vztahem ke konkrétnímu úkolu:

* **Role na Nástěnce (globální oprávnění v rámci celé Nástěnky):**
  * **Owner (Vlastník):** Nejvyšší oprávnění, správa Nástěnky a oblastí.
  * **Správce:** Stejné pravomoci jako Owner výhradně v rámci dané Nástěnky.
  * **Běžný člen:** Uživatel s přístupem k dané Nástěnce. Může pracovat s týmovým obsahem úkolů, komentovat je, nahrávat přílohy, měnit prioritu, přebírat úkoly a připojovat se k nim jako spoluřešitel (podrobně viz 5.3).
* **Vztah uživatele ke konkrétnímu úkolu (nejde o samostatné globální role na Nástěnce):**
  * **Hlavní Řešitel úkolu:** Člen, který je veden jako **hlavní odpovědná osoba** za daný úkol. Má rozšířená oprávnění (změna stavu, oblasti, termínu, archivace a smazání úkolu; viz 5.4).
  * **Spoluřešitel úkolu:** Člen, který se k již přiřazenému úkolu sám dobrovolně připojil a aktivně na něm spolupracuje. Má **shodná pracovní oprávnění jako hlavní Řešitel** (viz 5.4 a 5.5). Řešitel a Spoluřešitel nejsou samostatné role uživatele v rámci celé Nástěnky.

### 3.4 Modelový tým první nástěnky
Pro první modelovou nástěnku projektu je definován tým:
```text
Alena
Adam
Milan
```
Jedná se o testovací a modelový tým pro vývoj a ověřování požadavků, neznamená to omezení aplikace pouze na tyto uživatele.

---

## 4. Oblasti a jejich správa

### 4.1 Zobrazení oblastí
**Stav: POTVRZENO**
* Hlavní obrazovka nástěnky **nezobrazuje** nepřehlednou směs všech jednotlivých úkolů najednou.
* Výchozí členění je rozděleno na **oblasti**.
* Oblast představuje konkrétní místo, část činnosti nebo ucelený tematický okruh týmu.
* Typické příklady oblastí:
  * *Prodejna*
  * *Chata*
  * *Dům*
  * *Koláčkova*
  * (výhledově: *Auto, Administrativa, Finance, Údržba*)
* Na obrazovce nástěnky jsou oblasti zobrazeny formou přehledných karet / boxů.

**Stav: K DISKUZI**
* Karta oblasti může obsahovat souhrnné metriky (celkový počet aktivních úkolů, rozpracovaných úkolů apod.).

### 4.2 Matice oprávnění pro správu oblastí
**Stav: POTVRZENO**
Oblasti tvoří společnou strukturu Nástěnky, proto je nemůže libovolně měnit každý člen.

| Akce s oblastí | Owner | Správce | Běžný člen |
|---|---|---|---|
| **Vytvořit oblast** | ANO | ANO | NE |
| **Upravit oblast** | ANO | ANO | NE |
| **Přejmenovat oblast** | ANO | ANO | NE |
| **Smazat oblast** | ANO (potvrzení `SMAZAT`) | ANO (potvrzení `SMAZAT`) | NE |

### 4.3 Smazání oblasti a jejích úkolů
**Stav: POTVRZENO**
* **Smazání oblasti je definitivní destruktivní operace.**
* **Společně s oblastí se definitivně smažou také všechny úkoly, které jsou v této oblasti zařazeny.**
* Smazání oblasti smí provést **pouze Owner nebo Správce**.
* Před provedením musí aplikace vyžadovat **ruční zadání přesného textu**:
  > **`SMAZAT`**
* Pouhé potvrzení tlačítkem „Ano“ není dostačující. Pokud uživatel nezadá přesně `SMAZAT`, operace se nesmí provést.
* Smazané úkoly se následně **již nezobrazují ani v historii či archivu**, protože jde o definitivní odstranění ze systému.

Příklad potvrzovacího dialogu:
```text
Opravdu chcete oblast „Chata“ smazat?
UPOZORNĚNÍ: Spolu s oblastí budou definitivně smazány i všechny její úkoly!

Pro potvrzení napište:
SMAZAT

[________________]

[Zrušit]     [SMAZAT]
```

---

## 5. Úkoly a oprávnění

### 5.1 Vytvoření úkolu a povinné údaje
**Stav: POTVRZENO**
* Úkol může vytvořit **kterýkoliv člen týmu**.
* Při vytvoření úkolu se zadává:
  * **Název úkolu** (povinný údaj),
  * **Oblast** (povinné zařazení do příslušné oblasti),
  * **Popis úkolu** (volitelný údaj),
  * **Přiřazení hlavního řešitele** (volitelné – úkol může být nepřiřazený),
  * **Priorita** (volitelné, výchozí `○ Běžná`, viz 5.7),
  * **Termín** (volitelné, viz 5.8),
  * **Přílohy** (volitelné, viz 5.9).
* **Flexibilita přiřazení:**
  * **Varianta A – Nikdo (nepřiřazeno):** Úkol vzniká s vizí „někdo se toho ujme“, zůstává volný k převzetí.
  * **Varianta B – Vytvořím a vezmu si ho:** Zakládající člen úkol rovnou přiřadí sám sobě jako hlavní řešitel.
  * **Varianta C – Přiřadím jinému:** Zakládající člen přiřadí úkol konkrétnímu kolegovi z týmu jako hlavnímu řešiteli.

### 5.2 Viditelnost týmových úkolů
**Stav: POTVRZENO**
* Týmový úkol je **viditelný všem členům dané nástěnky**.
* Příklad:
  ```text
  Úkol: Koupit nový regál – Prodejna
  Řešitel: Adam
  Spoluřešitelé: Alena
  ```
  Tento úkol vidí Alena, Adam i Milan – tedy všichni členové příslušné nástěnky.

### 5.3 Oprávnění běžného člena týmu
**Stav: POTVRZENO**
Každý běžný člen Nástěnky může u kteréhokoliv týmového úkolu provádět tyto operace:
1. **Zobrazit úkol** (detail úkolu a jeho týmové údaje),
2. **Přidat vlastní komentář** (a upravit či smazat výhradně svůj vlastní komentář, viz 5.10),
3. **Upravit popis úkolu** (doplnit či upřesnit zadání),
4. **Změnit / přiřadit hlavního řešitele:** Každý člen konkrétní Nástěnky (Běžný člen, Správce i Owner) může přidělit úkol kterémukoli jinému členovi této Nástěnky nebo úkol ponechat jako `Nepřiřazeno`. Nejde o výhradní právo Ownera či Správce, ale o obecné právo každého člena Nástěnky.
5. **Převzít nepřiřazený úkol na sebe** (stát se hlavním řešitelem, viz 5.6),
6. **Převzít úkol od jiného řešitele na sebe** (stát se hlavním řešitelem, viz 5.6),
7. **Připojit se k úkolu jako spoluřešitel** (pomocí tlačítka `+ Připojit se k úkolu`, dostupné výhradně pokud úkol již má hlavního Řešitele, viz 5.5),
8. **Nastavit nebo změnit prioritu úkolu** (nastavit `○ Běžná` nebo `🔴 Spěchá`, i když není řešitelem; změna se zaznamená do historie, viz 5.7),
9. **Pracovat s týmovými přílohami** (přidat, upravit či smazat týmovou přílohu, viz 5.9).

**Co běžný člen NEMŮŽE pouze na základě členství:**
Běžný člen, který není ani Řešitelem, ani Spoluřešitelem daného úkolu, **nemůže**:
* měnit stav úkolu,
* měnit oblast úkolu,
* měnit termín úkolu,
* archivovat úkol,
* smazat úkol,
* odebrat Spoluřešitele (toto právo má výhradně Hlavní Řešitel),
* spravovat oblasti.

Tyto operace jsou vyhrazeny výhradně aktuálnímu Řešiteli a Spoluřešitelům úkolu (viz 5.4).

### 5.4 Rozšířená oprávnění: Řešitel a Spoluřešitel
**Stav: POTVRZENO**
Členové aktivně pracující na úkolu – tedy **hlavní Řešitel** a všichni **Spoluřešitelé** – mají shodná rozšířená pracovní oprávnění. Mohou:
1. **Měnit stav úkolu** (posouvat úkol mezi stavy bez rigidní sekvence, např. přímo `NOVÉ → HOTOVO`, viz 6.1),
2. **Přesunout úkol do jiné oblasti**,
3. **Změnit termín úkolu**,
4. **Změnit prioritu úkolu** (s evidencí do historie),
5. **Pracovat s týmovými přílohami** (přidávat, upravovat, mazat),
6. **Archivovat úkol** (ručně odložit do archivu, viz 5.11),
7. **Definitivně smazat úkol** (s povinným bezpečnostním potvrzením textem `SMAZAT`, viz 5.11).

**Výhradní pravomoc Hlavního Řešitele vůči Spoluřešitelům:**
8. **Odebrat Spoluřešitele z úkolu:** Hlavní Řešitel může odebrat existujícího Spoluřešitele ze seznamu spoluřešitelů (viz 5.5). Spoluřešitel nemůže odebrat jiného spoluřešitele ani Hlavního Řešitele.

*Poznámka:* Rozdíl mezi Řešitelem a Spoluřešitelem nespočívá v běžných pracovních právech k úkolu, ale v tom, že **Řešitel je veden jako hlavní odpovědná osoba** a má právo odebrat Spoluřešitele.

### 5.5 Spoluřešitelé úkolu

**Stav: POTVRZENO**
Na jednom úkolu může současně pracovat více členů týmu. Model úkolu obsahuje:
* **jednoho hlavního Řešitele**,
* **nula nebo více Spoluřešitelů**.

#### Připojení spoluřešitele
* **Závazné schválené pravidlo:** **Spoluřešitelem se lze stát pouze u úkolu, který již má hlavního Řešitele.**
* Úkol ve stavu `Nepřiřazeno` nemá hlavního Řešitele – u takového úkolu se člen **nemůže** připojit jako Spoluřešitel (tlačítko `+ Připojit se k úkolu` není dostupné).
* Pokud chce člen na `Nepřiřazeném` úkolu pracovat, musí jej nejprve **převzít** (`Převzít úkol`). Převzetím se stává hlavním Řešitelem.
* Teprve poté, co má úkol hlavního Řešitele, se mohou další členové připojit jako Spoluřešitelé:
  > **`Nepřiřazeno` → převzetí úkolu → hlavní Řešitel → možnost připojení dalších Spoluřešitelů**
* **Zákaz nekonzistentního stavu:** V aplikaci nesmí nikdy vzniknout stav `Řešitel: nikdo + Spoluřešitel: někdo`.
* Jediným způsobem, jak se stát spoluřešitelem u obsazeného úkolu, je **vlastní dobrovolné připojení člena**:
  > **`+ Připojit se k úkolu`**
* Toto tlačítko může použít kterýkoliv člen dané Nástěnky u úkolu, který již má hlavního Řešitele.
* Po kliknutí se člen okamžitě stává spoluřešitelem a získává rozšířená pracovní oprávnění k úkolu.
* **DŮLEŽITÉ OMEZENÍ:** V aplikaci **neexistuje možnost ručního přidání jiného člena** jako spoluřešitele (funkce typu *„+ Přidat spoluřešitele“* je zakázána). Spoluřešitel se k úkolu připojuje vždy výhradně sám.

#### Odpojení a odebrání spoluřešitele
* **Dobrovolné odpojení spoluřešitele:**
  * Spoluřešitel se může z úkolu kdykoliv sám odpojit:
    > **`− Odpojit se od úkolu`**
  * Po odpojení přestává být spoluřešitelem (ztrácí rozšířená oprávnění k úkolu a stává se běžným členem).
  * Úkol i práce ostatních zůstávají zachovány.
* **Odebrání spoluřešitele Hlavním Řešitelem:**
  * **Hlavní Řešitel může odebrat Spoluřešitele z úkolu.**
  * **Pravidla a dopady odebrání:**
    * Odebrání odstraní uživatele ze seznamu Spoluřešitelů daného úkolu.
    * Odebraný uživatel **není nijak zablokován**.
    * Pokud má úkol stále Hlavního Řešitele, může se tento uživatel později znovu připojit přes `+ Připojit se k úkolu`.
    * Odebrání nesmí změnit Hlavního Řešitele.
    * Odebrání musí být povinně zaznamenáno v historii/auditu úkolu (včetně autora operace).
  * Příklad:
    ```text
    Před:
    Řešitel: Milan
    Spoluřešitelé: Adam, Alena

    Milan odebere Adama.

    Po:
    Řešitel: Milan
    Spoluřešitelé: Alena
    ```
    *Adam může být později znovu Spoluřešitelem, pokud splňuje běžné podmínky pro připojení.*
  * Běžný člen ani jiný Spoluřešitel nemůže Spoluřešitele odebrat – tuto pravomoc má výhradně Hlavní Řešitel.
* **Soukromý prostor:**
  * Soukromý osobní pracovní prostor odpojeného či odebraného člena zůstává soukromý tomuto členovi a nikomu se nepředává.

#### Kapacita spoluřešitelů
* Počet spoluřešitelů na jednom úkolu není produktově omezen.

### 5.6 Změna přiřazení hlavního řešitele a nepřiřazený úkol
**Stav: POTVRZENO**

#### Obecné pravidlo přidělení úkolu
* **Každý člen konkrétní Nástěnky může přidělit úkol kterémukoli jinému členovi této Nástěnky nebo úkol ponechat jako `Nepřiřazeno`.**
* To platí pro:
  * **Běžného člena**,
  * **Správce**,
  * **Ownera**.
* Úkol lze přidělit pouze členovi stejné Nástěnky, nebo jej změnit zpět na `Nepřiřazeno`.
* Nejde o speciální oprávnění Ownera ani Správce – jde o **obecné právo každého člena Nástěnky**.
* **Důležitý princip:** Role Owner/Správce na Nástěnce a vztah k úkolu Řešitel/Spoluřešitel představují dvě zcela různé vrstvy oprávnění.

#### Změna hlavního řešitele (např. Adam → Milan)
* Každý člen týmu může změnit přiřazení hlavního řešitele nebo úkol převzít na sebe bez nutnosti schvalování.
* Pokud je úkol převeden na nového řešitele:
  * **Nový řešitel (Milan):** Získává roli hlavního řešitele a plná oprávnění k úkolu.
  * **Původní řešitel (Adam):** Ztrácí roli hlavního řešitele. Pokud se sám nepřipojil jako spoluřešitel, stává se běžným členem týmu.
  * **Týmový obsah úkolu:** Zůstává beze změny zachován pro celý tým (popis, komentáře, přílohy, priorita).
  * **Soukromý prostor:** Adamův soukromý osobní pracovní prostor **zůstává soukromý Adamovi a nepředává se Milanovi**. Milan pracuje se svým vlastním soukromým prostorem.

#### Nepřiřazený úkol (`Nepřiřazeno`)
* Pokud úkol nemá řešitele, **žádný uživatel nemá oprávnění řešitele**.
* Kterýkoliv člen jej může převzít a stát se hlavním Řešitelem.
* **U nepřiřazeného úkolu se nelze připojit jako Spoluřešitel** (akce `+ Připojit se k úkolu` není u nepřiřazeného úkolu dostupná). Člen musí úkol nejprve převzít na sebe.
* Teprve poté, co má úkol hlavního Řešitele, se k němu mohou připojit další kolegové jako Spoluřešitelé:
  ```text
  Nepřiřazeno
      ↓ (1. krok: převzetí úkolu členem)
  Milan = Řešitel

  Adam → [+ Připojit se k úkolu] (2. krok: připojení spoluřešitele k obsazenému úkolu)
      ↓
  Adam = Spoluřešitel
  ```

### 5.7 Priorita úkolu a evidence historie změn
**Stav: POTVRZENO**
* Priorita je **společná týmová vlastnost úkolu**, kterou vidí všichni členové dané Nástěnky.
* Priorita má výhradně dvě úrovně:
  ```text
  ○ Běžná
  🔴 Spěchá
  ```
* **Kterýkoliv člen týmu může prioritu nastavit nebo změnit**, i když úkol neřeší.
* **Zaznamenání do historie činnosti úkolu:**
  * Každá změna týmové priority musí být dohledatelná v historii úkolu.
  * Systém musí zachovat informaci o tom, **kdo změnu provedl**.
  * *Příklad:* `Milan změnil prioritu z „Běžná“ na „Spěchá“`.
* Stejný princip evidence autora platí pro všechny významné změny úkolu (změna řešitele, připojení/odpojení spoluřešitele, změna stavu, oblasti, termínu, nahrání/smazání přílohy).
* **Oddělení od osobního pořadí:** Priorita úkolu je společná týmová vlastnost, nikoli osobní pořadí uživatele (kapitola 7.2).

### 5.8 Termín úkolu
**Stav: POTVRZENO**
* **Úkol nemusí mít termín.** Termín je zcela **nepovinný**.
* Úkol vytvořený bez termínu aplikace nepovažuje za chybu ani nezobrazuje absenci termínu jako automatický problém nebo varování.
* Připomínky se týkají výhradně úkolů s nastaveným termínem.

### 5.9 Týmové přílohy a média u úkolu
**Stav: POTVRZENO**
* K úkolu musí být možné připojit vlastní pracovní materiály.
* Úkol může obsahovat přílohy, například:
  * fotografie a obrázky,
  * PDF dokumenty,
  * textové a tabulkové dokumenty,
  * jiné běžné soubory.
* **Přílohy jsou součástí týmové / veřejné části úkolu** a jsou přístupné všem členům dané Nástěnky.
* **Přílohy nejsou součástí soukromého osobního pracovního prostoru.**
* Každý člen může k úkolu nahrát přílohu, otevřít ji, upravit či smazat v rámci týmové spolupráce.
* **Zásadní pravidlo:** Příloha připojená k úkolu je sdílený týmový obsah. Soukromé dokumenty uživatele patří výhradně do jeho osobního pracovního prostoru.

### 5.10 Komentáře u úkolu
**Stav: POTVRZENO**
* Úkol obsahuje sekci týmových komentářů pro diskuzi k řešení.
* **Pravidla autorství:**
  * Každý člen může přidat svůj vlastní komentář.
  * Každý člen může **upravit nebo smazat výhradně svůj vlastní komentář**.
  * Žádný člen nemůže upravovat ani mazat komentáře ostatních kolegů.

### 5.11 Životní cyklus úkolu: Rozdíl HOTOVO / ARCHIVOVÁNO / SMAZÁNO
**Stav: POTVRZENO**

V aplikaci je zaveden striktní rozdíl mezi třemi koncovými stavy úkolu:

```text
       AKTIVNÍ PRÁCE (Nové / Převzaté / Rozpracované / Čeká se)
                                 │
                     [Přesun do Hotovo]
                                 ▼
                              HOTOVO
                    (dokončeno, skryto z UI,
                   dohledatelné přeškrtnuté)
                      │                 │
     [po 10 dnech auto]                 │ [ruční archivace dříve]
                      ▼                 ▼
                         ARCHIVOVÁNO
                 (dlouhodobě odloženo v archivu,
                      mimo běžný provoz)

─────────────────────────────────────────────────────────────
Kdykoliv řešitelem/spoluřešitelem:
[Smazat s potvrzením „SMAZAT“] ──► SMAZÁNO (definitivní zánik)
```

#### 1. HOTOVO
* Práce na úkolu je dokončena.
* Úkol **není aktivní**, automaticky se skryje z výchozího pohledu na oblast.
* Zůstává plně dohledatelný (po zapnutí zobrazení hotových úkolů je zobrazen jako přeškrtnutý).
* **Není archivovaný a není smazaný.**

#### 2. ARCHIVOVÁNO
* Úkol je dlouhodobě odložen mimo běžný pracovní provoz.
* Zůstává bezpečně uložen v systému a je dohledatelný v archivu.
* **Automatická archivace:** Pokud úkol zůstane ve stavu `HOTOVO`, po **10 dnech bude automaticky archivován**.
* **Ruční archivace:** Řešitel nebo kterýkoliv spoluřešitel může úkol archivovat **ručně kdykoliv po dokončení** (nemusí čekat 10 dní). Pokud je úkol archivován ručně dříve, automatická archivace po 10 dnech se již neuplatní.

#### 3. SMAZÁNO
* **Definitivní a trvalé odstranění úkolu ze systému.**
* Úkol přestává existovat, není dostupný v aktivním provozu, archivu ani historii.
* Smazání smí provést pouze Řešitel nebo Spoluřešitel (případně Owner / Správce).
* Vyžaduje bezpečnostní ruční vepsání textu:
  > **`SMAZAT`**

Příklad dialogu pro smazání úkolu:
```text
Opravdu chcete tento úkol smazat?
UPOZORNĚNÍ: Úkol bude definitivně odstraněn ze systému!

Pro potvrzení napište:
SMAZAT

[________________]

[Zrušit]     [SMAZAT]
```

---

## 6. Stavy úkolů a dokončené úkoly

### 6.1 Pohled na oblast a povolené přechody mezi stavy
**Stav: POTVRZENO**
* Po otevření konkrétní oblasti se zobrazí přehled jejích týmových úkolů v kanbanovém / sloupcovém uspořádání:

```text
PRODEJNA

NOVÉ       PŘEVZATÉ      ROZPRACOVANÉ      ČEKÁ SE       HOTOVO
----------------------------------------------------------------
Úkol 1     Úkol 3        Úkol 5            Úkol 7        [skryto]
Úkol 2     Úkol 4        Úkol 6
```

* **Volnost přechodů (žádná rigidní sekvence):** Uvedené stavy představují doporučené pracovní fáze, ale **nejsou povinnou pevnou posloupností**.
* **Řešitel nebo Spoluřešitel může úkol přesunout přímo do kteréhokoliv stavu.**
* Výslovně je povoleno např. přesunout úkol **přímo ze stavu `NOVÉ` do stavu `HOTOVO`** bez nutnosti procházet mezistavy.

**Stav: K DISKUZI**
* Přesný podrobný popis významu a nuancí jednotlivých stavů (`NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`, `HOTOVO`).

### 6.2 Zobrazení a chování dokončených úkolů
**Stav: POTVRZENO**
* **Automatické skrytí z běžného pohledu:** Po přesunu do stavu `HOTOVO` se úkol automaticky přestane zobrazovat v běžném aktivním pohledu na oblast.
* **Úkol se nemaže:** Dokončený úkol zůstává v systému zachován.
* **Možnost zobrazení:** Uživatel má možnost si dokončené úkoly v dané oblasti kdykoliv zobrazit (např. filtrem nebo přepínačem).
* **Vizuální odlišení – přeškrtnutí:** Dokončené úkoly jsou v tomto pohledu jednoznačně vizuálně odlišeny – **text úkolu je přeškrtnutý**.
* **Čistota rozhraní:** Výchozí zobrazení zůstává maximálně čisté a není zahlceno dokončenou prací.
* **Následná archivace:** Úkol setrvá ve stavu `HOTOVO` 10 dní, poté je automaticky archivován (nebo ručně dříve, viz 5.11).

---

## 7. Osobní pohled člena týmu

### 7.1 „Moje úkoly“
**Stav: POTVRZENO**
* Každý člen týmu má k dispozici svůj **vlastní osobní prostor** (osobní dashboard).
* Centrální částí je sekce **„Moje úkoly“** – obsahuje úkoly, kde je přihlášený uživatel uveden jako:
  * **hlavní Řešitel**, NEBO
  * **Spoluřešitel**.
* Účel: Okamžité soustředění na vlastní rozpracovanou práci bez nutnosti procházet celou nástěnku.

### 7.2 Osobní pořadí úkolů
**Stav: POTVRZENO**
* Každý uživatel si může úkoly ve svém osobním pracovním pohledu **libovolně řadit a přeskupovat**:
  * úkol, na kterém právě pracuje, si přesune na první místo nahoru,
  * úkol pro následující krok si umístí hned pod něj,
  * méně urgentní úkoly si odsune níže.
* **Pořadí je přísně osobní:**
  * Milan může mít Úkol A na 1. pozici,
  * Alena (např. jako spoluřešitelka stejného úkolu) může mít Úkol A na 3. pozici.
  * Změna pořadí jedním uživatelem **nikdy nemění** pořadí jinému uživateli.
* **Nezávislost vlastností úkolu:** Osobní pořadí je výhradně pracovní pomůcka uživatele. Manuální přerovnání nesmí měnit stav, prioritu, termín ani jakoukoli jinou společnou vlastnost úkolu.

**Stav: K DISKUZI**
* Možnost volitelných automatických režimů řazení (např. přepnutí na řazení dle termínu, dle priority, dle stavu či dle poslední aktivity).

---

## 8. Týmová a soukromá data (Soukromý pracovní prostor úkolu)

### 8.1 Konceptuální oddělení
**Stav: POTVRZENO**
Úkol se skládá ze společné týmové části a individuálních soukromých pracovních prostorů řešitelů:

```text
ÚKOL
│
├── VEŘEJNÁ / TÝMOVÁ ČÁST
│   ├── Název úkolu
│   ├── Popis
│   ├── Komentáře týmu (každý upravuje jen svůj)
│   ├── Přílohy a dokumenty (fotografie, PDF, soubory)
│   ├── Oblast
│   ├── Autor (zadavatel)
│   ├── Hlavní řešitel
│   ├── Spoluřešitelé
│   ├── Priorita úkolu (○ Běžná / 🔴 Spěchá) + historie změn
│   ├── Termín (pokud je zadán)
│   └── Stav
│
├── OSOBNÍ PRACOVNÍ PROSTOR HLAVNÍHO ŘEŠITELE (např. Milan)
│   ├── Soukromé poznámky
│   ├── Vlastní kroky / checklist
│   ├── Soukromé materiály a nákresy
│   └── Vlastní pracovní postup
│
└── OSOBNÍ PRACOVNÍ PROSTORY SPOLUŘEŠITELŮ
    ├── Osobní prostor spoluřešitele 1 (např. Adam)
    └── Osobní prostor spoluřešitele 2 (např. Alena)
```

### 8.2 Nezávislost osobních pracovních prostorů
**Stav: POTVRZENO**
* **Každý spoluřešitel má stejně jako hlavní řešitel vlastní soukromý osobní pracovní prostor.**
* Soukromé prostory jednotlivých členů se **vzájemně nesdílejí** (Milan nevidí poznámky Adama ani Aleny).
* Týmové informace, popis, komentáře a týmové přílohy jsou naopak pro všechny společné.
* Při odpojení spoluřešitele nebo změně hlavního řešitele zůstávají soukromé poznámky dotyčnému členovi a nepředávají se nikomu dalšímu.

---

## 9. Odchod člena z nástěnky

### 9.1 Zachování úkolů a převod na „Nepřiřazeno“
**Stav: POTVRZENO**
* Pokud člen opustí nástěnku, jeho aktivní úkoly **nesmí zmizet** – zůstávají součástí nástěnky.
* Pokud byl odcházející člen **hlavním řešitelem**, úkol se automaticky změní na:
  > **Nepřiřazeno**
* Pokud byl odcházející člen **spoluřešitelem**, je z pozice spoluřešitele odebrán; hlavní řešitel a ostatní spoluřešitelé pokračují v práci.

Příklad pro hlavního řešitele:
```text
Adam odchází z nástěnky

Úkol A (Řešitel: Adam)
Úkol B (Řešitel: Adam)

      ↓

Úkol A → Nepřiřazeno
Úkol B → Nepřiřazeno
```

### 9.2 Soukromý prostor odcházejícího člena
**Stav: POTVRZENO**
* Osobní pracovní prostor odcházejícího člena **zůstává soukromý**.
* Jeho obsah se nestává týmovým obsahem a nepředává se ostatním členům, spoluřešitelům ani budoucímu řešiteli.
* Přesná dlouhodobá správa osobního prostoru po odchodu člena zatím není součástí rozhodnutých požadavků.

---

## 10. Notifikace a připomínky

### 10.1 WhatsApp notifikace při vytvoření úkolu (Priorita 1. verze)
**Stav: POTVRZENO**
* **Klíčový notifikační mechanismus pro 1. verzi:** Při vytvoření **každého nového úkolu** vznikne notifikační událost, která se doručí prostřednictvím **WhatsApp všem členům dané Nástěnky**.
* **Pravidlo doručení všem členům Nástěnky:**
  * Notifikaci o novém úkolu obdrží **všichni členové příslušné Nástěnky** bez výjimky.
  * *Příklad:* Na Nástěnce jsou členové Milan, Adam a Alena. Milan vytvoří nový úkol *„Koupit nový regál – Prodejna“*. WhatsApp notifikaci obdrží Milan, Adam i Alena.
* **Nezávislost na přiřazení (včetně `Nepřiřazeno`):**
  * Pravidlo platí bez ohledu na to, zda je nový úkol přiřazen konkrétnímu Řešiteli, nebo zůstává ve stavu `Nepřiřazeno`.
  * Rozhodující pro doručení je výhradně členství v dané Nástěnce, nikoliv to, komu je úkol přiřazen.
* **Vymezení rozsahu:** Jedná se o čistě funkční požadavek na WhatsApp jako komunikační kanál (konkrétní WhatsApp API, poskytovatel, způsob autentizace ani technické řešení integrace se v této fázi nespecifikují).

### 10.2 Priorita ostatních notifikací (Budoucí rozšíření)
**Stav: K DISKUZI (Výhledově)**
* Pro první verzi aplikace je prioritní výhradně:
  > **NOVÝ ÚKOL → WhatsApp → všichni členové dané Nástěnky**
* Ostatní události se v první verzi neimplementují jako prioritní notifikace a zůstávají jako otevřené možnosti pro budoucí rozšíření:
  * změna priority úkolu,
  * změna stavu úkolu,
  * přidání nového komentáře,
  * změna hlavního Řešitele,
  * připojení nebo odpojení Spoluřešitele,
  * změna termínu úkolu a připomínky blížících se termínů,
  * archivace nebo smazání úkolu,
  * jiné kanály (např. volitelné e-mailové či interní in-app notifikace).

---

## 11. Mobilní použití

**Stav: POTVRZENO**
* Aplikace musí být plně použitelná na třech typech zařízení:
  * **PC / notebook**
  * **Tablet**
  * **Mobilní telefon**
* Použití na mobilu je klíčové pro operativní práci v terénu (prodejna, stavba, chata, údržba).
* V první fázi **není požadována nativní mobilní aplikace** (pro iOS / Android).
* Aplikace bude přístupná přes standardní moderní webový prohlížeč (responzivní rozhraní).

**Stav: K DISKUZI**
* Možnost instalace jako PWA (Progressive Web App) na plochu telefonu.
* Podpora pořizování a vkládání fotografií přímo z fotoaparátu mobilu do příloh či osobního prostoru.
* Případný offline režim pro oblasti s horším signálem (výhledově).

---

## 12. Čeština

**Stav: POTVRZENO**
* Celá aplikace je navržena a provozována v **češtině**.
* Čeština je základním a neměnným požadavkem, nikoliv dodatečnou volitelnou lokalizací.
* Veškeré texty v uživatelském rozhraní, názvy stavů, chybové hlášky, systémová tlačítka i nápovědy musí být v přirozené češtině.

---

## 13. Přehlednost a jednoduchost (Klíčové UX zásady)

**Stav: POTVRZENO**

**Přehlednost a jednoduchost jsou hlavními zásadami celé aplikace.** Nástěnka nemá zobrazovat zbytečné množství informací najednou.

Platí zejména:
1. **Priorita aktivního obsahu:** Výchozí pohled zobrazuje především aktivní a bezprostředně důležité informace.
2. **Nezatěžovat dokončeným:** Dokončené úkoly nesmí zbytečně zabírat místo na obrazovce (jsou skryty, po 10 dnech automaticky archivovány).
3. **Strukturované zanoření:** Hlavní obrazovka pracuje s přehledem oblastí; detailní informace se zobrazují až po otevření konkrétní oblasti nebo úkolu.
4. **Ergonomie na všech zařízeních:** Rozhraní musí být přirozeně přehledné a ovladatelné na PC, tabletu i telefonu.
5. **Ochrana před nechtěnou destrukcí:** Smazání oblasti (včetně jejích úkolů) i smazání úkolu vyžaduje bezpečné ruční vypsání textu `SMAZAT`.
6. **Přirozená kooperace bez zbytečné administrativy:** Spoluřešitel se připojuje a odpojuje sám bez nutnosti schvalování; nikdo nemůže druhého nutit ke spoluřešitelství.
7. **Žádné zbytečné funkce:** Žádná funkce nesmí být přidána pouze proto, že ji lze technicky snadno implementovat.

---

## 14. Otevřené otázky (K budoucímu rozhodnutí)

Tato sekce shromažďuje oblasti, které zatím nebyly definitivně rozhodnuty a zůstávají k diskuzi:

1. **Zobrazení archivu a obnova úkolů:**
   * Jakým způsobem se bude archiv uživatelům zobrazovat a filtrovat?
   * Bude možné archivovaný úkol v případě potřeby znovu obnovit do aktivního stavu, a pokud ano, jaká budou pravidla?
2. **Životní cyklus a stavy úkolu:**
   * Detailní popis a význam jednotlivých stavů úkolu (`NOVÉ`, `PŘEVZATÉ`, `ROZPRACOVANÉ`, `ČEKÁ SE`, `HOTOVO`).
3. **Osobní pohled:**
   * Možnost volby automatických způsobů řazení (např. seřadit dle termínu, dle priority apod.).
4. **Notifikace a upozornění (další události a kanály):**
   * V 1. verzi je prioritou výhradně WhatsApp notifikace při vytvoření úkolu všem členům Nástěnky.
   * K diskuzi pro budoucí verze zůstává: notifikace na změny stavů, komentáře, termíny a volba dalších kanálů (in-app, e-mail).
5. **Technologická a provozní rozšíření (výhledově):**
   * PWA (instalace na plochu telefonu).
   * Offline režim pro práci bez připojení.

---

## 15. Historie rozhodnutí

| Datum | Oblast | Popis rozhodnutí | Schválil / Zaznamenal |
|---|---|---|---|
| 18. 9. 2026 | Koncept | Schválení základní hierarchie: Nástěnka → Tým → Oblasti → Úkoly → Přiřazení → Osobní prostory | Product Owner / Tým |
| 18. 9. 2026 | Více nástěnek | Aplikace podporuje více samostatných nástěnek s vlastním týmem a obsahem | Product Owner |
| 18. 9. 2026 | Členství | Uživatel může být členem více nástěnek (nezávisle na sobě) | Product Owner |
| 18. 9. 2026 | Role | Každá nástěnka má svého Ownera (nejvyšší úroveň oprávnění) | Product Owner |
| 18. 9. 2026 | Role | Na nástěnce může existovat Správce se stejnými právy jako Owner v rámci dané nástěnky | Product Owner |
| 18. 9. 2026 | Oblasti | Zobrazení oblastí na hlavní obrazovce formou karet, oddělení úkolů dle oblastí | Product Owner / Tým |
| 18. 9. 2026 | Správa oblastí | Oblasti může vytvářet, upravovat, přejmenovávat a mazat pouze Owner a Správce | Product Owner |
| 18. 9. 2026 | Smazání oblasti | Smazání oblasti je destruktivní (smaže oblast i všechny její úkoly bez archivu); vyžaduje zadat `SMAZAT` | Product Owner |
| 18. 9. 2026 | Úkoly | Podpora nepřiřazených úkolů i přímého přiřazení (sobě i kolegovi) | Product Owner / Tým |
| 18. 9. 2026 | Viditelnost | Týmové úkoly vidí všichni členové dané nástěnky | Product Owner |
| 18. 9. 2026 | Oprávnění člena | Běžný člen může úkol zobrazit, komentovat, upravit popis, změnit řešitele/převzít, nastavit prioritu a přidat přílohu | Product Owner |
| 18. 9. 2026 | Oprávnění řešitele | Řešitel svého úkolu výhradně může: měnit stav, posunout do jiné oblasti, měnit termín, archivovat a smazat | Product Owner |
| 18. 9. 2026 | Změna řešitele | Převzetím nový řešitel získává práva řešitele, původní se stává běžným členem; osobní prostor se nepředává | Product Owner |
| 18. 9. 2026 | Nepřiřazený úkol | U nepřiřazeného úkolu nemá nikdo práva řešitele, dokud jej někdo nepřevezme | Product Owner |
| 18. 9. 2026 | Spoluřešitelé | Úkol může mít 1 Řešitele a více Spoluřešitelů; připojení tlačítkem `+ Připojit se k úkolu` | Product Owner |
| 18. 9. 2026 | Spoluřešitelé | Neimplementuje se funkce ručního přidání jiného člena jako spoluřešitele; člen se připojuje/odpojuje sám | Product Owner |
| 18. 9. 2026 | Oprávnění spoluřešitele | Spoluřešitel má stejná pracovní oprávnění jako hlavní Řešitel včetně smazání úkolu (`SMAZAT`) | Product Owner |
| 18. 9. 2026 | Soukromý prostor | Každý řešitel i spoluřešitel má vlastní soukromý prostor; prostory se vzájemně nesdílejí | Product Owner |
| 18. 9. 2026 | Přílohy úkolu | K úkolu lze přikládat soubory, foto, PDF; přílohy jsou součástí sdíleného týmového obsahu, nikoliv osobního prostoru | Product Owner |
| 18. 9. 2026 | Komentáře | Každý člen může přidat vlastní komentář a upravit/smazat pouze svůj komentář | Product Owner |
| 18. 9. 2026 | Přechody stavů | Stavy nejsou rigidní sekvence; řešitel/spoluřešitel může stavy přeskakovat (např. přímo `NOVÉ → HOTOVO`) | Product Owner |
| 18. 9. 2026 | Dokončené úkoly | Skryty z výchozího zobrazení; možnost zobrazit; přeškrtnutý text; zachování čistoty UI | Product Owner |
| 18. 9. 2026 | Automatická archivace | Po 10 dnech ve stavu HOTOVO se úkol automaticky archivuje; ruční archivace je možná dříve | Product Owner |
| 18. 9. 2026 | HOTOVO vs ARCHIV vs SMAZAT | Jasné vymezení: HOTOVO (dokončeno, dohledatelné), ARCHIVOVÁNO (odloženo v archivu), SMAZÁNO (trvalý zánik) | Product Owner |
| 18. 9. 2026 | Osobní pořadí | Každý člen si v osobním pohledu libovolně řadí úkoly; pořadí je přísně osobní a nemění data úkolu | Product Owner |
| 18. 9. 2026 | Model priorit | Priorita má pouze 2 hodnoty (`○ Běžná` a `🔴 Spěchá`); může ji měnit kterýkoliv člen týmu | Product Owner |
| 18. 9. 2026 | Historie priority | Změna priority je evidována v historii činnosti úkolu včetně autora změny | Product Owner |
| 18. 9. 2026 | Termín úkolu | Termín je nepovinný; úkol bez termínu není chyba | Product Owner |
| 18. 9. 2026 | Smazání úkolu | Smazání úkolu znamená trvalé odstranění; vyžaduje potvrzení napsáním `SMAZAT` | Product Owner |
| 18. 9. 2026 | Odchod člena | Po odchodu hlavního řešitele se úkol vrátí do stavu „Nepřiřazeno“; soukromé prostory zůstávají soukromé | Product Owner |
| 18. 9. 2026 | WhatsApp notifikace | Každý nový úkol odešle WhatsApp notifikaci všem členům dané Nástěnky (i u Nepřiřazeno); ostatní notifikace odloženy na budoucí verze | Product Owner |
| 18. 9. 2026 | UX princip | Přehlednost je klíčová zásada; výchozí pohled čistý, detaily až na vyžádání | Product Owner |
| 18. 9. 2026 | Mobilita | Požadavek na responzivní webové rozhraní pro mobil, tablet i PC; nativní aplikace v 1. fázi není vyžadována | Product Owner |
| 18. 9. 2026 | Spoluřešitelé | Spoluřešitelem se lze stát pouze u úkolu s hlavním Řešitelem; u Nepřiřazeno je nutné nejprve převzít úkol | Product Owner |
| 18. 9. 2026 | Jazyk | Stoprocentní české uživatelské rozhraní | Product Owner |
| 19. 9. 2026 | Spoluřešitelé a přiřazení | Přidána možnost Hlavního Řešitele odebrat Spoluřešitele a explicitně potvrzeno obecné právo všech členů Nástěnky přidělovat úkoly členům dané Nástěnky | Product Owner |
