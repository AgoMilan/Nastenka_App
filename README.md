# Nástěnka

Jednoduchá týmová aplikace pro organizaci práce.

## Stav projektu

**Fáze:** Bootstrap projektu (Step 17.1)

Architektonická dokumentace je k dispozici ve složce `docs/`.

## Dokumentace

Viz `docs/050_Architektura.md` (verze 1.4.0) pro kompletní architektonické rozhodnutí.

## Struktura projektu

```text
app/           – Next.js App Router (presentation & routing)
modules/       – Doménové a aplikační moduly
infrastructure/– Technická infrastruktura a adaptéry
shared/        – Sdílené abstrakce (typy, chyby, interfaces)
database/      – Drizzle ORM schémata a migrace
tests/         – Testovací suita (Vitest + Playwright)
public/        – Statické soubory
docs/          – Projektová dokumentace
```
