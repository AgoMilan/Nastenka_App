# Uživatelské scénáře aplikace Nástěnka

**Typ dokumentu:** Uživatelské scénáře z pohledu reálného uživatele  
**Stav:** Schváleno k analýze  
**Verze:** 0.3.0  
**Vychází z:** `docs/020_Pozadavky.md` (v0.9.0) a `docs/030_Funkcni_model.md` (v0.3.0)  
**Datum:** 19. 9. 2026  

---

## 1. Účel dokumentu a metodika

Tento dokument představuje **praktický most mezi produktovými požadavky, funkčním modelem a budoucí implementací**. Popisuje používání aplikace Nástěnka z pohledu skutečných lidí (členů týmu, řešitelů, správců a vlastníků) v konkrétních každodenních situacích.

Dokument striktně respektuje schválená pravidla:
* **Žádné nové funkce:** Popisuje výhradně schválené chování z [docs/020_Pozadavky.md](file:///c:/Users/Milan/Projekty/Nastenka/docs/020_Pozadavky.md) a [docs/030_Funkcni_model.md](file:///c:/Users/Milan/Projekty/Nastenka/docs/030_Funkcni_model.md).
* **Čistě uživatelská perspektiva:** Popisuje vstupy uživatele, reakce rozhraní a systémová pravidla bez technických detailů (databáze, API, frameworky, hosting).
* **Důsledné rozlišení rolí:**
  * **Globální role na Nástěnce:** Owner (Vlastník), Správce, Běžný člen.
  * **Vztah uživatele ke konkrétnímu úkolu:** Hlavní Řešitel, Spoluřešitel.

---

## 2. Přehled uživatelských scénářů

1. [Scénář 1: První vstup uživatele a orientace v aplikaci](#scénář-1-první-vstup-uživatele-a-orientace-v-aplikaci)
2. [Scénář 2: Výběr Nástěnky a přehled oblastí](#scénář-2-výběr-nástěnky-a-přehled-oblastí)
3. [Scénář 3: Vytvoření nového úkolu](#scénář-3-vytvoření-nového-úkolu)
4. [Scénář 4: Převzetí nepřiřazeného úkolu](#scénář-4-převzetí-nepřiřazeného-úkolu)
5. [Scénář 5: Připojení dalšího člena k úkolu a odebrání Spoluřešitele](#scénář-5-připojení-dalšího-člena-k-úkolu-a-odebrání-spoluřešitele)
6. [Scénář 6: Společná práce více lidí na jednom úkolu](#scénář-6-společná-práce-více-lidí-na-jednom-úkolu)
7. [Scénář 7: Práce v osobním pracovním prostoru](#scénář-7-práce-v-osobním-pracovním-prostoru)
8. [Scénář 8: Dokončení úkolu (HOTOVO) a zobrazení dokončených úkolů](#scénář-8-dokončení-úkolu-hotovo-a-zobrazení-dokončených-úkolů)
9. [Scénář 9: Archivace a práce s archivem](#scénář-9-archivace-a-práce-s-archivem)
10. [Scénář 10: Komentáře a týmové přílohy](#scénář-10-komentáře-a-týmové-přílohy)
11. [Scénář 11: Správa oblastí (vytvoření, úprava a smazání)](#scénář-11-správa-oblastí-vytvoření-úprava-a-smazání)
12. [Scénář 12: Odchod člena z Nástěnky](#scénář-12-odchod-člena-z-nástěnky)
13. [Scénář 13: WhatsApp notifikace nového úkolu](#scénář-13-whatsapp-notifikace-nového-úkolu)
14. [Scénář 14: Práce uživatele s více Nástěnkami](#scénář-14-práce-uživatele-s-více-nástěnkami)

---

## 3. Detailní popisy uživatelských scénářů

---

### Scénář 1: První vstup uživatele a orientace v aplikaci

**Výchozí situace**
* **Kdo provádí:** Uživatel (např. Alena), která byla přidána do týmu Nástěnky.
* **Kontext:** Alena otevírá aplikaci Nástěnka ve webovém prohlížeči (na PC, tabletu nebo telefonu).
* **Počáteční stav:** Alena je přihlášena a je členem jedné nebo více Nástěnek.

**Postup uživatele**
1. Alena otevře aplikaci v prohlížeči.
2. Na úvodní obrazovce vidí přehledné a čisté rozhraní v češtině.
3. Pokud je členem více Nástěnek, zvolí Nástěnku, se kterou chce pracovat (např. *„Prodejna & Provoz“*). Pokud má pouze jednu Nástěnku, vstoupí přímo do ní.
4. Prohlédne si hlavní rozcestník:
   * přehled oblastí dané Nástěnky,
   * rychlý přístup ke svému osobnímu přehledu *„Moje úkoly“*,
   * tlačítko pro rychlé vytvoření nového úkolu (`+ Nový úkol`).

**Chování aplikace**
* Rozhraní je responzivní a přizpůsobené rozměru obrazovky (PC, tablet, telefon).
* Výchozí zobrazení je maximálně čisté: nezobrazuje dokončené ani archivované úkoly, aby uživatele nezahltilo.
* Veškeré popisky, ovládací prvky i stavy jsou v přirozené češtině.

**Výsledek**
* Alena se snadno orientuje v aktuálním dění na Nástěnce bez vizuálního smogu.
* Vidí oblasti, které tvoří strukturu práce týmu, a stav svých přiřazených úkolů.

**Pravidla a omezení**
* Aplikace je plně v češtině (žádná dodatečná lokalizace, čeština je standard).
* Hlavní UX zásadou je přehlednost – výchozí pohled zobrazuje pouze aktivní a relevantní informace.

---

### Scénář 2: Výběr Nástěnky a přehled oblastí

**Výchozí situace**
* **Kdo provádí:** Běžný člen týmu (např. Adam).
* **Kontext:** Adam přichází do práce a potřebuje zjistit, jaká je situace v jednotlivých částech provozu.
* **Počáteční stav:** Nástěnka má vytvořené tematické oblasti (např. *Sklad*, *Prodejna*, *Zahrada*).

**Postup uživatele**
1. V záhlaví nebo přepínači Nástěnek Adam zkontroluje, že má vybranou správnou Nástěnku.
2. Na hlavní ploše si prohlíží jednotlivé karty oblastí.
3. Na kartě každé oblasti vidí stručný přehled aktivních úkolů (např. počet otevřených úkolů, indikaci spěchajících úkolů).
4. Klikne na konkrétní oblast (např. *„Sklad“*).
5. Otevře se detail oblasti s podrobným seznamem aktivních úkolů patřících výhradně do této oblasti.

**Chování aplikace**
* Aplikace zobrazí oblasti formou přehledných karet na ploše Nástěnky.
* Dokončené úkoly (`HOTOVO`) a archivované úkoly jsou v tomto výchozím zobrazení skryty.
* Pokud je v oblasti aktivní úkol s prioritou `🔴 Spěchá`, je na kartě oblasti vizuálně zvýrazněn.
* Při otevření karty oblasti aplikace zobrazí detail dané oblasti se všemi jejími aktivními úkoly (oddělení úkolů dle oblastí).

**Výsledek**
* Adam má okamžitý přehled o rozdělení práce podle fyzických či tematických okruhů.
* Adam vidí aktivní úkoly ostatních kolegů i nepřiřazené úkoly v dané oblasti.

**Pravidla a omezení**
* Oblasti vytváří a spravuje výhradně Owner nebo Správce; Adam jako běžný člen oblasti pouze prohlíží.
* Týmové úkoly vidí všichni členové dané Nástěnky.
* Výchozí zobrazení zachovává čistotu a přehlednost – zobrazuje pouze aktivní úkoly.

---

### Scénář 3: Vytvoření nového úkolu

**Výchozí situace**
* **Kdo provádí:** Kterýkoliv člen Nástěnky (např. Milan).
* **Kontext:** Milan zjistil, že je potřeba objednat regál do prodejny.
* **Počáteční stav:** Milan se nachází na Nástěnce nebo uvnitř oblasti *„Prodejna“*.

**Postup uživatele**
1. Milan klikne na tlačítko `+ Nový úkol`.
2. Otevře se formulář pro zadání úkolu.
3. Milan vyplní:
   * **Název úkolu:** *„Koupit nový regál – Prodejna“* (povinné pole).
   * **Oblast:** vybere oblast *„Prodejna“* (povinné pole, pokud vytvářel z detailu oblasti, je předvyplněna).
4. Milan může volitelně:
   * doplnit **Popis úkolu** s podrobnostmi (rozměry, nosnost),
   * nastavit **Řešitele**:
     * možnost A: ponechá výchozí hodnotu `Nepřiřazeno`,
     * možnost B: vybere sám sebe (Milan),
     * možnost C: vybere jiného člena (např. Adama),
   * nastavit **Prioritu** (výchozí je `○ Běžná`, může přepnout na `🔴 Spěchá`),
   * nastavit **Termín** (vybere datum splnění, nebo ponechá prázdné),
   * nahrát **Přílohu** (např. fotografii poškozeného starého regálu).
5. Milan klikne na tlačítko pro uložení / vytvoření úkolu.

**Chování aplikace**
1. Systém zvaliduje povinná pole (název nesmí být prázdný, oblast musí existovat).
2. Úkol je uložen do vybrané oblasti ve výchozím stavu `NOVÉ`.
3. Pokud nebyl zvolen řešitel, úkol má přiřazení `Nepřiřazeno`.
4. Úkol se okamžitě zařadí mezi aktivní úkoly na Nástěnce.
5. **Aplikace vygeneruje notifikační událost:** Všem členům dané Nástěnky je odeslána notifikace prostřednictvím WhatsApp (viz Scénář 13).

**Výsledek**
* Úkol je viditelný pro všechny členy Nástěnky v oblasti *„Prodejna“*.
* Pokud Milan přiřadil úkol sobě, úkol se ihned zobrazí i v jeho osobním přehledu *„Moje úkoly“*.
* Všichni členové Nástěnky (včetně Milana, Adama a Aleny) obdrží WhatsApp notifikaci o vzniku úkolu.

**Pravidla a omezení**
* Nový úkol může vytvořit kterýkoliv člen týmu.
* Název a oblast jsou striktně povinné.
* Termín je nepovinný – úkol bez termínu je platný a v pořádku.
* Výchozí stav je vždy `NOVÉ`.
* Výchozí přiřazení je `Nepřiřazeno`.
* **Obecné pravidlo přidělení úkolu:** Každý člen konkrétní Nástěnky (Běžný člen, Správce i Owner) může přidělit úkol kterémukoli jinému členovi této Nástěnky nebo úkol ponechat jako `Nepřiřazeno`. Nejde o speciální privilegium Ownera či Správce, ale o obecné právo člena Nástěnky. Úkol lze přidělit výhradně členovi stejné Nástěnky.

---

### Scénář 4: Převzetí nepřiřazeného úkolu

**Výchozí situace**
* **Kdo provádí:** Běžný člen Nástěnky (např. Adam).
* **Kontext:** Adam si v oblasti *„Prodejna“* všiml nového úkolu *„Koupit nový regál – Prodejna“*, který je ve stavu `Nepřiřazeno`.
* **Počáteční stav:** Úkol nemá žádného hlavního Řešitele (`Řešitel: Nepřiřazeno`), stav úkolu je `NOVÉ`. Tlačítko pro připojení spoluřešitele u úkolu není zobrazeno.

**Postup uživatele**
1. Adam otevře detail nepřiřazeného úkolu.
2. V detailu úkolu klikne na tlačítko:
   > **`Převzít úkol`**
3. Případně může v rozbalovacím seznamu řešitelů vybrat své jméno.

**Chování aplikace**
1. Aplikace nastaví Adama jako **hlavního Řešitele úkolu**.
2. Pro úkol se aktivují operační práva řešitele (možnost měnit stav, termín, oblast, ručně archivovat nebo smazat).
3. Adam má u tohoto úkolu k dispozici svůj vlastní **soukromý osobní pracovní prostor** (striktně oddělený od týmového obsahu úkolu).
4. Úkol se začne Adamovi zobrazovat v jeho osobním přehledu *„Moje úkoly“*.
5. U úkolu se pro ostatní členy týmu nově aktivuje a zobrazí tlačítko:
   > **`+ Připojit se k úkolu`**
6. Do historie úkolu se zapíše: `Adam převzal úkol jako hlavní Řešitel`.

**Výsledek**
* Úkol má jednoho hlavního Řešitele (Adam).
* Ostatní členové Nástěnky vidí, že Adam na úkolu pracuje.
* Nyní je umožněno ostatním členům připojit se k úkolu jako spoluřešitelé.

* **Pravidla a omezení**
* **Povinná posloupnost:** `Nepřiřazeno → převzetí → Hlavní Řešitel → možnost připojení Spoluřešitelů`.
* U nepřiřazeného úkolu se nikdo nemůže stát spoluřešitelem – nesmí nikdy vzniknout stav `Řešitel: nikdo + Spoluřešitel: někdo`.
* Převzetí nevyžaduje schvalování správce ani ownera. Převzít nebo přiřadit úkol může kterýkoliv člen Nástěnky (Běžný člen, Správce i Owner) bez nutnosti administrátorských práv.
* **Osobní prostor:** Každý člen má u úkolu svůj vlastní soukromý osobní pracovní prostor oddělený od týmového obsahu. Převzetí úkolu nezakládá žádné nové pravidlo pro existenci osobního prostoru – Adam v něm pracuje se svými vlastními poznámkami, které nikdo jiný nevidí.

---

### Scénář 5: Připojení dalšího člena k úkolu a odebrání Spoluřešitele

**Výchozí situace**
* **Kdo provádí:**
  * Případ A (Připojení/odpojení): Běžný člen Nástěnky (např. Alena).
  * Případ B (Odebrání): Hlavní Řešitel daného úkolu (např. Milan).
* **Kontext:** Na úkolu je potřeba koordinovat zapojení dalších řešitelů.
* **Počáteční stav:** Úkol již má hlavního Řešitele (např. Adam nebo Milan).

**Postup uživatele**
* **A) Vlastní připojení spoluřešitele:**
  1. Alena si otevře detail úkolu *„Koupit nový regál – Prodejna“* (Řešitel: Adam).
  2. V sekci přiřazení klikne na tlačítko:
     > **`+ Připojit se k úkolu`**
* **B) Dobrovolné odpojení spoluřešitele:**
  1. Alena v detailu úkolu klikne na tlačítko:
     > **`− Odpojit se od úkolu`**
* **C) Odebrání spoluřešitele Hlavním Řešitelem:**
  1. Příkladová situace:
     ```text
     Úkol: Opravit střechu
     Řešitel: Milan
     Spoluřešitelé: Adam, Alena
     ```
  2. Hlavní Řešitel Milan otevře detail úkolu a u spoluřešitele Adama klikne na možnost odebrání z úkolu.

**Chování aplikace**
1. **Při připojení:** Systém zařadí Alenu do seznamu Spoluřešitelů. Alena získává shodná pracovní oprávnění k úkolu jako hlavní Řešitel (s výjimkou práva odebrat jiného spoluřešitele). Úkol se zařadí do jejího přehledu *„Moje úkoly“*. Do historie se zapíše: `Alena se připojila jako spoluřešitel`.
2. **Při odpojení:** Alena je odebrána ze seznamu spoluřešitelů a stává se běžným členem. Do historie se zapíše: `Alena se odpojila z úkolu`.
3. **Při odebrání Hlavním Řešitelem:**
   * Systém odstraní Adama ze seznamu Spoluřešitelů daného úkolu.
   * Stav po odebrání:
     ```text
     Řešitel: Milan
     Spoluřešitelé: Alena
     ```
   * Do historie úkolu se zapíše záznam: `Milan odebral spoluřešitele Adam`.

**Výsledek**
* Tým transparentně vidí aktuální složení řešitelského týmu.
* Adam je odstraněn pouze z daného úkolu; úkol mizí z jeho přehledu *„Moje úkoly“*, ale Adamův soukromý prostor zůstává Adamovi.
* **Odebraný uživatel není zablokován:** Pokud má úkol stále Hlavního Řešitele, Adam se může později znovu připojit přes `+ Připojit se k úkolu`.

**Pravidla a omezení**
* **Pouze z vlastní vůle při vstupu:** Člen se může připojit výhradně sám. Neexistuje funkce, kterou by někdo mohl člena nuceně přiřadit jako spoluřešitele (`+ Přidat spoluřešitele` neexistuje).
* **Pouze u obsazeného úkolu:** Tlačítko `+ Připojit se k úkolu` se zobrazuje pouze tehdy, má-li úkol hlavního Řešitele.
* **Právo odebrání:** Odebrat Spoluřešitele může výhradně Hlavní Řešitel (běžný člen ani jiný spoluřešitel tuto akci provést nemůže).
* **Žádná blokace:** Odebraný člen není zablokován před budoucím opětovným připojením k úkolu.
* **Nedotknutelnost Hlavního Řešitele:** Odebrání Spoluřešitele nesmí změnit Hlavního Řešitele.
* **Osobní prostor:** Osobní prostory členů zůstávají oddělené a při odpojení ani odebrání se nepředávají.

---

### Scénář 6: Společná práce více lidí na jednom úkolu

**Výchozí situace**
* **Kdo provádí:** Hlavní Řešitel (Adam) a Spoluřešitelka (Alena).
* **Kontext:** Adam i Alena společně koordinují nákup regálu.
* **Počáteční stav:** Úkol je přiřazen Adamovi a Aleně, nachází se ve stavu `NOVÉ` nebo `PŘEVZATÉ`.

**Postup uživatele**
1. Adam telefonicky ověří dostupnost regálu u dodavatele. V detailu úkolu posune stav z `NOVÉ` přímo na `ROZPRACOVANÉ`.
2. Do týmových komentářů napíše: *„Regál je rezervován v hobbymarketu do zítřka 16:00.“*
3. Alena si komentář přečte a odpoví vlastním komentářem: *„Zítra odpoledne tam zajedu dodávkou a vyzvednu ho.“*
4. Alena posune stav na `ČEKÁ SE` a upraví termín na zítřejší datum.
5. Kdokoliv z týmu (např. Milan) může úkol otevřít a sledovat aktuální stav a diskuzi.

**Chování aplikace**
* Stav úkolu se okamžitě aktualizuje pro všechny uživatele bez nutnosti schvalovacích kroků.
* Komentáře se řadí chronologicky v týmové části úkolu.
* Změny stavu i termínu se zaznamenávají do historie úkolu.
* Přechody mezi stavy jsou volné – řešitel i spoluřešitel mohou stavy přeskakovat podle reálné potřeby (např. přímo z `NOVÉ` do `ROZPRACOVANÉ` nebo přímo z `NOVÉ` do `HOTOVO`).

**Výsledek**
* Tým má přesný přehled o průběhu prací.
* Práva Adama i Aleny k operativnímu řízení úkolu jsou rovnocenná.

**Pravidla a omezení**
* Běžný člen týmu (který není řešitelem ani spoluřešitelem) nemůže měnit stav, termín ani oblast úkolu. Může však přidávat komentáře, přílohy a měnit prioritu.
* **Volné přechody stavů:** Posloupnost `NOVÉ → PŘEVZATÉ → ROZPRACOVANÉ → ČEKÁ SE → HOTOVO` nepředstavuje rigidní sekvenci. Stav `PŘEVZATÉ` není povinným mezikrokem a uživatel s příslušným oprávněním může úkol přepnout přímo do kteréhokoliv relevantního stavu (včetně `NOVÉ → HOTOVO`).

---

### Scénář 7: Práce v osobním pracovním prostoru

**Výchozí situace**
* **Kdo provádí:** Řešitel (Adam) nebo Spoluřešitelka (Alena).
* **Kontext:** Alena si potřebuje k úkolu poznamenat rozměry korby auta a soukromý nákupní lístek dalších drobností, které v hobbymarketu koupí pro sebe.
* **Počáteční stav:** Alena má otevřený detail úkolu *„Koupit nový regál – Prodejna“*.

**Postup uživatele**
1. V detailu úkolu Alena přepne na záložku nebo sekci:
   > **`Můj osobní prostor`**
2. Do textového pole si napíše své soukromé poznámky:
   * *„Rozměry kufru: 180x90 cm“*
   * *„Koupit si soukromě: pracovní rukavice a žárovku do lampy“*
3. Poznámky uloží.
4. Následně si otevře svůj osobní přehled *„Moje úkoly“*.
5. Pro organizaci své práce má dvě možnosti:
   * **Ruční uspořádání:** přetáhne tento úkol myší na 1. místo svého denního seznamu.
   * **Rychlé řazení:** zvolí tlačítko rychlého seřazení podle jednoho ze tří dostupných kritérií:
     * podle **termínu**,
     * podle **priority**,
     * podle **data vzniku**.

**Chování aplikace**
1. Aplikace uloží poznámky do **soukromého osobního prostoru Aleny**.
2. **Přísná izolace dat:** Adam ani Milan tento text nevidí. Pokud si Adam otevře záložku `Můj osobní prostor` u téhož úkolu, vidí výhradně své vlastní poznámky (nebo prázdný prostor).
3. **Výhradně osobní pohled:** Ruční přetažení i použití rychlého řazení uspořádá seznam úkolů **pouze pro Alenu v jejím přehledu „Moje úkoly“**. Pořadí úkolů u Adama, Milana ani na hlavní ploše Nástěnky se tím nijak nezmění.

**Výsledek**
* Alena má své pracovní koncepty a osobní agendu přehledně u úkolu, aniž by tím zaplňovala týmový prostor.
* Alena si může efektivně organizovat svůj osobní denní přehled (přetažením nebo jedním ze 3 rychlých řazení).
* Plné soukromí pracovních poznámek i osobního pořadí úkolů je garantováno.

**Pravidla a omezení**
* Osobní pracovní prostor je striktně soukromý pro daného uživatele.
* Obsah osobního prostoru **není týmovým obsahem**.
* Do osobního prostoru nemají přístup ostatní řešitelé, spoluřešitelé, Správce ani Owner.
* Při předání úkolu nebo odchodu z úkolu se osobní prostor nepředává novému řešiteli.
* **Osobní řazení úkolů:** Každý uživatel si v přehledu `Moje úkoly` řadí úkoly ručně přetažením nebo rychlým řazením (pouze: *termín*, *priorita*, *datum vzniku*). Toto řazení je výhradně osobní a nijak nemění data úkolu (termín, prioritu, stav) ani pohledy ostatních členů. Žádné další automatické způsoby řazení se nezavádějí.

---

### Scénář 8: Dokončení úkolu (HOTOVO) a zobrazení dokončených úkolů

**Výchozí situace**
* **Kdo provádí:** Spoluřešitelka (Alena) nebo hlavní Řešitel (Adam).
* **Kontext:** Regál byl koupen, přivezen a smontován v prodejně. Práce je hotová.
* **Počáteční stav:** Úkol je ve stavu `ROZPRACOVANÉ` nebo `ČEKÁ SE`.

**Postup uživatele**
1. Alena otevře úkol a přepne jeho stav na:
   > **`HOTOVO`**
2. Změnu potvrdí.
3. Vrátí se na přehled oblasti *„Prodejna“*.

**Chování aplikace**
1. Systém nastaví úkol do stavu `HOTOVO` a zaznamená datum dokončení.
2. **Automatické skrytí:** Úkol se automaticky přestane zobrazovat v běžném aktivním pohledu Nástěnky, oblasti i v osobním přehledu *„Moje úkoly“*.
3. Úkol se **nemaže** ani se ihned neodstraňuje do archivu.
4. **Zobrazení dokončených:** V rozhraní je k dispozici přepínač / volba:
   > `Zobrazit dokončené úkoly`
5. Pokud uživatel tuto volbu zapne:
   * dokončené úkoly se zobrazí,
   * jsou vizuálně jednoznačně odlišeny – **jejich text je přeškrtnutý**,
   * jsou potlačeny vůči aktivním úkolům, aby nenarušovaly přehlednost.
6. Začne běžet **10denní lhůta** pro automatickou archivaci (Scénář 9).

**Výsledek**
* Aktivní plocha Nástěnky zůstává čistá a nepřehlcená.
* Tým má kdykoliv možnost ověřit, co a kdy bylo splněno.

**Pravidla a omezení**
* Dokončení úkolu (`HOTOVO`) smí provést pouze hlavní Řešitel nebo Spoluřešitel (a globálně Správce/Owner).
* **`HOTOVO` není smazání ani okamžitá archivace:** Úkol zůstává v systému uložen, je plně dohledatelný a je pouze vyjmut z běžného aktivního zobrazení.
* **Pouze způsob zobrazení:** Možnost zobrazit dokončené úkoly (s vizuálním přeškrtnutím textu) představuje výhradně volitelný režim zobrazení v uživatelském rozhraní pro zachování přehlednosti, nikoliv nový životní stav úkolu.
* Stav `HOTOVO` lze nastavit přímo z jakéhokoliv předchozího stavu (např. i rovnou z `NOVÉ`).

---

### Scénář 9: Archivace a práce s archivem

**Výchozí situace**
* **Kdo provádí:** 
  * Varianta A (Automatická): Systém Nástěnky.
  * Varianta B (Ruční): Hlavní Řešitel (Adam) nebo Spoluřešitelka (Alena).
* **Kontext:** Úkol byl dokončen a již není potřeba, aby se zobrazoval ani mezi dokončenými úkoly na Nástěnce.
* **Počáteční stav:** Úkol je ve stavu `HOTOVO`.

**Postup uživatele / Chování systému**
* **Přechod do archivu (dvě cesty):**
  * **Varianta A (Automatika po 10 dnech):** Úkol leží ve stavu `HOTOVO` po dobu 10 po sobě jdoucích dní. 10. den systém automaticky přesune úkol do stavu `ARCHIVOVÁNO`.
  * **Varianta B (Ruční archivace):** Hlavní řešitel, spoluřešitel, správce nebo owner nechtějí čekat 10 dní, otevřou detail dokončeného úkolu a zvolí akci `Archivovat úkol`. Úkol je do archivu přesunut okamžitě.
* **Prohlížení archivu uživatelem:**
  1. Kterýkoliv člen Nástěnky může otevřít sekci **Archiv**.
  2. V archivu vidí přehledný seznam všech archivovaných úkolů.
  3. Kliknutím na úkol otevře jeho detail pro nahlížení do historických dat.

**Chování aplikace**
* Úkol přejde do stavu `ARCHIVOVÁNO`, opouští aktivní plochu Nástěnky i seznam dokončených úkolů a je zařazen do seznamu archivu.
* Úkol zůstává v systému trvale uložen a dohledatelný.
* **Archiv slouží pouze k prohlížení (read-only):** V detailu archivovaného úkolu jsou zobrazeny veškeré historické informace (název, popis, řešitelé, komentáře, přílohy i historie změn), ale data již nelze editovat.
* **Obnova archivovaného úkolu není podporována:** Aplikace neobsahuje žádné tlačítko typu `Obnovit`, `Vrátit z archivu` ani podobnou funkci. Archivovaný úkol se již nevrací mezi aktivní úkoly.
* **Jednoduchý model zobrazení:** Aplikace neřeší archiv žádným samostatným pokročilým vyhledávacím mechanismem; plně postačuje přehledný seznam archivovaných úkolů a možnost otevřít detail.

**Výsledek**
* Nástěnka je dlouhodobě udržována čistá a přehledná.
* Tým má spolehlivou a trvalou evidenci proběhlých činností k nahlédnutí.

**Pravidla a omezení**
* **10 dní:** Automatická archivace nastává po 10 dnech ve stavu `HOTOVO`.
* **Oprávnění ruční archivace:** Ručně archivovat mohou pouze Řešitel, Spoluřešitel, Správce a Owner.
* **Pouze k prohlížení:** Archiv slouží výhradně k nahlížení; úkoly v něm nelze upravovat.
* **Zákaz obnovy:** Obnova archivovaného úkolu zpět mezi aktivní úkoly není podporována.
* **Rozlišení pojmů:**
  * `HOTOVO` = dokončený úkol, skrytý z výchozího pohledu, viditelný po zapnutí zobrazení jako přeškrtnutý.
  * `ARCHIVOVÁNO` = historický úkol uložený v archivu pouze k prohlížení bez možnosti obnovy.
  * `SMAZÁNO` = nevratné fyzické odstranění úkolu ze systému (vyžaduje zadat `SMAZAT`).

---

### Scénář 10: Komentáře a týmové přílohy

**Výchozí situace**
* **Kdo provádí:** Kterýkoliv člen Nástěnky (např. Milan jako běžný člen, který úkol neřeší).
* **Kontext:** Milan našel na internetu záruční list a fakturu k dříve zakoupenému regálu a chce je k úkolu přiložit.
* **Počáteční stav:** Úkol existuje na Nástěnce.

**Postup uživatele**
1. Milan otevře detail úkolu.
2. V sekci **Týmové přílohy** klikne na `Nahrát přílohu` a vybere soubor `zarucni_list.pdf` a fotografii účtenky.
3. V sekci **Komentáře** napíše text: *„Přikládám záruční list a účtenku pro případnou reklamaci.“* a klikne na `Odeslat komentář`.
4. Později si všimne překlepu ve svém komentáři, klikne na `Upravit` u svého komentáře a opraví jej.

**Chování aplikace**
1. Přílohy jsou nahrány do **sdílené týmové části úkolu**. Jsou okamžitě přístupné ke stažení a náhledu pro všechny členy Nástěnky.
2. Komentář je zařazen do chronologické diskuze s uvedením jména autora (Milan) a časové značky.
3. Systém umožní Milanovi upravit nebo smazat **pouze jeho vlastní komentář**.
4. U cizích komentářů (od Adama nebo Aleny) systém Milanovi tlačítka pro úpravu ani smazání nenabídne.

**Výsledek**
* Přílohy i komentáře slouží jako transparentní týmová dokumentace úkolu.
* Každý člen týmu má garantováno, že jeho komentáře nemůže jiný člen svévolně přepsat ani smazat.

**Pravidla a omezení**
* Komentovat a nahrávat přílohy může **kterýkoliv člen dané Nástěnky**.
* Přílohy u úkolu jsou týmovým obsahem, nikoliv součástí osobního prostoru.
* **Ochrana integrity diskuse:** Uživatel může upravit nebo smazat výhradně své vlastní komentáře. Cizí komentáře nemůže upravit ani smazat žádný člen (ani hlavní řešitel, ani Správce či Owner).

---

### Scénář 11: Správa oblastí (vytvoření, úprava a smazání)

**Výchozí situace**
* **Kdo provádí:** Owner (Vlastník) nebo Správce Nástěnky.
* **Kontext:** Vedení provozu se rozhodlo reorganizovat prostor – zrušit dočasnou oblast *„Výprodejový stan“* a vytvořit novou stálou oblast *„Showroom“*.
* **Počáteční stav:** Oblast *„Výprodejový stan“* obsahuje několik starých a nedokončených úkolů.

**Postup uživatele**
1. **Vytvoření oblasti:**
   * Správce klikne na správu Nástěnky a zvolí `+ Nová oblast`.
   * Zadá název *„Showroom“*, potvrdí a nová karta oblasti se okamžitě zobrazí na ploše Nástěnky.
2. **Úprava / přejmenování:**
   * Správce může kdykoliv upravit název či popis existující oblasti.
3. **Destruktivní smazání oblasti:**
   * Správce otevře nastavení oblasti *„Výprodejový stan“* a zvolí `Smazat oblast`.
   * Aplikace zobrazí varovné modální okno s červeným upozorněním:
     > *Pozor! Smazání oblasti je nevratné. Společně s oblastí budou definitivně smazány všechny úkoly, které tato oblast obsahuje!*
   * Aplikace vyžaduje přesné ruční vypsání textu:
     > **`SMAZAT`**
   * Správce do vstupního pole vepíše přesně `SMAZAT` a potvrdí.

**Chování aplikace**
1. Aplikace ověří roli uživatele (akci smí provést pouze Owner nebo Správce; běžnému členovi se tato volba vůbec nezobrazuje).
2. Při pokusu o smazání aplikace striktně kontroluje zadaný text. Pokud uživatel klikne na potvrzení bez vypsání nebo napíše text chybně (např. malými písmeny či „Ano“), operace se **neprovede**.
3. Po zadání přesného kontrolního slova `SMAZAT` systém:
   * definitivně odstraní oblast *„Výprodejový stan“*,
   * **definitivně a nevratně smaže všechny úkoly** v této oblasti.
4. Tyto smazané úkoly se nepřesouvají do archivu ani do koše – zanikají.

**Výsledek**
* Oblast je odstraněna z Nástěnky společně se všemi svými úkoly.
* Je zabráněno nechtěnému smazání omylem (vyžadována explicitní textová pojistka).

**Pravidla a omezení**
* Oblasti může vytvářet, upravovat, přejmenovávat a mazat **pouze Owner a Správce Nástěnky**. Běžný člen oblastní strukturu nespravuje.
* Smazání oblasti je destruktivní – smaže oblast i její úkoly bez archivace.
* Bezpečnostní pojistka: Vyžaduje přesné vypsání textu `SMAZAT`. Pouhé kliknutí na tlačítko „Ano/Potvrdit“ je nepřípustné.

---

### Scénář 12: Odchod člena z Nástěnky

**Výchozí situace**
* **Kdo provádí:** Člen opouštějící Nástěnku (např. Adam), nebo Owner/Správce odebírající člena.
* **Kontext:** Adam přechází na jiné pracoviště a opouští danou Nástěnku.
* **Počáteční stav:** Adam má na Nástěnce:
  * úkol 1, kde je **hlavním Řešitelem**,
  * úkol 2, kde je **Spoluřešitelem** (hlavním řešitelem je Milan),
  * svůj soukromý osobní pracovní prostor s poznámkami.

**Postup uživatele / Administrace**
1. Členství Adama na Nástěnce je ukončeno.

**Chování aplikace**
1. **Ochrana kontinuity práce (úkoly nesmí zmizet):**
   * **Úkol 1 (kde byl hlavní Řešitel):** Úkol zůstává zachován v příslušné oblasti. Pole řešitele se automaticky změní na:
     > **`Nepřiřazeno`**
     Úkol je tímto okamžitě uvolněn a připraven k převzetí kterýmkoliv zbývajícím členem týmu.
   * **Úkol 2 (kde byl Spoluřešitel):** Adam je odebrán ze seznamu spoluřešitelů. Hlavní řešitel Milan i ostatní spoluřešitelé pokračují v práci bez přerušení.
2. **Zachování soukromí při běžném odchodu z Nástěnky:**
   * Soukromý osobní pracovní prostor Adama **zůstává soukromý**.
   * Jeho poznámky a soukromý obsah se nestávají týmovým obsahem.
   * Nepředávají se Milanovi, budoucímu řešiteli ani správci.
   * Při běžném odchodu člena z Nástěnky se jeho soukromá data nemažou.
3. **Pravidlo pro trvalý zánik uživatelského účtu:**
   * Pokud v systému nastane **trvalý zánik celého uživatelského účtu** (úplné zrušení účtu uživatele v aplikaci), **smažou se osobní/soukromá data tohoto uživatele** (jeho soukromý osobní prostor).
   * Tato data se nepředávají žádnému jinému členovi.
   * Smazání se týká **výhradně soukromého osobního prostoru** – společný týmový obsah úkolů (názvy, popisy, komentáře, přílohy, historie) tím **není odstraněn** a zůstává plně zachován pro tým na Nástěnce.

**Výsledek**
* Tým nepřichází o rozdělanou práci – úkoly zůstávají na Nástěnce.
* Osobní integrita a soukromí odcházejícího pracovníka jsou stoprocentně zachovány.

**Pravidla a omezení**
* Aktivní úkoly odcházejícího člena nikdy nesmí zmizet.
* Hlavní řešitel odchází → úkol padá do `Nepřiřazeno`.
* Spoluřešitel odchází → úkol zůstává hlavnímu řešiteli.
* **Rozlišení běžného odchodu z Nástěnky a zániku účtu:**
  * **Při běžném odchodu člena z Nástěnky** zůstává jeho osobní prostor soukromý a není převeden na jiného člena (data se nemažou).
  * **Při trvalém zániku uživatelského účtu** se osobní/soukromá data daného uživatele definitivně smažou; týmový obsah úkolů zůstává nedotčen.

---

### Scénář 13: WhatsApp notifikace nového úkolu

**Výchozí situace**
* **Kdo provádí:** Člen týmu (např. Milan).
* **Kontext:** Na Nástěnce jsou registrováni členové týmu: Milan, Adam a Alena. Milan právě zakládá nový úkol.
* **Počáteční stav:** Všichni členové mají v aplikaci nakonfigurované spojení pro doručování notifikací.

**Postup uživatele**
1. Milan ve formuláři vytvoří úkol *„Opravit osvětlení u vchodu – Prodejna“*.
2. Milan ponechá úkol ve stavu `Nepřiřazeno` (nebo jej přiřadí sobě či Adamovi).
3. Milan klikne na tlačítko vytvořit.

**Chování aplikace**
1. Systém vytvoří a uloží úkol.
2. Okamžitě vzniká notifikační událost:
   > **`NOVÝ ÚKOL → WhatsApp → všichni členové dané Nástěnky`**
3. Aplikace odešle notifikační zprávu prostřednictvím WhatsApp:
   * **příjemci:** Milan, Adam, Alena (všichni členové Nástěnky bez výjimky).
   * **obsah notifikace:** základní identifikace nového úkolu (název, oblast, stav přiřazení).

**Výsledek**
* Celý tým v reálném čase ví o novém požadavku, a to i když jsou členové v terénu mimo počítač.
* Adam nebo Alena mohou na zprávu reagovat, otevřít mobilní rozhraní Nástěnky a úkol ihned převzít.

**Pravidla a omezení**
* **Doručení všem:** WhatsApp notifikaci o novém úkolu dostávají **všichni členové dané Nástěnky**, nikoliv pouze případný přiřazený řešitel.
* **Platí i pro Nepřiřazeno:** Zpráva se odesílá vždy, i když úkol nemá žádného řešitele. Rozhodující je členství na Nástěnce.
* **Priorita pro 1. verzi:** V první verzi aplikace je tato událost (vytvoření úkolu) jediným prioritním notifikačním spouštěčem. Ostatní události (změny stavu, komentáře, termíny) se do WhatsApp neodesílají.

---

### Scénář 14: Práce uživatele s více Nástěnkami

**Výchozí situace**
* **Kdo provádí:** Uživatel (např. Milan), který působí ve více týmech.
* **Kontext:** Milan spravuje firemní provoz v prodejně a současně organizuje údržbu rodinného zázemí.
* **Počáteční stav:** Milan je členem dvou samostatných Nástěnek:
  * Nástěnka 1: *„Prodejna & Provoz“* (je zde v roli **Správce**, tým: Milan, Adam, Alena).
  * Nástěnka 2: *„Rodina & Dům“* (je zde v roli **Běžný člen**, tým: Milan, Petra).

**Postup uživatele**
1. Milan v záhlaví aplikace klikne na přepínač Nástěnek.
2. V seznamu vidí obě své Nástěnky s jasným rozlišením názvu.
3. Zvolí Nástěnku *„Prodejna & Provoz“*:
   * Vidí oblasti Prodejny (Sklad, Pokladny).
   * Jako Správce má k dispozici tlačítka pro správu a editaci oblastí.
4. Následně v přepínači zvolí Nástěnku *„Rodina & Dům“*:
   * Rozhraní se přepne do kontextu druhé Nástěnky.
   * Vidí úplně jiné oblasti (Zahrada, Garáž) a jiné úkoly.
   * Protože je zde v roli Běžného člena, tlačítka pro editaci či mazání oblastí k dispozici nemá.
5. Milan otevře sekci *„Moje úkoly“*:
   * Může si zvolit pohled na úkoly z aktuální Nástěnky, případně souhrnný osobní přehled svých povinností.

**Chování aplikace**
1. Aplikace udržuje striktní datové oddělení jednotlivých Nástěnek: úkoly, oblasti, komentáře ani přílohy z Nástěnky 1 se nikdy nezobrazují v Nástěnce 2.
2. Aplikace dynamicky přizpůsobuje oprávnění uživatele podle jeho role v aktivně vybrané Nástěnce (na Nástěnce 1 je Správcem, na Nástěnce 2 je Běžným členem).
3. Členové Nástěnky 2 (Petra) nemají žádný přístup k obsahu Nástěnky 1 a ani nevidí, že Milan je jejím členem.

**Výsledek**
* Milan pohodlně přepíná mezi pracovními a soukromými kontexty v jediné aplikaci.
* Je zajištěna stoprocentní bezpečnostní a organizační izolace mezi jednotlivými týmy a projekty.

**Pravidla a omezení**
* Jeden uživatel může být členem libovolného počtu nezávislých Nástěnek.
* Oprávnění jsou vázána na konkrétní Nástěnku – role Správce na jedné Nástěnce nepřenáší žádná správcovská práva na jinou Nástěnku.

---

## 4. Otevřené otázky a plánovaná budoucí rozšíření

Po zapracování definitivních rozhodnutí (jednoduchý model archivu bez obnovy, smazání osobních dat při zániku účtu, osobní řazení v přehledu Moje úkoly) zůstávají jako náměty pro budoucí verze výhradně tyto oblasti:

1. **Rozšíření notifikačních kanálů a událostí (verze 2+):**
   * Zavedení in-app centra notifikací nebo volitelných e-mailových souhrnů pro další události (změny stavů, termínů, komentáře) po vyhodnocení ostrého provozu 1. verze (kde je prioritou výhradně WhatsApp notifikace při vytvoření úkolu).
2. **Plánovaná klientská a technologická rozšíření (výhledově):**
   * **PWA (Progressive Web App):** Instalace aplikace na plochu mobilního zařízení je plánovaným budoucím rozšířením (není požadavkem 1. verze a není v ní dostupná).
   * **Offline režim:** V první verzi se offline režim vůbec neřeší; zůstává pouze jako případné budoucí technické rozšíření pro práci v místech bez signálu.
