# Monitoring and Alerting Setup

## Overview

This document describes the monitoring and alerting infrastructure for the Coffee Delivery Service Blue-Green deployment pipeline. The monitoring stack includes:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards
- **Alertmanager**: Alert routing and notification management

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Blue Env      │────▶│                 │
│  (Port 3000)    │     │   Prometheus    │
└─────────────────┘     │   (Port 9090)   │
                        │                 │
┌─────────────────┐     │                 │
│  Green Env       │────▶│                 │
│  (Port 3000)     │     └────────┬────────┘
└─────────────────┘               │
                                  │
                        ┌─────────▼─────────┐
                        │   Alertmanager   │
                        │   (Port 9093)    │
                        └─────────┬────────┘
                                  │
                        ┌─────────▼─────────┐
                        │     Grafana       │
                        │   (Port 3001)     │
                        └───────────────────┘
```

## Metrics Exposed

### HTTP Metrics
- `http_requests_total`: Total number of HTTP requests
- `http_request_duration_seconds`: HTTP request duration histogram
- `http_request_errors_total`: Total number of HTTP errors

### Blue-Green Deployment Metrics
- `blue_green_switch_total`: Total number of environment switches
- `blue_green_switch_duration_seconds`: Switch duration histogram
- `blue_green_active_environment`: Currently active environment (0=blue, 1=green)
- `deployment_start_time`: Deployment start timestamp
- `deployment_duration_seconds`: Deployment duration histogram

### Application Metrics
- `coffee_orders_total`: Total number of coffee orders
- `coffee_order_value_total`: Total value of orders in dollars

## Deployment

### Prerequisites
- Docker installed on the monitoring server
- Ansible installed on the deployment machine
- Network access to blue/green environments (ports 3000)

### Deploy Monitoring Stack

```bash
# Deploy Prometheus, Grafana, and Alertmanager
ansible-playbook -i ansible/inventory.yml ansible/monitoring.yml
```

This will:
1. Deploy Prometheus on port 9090
2. Deploy Alertmanager on port 9093
3. Deploy Grafana on port 3001
4. Configure all components with appropriate settings

### Access URLs

- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Grafana**: http://localhost:3001
  - Default username: `admin`
  - Default password: `admin` (change on first login)

## Configuration

### Prometheus Configuration

The Prometheus configuration (`prometheus/prometheus.yml`) scrapes metrics from:
- Blue environment: `152.7.177.21:3000/metrics`
- Green environment: `152.7.177.84:3000/metrics`
- Prometheus itself: `localhost:9090`

Scrape interval: 15 seconds

### Alert Rules

Alert rules are defined in `prometheus/alerts.yml` and include:

1. **Deployment Alerts**
   - `DeploymentHealthCheckFailed`: Service down for >1 minute
   - `ServiceDown`: Service down for >2 minutes

2. **Performance Alerts**
   - `HighErrorRate`: Error rate >10% for 5 minutes
   - `SlowResponseTime`: 95th percentile >2s for 5 minutes
   - `VerySlowResponseTime`: 95th percentile >5s for 2 minutes

3. **Blue-Green Alerts**
   - `BlueGreenSwitchDurationHigh`: Switch duration >60s
   - `DeploymentDurationHigh`: Deployment duration >300s
   - `BothEnvironmentsUnhealthy`: Both blue and green down

4. **Application Alerts**
   - `NoOrdersProcessed`: No orders in last 10 minutes
   - `HighRequestRate`: Request rate >100 req/s

### Alertmanager Configuration

Alertmanager routes alerts based on severity:
- **Critical alerts** → `critical-receiver`
- **Deployment alerts** → `deployment-receiver`
- **Performance alerts** → `performance-receiver`

Currently configured with webhook notifications. To enable email notifications:

1. Edit `alertmanager/alertmanager.yml`
2. Uncomment and configure SMTP settings:
   ```yaml
   global:
     smtp_smarthost: 'smtp.gmail.com:587'
     smtp_from: 'alerts@yourdomain.com'
     smtp_auth_username: 'your-email@gmail.com'
     smtp_auth_password: 'your-password'
   ```
3. Uncomment email_configs in receivers
4. Redeploy Alertmanager

### Grafana Dashboards

The default dashboard "Coffee Pipeline - Blue-Green Deployment Dashboard" includes:

1. **Active Environment Indicator**: Shows current active environment (Blue/Green)
2. **Request Rate**: Requests per second by instance
3. **Response Time**: 95th percentile response time
4. **Error Rate**: Error rate by status code
5. **Blue-Green Switch Events**: Switch frequency and duration
6. **Deployment Duration**: Deployment time by environment
7. **Coffee Orders**: Order rate by coffee type
8. **Service Health**: Up/down status
9. **Total Orders Value**: Cumulative order value

## Metrics Endpoint

Each application instance exposes metrics at `/metrics`:

```bash
# Get metrics from blue environment
curl http://152.7.177.21:3000/metrics

# Get metrics from green environment
curl http://152.7.177.84:3000/metrics
```

## Recording Custom Metrics

### Recording Blue-Green Switch

The metrics are automatically recorded when the application starts based on the `ENVIRONMENT` environment variable. To manually record a switch event:

```javascript
const { recordBlueGreenSwitch } = require('./lib/metrics');

// Record switch from blue to green, took 45 seconds
recordBlueGreenSwitch('blue', 'green', 45);
```

### Recording Deployment

```javascript
const { recordDeployment } = require('./lib/metrics');

// Record deployment to green environment, version 1.0.1, took 120 seconds
recordDeployment('green', '1.0.1', 120);
```

### Recording Coffee Orders

Coffee orders are automatically recorded when orders are placed via the `/order` endpoint.

## Integration with CI/CD

### GitHub Actions Integration

To integrate alerts with GitHub Actions, you can:

1. Create a webhook receiver that posts to GitHub
2. Update Alertmanager webhook URL to point to your receiver
3. Configure GitHub Actions to receive webhook notifications

Example webhook payload:
```json
{
  "status": "firing",
  "alerts": [
    {
      "labels": {
        "alertname": "ServiceDown",
        "instance": "coffee-blue"
      },
      "annotations": {
        "description": "coffee-blue has been down for more than 2 minutes"
      }
    }
  ]
}
```

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check if Prometheus is running:
   ```bash
   docker ps | grep prometheus
   ```

2. Check Prometheus targets:
   - Go to http://localhost:9090/targets
   - Verify blue and green environments are "UP"

3. Check if metrics endpoint is accessible:
   ```bash
   curl http://152.7.177.21:3000/metrics
   curl http://152.7.177.84:3000/metrics
   ```

4. Check Prometheus logs:
   ```bash
   docker logs prometheus
   ```

### Grafana Not Showing Data

1. Verify Prometheus data source is configured:
   - Go to Grafana → Configuration → Data Sources
   - Check Prometheus connection

2. Check dashboard queries:
   - Open dashboard
   - Click on panel → Edit
   - Verify query syntax

3. Check time range:
   - Ensure time range includes when metrics were collected

### Alerts Not Firing

1. Check alert rules:
   - Go to Prometheus → Alerts
   - Verify rules are loaded

2. Check Alertmanager:
   - Go to http://localhost:9093
   - Check if alerts are being received

3. Verify alert conditions:
   - Check if metrics match alert conditions
   - Use Prometheus query interface to test expressions

## Security Considerations

1. **Change Default Passwords**: Change Grafana admin password immediately
2. **Network Access**: Restrict access to monitoring ports (9090, 9093, 3001)
3. **Authentication**: Configure Grafana authentication (LDAP, OAuth, etc.)
4. **TLS**: Use HTTPS for production deployments
5. **Secrets**: Store sensitive configuration (SMTP passwords) securely

## Maintenance

### Updating Prometheus

```bash
# Stop current container
docker stop prometheus

# Update configuration files
# Edit prometheus/prometheus.yml or prometheus/alerts.yml

# Restart container
docker start prometheus
```

### Updating Grafana Dashboards

1. Edit dashboard in Grafana UI
2. Export dashboard JSON
3. Save to `grafana/dashboards/coffee-pipeline.json`
4. Redeploy Grafana or restart container

### Backup

Backup Prometheus data:
```bash
docker cp prometheus:/prometheus /backup/prometheus-$(date +%Y%m%d)
```

Backup Grafana data:
```bash
docker cp grafana:/var/lib/grafana /backup/grafana-$(date +%Y%m%d)
```

## Next Steps

1. **Configure Email Notifications**: Set up SMTP in Alertmanager
2. **Add More Dashboards**: Create dashboards for specific use cases
3. **Integrate with CI/CD**: Set up webhook notifications to GitHub Actions
4. **Set Up Logging**: Consider adding ELK stack or Loki for log aggregation
5. **Performance Tuning**: Adjust scrape intervals and retention based on needs

## Files

- `lib/metrics.js`: Metrics collection module
- `app.js`: Express app with metrics endpoint
- `prometheus/prometheus.yml`: Prometheus server configuration
- `prometheus/alerts.yml`: Alert rules
- `alertmanager/alertmanager.yml`: Alertmanager configuration
- `grafana/provisioning/datasources/prometheus.yml`: Grafana data source
- `grafana/provisioning/dashboards/dashboards.yml`: Dashboard provisioning
- `grafana/dashboards/coffee-pipeline.json`: Main dashboard
- `ansible/monitoring.yml`: Ansible playbook for deployment

