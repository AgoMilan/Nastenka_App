# Nasazení aplikace Nástěnka na Synology NAS

Tento dokument popisuje provozní architekturu, konfiguraci a přesný postup nasazení aplikace **Nástěnka** do produkčního běhu v Dockeru na Synology NAS (DS725+).

---

## 1. Architektura prostředí

Systém důsledně rozlišuje vývojové a produkční prostředí:

### Vývojové prostředí (Development)
```text
Windows PC (C:\Users\Milan\Projekty\Nastenka)
   │ (npm run dev na http://localhost:3000)
   ▼
PostgreSQL na Synology NAS (192.168.0.250:5439)
```

### Produkční prostředí (Production / Test)
```text
LAN Klient (PC / Mobil / Tablet)
   │
   ▼ http://192.168.0.250:3000
Synology NAS (DS725+)
   │
   ▼ Container Manager / Docker
Nástěnka kontejner (Alpine Node.js 20, non-root nextjs:1001)
   │ (DATABASE_URL na port 5439)
   ▼
Existující PostgreSQL server na NAS (nesmí se měnit ani přesouvat)
```

> [!IMPORTANT]
> Nástěnka **nevytváří ani nepřidává vlastní PostgreSQL kontejner**. Využívá již běžící, existující PostgreSQL databázi na NAS společně s aplikací Pronájmy (port `5439`).

---

## 2. Příprava na NAS (`/docker/App_nastenka`)

1. Na Synology NAS v Container Manageru / File Station vytvořte adresář:
   ```text
   /docker/App_nastenka
   ```
2. Do tohoto adresáře se nakopírují soubory:
   - `Dockerfile`
   - `docker-compose.yml` (obsahuje `build: context: . dockerfile: Dockerfile` pro sestavení přímo na NAS)
   - `.dockerignore`
   - `package.json`
   - `package-lock.json`
   - `next.config.mjs`
   - `tsconfig.json`
   - `postcss.config.mjs`
   - adresáře `app/`, `components/`, `modules/`, `infrastructure/`, `database/`, `shared/`, `public/`
   - soubor `.env` (vytvořený na základě šablony `.env.production.example`)

3. **Konfigurace `.env` na NAS:**
   ```ini
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@192.168.0.250:5439/<DB_NAME>
   BETTER_AUTH_SECRET=<silny_nahodny_klic_min_32_znaku>
   BETTER_AUTH_URL=http://192.168.0.250:3000
   BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.0.250:3000
   ```
   > [!CAUTION]
   > Soubor `.env` obsahuje reálná přístupová hesla a **nesmí být nikdy verzován v Gitu ani vložen do Docker image**.
   > Na NAS nastavte práva čtení pouze pro vlastníka (`chmod 600 .env`).

---

## 3. Postup bezpečných databázových migrací

Produkční kontejner **nikdy nespouští migrace automaticky při každém startu** a nepoužívá destruktivní `db:push`.

Správný postup nasazení a migrací:

```text
Docker image / kód připraven
        ↓
Kontrola verzí migrací (drizzle-kit check)
        ↓
Explicitní spuštění Drizzle migrate
        ↓
Start / restart aplikace v Container Manageru
```

### Spuštění migrací z Windows PC (Doporučený způsob)
Z Windows PC, které má síťový přístup k PostgreSQL na NAS:
1. Vytvořte lokální soubor `.env.production` s produkční `DATABASE_URL` (tento soubor je v `.gitignore`).
2. Spusťte:
   ```powershell
   node --env-file=.env.production ./node_modules/drizzle-kit/bin.cjs migrate
   ```
   Hesla se nepředávají jako parametry příkazového řádku a neukládají se do historie.

### Spuštění migrací na NAS
Případně lze migrace provést v kontejneru jednorázovým příkazem před spuštěním:
```bash
docker compose run --rm nastenka npx drizzle-kit migrate
```

---

## 4. Spuštění v Synology Container Manager

V Synology Container Manager (DSM 7.2+):
1. **Projekty (Projects)** → **Vytvořit (Create)**.
2. Zadejte název projektu: `nastenka`.
3. Nastavte cestu k adresáři: `/docker/App_nastenka`.
4. Zdroj: Použít existující `docker-compose.yml`.
5. Dokončete průvodce a spusťte projekt.

### Provozní parametry kontejneru:
- **Port:** `3000:3000` (kontejner i NAS host)
- **Restart policy:** `unless-stopped`
- **Uživatel:** `nextjs` (UID 1001, GID 1001) – bezpečnostní ochrana
- **Healthcheck:** Liveness probe každých 30s na `http://127.0.0.1:3000/api/health`
- **Logy:** Rotace logů (max 10 MB, max 3 soubory)

Aplikace je následně dostupná v síti LAN na adrese:
```text
http://192.168.0.250:3000
```
