# Quick Deployment Guide

## Prerequisites

Ensure you have SSH access to atra.one:
```bash
ssh ubuntu@atra.one
```

## Option 1: Automated Deployment (Recommended)

Run the deployment script from your local machine:

```bash
cd /path/to/rork-makeup-check-app
./deploy-to-atra.sh
```

This handles everything automatically.

## Option 2: Manual Deployment

### On atra.one server:

```bash
# 1. Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Create project directory
mkdir -p /home/ubuntu/rork-makeup-check-app
cd /home/ubuntu/rork-makeup-check-app

# 3. Upload files (from local machine)
# rsync -avz backend/ .env package.json ubuntu@atra.one:/home/ubuntu/rork-makeup-check-app/

# 4. Install dependencies
bun install

# 5. Test the server
bun run backend/server.ts
# Press Ctrl+C after verifying it works

# 6. Set up systemd service
sudo cp rork-makeup-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rork-makeup-backend
sudo systemctl start rork-makeup-backend

# 7. Check status
sudo systemctl status rork-makeup-backend

# 8. Configure nginx (if not already done)
sudo cp nginx-atra-one.conf /etc/nginx/sites-available/atra-one-backend
sudo ln -s /etc/nginx/sites-available/atra-one-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Verify Deployment

```bash
# Check service
sudo systemctl status rork-makeup-backend

# Check logs
sudo journalctl -u rork-makeup-backend -f

# Test endpoint
curl https://atra.one/
```

## Common Commands

```bash
# Restart service
sudo systemctl restart rork-makeup-backend

# View logs
sudo journalctl -u rork-makeup-backend -n 50

# Stop service
sudo systemctl stop rork-makeup-backend

# Start service
sudo systemctl start rork-makeup-backend
```

## Endpoints

- `GET https://atra.one/` - Health check
- `POST https://atra.one/api/claude` - Claude AI
- `POST https://atra.one/api/openai` - OpenAI
- `POST https://atra.one/api/kie` - Kie.ai

## Files to Upload

Required files on server:
- `backend/` - Backend code
- `.env` - API keys (NEVER commit to git)
- `package.json` - Dependencies
- `rork-makeup-backend.service` - Systemd service
- `nginx-atra-one.conf` - Nginx config

## Troubleshooting

**Service won't start:**
```bash
sudo journalctl -u rork-makeup-backend -n 50
```

**502 Bad Gateway:**
```bash
sudo systemctl status rork-makeup-backend
curl http://localhost:3000/
```

**Update backend code:**
```bash
# Upload new files
rsync -avz backend/ ubuntu@atra.one:/home/ubuntu/rork-makeup-check-app/backend/
# Restart
ssh ubuntu@atra.one "sudo systemctl restart rork-makeup-backend"
```
