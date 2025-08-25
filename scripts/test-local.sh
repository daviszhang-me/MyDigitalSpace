#!/bin/bash

# Local Testing Script for KnowledgeHub
set -e

echo "🧪 Testing KnowledgeHub locally with Docker..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Clean up function
cleanup() {
    log_info "Cleaning up..."
    docker-compose down -v 2>/dev/null || true
}

# Set up trap for cleanup
trap cleanup EXIT

# Build and start services
log_info "Building and starting KnowledgeHub..."
docker-compose up --build -d

# Wait for service to be ready
log_info "Waiting for service to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Service is running!"
        break
    fi
    if [ $i -eq 30 ]; then
        log_warning "Service didn't start within 30 seconds"
        docker-compose logs
        exit 1
    fi
    sleep 1
done

# Run basic tests
log_info "Running basic functionality tests..."

# Test health endpoint
if curl -s http://localhost:3001/health | grep -q "healthy"; then
    log_success "✅ Health check passed"
else
    log_warning "❌ Health check failed"
fi

# Test main page
if curl -s http://localhost:3001 | grep -q "KnowledgeHub"; then
    log_success "✅ Main page loads"
else
    log_warning "❌ Main page failed to load"
fi

# Test API endpoint
if curl -s http://localhost:3001/api | grep -q "KnowledgeHub"; then
    log_success "✅ API endpoint accessible"
else
    log_warning "❌ API endpoint failed"
fi

log_success "🎉 Local testing completed!"
log_info "KnowledgeHub is running at: http://localhost:3001"
log_info "Press Ctrl+C to stop the service"

# Keep running until interrupted
if [ "${1:-}" != "--no-wait" ]; then
    log_info "Service is running. Press Ctrl+C to stop..."
    while true; do
        sleep 1
    done
fi