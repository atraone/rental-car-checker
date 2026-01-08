#!/bin/bash
set -e

echo "🚀 Deploying Rork Makeup Check Backend to atra.one"

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="atra.one"
DEPLOY_PATH="/home/ubuntu/rork-makeup-check-app"
SERVICE_NAME="rork-makeup-backend"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Step 1: Preparing deployment package...${NC}"
cd "$(dirname "$0")"
mkdir -p deploy-package
rsync -av --exclude='node_modules' --exclude='deploy-package' --exclude='.git' \
  backend/ deploy-package/backend/
cp .env deploy-package/.env
cp package.json deploy-package/
cp bun.lockb deploy-package/ 2>/dev/null || true
cp rork-makeup-backend.service deploy-package/

echo -e "${BLUE}📤 Step 2: Uploading to server...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${DEPLOY_PATH}"
rsync -avz --delete deploy-package/ ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/

echo -e "${BLUE}🔧 Step 3: Installing Bun on server (if not present)...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
if ! command -v bun &> /dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
else
    echo "Bun already installed"
fi
ENDSSH

echo -e "${BLUE}📦 Step 4: Installing dependencies on server...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
cd ${DEPLOY_PATH}
export PATH="\$HOME/.bun/bin:\$PATH"
bun install
ENDSSH

echo -e "${BLUE}⚙️  Step 5: Setting up systemd service...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
# Update paths in service file for production
sed -i "s|/home/ubuntu/rork-makeup-check-app|${DEPLOY_PATH}|g" ${DEPLOY_PATH}/rork-makeup-backend.service
sed -i "s|User=ubuntu|User=${SERVER_USER}|g" ${DEPLOY_PATH}/rork-makeup-backend.service

# Install service
sudo cp ${DEPLOY_PATH}/rork-makeup-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}
ENDSSH

echo -e "${BLUE}✅ Step 6: Verifying deployment...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
sleep 3
sudo systemctl status ${SERVICE_NAME} --no-pager || true
echo ""
echo "📊 Recent logs:"
sudo journalctl -u ${SERVICE_NAME} -n 20 --no-pager
ENDSSH

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}Backend is running on https://atra.one${NC}"
echo -e "${GREEN}Endpoints available:${NC}"
echo "  - POST https://atra.one/api/claude"
echo "  - POST https://atra.one/api/openai"
echo "  - POST https://atra.one/api/kie"
echo "  - GET  https://atra.one/ (health check)"

# Cleanup
rm -rf deploy-package
