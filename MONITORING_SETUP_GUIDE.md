# Step-by-Step Monitoring Setup Guide

This guide will walk you through deploying and configuring the monitoring stack for your Coffee Pipeline project.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js installed (for npm install)
- [ ] Docker installed and running
- [ ] Ansible installed
- [ ] SSH access to your VMs (blue, green, load balancer)
- [ ] Network access to ports 9090, 9093, 3001 (for monitoring services)

---

## Step 1: Install Application Dependencies

**Goal:** Install the `prom-client` package that enables metrics collection.

### Actions:

```bash
# Navigate to project directory
cd "/Users/sanjaey/Desktop/Dev-Ops latest/f2025_project_brewops"

# Install dependencies (this will add prom-client)
npm install
```

### Verification:

```bash
# Check if prom-client was installed
npm list prom-client
```

**Expected Output:** Should show `prom-client@15.1.0` or similar version.

---

## Step 2: Test Metrics Endpoint Locally

**Goal:** Verify that the application exposes metrics correctly before deploying.

### Actions:

```bash
# Start the application locally
npm start
```

In another terminal:

```bash
# Test the metrics endpoint
curl http://localhost:3000/metrics
```

### Verification:

You should see Prometheus-formatted metrics output including:
- `http_requests_total`
- `blue_green_active_environment`
- `coffee_orders_total`
- And other metrics

**If you see metrics output, proceed to Step 3.**
**If not, check:**
- Application is running (`npm start`)
- No errors in console
- Port 3000 is not in use by another process

---

## Step 3: Verify Docker is Running

**Goal:** Ensure Docker is available for deploying monitoring containers.

### Actions:

```bash
# Check Docker status
docker --version
docker ps
```

### Verification:

- Docker version should be displayed
- `docker ps` should show running containers (or empty list if none running)

**If Docker is not installed:**
- macOS: `brew install docker` or download Docker Desktop
- Linux: Follow Docker installation guide for your distribution

---

## Step 4: Deploy Monitoring Stack

**Goal:** Deploy Prometheus, Grafana, and Alertmanager using Ansible.

### Actions:

```bash
# Make sure you're in the project root
cd "/Users/sanjaey/Desktop/Dev-Ops latest/f2025_project_brewops"

# Deploy monitoring stack
ansible-playbook -i ansible/inventory.yml ansible/monitoring.yml
```

### What This Does:

1. Creates directories for Prometheus, Grafana, and Alertmanager
2. Copies configuration files
3. Starts Docker containers for each service
4. Verifies all services are healthy

### Expected Output:

You should see:
```
✅ Prometheus deployed successfully
🌐 Access at: http://localhost:9090

✅ Alertmanager deployed successfully
🌐 Access at: http://localhost:9093

✅ Grafana deployed successfully
🌐 Access at: http://localhost:3001
```

### Verification:

```bash
# Check if containers are running
docker ps | grep -E "prometheus|grafana|alertmanager"
```

You should see three containers running.

---

## Step 5: Verify Monitoring Services

**Goal:** Ensure all monitoring services are accessible and healthy.

### 5.1 Check Prometheus

```bash
# Health check
curl http://localhost:9090/-/healthy

# Should return: Prometheus is Healthy.
```

**Open in browser:** http://localhost:9090

**Check targets:**
1. Go to http://localhost:9090/targets
2. You should see:
   - `prometheus` (UP)
   - `coffee-app-blue` (may be DOWN initially - that's OK)
   - `coffee-app-green` (may be DOWN initially - that's OK)

**Note:** Blue and green targets will be UP once you deploy the application.

### 5.2 Check Alertmanager

```bash
# Health check
curl http://localhost:9093/-/healthy

# Should return: OK
```

**Open in browser:** http://localhost:9093

### 5.3 Check Grafana

```bash
# Health check
curl http://localhost:3001/api/health

# Should return JSON with status: "ok"
```

**Open in browser:** http://localhost:3001

**Login:**
- Username: `admin`
- Password: `admin`
- **IMPORTANT:** Change password on first login!

---

## Step 6: Configure Grafana (First Time Setup)

**Goal:** Set up Grafana and verify the dashboard.

### 6.1 Login to Grafana

1. Open http://localhost:3001
2. Login with `admin` / `admin`
3. **Change password** when prompted (save it securely!)

### 6.2 Verify Data Source

1. Go to **Configuration** → **Data Sources**
2. Click on **Prometheus**
3. Verify:
   - URL: `http://localhost:9090`
   - Status: **Green** (working)
4. Click **Save & Test**

### 6.3 Access Dashboard

1. Go to **Dashboards** → **Browse**
2. Look for **Coffee Pipeline - Blue-Green Deployment Dashboard**
3. Open the dashboard

**Note:** Dashboard may show "No data" initially - this is normal until you deploy the application.

---

## Step 7: Deploy Application with Metrics

**Goal:** Deploy the application so Prometheus can collect metrics.

### Actions:

```bash
# Deploy application (this will deploy to blue or green)
ansible-playbook -i ansible/inventory.yml ansible/deploy.yml --private-key ~/.ssh/deploy_key
```

**Or use the automated script:**

```bash
./deploy-automated.sh
```

### What This Does:

1. Builds Docker image with metrics support
2. Deploys to blue or green environment
3. Sets `ENVIRONMENT` variable (blue or green)
4. Application starts with metrics endpoint enabled

---

## Step 8: Verify Metrics Collection

**Goal:** Confirm Prometheus is collecting metrics from your application.

### 8.1 Check Application Metrics Endpoint

```bash
# Check blue environment (if active)
curl http://152.7.177.21:3000/metrics

# Check green environment (if active)
curl http://152.7.177.84:3000/metrics
```

**Expected:** You should see Prometheus metrics output.

### 8.2 Verify in Prometheus

1. Open http://localhost:9090/targets
2. Check status of:
   - `coffee-app-blue` - Should be **UP** (if blue is deployed)
   - `coffee-app-green` - Should be **UP** (if green is deployed)

**If targets show DOWN:**
- Check if application is running: `curl http://152.7.177.21:3000/health`
- Check firewall rules (port 3000 should be accessible)
- Verify network connectivity

### 8.3 Test Metrics Query

1. Go to http://localhost:9090
2. In the query box, type: `up{job="coffee-app-blue"}`
3. Click **Execute**
4. Should show value `1` (UP) or `0` (DOWN)

**Try other queries:**
- `http_requests_total`
- `blue_green_active_environment`
- `coffee_orders_total`

---

## Step 9: Verify Grafana Dashboard

**Goal:** Confirm dashboard is displaying metrics correctly.

### Actions:

1. Open Grafana: http://localhost:3001
2. Navigate to **Dashboards** → **Coffee Pipeline - Blue-Green Deployment Dashboard**
3. Check panels:

**What to Look For:**
- **Active Environment**: Should show "Blue" or "Green"
- **Request Rate**: Should show graph (may be flat if no traffic)
- **Service Health**: Should show "Up" (green)
- **Response Time**: Should show values

**If dashboard shows "No data":**
- Wait 1-2 minutes for metrics to be collected
- Check Prometheus targets are UP
- Verify time range (top right) includes current time

---

## Step 10: Test Alerting

**Goal:** Verify alerts are configured and working.

### 10.1 Check Alert Rules

1. Open Prometheus: http://localhost:9090
2. Go to **Alerts** tab
3. You should see all alert rules listed

**Alert Rules to Verify:**
- DeploymentHealthCheckFailed
- ServiceDown
- HighErrorRate
- SlowResponseTime
- BlueGreenSwitchDurationHigh
- etc.

### 10.2 Test Alert (Optional)

To test an alert, you can temporarily stop the application:

```bash
# SSH to blue or green VM
ssh skovvur@152.7.177.21

# Stop the container
docker stop coffee-blue  # or coffee-green
```

**Then:**
1. Wait 2 minutes
2. Check Prometheus Alerts - should show `ServiceDown` as firing
3. Check Alertmanager - should show the alert

**Restore service:**
```bash
docker start coffee-blue
```

---

## Step 11: Configure Email Notifications (Optional)

**Goal:** Set up email alerts for critical issues.

### Actions:

1. Edit `alertmanager/alertmanager.yml`
2. Uncomment and configure SMTP settings:

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'your-email@gmail.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'  # Use app-specific password
```

3. Uncomment email_configs in receivers:

```yaml
receivers:
  - name: 'critical-receiver'
    email_configs:
      - to: 'oncall@yourdomain.com'
        subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
```

4. Redeploy Alertmanager:

```bash
# Stop current container
docker stop alertmanager

# Restart with updated config
ansible-playbook -i ansible/inventory.yml ansible/monitoring.yml --tags alertmanager
```

---

## Step 12: Integration with CI/CD (Optional)

**Goal:** Get alerts in GitHub Actions workflow.

### Option 1: Webhook Integration

1. Create a webhook receiver script
2. Update Alertmanager webhook URL
3. Configure GitHub Actions to receive webhooks

### Option 2: GitHub Actions Step

Add to `.github/workflows/ci.yaml`:

```yaml
- name: Check Prometheus Alerts
  if: failure()
  run: |
    curl -X POST http://localhost:9093/api/v1/alerts \
      -H "Content-Type: application/json" \
      -d '{"alerts":[{"labels":{"alertname":"DeploymentFailed"}}]}'
```

---

## Troubleshooting

### Issue: Prometheus targets show DOWN

**Solutions:**
1. Check application is running: `curl http://152.7.177.21:3000/health`
2. Verify metrics endpoint: `curl http://152.7.177.21:3000/metrics`
3. Check firewall: Port 3000 should be accessible
4. Verify network connectivity from monitoring server

### Issue: Grafana shows "No data"

**Solutions:**
1. Check Prometheus data source is configured correctly
2. Verify time range includes current time
3. Wait 1-2 minutes for metrics to be collected
4. Check Prometheus targets are UP

### Issue: Docker containers won't start

**Solutions:**
1. Check Docker is running: `docker ps`
2. Check ports are not in use: `lsof -i :9090`
3. Check disk space: `df -h`
4. Check Docker logs: `docker logs prometheus`

### Issue: Metrics not appearing

**Solutions:**
1. Verify `prom-client` is installed: `npm list prom-client`
2. Check application logs for errors
3. Verify `/metrics` endpoint is accessible
4. Check Prometheus scrape interval (15s default)

---

## Verification Checklist

Use this checklist to verify everything is working:

- [ ] `npm install` completed successfully
- [ ] Local metrics endpoint works (`curl http://localhost:3000/metrics`)
- [ ] Docker is running
- [ ] Monitoring stack deployed (`ansible-playbook monitoring.yml`)
- [ ] Prometheus accessible at http://localhost:9090
- [ ] Alertmanager accessible at http://localhost:9093
- [ ] Grafana accessible at http://localhost:3001
- [ ] Grafana password changed
- [ ] Prometheus data source configured in Grafana
- [ ] Application deployed with metrics enabled
- [ ] Prometheus targets show UP
- [ ] Grafana dashboard displays data
- [ ] Alert rules visible in Prometheus
- [ ] (Optional) Email notifications configured

---

## Next Steps After Setup

1. **Monitor a deployment:**
   - Trigger a deployment
   - Watch metrics in Grafana
   - Observe Blue-Green switch metrics

2. **Set up alerts:**
   - Configure email notifications
   - Test alert triggers
   - Set up on-call rotation

3. **Customize dashboards:**
   - Create additional dashboards
   - Add custom panels
   - Configure alerting thresholds

4. **Integrate with CI/CD:**
   - Add webhook notifications
   - Include metrics in deployment reports
   - Use metrics for deployment validation

---

## Support

If you encounter issues:

1. Check logs: `docker logs prometheus`, `docker logs grafana`, `docker logs alertmanager`
2. Review `MONITORING.md` for detailed documentation
3. Check Prometheus targets: http://localhost:9090/targets
4. Verify configuration files are correct

---

**Congratulations!** Your monitoring stack is now set up and ready to provide visibility into your Blue-Green deployment pipeline! 🎉

