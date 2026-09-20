# Implementation Plan: STEP 17.7A – Better Auth Instalace a Serverová Konfigurace

## 1. Analýza balíčku Better Auth a adaptérů (Bod A)

* **Nainstalovaná verze:** `better-auth@1.7.5`.
* **Dostupný Drizzle adaptér:** Balíček `better-auth` vnitřně obsahuje `@better-auth/drizzle-adapter@1.7.5` a poskytuje přímý oficiální import:
  ```ts
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  ```
* **Rozhodnutí o závislosti:** Použijeme standardní import `better-auth/adapters/drizzle`, což zamezuje verzovacím konfliktům a duplicitám v `node_modules`.

---

## 2. Kompatibilita a mapování na existující model `users` (Bod B)

### 2.1 Porovnání modelů
* **Stávající tabulka `users` (`database/schema/users.ts`):**
  - `id`: `uuid` (`gen_random_uuid()`)
  - `name`: `varchar(255)`
  - `email`: `varchar(255)` (`UNIQUE`)
  - `global_role`: `enum('global_role', ['USER', 'ADMIN'])` (výchozí `'USER'`)
  - `is_active`: `boolean` (výchozí `true`)
  - `created_at`: `timestamp with time zone` (výchozí `now()`)
  - `updated_at`: `timestamp with time zone` (výchozí `now()`)
  - `deleted_at`: `timestamp with time zone` (nullable, soft-delete)

* **Co očekává Better Auth pro entitu `user`:**
  - `id`: `string` / `uuid` (podporuje UUID v PostgreSQL přes adaptér i nativně)
  - `name`: `string`
  - `email`: `string` (`unique`)
  - `emailVerified`: `boolean` (povinné pole v Better Auth core modelu)
  - `image`: `string | null` (volitelné profilové foto)
  - `createdAt`: `timestamp / date`
  - `updatedAt`: `timestamp / date`

### 2.2 Strategie napojení a Server-Owned User Fields
1. **Identifikátor (`id`):** Model v aplikaci používá `uuid`. Better Auth plně podporuje UUID jako primární klíče v PostgreSQL. Pro generování nových ID použijeme nativní generování nebo `advanced.database.generateId: () => crypto.randomUUID()`.
2. **Pojmenování tabulky a polí:**
   - Drizzle adaptér podporuje `usePlural: true` (tabulky se jmenují `users`, `sessions`, `accounts`, `verifications`).
   - Drizzle schema mapuje camelCase vlastnosti na snake_case sloupce v DB (`createdAt` ➔ `created_at`, `emailVerified` ➔ `email_verified`).
3. **Ochrana server-owned polí (`globalRole`, `isActive`, `deletedAt`):**
   - Všechna tato pole patří do doménové správy a **nesmí být přístupná klientskému zápisu ani čtení** přes auth API.
   - V Better Auth konfiguraci budou v `user.additionalFields` nastavena s restrikcí:
     * `globalRole`: `{ type: "string", input: false, returned: false }`
     * `isActive`: `{ type: "boolean", input: false, returned: false }`
     * `deletedAt`: `{ type: "date", input: false, returned: false }`
   - **Důvody pro toto striktní nastavení:**
     * Klient nesmí mít možnost ovlivnit ani nastavit svoji roli `globalRole` (ochrana před eskalací privilegií na `ADMIN`).
     * Klient nesmí modifikovat stav `isActive` (aktivace/deaktivace účtu je výhradně doménová/administrátorská operace).
     * Klient nesmí ovlivnit stav `deletedAt` (ochrana soft-delete mechanismu).
     * `returned: false` zabraňuje expozici interních stavových a autorizačních polí v klientských DTO / session odpovědích; k těmto informacím má přístup výhradně server při sestavování `ActorContext`.
4. **Rozšíření modelu `users`:**
   - Pro plnou funkčnost Better Auth bude v budoucnu (STEP 17.7B / migrace) nutné do tabulky `users` doplnit:
     * `email_verified` (`boolean`, default `false`, `notNull`)
     * `image` (`text`, nullable)

---

## 3. Požadavky na Auth Core Schema (Bod C)

Pro plnou funkčnost vyžaduje Better Auth 4 tabulky:
1. `users` – stávající tabulka, do které bude třeba v budoucím kroku přidat `email_verified` a `image`.
2. `sessions` – nová tabulka: `id`, `expires_at`, `token`, `created_at`, `updated_at`, `ip_address`, `user_agent`, `user_id` (FK na `users.id` ON DELETE CASCADE).
3. `accounts` – nová tabulka: `id`, `account_id`, `provider_id`, `user_id` (FK na `users.id` ON DELETE CASCADE), `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password` (hash hesla), `created_at`, `updated_at`.
4. `verifications` – nová tabulka: `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`.

---

## 4. Dodržení pravidla: Žádná migrace v 17.7A (Bod D)

* V tomto kroku (17.7A) **nebudeme modifikovat `database/schema/`**, ani **nebudeme spouštět `drizzle-kit generate`**, ani **nebudeme měnit existující historii migrací**.
* **Důležité přiznání a závěr:** Bez fyzické existence tabulek `sessions`, `accounts`, `verifications` a rozšíření `users` v databázi **nelze Better Auth za běhu reálně provozovat pro autentizační operace** (přihlášení, registrace, čtení session). Dotazy na chybějící tabulky by v databázi skončily chybou.
* Cílem 17.7A je připravit čistou architektonickou kostru v `infrastructure/auth/`, typy, tovární funkci konfigurace a integraci prostředí. Skutečné zavedení schématu a migrací proběhne až v návazném kroku 17.7B.

---

## 5. Auth Route: `app/api/auth/[...all]/route.ts` (Bod E)

* **Rozhodnutí: Odložit na krok 17.7B.**
* **Důvod:** Vytvoření aktivního HTTP handleru v `app/api/auth/[...all]/route.ts`, který by směroval na neúplné databázové schéma, by vystavilo nefunkční endpoint a mohlo způsobit nežádoucí chování při sestavení aplikace (`next build`).
* V 17.7A připravíme pouze interní modul `infrastructure/auth/`, exportující konfiguraci a instanci připravenou k montáži do Next.js handleru v 17.7B.

---

## 6. E-mail a heslo (`emailAndPassword`) (Bod F)

* **Rozhodnutí: NEAKTIVOVAT v STEP 17.7A.**
* **Důvod:** Funkce `emailAndPassword: { enabled: true }` závisí na přítomnosti tabulky `accounts` (sloupec `password`) a tabulky `verifications`. Její aktivace bez existence těchto tabulek by neodpovídala skutečnému životnímu cyklu aplikace a vytvářela by klamný dojem funkčnosti.
* Konfigurace `emailAndPassword` bude zapnuta až v kroku 17.7B společně s vytvořením příslušného Drizzle schématu a migrace.

---

## 7. Model relací (Session Model) (Bod G)

* Plně respektujeme schválenou architekturu (ADR-008):
  * **Server-side session** v PostgreSQL tabulce `sessions`.
  * **Opaque session token** s vysokou kryptografickou entropií.
  * **Bezpečné cookies**: `httpOnly: true`, `sameSite: "lax"`, `secure: true` (v produkčním prostředí).
* Tyto parametry jsou v souladu s architekturou Nástěnky a odpovídají standardním bezpečnostním mechanismům Better Auth 1.x.

---

## 8. Bezpečnost buildu (Build Safety) (Bod H)

* `next build` provádí statickou analýzu a import modulů bez běžící databáze PostgreSQL a bez nutnosti nastavení produkčních tajných klíčů v prostředí.
* Abychom garantovali, že build neselže:
  * Inicializace Better Auth bude zabalena v líné funkci `getAuth()`.
  * Objekt `auth` bude exportován jako bezpečný Proxy, který odkládá čtení `getEnv()` a `getDb()` až na okamžik skutečného volání za běhu (runtime).
  * Build a kontrola typů proběhnou bez jakýchkoliv požadavků na síťové či databázové spojení.

---

## 9. Rozdělení fází: 17.7A vs 17.7B vs Schéma/Migrace (Bod I)

| Komponenta / Úkol | 17.7A (Tento krok) | 17.7B (Navazující krok) |
|---|---|---|
| Instalace `better-auth` | **ANO** (`better-auth@1.7.5`) | — |
| Serverová konfigurace (`infrastructure/auth/better-auth.ts`) | **ANO** (základní instance, lazy init, integrace `getEnv()`) | Rozšíření o `emailAndPassword` |
| Ochrana polí (`globalRole`, `isActive`, `deletedAt`) | **ANO** (`input: false`, `returned: false`) | — |
| `emailAndPassword: { enabled: true }` | **NE** (neaktivováno) | **ANO** (aktivace po migraci) |
| Úprava Drizzle schématu (`users`, `sessions`, `accounts`, `verifications`) | **NE** | **ANO** |
| Databázová migrace (`drizzle-kit generate`) | **NE** | **ANO** |
| Next.js Route Handler `app/api/auth/[...all]/route.ts` | **NE** (odloženo) | **ANO** |
| Session lifecycle & ActorContext | **NE** | **ANO** |
| Unit testy pro serverovou konfiguraci | **ANO** (`tests/unit/auth.test.ts`) | Integrační testy auth flow |

---

## 10. Navržené změny souborů v 17.7A

### Nové soubory:
- `infrastructure/auth/better-auth.ts` – základní konfigurace Better Auth (lazy inicializace, `drizzleAdapter`, napojení na `getEnv()`, konfigurace `user.additionalFields`).
- `infrastructure/auth/index.ts` – exporty `getAuth()`, `auth`, a typů.
- `tests/unit/auth.test.ts` – unit testy pro ověření líné inicializace, konfigurace a bezpečnosti secretů.

### Upravené soubory:
- `package.json` – přidání `better-auth` do závislostí.
- `package-lock.json` – aktualizace lockfile.

---

## 11. Ověřovací plán pro 17.7A

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `node -C react-server --test tests/unit/*.test.ts`
6. `git diff --check`
7. Git commit: `chore: add better auth server foundation`
