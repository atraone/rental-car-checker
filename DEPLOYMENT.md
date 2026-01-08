# 🚀 Deployment Guide: Backend Server Setup

## 📁 .ENV File Location & Structure

### **Local Development (Your Machine)**
```
Location: /home/verycosmic/ReactNatives/rork-makeup-check-app/.env
Status: ✅ EXISTS (in project root)
Git: ❌ IGNORED (.gitignore line 43) - NEVER COMMITTED
```

**Contents:**
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
KIE_API_KEY=your_kie_api_key_here
PORT=3000
HOST=0.0.0.0
```

### **Production Server (atra.one)**
```
Location: /path/to/deployed/backend/.env (on server filesystem)
Status: ⚠️  MUST BE CREATED MANUALLY ON SERVER
Git: ❌ NEVER IN REPOSITORY
```

**Same structure as local**, but created directly on the production server.

---

## 🖥️ What Needs to Run on the Web Server

### **REQUIRED: Backend Server Only**

The app uses **simple REST endpoints**, not tRPC. You only need:

1. **Backend Server** (`backend/server.ts`)
   - Runs on port 3000 (or `process.env.PORT`)
   - Listens on `0.0.0.0` (all interfaces)
   - Provides 3 endpoints:
     - `POST /api/claude` - Claude API proxy
     - `POST /api/kie` - Kie.ai API proxy
     - `POST /api/openai` - OpenAI API proxy (commented out, not used)

2. **Environment Variables** (`.env` file on server)
   - API keys for Claude, OpenAI, Kie.ai
   - PORT and HOST settings

3. **Runtime**: Bun OR Node.js
   - Bun (preferred): `bun run backend/server.ts`
   - Node.js (fallback): `npx tsx backend/server.ts`

---

## ❌ What Does NOT Need to Be Done/Used

### **1. tRPC - NOT USED** ❌
- **Status**: Leftover code, completely unused
- **Location**: `backend/trpc/` folder, `backend/hono.ts` lines 62-69
- **Why**: Frontend uses simple `fetch()` calls, not tRPC client
- **Action**: Can be safely deleted (but harmless if left)

**Evidence:**
- Frontend (`app/`, `services/`) has **zero** tRPC imports
- Services use `fetch()` directly: `services/claude.ts`, `services/kie.ts`
- No `@trpc/client` usage in frontend code
- tRPC endpoint `/api/trpc/*` exists but nothing calls it

### **2. Expo Router API Routes - NOT USED** ❌
- **Status**: Deleted/abandoned
- **Why**: Hono backend on separate port is used instead
- **Action**: Already removed

### **3. Rork SDK - NOT USED** ❌
- **Status**: Dependency still in `package.json` but unused
- **Why**: Replaced with direct API calls
- **Action**: Can be removed from dependencies (but harmless)

### **4. Frontend Environment Variables - NOT NEEDED** ❌
- **Status**: Frontend doesn't need API keys
- **Why**: All API calls go through backend proxy
- **Action**: Only backend needs `.env` file

---

## 📋 Step-by-Step Server Deployment

### **Step 1: Deploy Backend Code to Server**

```bash
# On your server (atra.one)
cd /path/to/deployment
git clone <your-repo-url>
cd rork-makeup-check-app
```

### **Step 2: Install Dependencies**

```bash
# Option A: Using Bun (preferred)
bun install

# Option B: Using Node.js
npm install
npm install -g @hono/node-server  # If using Node fallback
```

### **Step 3: Create .env File on Server**

```bash
# On server, create .env in project root
nano .env
# Paste your API keys (same as local)
```

**Important**: Never commit `.env` to git. It's already in `.gitignore`.

### **Step 4: Start Backend Server**

```bash
# Option A: Bun
bun run backend/server.ts

# Option B: Node.js
npx tsx backend/server.ts

# Option C: With PM2 (production process manager)
pm2 start backend/server.ts --name "makeup-backend" --interpreter bun
# OR
pm2 start "npx tsx backend/server.ts" --name "makeup-backend"
```

### **Step 5: Configure Reverse Proxy (Nginx/Apache)**

If using a reverse proxy (recommended for production):

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name atra.one;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **Step 6: Test Endpoints**

```bash
# Test Claude endpoint
curl -X POST https://atra.one/api/claude \
  -H "Content-Type: application/json" \
  -d '{"promptText":"test","imageBase64":"...","imageMime":"image/jpeg"}'

# Test Kie endpoint
curl -X POST https://atra.one/api/kie \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","imageBase64":"...","imageMime":"image/jpeg"}'
```

---

## 🔍 How the App Calls the Server

### **Frontend Flow:**

1. **User takes photo** → `app/index.tsx`
2. **Analysis request** → `services/claude.ts` → `fetch('https://atra.one/api/claude')`
3. **Image editing** → `services/kie.ts` → `fetch('https://atra.one/api/kie')`
4. **Backend proxies** → Calls actual APIs (Claude, Kie.ai) with keys
5. **Response** → Returns to frontend

### **API Base URL Detection:**

`lib/apiBaseUrl.ts` automatically:
- **Production**: Uses `https://atra.one` (when `NODE_ENV === 'production'`)
- **Development**: Uses `http://localhost:3000` (when `__DEV__ === true`)

**No configuration needed** - it auto-detects!

---

## ✅ Summary: What Actually Matters

### **MUST HAVE:**
- ✅ Backend server running (`backend/server.ts`)
- ✅ `.env` file on server with API keys
- ✅ Server accessible at `https://atra.one:3000` (or via reverse proxy)
- ✅ Bun or Node.js runtime

### **CAN IGNORE/DELETE:**
- ❌ tRPC code (`backend/trpc/`) - unused
- ❌ Rork SDK dependency - unused
- ❌ Frontend `.env` - not needed
- ❌ Expo Router API routes - already removed

### **MINIMAL DEPLOYMENT:**
Just deploy `backend/` folder + `.env` file. That's it! 🎉




