# OpenRouter Agent Setup Guide

This guide will help you set up the OpenRouter Agent with automated key rotation and Vercel deployment.

## 🚀 Quick Setup

### 1. GitHub Secrets Configuration

The OpenRouter provisioning key has been added to GitHub Secrets. You need to add the remaining secrets:

#### Required Secrets:
```bash
# Run the setup script
./scripts/setup-github-secrets.sh
```

Or add manually via GitHub CLI:
```bash
# Supabase Configuration
gh secret set SUPABASE_URL --repo F8ai/openrouter-agent
gh secret set SUPABASE_SERVICE_ROLE_KEY --repo F8ai/openrouter-agent

# Vercel Configuration
gh secret set VERCEL_TOKEN --repo F8ai/openrouter-agent
gh secret set VERCEL_ORG_ID --repo F8ai/openrouter-agent
gh secret set VERCEL_PROJECT_ID --repo F8ai/openrouter-agent
```

#### Optional Secrets:
```bash
# API Authentication
gh secret set OPENROUTER_AGENT_API_KEY --repo F8ai/openrouter-agent

# Notifications
gh secret set SLACK_WEBHOOK_URL --repo F8ai/openrouter-agent
gh secret set DISCORD_WEBHOOK_URL --repo F8ai/openrouter-agent

# Health Checks
gh secret set VERCEL_DEPLOYMENT_URL --repo F8ai/openrouter-agent
```

### 2. Database Setup

1. **Create Supabase Project** (if not already done)
2. **Run the database schema**:
   ```sql
   -- Copy and paste the contents of schema/supabase-schema.sql
   -- into your Supabase SQL Editor and run it
   ```

### 3. Vercel Deployment

1. **Connect to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Get Vercel IDs**:
   ```bash
   vercel project ls
   vercel team ls
   ```

3. **Add to GitHub Secrets**:
   ```bash
   gh secret set VERCEL_ORG_ID --repo F8ai/openrouter-agent
   gh secret set VERCEL_PROJECT_ID --repo F8ai/openrouter-agent
   ```

## 🔄 Automated Workflow

### Schedule
- **Automatic**: Monthly on the 1st at 2 AM UTC
- **Manual**: Trigger via GitHub Actions tab

### What it does:
1. **Rotates all user API keys** using OpenRouter Provisioning API
2. **Updates Supabase** with new key information
3. **Deploys to Vercel** with updated configuration
4. **Verifies deployment** with health checks
5. **Sends notifications** (if configured)

### Manual Trigger:
1. Go to [GitHub Actions](https://github.com/F8ai/openrouter-agent/actions)
2. Select "Rotate OpenRouter Keys and Deploy"
3. Click "Run workflow"
4. Choose options:
   - Delete old keys: Yes/No
   - Target environment: production/preview/development

## 🧪 Testing

### Test the Agent Locally:
```bash
# Install dependencies
npm install

# Set environment variables
cp env.example .env
# Edit .env with your values

# Start the server
npm run dev
```

### Test API Endpoints:
```bash
# Health check
curl http://localhost:3001/health

# List keys (requires API key)
curl -H "X-API-Key: your-api-key" http://localhost:3001/api/keys

# Create user key
curl -X POST -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "monthlyLimit": 50}' \
  http://localhost:3001/api/keys/create-user
```

## 📊 Monitoring

### Health Checks:
- `GET /health` - Basic health check
- `GET /health/keys` - OpenRouter API status
- `GET /health/database` - Supabase connection
- `GET /health/usage` - Usage monitoring status

### Admin Endpoints:
- `GET /api/admin/keys` - List all user keys
- `GET /api/admin/usage` - System usage statistics
- `POST /api/admin/reset-usage` - Reset monthly usage

## 🔧 Configuration

### Environment Variables:
See `env.example` for all available configuration options.

### Key Rotation Schedule:
```bash
# Default: Monthly on 1st at 2 AM UTC
ROTATION_SCHEDULE=0 2 1 * *

# Custom: Weekly on Sunday at 2 AM
ROTATION_SCHEDULE=0 2 * * 0
```

### Usage Limits by Tier:
- Free: $10/month
- Standard: $50/month
- Micro: $100/month
- Operator: $250/month
- Enterprise: $500/month
- Beta: $1,000/month
- Admin: Unlimited
- Future4200: Unlimited

## 🚨 Troubleshooting

### Common Issues:

1. **"OpenRouter API error"**:
   - Check `OPENROUTER_PROVISIONING_KEY` is correct
   - Verify key has provisioning permissions

2. **"Supabase connection error"**:
   - Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Verify database schema is installed

3. **"Vercel deployment failed"**:
   - Check `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - Verify Vercel project exists and is accessible

4. **"Health check failed"**:
   - Check all services are running
   - Verify environment variables are set
   - Check logs for specific errors

### Debug Mode:
```bash
# Enable debug logging
DEBUG=true npm run dev

# Check logs
tail -f logs/combined.log
```

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/F8ai/openrouter-agent/issues)
- **Documentation**: [Full documentation](https://github.com/F8ai/openrouter-agent/wiki)
- **Discord**: [F8 Community](https://discord.gg/f8)

## 🔗 Integration

### With Formul8 Multiagent:
1. Update your main system to use the OpenRouter Agent API
2. Configure user-specific keys instead of shared keys
3. Set up usage monitoring and billing

### API Integration:
```javascript
// Example: Get user's API key
const response = await fetch('https://your-openrouter-agent.vercel.app/api/keys/user/user-uuid', {
  headers: {
    'X-API-Key': 'your-agent-api-key'
  }
});

const { data } = await response.json();
const userApiKey = data.userApiKey.openrouter_key_id;
```

## 🎯 Next Steps

1. ✅ **Setup Complete**: OpenRouter Agent is ready
2. **Configure Secrets**: Add remaining GitHub secrets
3. **Deploy to Vercel**: Connect and deploy
4. **Test Workflow**: Run manual rotation
5. **Integrate**: Connect with your main system
6. **Monitor**: Set up alerts and notifications
