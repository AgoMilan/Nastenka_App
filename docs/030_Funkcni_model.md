# Funkční model aplikace Nástěnka

**Typ dokumentu:** Funkční model a specifikace uživatelských scénářů  
**Stav:** Schváleno k analýze  
**Verze:** 0.3.0  
**Vychází z:** `docs/020_Pozadavky.md` (v0.9.0)  
**Datum:** 19. 9. 2026  

---

## 1. Účel dokumentu a kontext

Tento dokument navazuje na [docs/020_Pozadavky.md](file:///c:/Users/Milan/Projekty/Nastenka/docs/020_Pozadavky.md) a převádí schválené produktové požadavky do **konkrétního funkčního modelu z pohledu uživatele**.

Popisuje:
* chování jednotlivých entit a rolí,
* detailní průběhy 20 uživatelských scénářů (vstupy, kroky, validační pravidla, stavy),
* přesné interakce mezi týmovým a osobním prostorem.

Dokument se striktně drží zásady **popisu funkčního chování** bez vazby na programovací jazyk, databázové schéma či konkrétní frameworky.

---

## 2. Přehled entit a rolí ve funkčním modelu

### 2.1 Entity
* **Nástěnka (Board):** Samostatný pracovní prostor s vlastním týmem, oblastmi a úkoly.
* **Oblast (Area):** Tematický, prostorový nebo organizační okruh na Nástěnce (např. Prodejna, Chata, Dům).
* **Úkol (Task):** Základní pracovní jednotka skládající se z:
  * **Týmové části:** název, popis, oblast, termín (volitelný), priorita, stavy, komentáře, týmové přílohy, historie změn.
  * **Přiřazení:** 1 hlavní Řešitel + 0 až N Spoluřešitelů.
  * **Soukromých osobních prostorů:** nezávislý prostor pro každého řešitele a spoluřešitele.

### 2.2 Role a oprávnění
Důsledně rozlišujeme mezi **rolí v rámci celé Nástěnky** a **vztahem / rolí uživatele ke konkrétnímu úkolu**:

* **Role na Nástěnce (globální oprávnění na Nástěnce):**
  1. **Owner (Vlastník):** Nejvyšší oprávnění na Nástěnce (správa Nástěnky, správa oblastí).
  2. **Správce:** Stejné pravomoci jako Owner výhradně v rámci dané Nástěnky.
  3. **Běžný člen:** Člen Nástěnky. Může prohlížet úkoly, komentovat, pracovat s přílohami, nastavovat prioritu, přidělit úkol kterémukoli členovi dané Nástěnky nebo jej vrátit do stavu `Nepřiřazeno`, delegovat a přebírat úkoly nebo se připojit k obsazenému úkolu jako spoluřešitel.
* **Vztah uživatele ke konkrétnímu úkolu (nejde o samostatné globální role na Nástěnce):**
  4. **Hlavní Řešitel úkolu:** Člen vedený jako hlavní odpovědná osoba za úkol. Má navíc výhradní operační práva k úkolu (stav, oblast, termín, archivace, smazání a odebrání Spoluřešitele).
  5. **Spoluřešitel úkolu:** Člen dobrovolně připojený k již obsazenému úkolu. Má **shodná pracovní oprávnění jako hlavní Řešitel** (s výjimkou odebrání jiného spoluřešitele). Řešitel a Spoluřešitel nejsou samostatné role uživatele v rámci celé Nástěnky.

### 2.3 Notifikační model (1. verze)
* **Klíčový notifikační princip pro 1. verzi:**
  > **NOVÝ ÚKOL → WhatsApp → všichni členové dané Nástěnky**
* Při založení libovolného nového úkolu se automaticky odešle notifikace prostřednictvím **WhatsApp všem členům dané Nástěnky**.
* **Nezávislost na přiřazení:** Notifikaci obdrží všichni členové Nástěnky bez ohledu na to, zda je úkol přiřazen konkrétnímu řešiteli, nebo zůstává ve stavu `Nepřiřazeno`. Rozhodující pro doručení je výhradně členství v dané Nástěnce.
* *Příklad:* Nástěnka má členy Milan, Adam a Alena. Milan vytvoří nový úkol *„Koupit nový regál – Prodejna“* (ať už pro sebe, pro Adama, nebo jako `Nepřiřazeno`). WhatsApp notifikaci obdrží Milan, Adam i Alena.
* **Ostatní notifikace odloženy:** Veškerá další upozornění (změna priority, změna stavu, komentáře, změna řešitele, připojení/odpojení spoluřešitele, termíny apod.) jsou v 1. verzi odložena jako náměty pro budoucí rozšíření a systém je zatím neodesílá.

---

## 3. Uživatelské scénáře: Životní cyklus úkolu

---

### Scénář 1: Vytvoření nového úkolu
* **Kdo provádí:** Kterýkoliv člen Nástěnky.
* **Výchozí stav:** Uživatel se nachází na Nástěnce nebo uvnitř konkrétní oblasti.
* **Kroky uživatele:**
  1. Uživatel vyvolá akci vytvoření úkolu (`+ Nový úkol`).
  2. Zadá povinné údaje:
     * **Název úkolu** (text, nesmí být prázdný),
     * **Oblast** (výběr ze seznamu existujících oblastí).
  3. Může volitelně zadat:
     * **Popis úkolu** (podrobnější zadání),
     * **Přiřazení hlavního řešitele** (možnost A: ponechat `Nepřiřazeno`, možnost B: vybrat sebe, možnost C: vybrat jiného člena),
     * **Prioritu** (výchozí: `○ Běžná`, volitelně: `🔴 Spěchá`),
     * **Termín** (nepovinné datum splnění),
     * **Přílohy** (nahrát úvodní pracovní soubory).
  4. Potvrdí vytvoření.
* **Výsledek:**
  * Úkol je zařazen do vybrané oblasti ve výchozím stavu `NOVÉ`. Zobrazí se všem členům Nástěnky.
  * Systém vygeneruje notifikační událost: **Všem členům dané Nástěnky je odeslána WhatsApp notifikace** o vytvoření nového úkolu (bez ohledu na to, zda byl úkol přiřazen konkrétnímu řešiteli nebo zůstal `Nepřiřazeno`).

---

### Scénář 2: Přiřazení a změna hlavního řešitele
* **Kdo provádí:** Kterýkoliv člen Nástěnky (Běžný člen, Správce, Owner).
* **Výchozí stav:** Úkol je ve stavu `Nepřiřazeno`, nebo již má přiřazeného jiného řešitele.
* **Kroky uživatele:**
  1. Uživatel otevře detail úkolu.
  2. V poli řešitele vybere člena týmu (např. vybere kolegu Adama, nebo vrátí na `Nepřiřazeno`).
  3. Změna se ihned uloží bez schvalování.
* **Pravidlo přidělení úkolu:**
  * Každý člen konkrétní Nástěnky může:
    * převzít Nepřiřazený úkol,
    * přidělit úkol kterémukoli jinému členovi dané Nástěnky,
    * změnit Řešitele,
    * změnit úkol zpět na `Nepřiřazeno`.
  * Nejde o administrátorské privilegium Ownera či Správce, ale o obecné právo každého člena Nástěnky.
* **Výsledek:**
  * Jako hlavní Řešitel je nastaven vybraný člen (nebo je úkol nastaven na `Nepřiřazeno`).
  * Do historie úkolu se zapíše záznam o změně řešitele včetně jména autora změny.

---

### Scénář 3: Převzetí úkolu členem
* **Kdo provádí:** Kterýkoliv člen Nástěnky (např. Milan).
* **Výchozí stav:** Úkol je buď `Nepřiřazeno`, nebo jej má přiřazen jiný kolega (např. Adam).
* **Kroky uživatele:**
  1. Milan otevře úkol a zvolí možnost převzetí úkolu na sebe (`Převzít úkol`).
  2. Systém nevyžaduje schválení od původního řešitele ani správce.
* **Výsledek:**
  * Milan se stává hlavním Řešitelem a získává rozšířená práva k úkolu.
  * Původní řešitel (Adam) přestává být řešitelem, stává se běžným členem a ztrácí rozšířená práva (pokud se nepřipojí jako spoluřešitel).
  * Adamův osobní prostor zůstává Adamovi; Milan má svůj vlastní osobní prostor.
  * V historii úkolu se zaznamená převzetí.

---

### Scénář 4: Připojení spoluřešitele k úkolu
* **Kdo provádí:** Kterýkoliv člen Nástěnky, který dosud není řešitelem ani spoluřešitelem úkolu.
* **Výchozí stav:** Úkol existuje na Nástěnce a **již má přiřazeného hlavního Řešitele**.
* **Kroky uživatele:**
  1. Člen (např. Alena) otevře detail úkolu.
  2. Klikne na tlačítko:
     > **`+ Připojit se k úkolu`**
* **Důležitá pravidla:**
  * **Pouze u obsazeného úkolu:** Akce `+ Připojit se k úkolu` je dostupná výhradně tehdy, když úkol již má hlavního Řešitele. U úkolu ve stavu `Nepřiřazeno` toto tlačítko není dostupné – člen musí úkol nejprve **převzít** (Scénář 3) a stát se hlavním Řešitelem.
  * **Pouze z vlastní vůle:** Tuto akci může provést výhradně Alena sama za sebe. Hlavní řešitel Milan ani nikdo jiný nemá k dispozici tlačítko pro nucené přiřazení spoluřešitele.
* **Výsledek:**
  * Alena je okamžitě zařazena do seznamu **Spoluřešitelé**.
  * Alena získává stejná pracovní oprávnění k úkolu jako hlavní Řešitel (s výjimkou práva odebrat jiného spoluřešitele).
  * Aleně se vytvoří její vlastní soukromý osobní pracovní prostor pro tento úkol.
  * Úkol se Aleně začne zobrazovat v jejím osobním přehledu **„Moje úkoly“**.
  * V historii úkolu se zaznamená: `Alena se připojila jako spoluřešitel`.

---

### Scénář 5: Odpojení a odebrání spoluřešitele z úkolu
* **Kdo provádí:**
  * **Možnost A (Odpojení):** Samotný spoluřešitel (např. Alena).
  * **Možnost B (Odebrání):** Hlavní Řešitel daného úkolu (např. Milan).
* **Výchozí stav:** Úkol má Hlavního Řešitele a alespoň jednoho Spoluřešitele.
* **Kroky uživatele:**
  * **Varianta A – Dobrovolné odpojení spoluřešitele:**
    1. Spoluřešitelka Alena otevře detail úkolu.
    2. Klikne na tlačítko:
       > **`− Odpojit se od úkolu`**
    3. Alena je odebrána ze seznamu spoluřešitelů. V historii se zapíše: `Alena se odpojila z úkolu`.
  * **Varianta B – Odebrání spoluřešitele Hlavním Řešitelem:**
    1. Hlavní Řešitel Milan otevře detail úkolu.
    2. U spoluřešitele (např. Adama) zvolí akci odebrání z úkolu.
    3. Adam je odstraněn ze seznamu Spoluřešitelů daného úkolu.
    4. V historii se zapíše: `Milan odebral spoluřešitele Adam`.
* **Důležitá pravidla:**
  * **Žádná blokace:** Odebraný uživatel není nijak zablokován. Pokud má úkol stále Hlavního Řešitele, může se tento uživatel později znovu připojit přes `+ Připojit se k úkolu`.
  * **Zachování Hlavního Řešitele:** Odebrání Spoluřešitele nesmí změnit Hlavního Řešitele.
  * **Výhradní pravomoc Řešitele:** Běžný člen ani jiný Spoluřešitel nemůže Spoluřešitele odebrat. Právo odebrat Spoluřešitele má výhradně Hlavní Řešitel.
* **Výsledek:**
  * Uživatel je odebrán ze seznamu spoluřešitelů a stává se běžným členem.
  * Ztrácí rozšířená oprávnění k úkolu.
  * Úkol mizí z jeho přehledu „Moje úkoly“.
  * Jeho soukromý osobní prostor k tomuto úkolu zůstává zachován soukromý jemu (nikomu se nepředává).
  * Úkol a práce ostatních členů pokračuje bez přerušení.

---

### Scénář 6: Práce více lidí na jednom úkolu
* **Kdo provádí:** Hlavní řešitel (Milan) a spoluřešitelé (Adam, Alena).
* **Průběh spolupráce:**
  * Všichni tři vidí týmovou část úkolu (název, popis, stav, prioritu, termín).
  * Kterýkoliv z nich může přidávat týmové komentáře a nahrávat či stahovat týmové přílohy.
  * Kterýkoliv z nich může operativně posunout stav úkolu nebo upravit termín.
  * **Paralelní osobní prostory:**
    * Milan si píše své soukromé poznámky a mezikroky do svého prostoru.
    * Adam má svůj vlastní checklist, který Milan ani Alena nevidí.
    * Alena má své pracovní koncepty, které vidí pouze ona.

---

### Scénář 7: Nastavení a změna priority úkolu
* **Kdo provádí:** Kterýkoliv člen Nástěnky (i ten, kdo úkol neřeší).
* **Výchozí stav:** Úkol má prioritu `○ Běžná` nebo `🔴 Spěchá`.
* **Kroky uživatele:**
  1. Uživatel (např. Milan u úkolu, kde je řešitelem Adam) klikne na volbu priority.
  2. Změní hodnotu z `○ Běžná` na `🔴 Spěchá`.
* **Výsledek:**
  * Priorita úkolu se okamžitě vizuálně změní pro celý tým na Nástěnce.
  * Do historie činnosti úkolu se neprodleně zapíše auditní záznam:  
    `Milan změnil prioritu na „Spěchá“` (včetně data a času).
  * Osobní pracovní pořadí ostatních členů v jejich dashboardech zůstává nedotčeno.

---

### Scénář 8: Změna stavu úkolu (volné přechody)
* **Kdo provádí:** Pouze hlavní Řešitel nebo kterýkoliv Spoluřešitel.
* **Výchozí stav:** Úkol je v libovolném stavu (např. `NOVÉ`).
* **Kroky uživatele:**
  1. Řešitel nebo spoluřešitel přesune úkol do cílového stavu (např. tažením na kanbanu nebo výběrem ze seznamu).
  2. **Pravidlo volnosti přechodů:** Systém nevynucuje průchod přes stavy `PŘEVZATÉ`, `ROZPRACOVANÉ` ani `ČEKÁ SE`. Přímý přechod z `NOVÉ` do `HOTOVO` je povolen.
* **Výsledek:**
  * Úkol se okamžitě přesune do vybraného sloupce.
  * Změna stavu je zaznamenána v historii úkolu s uvedením autora změny.

---

### Scénář 9: Dokončení úkolu (`HOTOVO`)
* **Kdo provádí:** Hlavní Řešitel nebo Spoluřešitel.
* **Kroky uživatele:**
  1. Řešitel posune úkol do stavu `HOTOVO`.
* **Systémové chování:**
  * Úkol je označen jako dokončený.
  * Úkol se **automaticky skryje z běžného aktivního pohledu** na oblast.
  * Pokud uživatel v dané oblasti zapne přepínač *„Zobrazit hotové úkoly“*, úkol se zobrazí s **přeškrtnutým textem názvu**.
  * Spustí se odpočet 10 dnů pro automatickou archivaci.
  * Úkol se nemaže a zůstává plně dohledatelný.

---

### Scénář 10: Automatická archivace úkolu po 10 dnech
* **Kdo provádí:** Systém automaticky.
* **Podmínka:** Úkol setrval ve stavu `HOTOVO` nepřetržitě po dobu 10 dnů.
* **Systémové chování:**
  * Po uplynutí 10 dnů systém převede úkol ze stavu `HOTOVO` do stavu `ARCHIVOVÁNO`.
  * Úkol přestává být zobrazován i v pohledu na hotové úkoly dané oblasti a přesouvá se do **Archivu Nástěnky**.
  * Úkol zůstává v systému trvale uložen a dohledatelný pro případ budoucí potřeby.

---

### Scénář 11: Ruční archivace úkolu
* **Kdo provádí:** Hlavní Řešitel nebo kterýkoliv Spoluřešitel.
* **Výchozí stav:** Úkol je dokončen (ve stavu `HOTOVO`), nebo se řešitelé rozhodli jej předčasně odložit.
* **Kroky uživatele:**
  1. Řešitel otevře detail úkolu a zvolí akci `Archivovat úkol`.
  2. Nemusí čekat na uplynutí 10 dnů.
* **Výsledek:**
  * Úkol je okamžitě přesunut do stavu `ARCHIVOVÁNO`.
  * Automatický odpočet 10 dnů se ruší jako již neaplikovatelný.
  * Úkol je bezpečně uložen v archivu mimo běžný provoz.

---

### Scénář 12: Definitivní smazání úkolu
* **Kdo provádí:** Hlavní Řešitel, Spoluřešitel, Owner nebo Správce.
* **Výchozí stav:** Úkol existuje v jakémkoliv stavu (aktivní, hotový i archivovaný).
* **Kroky uživatele:**
  1. Uživatel klikne na akci `Smazat úkol`.
  2. Zobrazí se bezpečnostní dialog:
     ```text
     Opravdu chcete tento úkol smazat?
     UPOZORNĚNÍ: Úkol bude definitivně odstraněn ze systému!

     Pro potvrzení napište:
     SMAZAT

     [________________]

     [Zrušit]     [SMAZAT]
     ```
  3. Uživatel musí do textového pole přesně ručně vypsat slovo: `SMAZAT`.
  4. Tlačítko `[SMAZAT]` se aktivuje pouze při přesné shodě textu.
* **Výsledek:**
  * Úkol je **trvale a nevratně odstraněn ze systému**.
  * Úkol přestává existovat v aktivním zobrazení, v historii i v archivu.

---

### Scénář 13: Nepřiřazený úkol v provozu
* **Stav úkolu:** Úkol má v poli řešitele hodnotu `Nepřiřazeno`.
* **Pravidla chování:**
  * Úkol je viditelný všem členům jako volný (např. s vizí „někdo se toho ujme“).
  * Žádný člen nemá k úkolu oprávnění řešitele (nikdo nemůže měnit stav, termín ani mazat).
  * Běžní členové mohou k úkolu přidávat komentáře, přílohy a měnit prioritu.
  * **Převzetí úkolu jako podmínka řešení:** Kterýkoliv člen může kliknout na `Převzít úkol` a stát se hlavním Řešitelem (Scénář 3).
  * **Zákaz připojení spoluřešitele bez hlavního řešitele:** U `Nepřiřazeného` úkolu se člen **nemůže připojit jako Spoluřešitel** (akce `+ Připojit se k úkolu` není dostupná). Pokud chce člen na úkolu pracovat, musí jej nejprve převzít. Teprve po obsazení role hlavního Řešitele se mohou další členové připojit jako Spoluřešitelé. Nesmí vzniknout nekonzistentní stav: `Řešitel: nikdo + Spoluřešitel: někdo`.

---

## 4. Uživatelské scénáře: Správa oblastí

---

### Scénář 14: Vytvoření, úprava a přejmenování oblasti
* **Kdo provádí:** Pouze Owner nebo Správce Nástěnky.
* **Běžný člen:** Tyto ovládací prvky vůbec nemá k dispozici.
* **Průběh:**
  * Owner / Správce zvolí `Nová oblast`, zadá název (např. *Prodejna*) a potvrdí.
  * Karta oblasti se ihned objeví na hlavní obrazovce Nástěnky.
  * Přejmenování probíhá přes volbu `Upravit oblast`.

---

### Scénář 15: Definitivní smazání oblasti včetně všech jejích úkolů
* **Kdo provádí:** Pouze Owner nebo Správce Nástěnky.
* **Výchozí stav:** Oblast existuje na Nástěnce a obsahuje 0 až N úkolů.
* **Kroky uživatele:**
  1. Owner / Správce zvolí možnost `Smazat oblast`.
  2. Zobrazí se bezpečnostní dialog s varováním:
     ```text
     Opravdu chcete oblast „Chata“ smazat?
     UPOZORNĚNÍ: Spolu s oblastí budou definitivně smazány i všechny její úkoly!

     Pro potvrzení napište:
     SMAZAT

     [________________]

     [Zrušit]     [SMAZAT]
     ```
  3. Uživatel musí ručně vypsat text `SMAZAT`.
* **Systémové chování:**
  * Oblast je trvale odstraněna.
  * **Všechny úkoly zařazené v této oblasti (aktivní, hotové i archivované) jsou okamžitě a definitivně smazány ze systému.**
  * Smazané úkoly se již nikde nezobrazují a nelze je obnovit.

---

## 5. Uživatelské scénáře: Obsah, spolupráce a soukromí

---

### Scénář 16: Práce s komentáři u úkolu
* **Kdo provádí:** Kterýkoliv člen Nástěnky.
* **Pravidla a chování:**
  * Uživatel napíše text a potvrdí odeslání. Komentář se zobrazí s jeho jménem, časem a textem.
  * **Vlastní komentář:** Autor má u svého komentáře možnost `Upravit` a `Smazat`.
  * **Cizí komentář:** U komentářů ostatních členů se tlačítka pro úpravu ani smazání nezobrazují.

---

### Scénář 17: Práce s týmovými přílohami
* **Kdo provádí:** Kterýkoliv člen Nástěnky.
* **Průběh:**
  * Uživatel nahraje soubor (fotografie z terénu, technický výkres v PDF, faktura, soupiska).
  * Příloha se uloží do **týmové části úkolu**.
  * Všichni členové Nástěnky mají možnost přílohu otevřít, stáhnout nebo zobrazit náhled.
  * Každý člen může zastaralou přílohu z týmového úkolu odstranit.
  * **Zásada:** Přílohy u úkolu jsou společné týmové podklady.

---

### Scénář 18: Práce v soukromém osobním pracovním prostoru
* **Kdo provádí:** Hlavní řešitel nebo spoluřešitel daného úkolu.
* **Průběh:**
  * Uživatel si v detailu úkolu otevře záložku/sekci `Můj osobní prostor`.
  * Zde si zapisuje neformální poznámky, pomocný nákupní checklist, dílčí mezikroky nebo pracovní koncepty.
  * **Zajištění soukromí:** Ostatní členové týmu (ani hlavní řešitel, ani ostatní spoluřešitelé, ani Správce/Owner) do tohoto prostoru nemají přístup a nevidí jeho obsah.
  * Data zůstávají uživateli i při změně řešitele nebo odpojení z úkolu.

---

### Scénář 19: Osobní řazení úkolů („Moje úkoly“)
* **Kdo provádí:** Každý uživatel ve svém osobním dashboardu.
* **Průběh:**
  * Uživatel vidí souhrnný seznam všech úkolů, kde je řešitelem nebo spoluřešitelem napříč oblastmi.
  * Úkoly si libovolně přetahuje nahoru či dolů podle svého denního plánu.
  * **Izolace:** Přesun úkolu na 1. místo Milanem nezmění pořadí Aleně ani Adamovi.
  * Změna pořadí nemění stav, prioritu ani termín úkolu.

---

## 6. Uživatelské scénáře: Správa členství a odchod z Nástěnky

---

### Scénář 20: Odchod člena z Nástěnky
* **Kontext:** Člen opouští Nástěnku (odchází z týmu).
* **Systémové chování vůči úkolům:**
  1. **Úkoly, kde byl hlavní Řešitel:**
     * Úkoly se nemažou.
     * Pole řešitele se automaticky změní na `Nepřiřazeno`.
     * Úkoly zůstávají na Nástěnce k dispozici pro převzetí ostatními členy.
  2. **Úkoly, kde byl Spoluřešitel:**
     * Člen je odebrán ze seznamu spoluřešitelů.
     * Hlavní řešitel a ostatní spoluřešitelé pokračují v práci beze změny.
  3. **Soukromý prostor odcházejícího člena:**
     * Soukromý osobní pracovní prostor zůstává soukromý.
     * Jeho obsah se nestává týmovým obsahem.
     * Nepředává se ostatním členům, spoluřešitelům ani novému řešiteli.
     * Přesná dlouhodobá správa osobního prostoru po odchodu člena zatím není součástí rozhodnutých požadavků.

---

## 7. Souhrnná matice operací a oprávnění

| Uživatelská operace | Owner | Správce | Hlavní Řešitel | Spoluřešitel | Běžný člen |
|---|---|---|---|---|---|
| **Zobrazit úkol a týmový obsah** | ANO | ANO | ANO | ANO | ANO |
| **Přidat komentář** | ANO | ANO | ANO | ANO | ANO |
| **Upravit / smazat svůj komentář** | ANO | ANO | ANO | ANO | ANO |
| **Upravit / smazat cizí komentář** | NE | NE | NE | NE | NE |
| **Nahrát / smazat týmovou přílohu** | ANO | ANO | ANO | ANO | ANO |
| **Změnit prioritu (`Běžná` / `Spěchá`)** | ANO | ANO | ANO | ANO | ANO |
| **Přiřadit / změnit řešitele** | ANO | ANO | ANO | ANO | ANO |
| **Změnit úkol na Nepřiřazeno** | ANO | ANO | ANO | ANO | ANO |
| **Převzít úkol na sebe (být Řešitel)** | ANO | ANO | ANO | ANO | ANO |
| **Připojit se jako Spoluřešitel (`+ Připojit se`)** | ANO* | ANO* | ANO* | — | ANO* |
| **Odpojit se z pozice Spoluřešitele** | — | — | — | ANO (sám sebe) | — |
| **Odebrat Spoluřešitele z úkolu** | ANO** | ANO** | ANO | NE | NE |
| **Změnit stav úkolu** | ANO | ANO | ANO | ANO | NE |
| **Změnit oblast úkolu** | ANO | ANO | ANO | ANO | NE |
| **Změnit termín úkolu** | ANO | ANO | ANO | ANO | NE |
| **Ručně archivovat úkol** | ANO | ANO | ANO | ANO | NE |
| **Definitivně smazat úkol (`SMAZAT`)** | ANO | ANO | ANO | ANO | NE |
| **Vytvořit / upravit oblast** | ANO | ANO | NE | NE | NE |
| **Smazat oblast i s jejími úkoly (`SMAZAT`)**| ANO | ANO | NE | NE | NE |
| **Vlastní soukromý pracovní prostor** | ANO | ANO | ANO | ANO | ANO |
| **Zobrazit cizí soukromý prostor** | NE | NE | NE | NE | NE |

*\* Poznámka 1: Akce `+ Připojit se k úkolu` je dostupná výhradně tehdy, pokud úkol již má hlavního Řešitele (u úkolu ve stavu Nepřiřazeno není dostupná – člen jej musí nejprve převzít).*  
*\*\* Poznámka 2: Z rolí vázaných k úkolu má právo odebrat Spoluřešitele výhradně Hlavní Řešitel (jiný Spoluřešitel ani běžný člen toto právo nemá); Owner a Správce mají toto právo z titulu globální správy Nástěnky.*
