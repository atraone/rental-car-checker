# Backend Setup & Deployment Guide

## Local Development

### Start Backend Server

```bash
# Using Bun (preferred)
bun run backend:dev

# Using Node.js (fallback)
bun run backend:dev:node
```

The server will:
- Listen on `http://0.0.0.0:3000` (accessible from all interfaces)
- Load environment variables from `.env`
- Serve API endpoints:
  - `GET /` - Health check
  - `POST /api/claude` - Claude API proxy
  - `POST /api/openai` - OpenAI API proxy
  - `POST /api/trpc/*` - tRPC endpoints

### Verify Backend

```bash
# Health check
curl http://localhost:3000/

# Should return: {"status":"ok","message":"API is running"}
```

## Environment Variables

### Backend (.env file)

**Production (server-side only):**
- `ANTHROPIC_API_KEY` - Claude API key (preferred)
- `OPENAI_API_KEY` - OpenAI API key (preferred)
- `PORT` - Server port (default: 3000)
- `HOST` - Server hostname (default: 0.0.0.0)

**Development fallback:**
- `EXPO_PUBLIC_CLAUDE_API_KEY` - Fallback for Claude (dev only)
- `EXPO_PUBLIC_OPENAI_API_KEY` - Fallback for OpenAI (dev only)

### Frontend (app.config.js or .env)

**Production:**
- `EXPO_PUBLIC_API_BASE_URL=https://atra.one`

**Development:**
- Web: Auto-detected as `http://localhost:3000`
- Android emulator: Auto-detected as `http://10.0.2.2:3000`
- Physical device: Set `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:3000`

## Mobile App Configuration

The app automatically detects the correct API base URL:

1. **Explicit override** (highest priority): `EXPO_PUBLIC_API_BASE_URL`
2. **Production**: `https://atra.one`
3. **Web dev**: `http://localhost:3000`
4. **Android emulator**: `http://10.0.2.2:3000`
5. **iOS simulator**: `http://localhost:3000`
6. **Physical devices**: `http://localhost:3000` (with warning - use LAN IP)

### Testing on Physical Device

1. Find your machine's LAN IP:
   ```bash
   # Linux/Mac
   ip addr show | grep "inet " | grep -v 127.0.0.1
   
   # Or
   hostname -I
   ```

2. Set environment variable:
   ```bash
   export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
   bunx expo start
   ```

3. Or create `.env.local`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
   ```

## Deployment to atra.one

### Backend Deployment

1. **Set environment variables** on the server:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export OPENAI_API_KEY=sk-proj-...
   export PORT=3000
   export HOST=0.0.0.0
   ```

2. **Start the server**:
   ```bash
   bun run backend/server.ts
   # Or with PM2/systemd for production
   ```

3. **Configure reverse proxy** (nginx/traefik) to route:
   - `https://atra.one/api/*` → `http://localhost:3000/api/*`

### Frontend Build

1. **Set production API URL**:
   ```bash
   export EXPO_PUBLIC_API_BASE_URL=https://atra.one
   ```

2. **Build the app**:
   ```bash
   eas build --platform android
   eas build --platform ios
   ```

## API Endpoints

### POST /api/claude
```json
{
  "promptText": "string",
  "imageBase64": "string (base64, no data URI prefix)",
  "imageMime": "image/jpeg" | "image/png"
}
```

### POST /api/openai
```json
{
  "prompt": "string",
  "imageBase64": "string (base64, no data URI prefix)",
  "imageMime": "image/jpeg" | "image/png",
  "aspectRatio": "1:1" | "16:9" | "9:16"
}
```

### POST /api/trpc/*
tRPC endpoints (if needed)

## Troubleshooting

### Backend won't start
- Check if port 3000 is already in use: `ss -ltnp | grep :3000`
- Verify Bun is installed: `bun --version`
- Check .env file exists and has API keys

### Mobile app can't connect
- **Emulator**: Should auto-detect `10.0.2.2:3000`
- **Physical device**: Must set `EXPO_PUBLIC_API_BASE_URL` to your LAN IP
- **Production**: Must set `EXPO_PUBLIC_API_BASE_URL=https://atra.one`

### CORS errors
- Backend CORS is configured to allow all origins (`origin: "*"`)
- If issues persist, check backend logs

