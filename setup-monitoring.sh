#!/usr/bin/env bash

# Quick Setup Script for Monitoring Stack
# This script guides you through setting up Prometheus, Grafana, and Alertmanager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Monitoring Stack Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   macOS: brew install docker or download Docker Desktop"
    exit 1
fi
echo "✅ Docker is installed"

if ! command -v ansible-playbook &> /dev/null; then
    echo "❌ Ansible is not installed. Please install Ansible first."
    echo "   macOS: brew install ansible"
    exit 1
fi
echo "✅ Ansible is installed"

if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm is not installed. Please install Node.js first."
    exit 1
fi
echo "✅ Node.js/npm is installed"

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing application dependencies..."
cd "$PROJECT_ROOT"
npm install
echo "✅ Dependencies installed"

# Step 3: Check Docker is running
echo ""
echo "Step 3: Checking Docker status..."
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi
echo "✅ Docker is running"

# Step 4: Deploy monitoring stack
echo ""
echo "Step 4: Deploying monitoring stack..."
echo "This will deploy Prometheus, Grafana, and Alertmanager..."
echo ""

ansible-playbook -i ansible/inventory.yml ansible/monitoring.yml

# Step 5: Wait for services to be ready
echo ""
echo "Step 5: Waiting for services to be ready..."
sleep 5

# Step 6: Verify services
echo ""
echo "Step 6: Verifying services..."

# Check Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
    echo "✅ Prometheus is healthy"
else
    echo "⚠️  Prometheus health check failed (may need a moment to start)"
fi

# Check Alertmanager
if curl -s http://localhost:9093/-/healthy > /dev/null 2>&1; then
    echo "✅ Alertmanager is healthy"
else
    echo "⚠️  Alertmanager health check failed (may need a moment to start)"
fi

# Check Grafana
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Grafana is healthy"
else
    echo "⚠️  Grafana health check failed (may need a moment to start)"
fi

# Step 7: Display access information
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Monitoring Stack Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Access URLs:"
echo "   Prometheus:  http://localhost:9090"
echo "   Grafana:     http://localhost:3001 (admin/admin)"
echo "   Alertmanager: http://localhost:9093"
echo ""
echo "📝 Next Steps:"
echo "   1. Open Grafana and change the default password"
echo "   2. Verify Prometheus targets at http://localhost:9090/targets"
echo "   3. Deploy your application to start collecting metrics"
echo "   4. View dashboard: Coffee Pipeline - Blue-Green Deployment Dashboard"
echo ""
echo "📖 For detailed instructions, see: MONITORING_SETUP_GUIDE.md"
echo ""

