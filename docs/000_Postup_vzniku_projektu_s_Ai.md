# 000 – Postup vzniku projektu s AI

**Účel dokumentu:** Obecná „kuchařka“ pro vznik nového softwarového projektu s využitím AI.

**Stav:** Pracovní dokument – průběžně doplňovaný  
**Verze:** 0.1.0

---

## 1. Účel tohoto dokumentu

Tento dokument popisuje doporučený postup, jak pomocí AI připravit nový softwarový projekt ještě před zahájením vlastní implementace.

Nejde o návod pro jeden konkrétní projekt. Jednotlivé kroky jsou formulovány obecně tak, aby je bylo možné použít při zakládání různých typů projektů.

Princip je jednoduchý:

> **Nejdříve společně s AI vyjasnit CO chceme vytvořit a JAK se má systém chovat. Teprve potom řešit technologii a psát kód.**

Dokument bude průběžně aktualizován podle zkušeností z dalších projektů.

---

# 2. Základní způsob spolupráce člověk + AI

Před začátkem projektu je vhodné rozdělit odpovědnosti.

### Člověk – Product Owner

Člověk rozhoduje zejména:

- proč projekt vzniká,
- jaký problém řeší,
- co má systém umět,
- co je důležité,
- jaká jsou omezení,
- která varianta je pro projekt správná,
- zda je navržené chování skutečně požadované.

### AI – analytik / architekt

AI pomáhá:

- strukturovat požadavky,
- odhalovat nejasnosti,
- hledat rozpory,
- navrhovat varianty,
- formulovat pravidla,
- vytvářet dokumentaci,
- kontrolovat konzistenci mezi dokumenty,
- připravovat zadání pro implementační AI.

### Implementační AI

Samostatná AI/IDE může následně:

- vytvářet kód,
- upravovat projekt,
- vytvářet testy,
- provádět refaktoring,
- implementovat přesně definované požadavky.

Důležitý princip:

> **Implementační AI nemá sama rozhodovat o nevyjasněných produktových pravidlech.**

---

# 3. Krok 1 – Vize a cíl projektu

První dokument má vysvětlit, proč projekt existuje.

Doporučený dokument:

`010_Vize_a_cil.md`

Měl by obsahovat:

- název projektu,
- účel projektu,
- problém, který řeší,
- cílové uživatele,
- hlavní přínos,
- základní princip fungování,
- co projekt řeší,
- co projekt záměrně neřeší,
- hlavní omezení,
- případně dlouhodobou vizi.

Výstupem této fáze není technické řešení.

Výstupem je odpověď:

> **Proč projekt vzniká a čeho má dosáhnout?**

---

# 4. Krok 2 – Požadavky

Následuje detailní specifikace toho, co má systém umět.

Doporučený dokument:

`020_Pozadavky.md`

Požadavky je vhodné rozdělit například na:

- hlavní funkce,
- uživatelské role,
- oprávnění,
- objekty systému,
- pravidla chování,
- stavové modely,
- práce s daty,
- soubory a přílohy,
- notifikace,
- bezpečnost,
- responzivitu,
- lokalizaci,
- omezení,
- budoucí funkce.

Je důležité zapisovat nejen:

> „Systém umožní vytvořit úkol.“

ale také:

> kdo jej může vytvořit, co je povinné, co volitelné, kdo jej vidí, kdo jej může změnit a co se stane v okrajových situacích.

Požadavky mají být dostatečně konkrétní, aby později nebylo nutné důležité chování domýšlet během programování.

---

# 5. Krok 3 – Funkční model

Požadavky říkají, co systém potřebuje.

Funkční model popisuje, **jak spolu jednotlivé části systému souvisejí**.

Doporučený dokument:

`030_Funkcni_model.md`

Může obsahovat:

- hlavní objekty systému,
- jejich vztahy,
- role,
- oprávnění,
- životní cykly,
- stavové přechody,
- významné operace,
- pravidla mezi objekty,
- hlavní notifikační toky,
- důležité systémové vazby.

Například:

```text
Uživatel
   ↓
Členství
   ↓
Tým
   ↓
Oblast
   ↓
Úkol
```

Funkční model pomáhá převést množství jednotlivých požadavků do uceleného modelu systému.

---

# 6. Krok 4 – Uživatelské scénáře

Následuje popis konkrétních situací, ve kterých bude uživatel systém používat.

Doporučený dokument:

`040_Uzivatelske_scenare.md`

Každý scénář by měl typicky obsahovat:

- kdo jej provádí,
- výchozí stav,
- akci uživatele,
- očekávaný výsledek,
- případné alternativní větve,
- případná chybová nebo okrajová situace.

Příklady obecných scénářů:

- vytvoření objektu,
- změna vlastníka nebo odpovědné osoby,
- převzetí práce,
- změna stavu,
- dokončení,
- archivace,
- smazání,
- přidání komentáře,
- práce se souborem,
- odchod uživatele.

Scénáře mají být praktickým ověřením požadavků a funkčního modelu.

---

# 7. Krok 5 – Kontrola konzistence

Před architekturou je vhodné provést kontrolu:

```text
Vize
  ↓
Požadavky
  ↓
Funkční model
  ↓
Uživatelské scénáře
```

AI by měla hledat například:

- rozporná oprávnění,
- nejasné role,
- objekty bez vlastníka,
- operace bez definovaného oprávnění,
- stavy bez jasného přechodu,
- scénáře, které odporují požadavkům,
- funkce zmíněné v jednom dokumentu, ale chybějící v jiném,
- nejasné okrajové situace.

Pokud vznikne rozpor, nemá jej AI sama potichu vyřešit.

Správný postup je:

1. rozpor identifikovat,
2. popsat varianty,
3. požádat člověka o rozhodnutí,
4. rozhodnutí zapsat,
5. aktualizovat dokumentaci.

---

# 8. Krok 6 – Logická architektura

Teprve po dostatečném vyjasnění funkcí se připravuje architektura.

Doporučený dokument:

`050_Architektura.md`

V této fázi ještě není nutné rozhodnout konkrétní technologie.

Dokument by měl popsat:

- architektonické principy,
- logické části systému,
- hlavní doménové objekty,
- vztahy mezi objekty,
- vlastnictví dat,
- hranice jednotlivých částí systému,
- oprávnění a bezpečnostní hranice,
- životní cykly,
- audit,
- soubory,
- notifikace,
- mazání a archivaci,
- hlavní aplikační toky,
- externí integrace,
- responzivního klienta,
- budoucí rozšiřitelnost.

Důležitý princip:

> **Logická architektura má popsat systém, nikoliv ještě konkrétní implementaci.**

---

# 9. Krok 7 – Detailní oprávnění a bezpečnostní model

Jedna z nejdůležitějších částí před implementací.

Je potřeba přesně určit:

- kdo může objekt vytvořit,
- kdo jej může zobrazit,
- kdo jej může upravit,
- kdo může změnit jednotlivé vlastnosti,
- kdo může objekt archivovat,
- kdo jej může smazat,
- kdo může pracovat s přílohami,
- kdo vidí soukromá data,
- co se stane při změně role,
- co se stane při odchodu uživatele.

Vhodná je matice:

| Operace | Role A | Role B | Role C | Vztah k objektu |
|---|---|---|---|---|
| vytvořit | ano | ano | ne | — |
| upravit | ano | ano | ano | podle pravidel |
| změnit stav | ne | ano | ne | odpovědná osoba |
| smazat | ano | ano | ne | podle pravidel |

Je nutné rozlišovat:

- **globální roli uživatele**,
- **členství v konkrétním prostoru**,
- **vztah uživatele ke konkrétnímu objektu**.

Aplikace nesmí spoléhat pouze na to, že určité tlačítko není zobrazeno v UI.

> **UI není bezpečnostní hranice. Oprávnění musí být ověřováno v aplikační logice.**

---

# 10. Krok 8 – Životní cyklus dat

Pro každý významný objekt je vhodné určit:

```text
VYTVOŘENÍ
   ↓
AKTIVNÍ STAV
   ↓
ZMĚNY
   ↓
DOKONČENÍ / ARCHIVACE
   ↓
PŘÍPADNÉ TRVALÉ SMAZÁNÍ
```

Je třeba rozhodnout:

- kdy objekt vzniká,
- kdo jej může vytvořit,
- jaké má stavy,
- jaké přechody jsou možné,
- kdy je považován za dokončený,
- zda se automaticky archivuje,
- zda lze archivovaný objekt obnovit,
- kdy a jak jej lze definitivně smazat.

---

# 11. Krok 9 – Historie a audit

U důležitých systémů je vhodné ještě před implementací určit, které změny musí být dohledatelné.

Typicky:

- kdo změnu provedl,
- kdy,
- co se změnilo,
- původní hodnota,
- nová hodnota.

Audit je důležitý zejména tam, kde více uživatelů pracuje se stejnými daty.

---

# 12. Krok 10 – Týmová a soukromá data

Pokud projekt pracuje se sdílenými i soukromými daty, musí být jejich hranice jasně definována.

Například:

```text
OBJEKT
├── TÝMOVÁ ČÁST
│   ├── společná data
│   ├── komentáře
│   ├── přílohy
│   └── historie
│
└── OSOBNÍ ČÁST
    ├── soukromé poznámky
    ├── vlastní pracovní postup
    └── osobní dokumenty
```

Je nutné určit:

- kdo data vlastní,
- kdo je vidí,
- kdo je může měnit,
- zda se při změně odpovědné osoby přenášejí,
- co se s nimi stane při odchodu uživatele,
- co se stane při zániku účtu.

---

# 13. Krok 11 – Integrace a externí služby

Teprve nyní se začínají přesněji specifikovat externí služby.

Například:

- e-mail,
- WhatsApp,
- kalendář,
- cloudové úložiště,
- platební služba,
- AI služba,
- jiné API.

Nejdříve definovat:

> **Co má integrace dělat?**

Až následně:

> **Jakou technologii/provider použijeme?**

---

# 14. Krok 12 – Technologická architektura

Po dokončení funkční a logické architektury lze rozhodovat o:

- frontend technologii,
- backend technologii,
- databázi,
- autentizaci,
- ukládání souborů,
- API,
- hostingu,
- Dockeru,
- CI/CD,
- monitoringu,
- zálohování.

Technologická volba by měla vycházet z předchozích požadavků.

Ne obráceně.

---

# 15. Krok 13 – Datový model

Teprve po ustálení doménového modelu lze připravovat:

- entity,
- atributy,
- vztahy,
- kardinality,
- integritní pravidla,
- indexy,
- historie,
- mazání,
- případné migrace.

Doporučený princip:

> **Databáze má podporovat doménový model, nikoliv určovat, jak se má projekt chovat.**

---

# 16. Krok 14 – API a aplikační operace

Následně lze definovat:

- aplikační případy použití,
- příkazy,
- dotazy,
- API operace,
- vstupy,
- výstupy,
- validační pravidla,
- chybové stavy,
- autorizaci.

Každá významná operace by měla mít oporu v předchozí specifikaci.

---

# 17. Krok 15 – Implementační plán

Před začátkem programování je vhodné rozdělit projekt na menší implementační kroky.

Například:

```text
1. základ projektu
2. autentizace
3. základní doménový model
4. hlavní funkce
5. oprávnění
6. UI
7. přílohy
8. notifikace
9. audit
10. testy
11. nasazení
```

Každý krok by měl mít:

- jasný cíl,
- vstupní podmínky,
- konkrétní úkoly,
- očekávaný výsledek,
- testovací kritéria.

---

# 18. Krok 16 – Testovací strategie

Ještě před implementací je vhodné určit, jak se bude ověřovat správnost systému.

Dokument:

`070_Testovani.md`

Může obsahovat:

- unit testy,
- integrační testy,
- testy oprávnění,
- testy uživatelských scénářů,
- regresní testy,
- UI testy,
- testy okrajových situací,
- praktické uživatelské testování.

Důležitý princip:

> **Každý důležitý požadavek musí být nějak ověřitelný.**

---

# 19. Krok 17 – Roadmapa

Dokument:

`060_Roadmapa.md`

Má určit:

- co bude v první verzi,
- co přijde později,
- co je pouze budoucí možnost,
- pořadí implementace,
- závislosti mezi částmi.

Je důležité oddělit:

- **MVP / v1**
- **v2**
- **budoucí rozšíření**

Tím se zabrání nekontrolovanému růstu projektu.

---

# 20. Doporučená struktura dokumentace

Před implementací může mít projekt například:

```text
docs/
├── 000_Postup_vzniku_projektu_s_Ai.md
├── 010_Vize_a_cil.md
├── 020_Pozadavky.md
├── 030_Funkcni_model.md
├── 040_Uzivatelske_scenare.md
├── 050_Architektura.md
├── 060_Roadmapa.md
├── 070_Testovani.md
├── 080_Co_projekt_umi.md
└── README.md
```

Ne všechny projekty musí potřebovat všechny dokumenty.

Struktura se může přizpůsobit velikosti a typu projektu.

---

# 21. Minimální stav před vlastní implementací

Před tím, než AI začne psát produkční kód, by mělo být alespoň jasné:

### Produkt

- proč projekt existuje,
- pro koho je,
- co má řešit,
- co řešit nebude.

### Funkce

- hlavní funkce,
- role,
- oprávnění,
- hlavní objekty,
- jejich vztahy,
- stavové modely,
- důležité okrajové situace.

### Uživatelské chování

- hlavní uživatelské scénáře,
- očekávané výsledky,
- chybové situace.

### Architektura

- logické části systému,
- hranice odpovědností,
- vlastnictví dat,
- bezpečnostní hranice,
- týmová vs. soukromá data.

### Technika

- technologický stack,
- databáze,
- API,
- autentizace,
- úložiště,
- deployment.

### Kvalita

- testovací strategie,
- akceptační kritéria,
- způsob ověřování výsledku.

---

# 22. Co má AI dělat před napsáním kódu

AI by měla před implementací především:

1. číst aktuální projektovou dokumentaci,
2. pochopit doménu,
3. identifikovat nejasnosti,
4. upozornit na rozpory,
5. navrhnout varianty,
6. čekat na rozhodnutí člověka u zásadních otázek,
7. aktualizovat dokumentaci,
8. teprve potom připravit implementační plán.

Neměla by:

- svévolně měnit požadavky,
- domýšlet důležité obchodní pravidlo,
- vytvářet funkci jen proto, že je technicky jednoduchá,
- považovat UI omezení za bezpečnost,
- přeskočit analytickou fázi jen proto, že uživatel chce rychle začít programovat.

---

# 23. Základní pracovní smyčka projektu

Doporučený proces:

```text
ČLOVĚK DEFINUJE POTŘEBU
        ↓
AI POMÁHÁ OBJASNIT POŽADAVKY
        ↓
DOKUMENTACE
        ↓
KONTROLA KONZISTENCE
        ↓
FUNKČNÍ MODEL
        ↓
UŽIVATELSKÉ SCÉNÁŘE
        ↓
LOGICKÁ ARCHITEKTURA
        ↓
OPRÁVNĚNÍ + BEZPEČNOST
        ↓
TECHNOLOGICKÁ ARCHITEKTURA
        ↓
IMPLEMENTAČNÍ PLÁN
        ↓
IMPLEMENTACE AI
        ↓
TESTY
        ↓
PRAKTICKÉ OVĚŘENÍ ČLOVĚKEM
        ↓
ZPĚTNÁ VAZBA
        ↓
AKTUALIZACE DOKUMENTACE
        ↓
DALŠÍ ITERACE
```

---

# 24. Zásada postupného zpřesňování

Dokumentace nemusí být perfektní hned na začátku.

Důležitější je:

> **Neimplementovat nejasné rozhodnutí.**

Projekt může postupovat například:

```text
v0.1 → pracovní návrh
v0.2 → doplnění
v0.3 → oprava rozporů
v1.0 → schválený základ
```

Dokumentace se může vyvíjet spolu s projektem.

Každé významné rozhodnutí by však mělo být zpětně dohledatelné.

---

# 25. Role dokumentace během vývoje

Dokumentace není pouze příprava před programováním.

Během vývoje slouží jako:

- zdroj pravdy pro AI,
- podklad pro implementaci,
- kontrola proti nechtěnému rozšiřování projektu,
- podklad pro testování,
- historie rozhodnutí,
- základ pro další vývojáře a další AI agenty.

Proto je nutné dokumentaci průběžně aktualizovat.

---

# 26. Budoucí rozšíření této „kuchařky“

Tento dokument je pracovní metodika.

Při vývoji dalších projektů je vhodné jej postupně doplňovat o zkušenosti například z oblastí:

- práce více AI agentů,
- předávání práce mezi AI,
- revize kódu AI,
- Git workflow,
- verzování dokumentace,
- automatické kontroly konzistence,
- testování AI-generovaného kódu,
- bezpečnost,
- deployment,
- monitoring,
- zálohování,
- práce s externími službami,
- řízení změn požadavků.

Nové poznatky se mají nejprve ověřit v praxi a následně zapsat do této metodiky.

---

# 27. Historie verzí

| Verze | Stav | Obsah |
|---|---|---|
| 0.1.0 | Pracovní | Základní metodika postupu od vize přes požadavky, funkční model, scénáře a architekturu až k přípravě implementace. |

---

## Závěrečný princip

Celá metodika stojí na jednoduchém pravidle:

> **Nejdříve rozumět problému. Potom definovat chování. Potom navrhnout systém. Až nakonec programovat.**

AI má proces urychlit a zpřesnit, nikoliv nahradit rozhodování člověka o tom, co má výsledný produkt dělat.
