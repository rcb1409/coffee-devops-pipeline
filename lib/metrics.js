// lib/metrics.js
// Prometheus metrics collection for Coffee Delivery Service

const client = require('prom-client');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// HTTP Metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code']
});

// Custom Blue-Green Deployment Metrics
const blueGreenSwitchTotal = new client.Counter({
  name: 'blue_green_switch_total',
  help: 'Total number of Blue-Green environment switches',
  labelNames: ['from_env', 'to_env']
});

const blueGreenSwitchDuration = new client.Histogram({
  name: 'blue_green_switch_duration_seconds',
  help: 'Duration of Blue-Green environment switch in seconds',
  labelNames: ['from_env', 'to_env'],
  buckets: [1, 5, 10, 30, 60, 120]
});

const blueGreenActiveEnvironment = new client.Gauge({
  name: 'blue_green_active_environment',
  help: 'Currently active environment (0=blue, 1=green)',
  labelNames: ['environment']
});

const deploymentStartTime = new client.Gauge({
  name: 'deployment_start_time',
  help: 'Unix timestamp of deployment start time',
  labelNames: ['environment', 'version']
});

const deploymentDuration = new client.Histogram({
  name: 'deployment_duration_seconds',
  help: 'Duration of deployment in seconds',
  labelNames: ['environment'],
  buckets: [10, 30, 60, 120, 300, 600]
});

// Application-specific Metrics
const coffeeOrdersTotal = new client.Counter({
  name: 'coffee_orders_total',
  help: 'Total number of coffee orders placed',
  labelNames: ['coffee_name']
});

const coffeeOrderValue = new client.Counter({
  name: 'coffee_order_value_total',
  help: 'Total value of coffee orders in dollars',
  labelNames: ['coffee_name']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestErrors);
register.registerMetric(blueGreenSwitchTotal);
register.registerMetric(blueGreenSwitchDuration);
register.registerMetric(blueGreenActiveEnvironment);
register.registerMetric(deploymentStartTime);
register.registerMetric(deploymentDuration);
register.registerMetric(coffeeOrdersTotal);
register.registerMetric(coffeeOrderValue);

// Helper function to record HTTP metrics
function recordHttpMetrics(req, res, responseTime) {
  const route = req.route ? req.route.path : req.path;
  const method = req.method;
  const statusCode = res.statusCode;

  httpRequestDuration.observe({ method, route, status_code: statusCode }, responseTime);
  httpRequestTotal.inc({ method, route, status_code: statusCode });

  if (statusCode >= 400) {
    httpRequestErrors.inc({ method, route, status_code: statusCode });
  }
}

// Helper function to record Blue-Green switch
function recordBlueGreenSwitch(fromEnv, toEnv, duration) {
  blueGreenSwitchTotal.inc({ from_env: fromEnv, to_env: toEnv });
  if (duration !== undefined) {
    blueGreenSwitchDuration.observe({ from_env: fromEnv, to_env: toEnv }, duration);
  }
  // Update active environment gauge
  blueGreenActiveEnvironment.set({ environment: toEnv }, toEnv === 'green' ? 1 : 0);
}

// Helper function to record deployment
function recordDeployment(environment, version, duration) {
  deploymentStartTime.set({ environment, version }, Date.now() / 1000);
  if (duration !== undefined) {
    deploymentDuration.observe({ environment }, duration);
  }
}

// Helper function to record coffee order
function recordCoffeeOrder(coffeeName, value) {
  coffeeOrdersTotal.inc({ coffee_name: coffeeName });
  coffeeOrderValue.inc({ coffee_name: coffeeName }, value);
}

module.exports = {
  register,
  recordHttpMetrics,
  recordBlueGreenSwitch,
  recordDeployment,
  recordCoffeeOrder,
  blueGreenActiveEnvironment,
  // Export metrics for direct access if needed
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    httpRequestErrors,
    blueGreenSwitchTotal,
    blueGreenSwitchDuration,
    blueGreenActiveEnvironment,
    deploymentStartTime,
    deploymentDuration,
    coffeeOrdersTotal,
    coffeeOrderValue
  }
};

