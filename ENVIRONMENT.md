# Environment Configuration Guide

This guide explains how to properly configure environment variables for MyDigitalSpace across different deployment scenarios.

## 🔧 Environment Files

### `.env.local` - Local Development
```bash
NODE_ENV=development
PORT=3001
DB_PATH=./data/knowledgehub.db
JWT_SECRET=local-development-jwt-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### `.env.production` - Production Deployment
```bash
NODE_ENV=production
PORT=3001
DB_PATH=./data/knowledgehub.db
JWT_SECRET=REPLACE_WITH_SECURE_SECRET_IN_PRODUCTION
CORS_ORIGIN=http://52.221.181.208,https://52.221.181.208,http://52.221.181.208:3000
FRONTEND_URL=http://52.221.181.208
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Deployment Configurations

### 1. Direct AWS Instance Deployment (`deploy.sh`)
- ✅ **Port**: Standardized to 3001 for backend, Nginx proxies from port 80
- ✅ **JWT Secret**: Auto-generated secure secret using `openssl rand -hex 32`
- ✅ **Environment**: Automatically sets production environment
- ✅ **Validation**: Validates environment file before deployment

### 2. Quick Deployment (`quick-deploy.sh`)  
- ✅ **Port**: Standardized to 3001
- ✅ **Environment**: Creates `.env` file if missing with secure defaults
- ✅ **Database**: Ensures both `data/` and `database/` directories exist

### 3. Docker Deployment (`docker-compose.yml`)
- ✅ **Port**: Uses 3001 consistently
- ✅ **Environment Variables**: Uses environment variables with fallbacks
- ✅ **JWT Secret**: Configurable via `JWT_SECRET` environment variable
- ✅ **CORS**: Configurable via `CORS_ORIGIN` environment variable

### 4. AWS App Runner (`aws/app-runner.json`)
- ✅ **Port**: Standardized to 3001  
- ✅ **Environment**: Includes all required environment variables
- ⚠️  **Setup Required**: Replace placeholder values with actual secrets

## 🔐 Security Best Practices

### JWT Secret Generation
```bash
# Generate a secure JWT secret
openssl rand -hex 32
```

### Environment Variable Validation
Use the validation script to check your configuration:
```bash
# Validate local development
./scripts/validate-env.sh local

# Validate production
./scripts/validate-env.sh production

# Validate Docker environment
./scripts/validate-env.sh docker
```

## 🔍 Environment Validation

The validation script checks for:
- ✅ Required environment variables present
- ✅ JWT secret minimum length (32 characters)
- ✅ No placeholder/default values in production
- ✅ Proper environment file format

## 📋 Setup Checklist

### For Local Development:
- [ ] Copy `.env.example` to `.env` 
- [ ] Update `JWT_SECRET` with a secure value
- [ ] Run `./scripts/validate-env.sh local`

### For Production Deployment:
- [ ] Create `.env.production` from template
- [ ] Generate secure JWT secret: `openssl rand -hex 32`
- [ ] Update `SERVER_IP` in deployment scripts if needed
- [ ] Run `./scripts/validate-env.sh production`
- [ ] Deploy using `./deploy.sh`

### For Docker Deployment:
- [ ] Set `JWT_SECRET` environment variable
- [ ] Set `CORS_ORIGIN` if different from defaults
- [ ] Run `./scripts/validate-env.sh docker`
- [ ] Deploy using `docker-compose up`

## 🔧 Troubleshooting

### Common Issues:

**JWT Secret Validation Failed**
- Ensure JWT_SECRET is at least 32 characters
- Replace any placeholder text with actual secure values

**CORS Errors**
- Check that CORS_ORIGIN includes your frontend domain
- Ensure protocol (http/https) matches your setup

**Port Conflicts**  
- Default backend port is 3001
- Nginx serves on port 80 in production
- Update PORT environment variable if needed

**Database Path Issues**
- Ensure `data/` directory exists and is writable
- Default path: `./data/knowledgehub.db`

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Nginx       │    │    Backend      │
│   (Static)      │◄──►│   (Port 80)     │◄──►│   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │   SQLite DB     │
                                               │ (data/ folder)  │
                                               └─────────────────┘
```

This setup ensures consistent, secure, and maintainable deployments across all environments.