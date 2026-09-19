---
name: project-documentation
description: >-
  Zajišťuje deterministickou kontrolu a synchronizaci projektové dokumentace
  (docs/080_Co_projekt_umi.md a docs/060_Roadmapa.md) po dokončení implementace.
  Funguje v Git-enabled i Non-Git projektech.
---

# Project Documentation Synchronization Skill

Tato dovednost zajišťuje, že projektová dokumentace přesně odpovídá skutečnému stavu implementace.
Platí zásada: **IMPLEMENTACE > DOKUMENTACE**. Dokumentace nesmí obsahovat domněnky.

## Kdy se dovednost aktivuje
- Po dokončení schválené implementace a ověření testy (v Git projektech po implementačním commitu).
- Na explicitní výzvu uživatele (např. "Zkontroluj dokumentaci projektu", "Aktualizuj dokumentaci").

## Závazná bezpečnostní pravidla
1. NIKDY neprováděj `git push`, `git push origin`, `git push --force` ani vytváření remote tagů/PR.
2. Neměň produkční kód, testy ani konfiguraci.
3. Neupravuj dokumentaci mechanicky, pokud změna neměla vliv na schopnosti nebo roadmapu projektu.
4. V Git projektech smí dokumentační commit obsahovat VÝHRADNĚ soubory z adresáře `docs/`.
5. V Non-Git projektech nespouštěj žádné Git příkazy ani nevytvářej commity.
6. Dokumentační proces je konec cyklu – nesmí sám spustit další dokumentační synchronizaci.

## Postup provedení

### KROK 1 – Zjištění stavu projektu a Git režimu
1. Zjisti, zda projekt používá Git:
   - Ověř existenci složky `.git` v kořeni projektu a dostupnost nástroje `git` v systému.
2. **Pokud je projekt Git-enabled:**
   - Prohlédni skutečný stav Git historie a diffu:
     ```bash
     git log -n 1 --stat
     git show HEAD
     ```
   - Neodvozuj změny pouze z názvu commitu, ale ze skutečně změněných řádků kódu a testů.
3. **Pokud je projekt Non-Git / Git není dostupný:**
   - Posuď změny přímo z kontextu provedené implementace a upravených souborů.

### KROK 2 – Rozhodnutí, zda dokumentaci měnit
Posuď na základě faktů:
A) **Změnila implementace skutečné schopnosti projektu?**
   - Přibyla nová funkce / nástroj / API?
   - Změnilo se chování existující funkce?
   - Došlo ke změně systémových limitů, technologií či podporovaných integrací?
   - *Pokud ANO:* Zvaž aktualizaci `docs/080_Co_projekt_umi.md`.

B) **Změnila implementace roadmapu / dokončenou etapu / plán?**
   - Byla dokončena plánovaná etapa či milník?
   - *Pokud ANO:* Zvaž aktualizaci `docs/060_Roadmapa.md`.

C) **Byla změna pouze interní (refaktoring, oprava překlepu, interní optimalizace, úprava testů bez změny schopností)?**
   - *Pokud ANO:*
     - Dokumentaci NEMĚŇ.
     - Žádný dokumentační commit NEVYTVÁŘEJ.
     - Vrať hlášení: `DOKUMENTACE: AKTUÁLNÍ (implementace neměla dopad na schopnosti ani roadmapu)`.
     - Konec.

### KROK 3 – Aktualizace dokumentace
Pokud je změna potřebná:
- Uprav pouze relevantní dokumentační soubory (`docs/080_Co_projekt_umi.md`, `docs/060_Roadmapa.md`).
- Zachovej existující strukturu a styl dokumentů.
- Nevymýšlej neexistující schopnosti ani nevkládej informace, které nejsou doloženy kódem či testy.

### KROK 4 – Dokončení a uložení (podle Git režimu)

#### Větev A: Git-enabled projekt
1. Zkontroluj diff dokumentace:
   ```bash
   git diff -- docs/
   ```
2. Do stagingu přidej VÝHRADNĚ dokumentační soubory (NIKDY nepoužívej `git add .` ani `git add -A`):
   ```bash
   git add docs/080_Co_projekt_umi.md docs/060_Roadmapa.md
   ```
3. Ověř, že jsou staged pouze dokumentační soubory:
   ```bash
   git diff --cached --name-only
   ```
4. Vytvoř samostatný dokumentační commit:
   ```bash
   git commit -m "docs: update project documentation"
   ```
5. Ověř čistotu pracovního stromu:
   ```bash
   git status
   ```

#### Větev B: Non-Git projekt / Git nedostupný
1. Soubory v `docs/` ulož přímo na disk.
2. Žádné Git příkazy nespouštěj a commity nevytvářej.

### KROK 5 – Push (ABSOLUTNÍ ZÁKAZ)
NIKDY neprováděj `git push`. Push provádí vždy výhradně uživatel ručně z PowerShellu.

### KROK 6 – Výstupní report
V závěrečném reportu uveď:
- Zda byla dokumentace změněna (AKTUALIZOVÁNA / BEZE ZMĚNY)
- Které dokumenty byly změněny
- Režim uložení: Git commit vytvořen / Non-Git uloženo přímo na disk
- Potvrzení: `GIT PUSH: NOT PERFORMED`
