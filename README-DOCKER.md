# Docker Production Deployment Guide

M & A Creative Arena features a production-grade, multi-stage Docker build utilizing **Next.js 16 Standalone Output** on **Alpine Linux (Node.js 22 LTS)**.

- 📦 **Image Size**: **~83 MB** (content size)
- 🔒 **Security**: Runs under an unprivileged non-root system user (`nextjs:nodejs`, UID `1001`)
- 💾 **Persistence**: Mountable volume for the built-in local database (`.local-db`)
- 🩺 **Health Monitoring**: Integrated container healthcheck querying `/api/health`

---

## 1. Multi-Stage Docker Architecture

```mermaid
flowchart TD
    subgraph Stage1["1. Base (node:22-alpine)"]
        Base["Install libc6-compat & setup /app"]
    end

    subgraph Stage2["2. Deps (base)"]
        Manifests["Copy package.json & package-lock.json"]
        NpmCi["Run npm ci (clean install)"]
        Manifests --> NpmCi
    end

    subgraph Stage3["3. Builder (base)"]
        Src["Copy source code & node_modules"]
        Build["npm run build\n(Standalone Output Mode)"]
        Src --> Build
    end

    subgraph Stage4["4. Runner (base) - ~83 MB"]
        User["Create nextjs:1001 user"]
        CopyStatic["Copy public/ & .next/static"]
        CopyStandalone["Copy .next/standalone/"]
        LocalDb["Ensure /app/.local-db is writable"]
        Health["HEALTHCHECK /api/health"]
        Start["CMD node server.js"]
        User --> CopyStatic --> CopyStandalone --> LocalDb --> Health --> Start
    end

    Base --> Stage2 --> Stage3 --> Stage4
```

---

## 2. Quick Start: Docker Compose (Recommended)

Docker Compose configures persistent volume storage, loads environment variables from `.env`, forwards port 3000, and enables health monitoring automatically.

### Step 1: Prepare Environment
```bash
# Copy template and add your API keys
cp .env.example .env
```

### Step 2: Build and Run
```bash
docker compose up -d --build
```

### Step 3: Verify Container Health
```bash
docker compose ps
docker compose logs -f
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 4: Stop Container
```bash
docker compose down
```

---

## 3. Manual Docker CLI Deployment

### Build the Docker Image
```bash
docker build -t creative-arena:latest .
```

### Run in Local JSON Database Mode
Uses the built-in atomic file database with a persistent Docker volume:

```bash
# Create persistent volume
docker volume create creative-arena-data

# Run container
docker run -d \
  --name creative-arena-app \
  -p 3000:3000 \
  --env-file .env \
  -v creative-arena-data:/app/.local-db \
  creative-arena:latest
```

### Run with Cloud PostgreSQL (Neon / Supabase)
If connecting to an external database, point `DATABASE_URL` to your remote PostgreSQL instance:

```bash
docker run -d \
  --name creative-arena-app \
  -p 3000:3000 \
  -e LOCAL_JSON_DB=false \
  -e DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require" \
  -e OPENROUTER_API_KEY="your-openrouter-key" \
  -e AGNES_API_KEY="your-agnes-key" \
  creative-arena:latest
```

---

## 4. Environment Variables in Container

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port on which the standalone server listens. |
| `HOSTNAME` | `0.0.0.0` | Network binding interface. |
| `NODE_ENV` | `production` | Enables production optimizations in Next.js. |
| `LOCAL_JSON_DB` | `true` | Enables atomic local JSON file storage (`/app/.local-db`). |
| `DATABASE_URL` | *None* | Connection string for Neon / PostgreSQL. |
| `OPENROUTER_API_KEY` | *None* | Key for OpenRouter copywriting & prompt intelligence. |
| `OPENROUTER_MODEL` | `openai/gpt-4o` | Text generation model slug. |
| `AGNES_API_KEY` | *None* | Key for Agnes AI architectural image generation. |
| `AGNES_BASE_URL` | `https://apihub.agnes-ai.com/v1` | Agnes API endpoint URL. |
| `AGNES_MODEL` | `agnes-image-2.5-flash` | Agnes AI model variant. |

---

## 5. Maintenance & Diagnostics Commands

### Check Live Healthcheck Status
```bash
docker inspect --format='{{json .State.Health}}' creative-arena-app
```

### Direct HTTP Health Probe
```bash
# Inside container
docker exec creative-arena-app wget -qO- http://localhost:3000/api/health

# From host (PowerShell)
Invoke-RestMethod -Uri http://localhost:3000/api/health
```

### Backup Persistent Local Database
```bash
# Copy database.json from container to host
docker cp creative-arena-app:/app/.local-db/database.json ./backup-database.json
```

### Restore Database Backup
```bash
docker cp ./backup-database.json creative-arena-app:/app/.local-db/database.json
docker restart creative-arena-app
```
