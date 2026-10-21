#!/usr/bin/env bash

# Blue-Green Deployment Script using Ansible
# This script automates the deployment process
#
# Usage:
#   ./deploy-automated.sh           # Normal deployment
#   ./deploy-automated.sh --setup   # Run setup first, then deploy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
SETUP_MODE=false

# Parse arguments
if [[ "$1" == "--setup" ]]; then
    SETUP_MODE=true
fi

echo "🚀 Starting Blue-Green Deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check prerequisites
if ! command -v ansible-playbook &> /dev/null; then
    echo "❌ Error: ansible-playbook not found"
    echo "Please install Ansible: pip3 install ansible"
    exit 1
fi

cd "$PROJECT_ROOT"

# Run setup if requested
if [ "$SETUP_MODE" = true ]; then
    echo "📦 Running initial setup on VMs..."
    ansible-playbook -i ansible/inventory.yml ansible/deploy.yml --tags setup
    echo ""
fi

# Run deployment
echo "🚢 Deploying application..."
ansible-playbook -i ansible/inventory.yml ansible/deploy.yml

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment completed successfully!"
echo "🌐 Application: http://152.7.176.23/"
echo "📊 Status: http://152.7.176.23/status"
