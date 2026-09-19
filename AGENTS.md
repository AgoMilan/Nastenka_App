# Pravidla vývoje projektu pro Antigravity

## Závazné procesní pravidlo: Synchronizace projektové dokumentace
1. Po každé schválené implementaci a jejím ověření testy VŽDY proveď kontrolu projektové dokumentace.
2. Ke kontrole dokumentace VŽDY použij projektový skill: `.agents/skills/project-documentation/SKILL.md`.
3. Posuď skutečný dopad implementace na:
   - `docs/080_Co_projekt_umi.md`
   - `docs/060_Roadmapa.md`
4. Dokumentaci uprav pouze tehdy, pokud implementace skutečně změnila schopnosti projektu nebo stav roadmapy.
5. **Režim podle dostupnosti a použití Gitu:**
   - **Pokud projekt používá Git:**
     a) Po implementačním Git commitu proveď kontrolu dokumentace.
     b) Pokud dokumentace vyžaduje změnu, vytvoř SAMOSTATNÝ Git commit obsahující VÝHRADNĚ soubory z adresáře `docs/`.
     c) NIKDY neprováděj `git push`. Push provádí výhradně uživatel ručně z PowerShellu.
     d) Po vytvoření dokumentačního commitu je proces dokončen – nespouštěj další dokumentační cyklus.
   - **Pokud projekt Git nepoužívá nebo Git není dostupný:**
     a) Zkontroluj a přímo aktualizuj příslušné soubory v `docs/`.
     b) Žádné Git commity nevytvářej ani nespouštěj Git příkazy.
     c) Po aktualizaci souborů je proces dokončen.
