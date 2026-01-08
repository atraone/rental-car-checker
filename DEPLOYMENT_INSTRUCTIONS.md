# Deployment Instructions for Rork Makeup Check Backend

## Overview

This document provides complete instructions for deploying the backend API server to **atra.one** with auto-restart capabilities.

## Architecture

- **Backend Server**: Hono.js running on Bun
- **Port**: 3000 (internal)
- **Public Access**: https://atra.one (via nginx reverse proxy)
- **Auto-Restart**: systemd service
- **Runtime**: Bun (preferred) or Node.js (fallback)

## Endpoints

The backend provides the following API endpoints:

- `POST /api/claude` - Claude AI vision API proxy
- `POST /api/openai` - OpenAI image editing API proxy  
- `POST /api/kie` - Kie.ai Nano Banana Edit API proxy
- `GET /` - Health check endpoint

## Prerequisites on Server

1. **Ubuntu/Debian server** with sudo access
2. **Nginx** installed and configured
3. **SSL certificate** for atra.one (Let's Encrypt recommended)
4. **SSH access** to the server

## Deployment Methods

### Method 1: Automated Deployment Script (Recommended)

The easiest way to deploy is using the provided script:

```bash
./deploy-to-atra.sh
```

This script will:
1. Package the backend files
2. Upload to the server
3. Install Bun if not present
4. Install dependencies
5. Set up systemd service
6. Start the backend with auto-restart

### Method 2: Manual Deployment

If you prefer manual deployment or need to troubleshoot:

#### Step 1: Prepare Files

On your local machine:

```bash
cd /path/to/rork-makeup-check-app
```

Ensure you have:
- `backend/` directory with server code
- `.env` file with API keys
- `package.json` and `bun.lockb`

#### Step 2: Upload to Server

```bash
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ ubuntu@atra.one:/home/ubuntu/rork-makeup-check-app/
```

#### Step 3: Install Bun on Server

SSH into the server:

```bash
ssh ubuntu@atra.one
```

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

#### Step 4: Install Dependencies

```bash
cd /home/ubuntu/rork-makeup-check-app
bun install
```

#### Step 5: Test Backend

Test that the backend runs correctly:

```bash
bun run backend/server.ts
```

You should see:
```
✅ Loaded .env file
🚀 Backend server running on http://0.0.0.0:3000
📝 API keys loaded: Claude ✓ OpenAI ✓
✅ Server started with Bun on 0.0.0.0:3000
```

Press Ctrl+C to stop.

#### Step 6: Set Up Systemd Service

Copy the service file:

```bash
sudo cp rork-makeup-backend.service /etc/systemd/system/
```

Reload systemd and enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rork-makeup-backend
sudo systemctl start rork-makeup-backend
```

Check status:

```bash
sudo systemctl status rork-makeup-backend
```

#### Step 7: Configure Nginx Reverse Proxy

Copy the nginx configuration:

```bash
sudo cp nginx-atra-one.conf /etc/nginx/sites-available/atra-one-backend
sudo ln -s /etc/nginx/sites-available/atra-one-backend /etc/nginx/sites-enabled/
```

**Important**: Update SSL certificate paths in the config if different:

```bash
sudo nano /etc/nginx/sites-available/atra-one-backend
```

Test nginx configuration:

```bash
sudo nginx -t
```

Reload nginx:

```bash
sudo systemctl reload nginx
```

## Environment Variables

The `.env` file must contain:

```env
EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-api03-...
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-...
KIE_API_KEY=...
```

**Security Note**: Never commit `.env` to git. It's already in `.gitignore`.

## Service Management

### Start the service:
```bash
sudo systemctl start rork-makeup-backend
```

### Stop the service:
```bash
sudo systemctl stop rork-makeup-backend
```

### Restart the service:
```bash
sudo systemctl restart rork-makeup-backend
```

### Check status:
```bash
sudo systemctl status rork-makeup-backend
```

### View logs:
```bash
sudo journalctl -u rork-makeup-backend -f
```

Or check the log file:
```bash
sudo tail -f /var/log/rork-makeup-backend.log
```

## Auto-Restart Configuration

The systemd service is configured with:

- **Restart=always**: Automatically restart on failure
- **RestartSec=10**: Wait 10 seconds before restarting
- **After=network.target**: Start after network is available
- **WantedBy=multi-user.target**: Start on boot

This ensures high availability and automatic recovery from crashes.

## Verifying Deployment

### 1. Check Service Status

```bash
sudo systemctl status rork-makeup-backend
```

Should show "active (running)".

### 2. Test Health Check

```bash
curl https://atra.one/
```

Expected response:
```json
{"status":"ok","message":"API is running"}
```

### 3. Test API Endpoints

Test Claude endpoint:
```bash
curl -X POST https://atra.one/api/claude \
  -H "Content-Type: application/json" \
  -d '{"promptText":"Test","imageBase64":"...","imageMime":"image/jpeg"}'
```

## Troubleshooting

### Service won't start

Check logs:
```bash
sudo journalctl -u rork-makeup-backend -n 50
```

Common issues:
- Missing `.env` file
- Wrong file permissions
- Bun not in PATH
- Port 3000 already in use

### Nginx 502 Bad Gateway

Check if backend is running:
```bash
sudo systemctl status rork-makeup-backend
curl http://localhost:3000/
```

Check nginx error logs:
```bash
sudo tail -f /var/log/nginx/atra-one-error.log
```

### API Keys Not Loading

Verify `.env` file exists and has correct format:
```bash
cat /home/ubuntu/rork-makeup-check-app/.env
```

Restart the service after updating:
```bash
sudo systemctl restart rork-makeup-backend
```

## Updating the Backend

To update the backend code:

1. Upload new files:
```bash
rsync -avz --exclude='node_modules' \
  backend/ ubuntu@atra.one:/home/ubuntu/rork-makeup-check-app/backend/
```

2. Restart the service:
```bash
ssh ubuntu@atra.one "sudo systemctl restart rork-makeup-backend"
```

Or use the deployment script:
```bash
./deploy-to-atra.sh
```

## Security Considerations

1. **API Keys**: Keep `.env` secure, never commit to git
2. **HTTPS Only**: Always use HTTPS in production
3. **Firewall**: Only expose port 443 (HTTPS) and 22 (SSH)
4. **Updates**: Keep Bun, Node.js, and system packages updated
5. **Logs**: Rotate logs to prevent disk space issues

## Monitoring

Set up monitoring for:
- Service uptime: `sudo systemctl status rork-makeup-backend`
- Disk space: `df -h`
- Memory usage: `free -h`
- CPU usage: `top` or `htop`
- Logs: `sudo journalctl -u rork-makeup-backend`

Consider setting up automated monitoring with tools like:
- Prometheus + Grafana
- Uptime Robot
- Datadog

## Backup

Important files to backup:
- `/home/ubuntu/rork-makeup-check-app/.env`
- `/home/ubuntu/rork-makeup-check-app/backend/`
- `/etc/systemd/system/rork-makeup-backend.service`
- `/etc/nginx/sites-available/atra-one-backend`

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u rork-makeup-backend -n 100`
2. Verify service status: `sudo systemctl status rork-makeup-backend`
3. Test endpoints manually with curl
4. Review this documentation

## Summary

The backend is now deployed with:
- ✅ Bun runtime for optimal performance
- ✅ Systemd service for auto-restart
- ✅ Nginx reverse proxy for HTTPS
- ✅ Environment variables loaded from .env
- ✅ All API endpoints accessible at https://atra.one

The service will automatically restart on failure and start on system boot.
