#!/bin/bash

# Environment Variable Validation Script
# Validates required environment variables for deployment

set -e

validate_env_file() {
    local env_file="$1"
    local environment="$2"
    
    echo "🔍 Validating $environment environment file: $env_file"
    
    if [ ! -f "$env_file" ]; then
        echo "❌ Environment file not found: $env_file"
        return 1
    fi
    
    # Required variables
    required_vars=("NODE_ENV" "PORT" "DB_PATH" "JWT_SECRET")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "❌ Missing required environment variables:"
        printf '   - %s\n' "${missing_vars[@]}"
        return 1
    fi
    
    # Validate JWT_SECRET strength
    jwt_secret=$(grep "^JWT_SECRET=" "$env_file" | cut -d'=' -f2)
    if [ ${#jwt_secret} -lt 32 ]; then
        echo "⚠️  Warning: JWT_SECRET should be at least 32 characters long"
    fi
    
    # Check for default/insecure values
    if [[ "$jwt_secret" == *"REPLACE"* ]] || [[ "$jwt_secret" == *"your-"* ]]; then
        echo "❌ JWT_SECRET contains placeholder text. Please set a secure secret."
        return 1
    fi
    
    echo "✅ Environment validation passed for $environment"
    return 0
}

# Main validation logic
case "${1:-}" in
    "local")
        validate_env_file ".env.local" "local development"
        ;;
    "production")
        validate_env_file ".env.production" "production"
        ;;
    "docker")
        echo "🔍 Validating Docker environment variables"
        # Check if required environment variables are set for Docker
        if [ -z "${JWT_SECRET:-}" ]; then
            echo "❌ JWT_SECRET environment variable not set for Docker deployment"
            exit 1
        fi
        echo "✅ Docker environment validation passed"
        ;;
    *)
        echo "Usage: $0 [local|production|docker]"
        echo ""
        echo "Examples:"
        echo "  $0 local      - Validate local development environment"
        echo "  $0 production - Validate production environment"  
        echo "  $0 docker     - Validate Docker environment variables"
        exit 1
        ;;
esac