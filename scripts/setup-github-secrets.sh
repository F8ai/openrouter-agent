#!/bin/bash

# Setup GitHub Secrets for OpenRouter Agent
# This script helps you add the required secrets to your GitHub repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 GitHub Secrets Setup for OpenRouter Agent${NC}"
echo "================================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"
echo ""

# Repository information
REPO="F8ai/openrouter-agent"
echo -e "${BLUE}Repository: ${REPO}${NC}"
echo ""

# Function to add secret
add_secret() {
    local secret_name=$1
    local secret_description=$2
    local secret_value=""
    
    echo -e "${YELLOW}📝 ${secret_description}${NC}"
    echo -n "Enter value for ${secret_name}: "
    read -s secret_value
    echo ""
    
    if [ -n "$secret_value" ]; then
        echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO"
        echo -e "${GREEN}✅ ${secret_name} added successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ Skipping ${secret_name} (empty value)${NC}"
    fi
    echo ""
}

# Required secrets
echo -e "${BLUE}🔑 Adding Required Secrets${NC}"
echo "================================"

add_secret "OPENROUTER_PROVISIONING_KEY" "OpenRouter Provisioning API Key (sk-or-v1-...)"
add_secret "SUPABASE_URL" "Supabase Project URL (https://your-project.supabase.co)"
add_secret "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key"
add_secret "VERCEL_TOKEN" "Vercel API Token"
add_secret "VERCEL_ORG_ID" "Vercel Organization ID"
add_secret "VERCEL_PROJECT_ID" "Vercel Project ID"

echo -e "${BLUE}🔧 Adding Optional Secrets${NC}"
echo "================================"

add_secret "OPENROUTER_AGENT_API_KEY" "API Key for OpenRouter Agent authentication"
add_secret "VERCEL_DEPLOYMENT_URL" "Vercel Deployment URL for health checks"
add_secret "SLACK_WEBHOOK_URL" "Slack Webhook URL for notifications"
add_secret "DISCORD_WEBHOOK_URL" "Discord Webhook URL for notifications"

echo -e "${GREEN}🎉 GitHub Secrets Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Verify all secrets are set: gh secret list --repo $REPO"
echo "2. Test the workflow manually: gh workflow run 'Rotate OpenRouter Keys and Deploy' --repo $REPO"
echo "3. Check workflow runs: gh run list --repo $REPO"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- Workflow file: .github/workflows/rotate-and-deploy.yml"
echo "- Manual trigger: Go to Actions tab → 'Rotate OpenRouter Keys and Deploy' → 'Run workflow'"
echo "- Schedule: Monthly on the 1st at 2 AM UTC"
echo ""
echo -e "${BLUE}🔍 To view secrets:${NC}"
echo "gh secret list --repo $REPO"
echo ""
echo -e "${BLUE}🗑️ To delete a secret:${NC}"
echo "gh secret delete SECRET_NAME --repo $REPO"
