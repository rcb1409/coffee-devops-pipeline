# Blue-Green Deployment Setup

## Overview
This project implements Blue-Green deployment using Ansible across 3 VMs:
- **Load Balancer** (152.7.176.23): Nginx reverse proxy
- **Blue** (152.7.177.28): Application server
- **Green** (152.7.177.29): Application server

## Prerequisites

### Local Machine
- Ansible 2.9+
- SSH access to all VMs
- Python 3

### VMs
The Ansible playbook will automatically install:
- **Load Balancer**: Nginx, firewall rules
- **App Servers**: Docker, Python Docker module

## Initial Setup

### 1. Configure SSH Keys
```bash
# Copy SSH keys to all VMs (one-time setup)
ssh-copy-id -i ~/.ssh/id_ed25519.pub rbollep@152.7.176.23
ssh-copy-id -i ~/.ssh/id_ed25519.pub rbollep@152.7.177.28
ssh-copy-id -i ~/.ssh/id_ed25519.pub rbollep@152.7.177.29
```

### 2. Run Initial Setup (First Time Only)
```bash
# This installs Nginx, Docker, configures firewall
./deploy-automated.sh --setup
```

This will:
- Install Nginx on load balancer
- Configure firewall (open port 80)
- Install Docker on app servers
- Install Python Docker module
- Add user to docker group

## Deployment

### Manual Deployment
```bash
# Normal deployment (after initial setup)
./deploy-automated.sh

# Or use Ansible directly
ansible-playbook -i ansible/inventory.yml ansible/deploy.yml
```

### Deployment with Setup
```bash
# Run this if VMs were restarted or setup was not done
./deploy-automated.sh --setup
```

### Run Setup Only
```bash
# Just prepare VMs without deploying
ansible-playbook -i ansible/inventory.yml ansible/deploy.yml --tags setup
```

## CI/CD Pipeline

The GitHub Actions workflow automatically:
1. Runs quality checks (ESLint, tests, coverage)
2. Builds and pushes Docker image to Docker Hub
3. **Scans Docker image for security vulnerabilities** (NEW)
4. Deploys using Blue-Green strategy (on push to `release/**`)

### GitHub Secrets Required
- `SSH_PRIVATE_KEY`: SSH private key for VM access
- `DOCKERHUB_USER`: Docker Hub username (currently: sanjaey)
- `DOCKERHUB_TOKEN`: Docker Hub access token

## Architecture

### Blue-Green Strategy
1. Determines current active environment (blue or green)
2. Deploys to the **inactive** environment
3. Runs health checks
4. Updates Nginx to route traffic to new version
5. Zero downtime deployment

### Idempotency
- Container only updates if Docker image changed
- Nginx only reloads if configuration changed
- Setup tasks are idempotent (safe to run multiple times)

## Testing

### Verify Deployment
```bash
# Check health
curl http://152.7.176.23/health

# Check status (shows active environment)
curl http://152.7.176.23/status

# Check application
curl http://152.7.176.23/
```

### Test Connectivity
```bash
# Ping all VMs
ansible all -i ansible/inventory.yml -m ping

# Check Docker on app servers
ansible app_servers -i ansible/inventory.yml -m command -a "docker --version"

# Check Nginx on load balancer
ansible loadbalancer -i ansible/inventory.yml -m command -a "nginx -v"
```

## Troubleshooting

### VMs Restarted
If VMs are restarted, run setup again:
```bash
./deploy-automated.sh --setup
```

### Firewall Issues
If port 80 is blocked:
```bash
ansible loadbalancer -i ansible/inventory.yml -b -m shell -a "iptables -I INPUT -p tcp --dport 80 -j ACCEPT"
```

### Docker Not Working
```bash
# Reinstall Docker
ansible app_servers -i ansible/inventory.yml --tags setup

# Check Docker status
ansible app_servers -i ansible/inventory.yml -m shell -a "systemctl status snap.docker.dockerd"
```

## Automated Rollback Mechanism

### Overview
The deployment pipeline includes an **automatic rollback mechanism** that triggers if health checks fail after switching environments. This ensures zero-downtime and automatic recovery from failed deployments.

### How It Works

1. **State Storage**: Before switching environments, the current active environment is saved to `/home/rbollep/rollback-state.txt`
2. **Post-Switch Health Checks**: After switching Nginx to the new environment, comprehensive health checks are performed
3. **Automatic Rollback**: If health checks fail, the system automatically:
   - Reads the rollback state file
   - Switches Nginx back to the previous environment
   - Updates the active environment marker
   - Verifies the rollback was successful
   - Reports the rollback in the CI/CD pipeline

### Rollback Triggers

Rollback is automatically triggered when:
- Post-switch health check fails (HTTP status != 200)
- Health endpoint is unreachable after multiple retries
- Application fails to respond within the timeout period

### Manual Rollback

#### Option 1: Using Rollback Playbook
```bash
# Run the dedicated rollback playbook
ansible-playbook -i ansible/inventory.yml ansible/rollback.yml --private-key ~/.ssh/deploy_key
```

#### Option 2: Automatic Switch
```bash
# Just run deployment again - it automatically switches between blue/green
ansible-playbook -i ansible/inventory.yml ansible/deploy.yml
```

### Rollback State Files

- **Active Environment**: `/home/rbollep/active-env.txt` - Current active environment (blue/green)
- **Rollback State**: `/home/rbollep/rollback-state.txt` - Previous environment for rollback

### CI/CD Integration

The GitHub Actions pipeline:
- Detects when rollback is triggered
- Reports rollback status in job summary
- Provides current environment status
- Fails the deployment job with clear rollback information

### Testing Rollback

To test the rollback mechanism:

1. **Simulate a failed deployment**:
   ```bash
   # Deploy a broken image or stop the container after deployment
   ```

2. **Verify rollback state file exists**:
   ```bash
   ansible loadbalancer -i ansible/inventory.yml -m shell -a "cat /home/rbollep/rollback-state.txt"
   ```

3. **Check rollback playbook**:
   ```bash
   ansible-playbook -i ansible/inventory.yml ansible/rollback.yml --check
   ```

### Rollback Verification

After a rollback, verify it was successful:
```bash
# Check active environment
curl http://152.7.176.36/status

# Verify health
curl http://152.7.176.36/health

# Check rollback state
ansible loadbalancer -i ansible/inventory.yml -m shell -a "cat /home/rbollep/active-env.txt"
```

## Container Security Scanning

### Overview
The CI/CD pipeline includes **automated container security scanning** using Trivy to detect vulnerabilities in Docker images before deployment. This ensures that only secure images are deployed to production.

### How It Works

1. **Automatic Scanning**: After the Docker image is built and pushed, Trivy automatically scans the image for:
   - **Vulnerabilities**: Known CVEs in base images and dependencies
   - **Configuration Issues**: Misconfigurations in Dockerfiles and container settings
   - **Secrets**: Hardcoded secrets or credentials in the image

2. **Severity Threshold**: The pipeline fails if **CRITICAL** or **HIGH** severity vulnerabilities are detected

3. **Reports**: Security scan results are:
   - Uploaded to GitHub Security tab (SARIF format)
   - Generated as HTML reports (available as workflow artifacts)
   - Displayed in the workflow summary

### Security Scan Workflow

The security scanning job runs in parallel with the build process:

```
Build Image → Security Scan → Deploy (only if scan passes)
```

**Key Features:**
- ✅ Blocks deployment if critical/high vulnerabilities found
- ✅ Scans for vulnerabilities, misconfigurations, and secrets
- ✅ Generates detailed HTML reports
- ✅ Integrates with GitHub Security tab
- ✅ Artifacts retained for 30 days

### Viewing Scan Results

#### Option 1: GitHub Security Tab
1. Go to your repository
2. Click on **Security** tab
3. View **Code scanning alerts** from Trivy

#### Option 2: Workflow Artifacts
1. Go to **Actions** tab
2. Click on the workflow run
3. Find **Container Security Scan** job
4. Download **trivy-security-report** artifact
5. Open the HTML file in a browser

#### Option 3: Workflow Summary
- Check the workflow run summary for scan status
- View scan details and vulnerability count

### Handling Vulnerabilities

If the security scan fails:

1. **Review the scan report** to identify vulnerabilities
2. **Update base image** if vulnerabilities are in the base image:
   ```dockerfile
   FROM node:20-alpine  # Update to latest version
   ```
3. **Update dependencies** if vulnerabilities are in npm packages:
   ```bash
   npm audit fix
   npm update
   ```
4. **Rebuild and rescan** the image
5. **Deploy only after** all critical/high vulnerabilities are resolved

### Manual Security Scanning

You can also run Trivy locally:

```bash
# Install Trivy (macOS)
brew install trivy

# Scan local image
trivy image docker.io/<username>/coffee:latest

# Scan with HTML report
trivy image --format template --template "@contrib/gitlab.tpl" -o report.html docker.io/<username>/coffee:latest

# Scan Dockerfile
trivy config Dockerfile
```

### Security Best Practices

- **Keep base images updated**: Regularly update `node:20-alpine` to latest version
- **Minimize attack surface**: Use minimal base images (Alpine Linux)
- **Regular scanning**: Security scans run automatically on every build
- **Review reports**: Regularly review security reports and address vulnerabilities
- **Dependency updates**: Keep npm dependencies updated with `npm audit fix`

## Monitoring and Alerting

The project includes a comprehensive monitoring stack with Prometheus, Grafana, and Alertmanager. See [MONITORING.md](./MONITORING.md) for detailed setup and usage instructions.

### Quick Start

```bash
# Deploy monitoring stack
ansible-playbook -i ansible/inventory.yml ansible/monitoring.yml
```

### Access URLs

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Alertmanager**: http://localhost:9093

### Metrics Endpoint

Each application instance exposes Prometheus metrics at `/metrics`:
- Blue: http://152.7.177.21:3000/metrics
- Green: http://152.7.177.84:3000/metrics

## Files

- `ansible/inventory.yml`: VM configuration
- `ansible/deploy.yml`: Main deployment playbook with setup tasks and automatic rollback
- `ansible/rollback.yml`: Dedicated rollback playbook for manual rollback operations
- `ansible/monitoring.yml`: Monitoring stack deployment (Prometheus, Grafana, Alertmanager)
- `ansible/setup_ssh_key.yml`: SSH key distribution (one-time)
- `deploy-automated.sh`: Deployment script
- `.github/workflows/ci.yaml`: CI/CD pipeline with rollback support and security scanning
- `MONITORING.md`: Comprehensive monitoring and alerting documentation

## Notes

- Setup tasks use `tags: [setup, never]` - only run when explicitly requested
- Docker installation uses snap package
- Firewall rules persist across reboots via iptables
- Active environment tracked in `/home/skovvur/active-env.txt`
- Rollback state stored in `/home/skovvur/rollback-state.txt` for automatic recovery
- Post-switch health checks ensure deployment quality before committing to switch
- Automatic rollback prevents downtime from failed deployments
- Container security scanning prevents deployment of vulnerable images
- Prometheus metrics exposed at `/metrics` endpoint on each application instance
- Monitoring stack can be deployed independently using `ansible/monitoring.yml`
