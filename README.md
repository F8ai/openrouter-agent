# OpenRouter Agent

A dedicated agent for managing OpenRouter API keys across the Formul8 ecosystem. This agent handles key creation, rotation, monitoring, and user-specific key management.

## 🎯 Features

- **Automated Key Management**: Create, rotate, and delete OpenRouter API keys
- **Per-User Key Support**: Individual API keys for each user with usage tracking
- **Usage Monitoring**: Real-time tracking of API usage and costs
- **Subscription Integration**: Automatic limits based on user subscription tiers
- **Security**: Secure key storage and rotation with audit trails
- **Scalability**: Handle thousands of users with individual keys

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Formul8       │    │  OpenRouter     │    │   Supabase      │
│   Multiagent    │───►│     Agent       │───►│   Database      │
│                 │    │                 │    │                 │
│ • User Requests │    │ • Key Creation  │    │ • User Keys     │
│ • Auth Context  │    │ • Key Rotation  │    │ • Usage Logs    │
│ • Usage Data    │    │ • Monitoring    │    │ • Limits        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   OpenRouter    │
                       │   Provisioning  │
                       │      API        │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase project
- OpenRouter Provisioning API key

### Installation

```bash
git clone https://github.com/F8ai/openrouter-agent.git
cd openrouter-agent
npm install
```

### Environment Setup

Create a `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter Configuration
OPENROUTER_PROVISIONING_KEY=sk-or-v1-your-provisioning-key

# Server Configuration
PORT=3001
NODE_ENV=production
```

### Database Setup

Run the database schema in your Supabase SQL Editor:

```sql
-- Run the schema from schema/supabase-schema.sql
```

### Start the Agent

```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Endpoints

### Key Management

- `POST /api/keys/create` - Create a new API key
- `POST /api/keys/rotate` - Rotate a user's API key
- `DELETE /api/keys/:id` - Delete an API key
- `GET /api/keys/user/:userId` - Get user's API key

### Usage Monitoring

- `GET /api/usage/:userId` - Get user's usage summary
- `GET /api/usage/:userId/monthly` - Get monthly usage
- `POST /api/usage/log` - Log API usage

### Admin Functions

- `GET /api/admin/keys` - List all keys (admin only)
- `GET /api/admin/usage` - System-wide usage stats
- `POST /api/admin/reset-usage` - Reset monthly usage

## 🔧 Configuration

### Subscription Tiers

Default monthly limits by subscription tier:

| Tier | Monthly Limit | Features |
|------|---------------|----------|
| free | $10 | Basic usage |
| standard | $50 | Standard features |
| micro | $100 | Micro business |
| operator | $250 | Operations support |
| enterprise | $500 | Enterprise features |
| beta | $1,000 | Beta testing |
| admin | Unlimited | Admin access |
| future4200 | Unlimited | Future4200 integration |

### Key Rotation Schedule

- **System Keys**: Monthly (1st of each month)
- **User Keys**: On-demand or monthly
- **Emergency Rotation**: Immediate when needed

## 🛡️ Security

### Key Storage

- Keys are never stored in plain text
- Only OpenRouter key IDs are stored in database
- All operations require authentication

### Access Control

- Users can only access their own keys
- Admins can manage all keys
- Service role for system operations

### Audit Trail

- All key operations are logged
- Usage tracking with timestamps
- Security event monitoring

## 📊 Monitoring

### Health Checks

- `GET /health` - Agent health status
- `GET /health/keys` - Key management health
- `GET /health/database` - Database connectivity

### Metrics

- Key creation/rotation rates
- Usage patterns
- Error rates
- Response times

## 🔄 Deployment

### Docker

```bash
docker build -t openrouter-agent .
docker run -p 3001:3001 --env-file .env openrouter-agent
```

### Vercel

```bash
vercel --prod
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## 📈 Performance

### Benchmarks

- Key creation: < 2 seconds
- Key rotation: < 5 seconds
- Usage logging: < 100ms
- Database queries: < 50ms

### Scaling

- Supports 10,000+ concurrent users
- Horizontal scaling with load balancer
- Database connection pooling
- Redis caching for frequently accessed data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- GitHub Issues: [Report bugs or request features](https://github.com/F8ai/openrouter-agent/issues)
- Documentation: [Full documentation](https://github.com/F8ai/openrouter-agent/wiki)
- Discord: [F8 Community](https://discord.gg/f8)

## 🔗 Related Projects

- [Formul8 Multiagent](https://github.com/F8ai/formul8-multiagent) - Main multi-agent system
- [F8 Security](https://github.com/F8ai/f8-security) - Security framework
- [Supabase Integration](https://github.com/F8ai/supabase-integration) - Database integration
