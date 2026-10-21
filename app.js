// app.js

const express = require('express');
const { coffees, orders } = require('./data');
const { register, recordHttpMetrics, recordCoffeeOrder, blueGreenActiveEnvironment } = require('./lib/metrics');

const app = express();
const PORT = 3000;

// Get environment from environment variable (set by Ansible during deployment)
const ENVIRONMENT = process.env.ENVIRONMENT || 'unknown';

// Initialize active environment metric
blueGreenActiveEnvironment.set({ environment: ENVIRONMENT }, ENVIRONMENT === 'green' ? 1 : 0);

// Metrics middleware - records HTTP request metrics
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = (Date.now() - startTime) / 1000;
    recordHttpMetrics(req, res, responseTime);
    originalEnd.apply(this, args);
  };
  
  next();
});

app.use(express.json());
app.use(express.static('public')); 
module.exports = app

// Endpoint to fetch available coffees
app.get('/coffees', (req, res) => {
  res.json(coffees);
});

// Endpoint to place an order
app.post('/order', (req, res) => {
  const { coffeeId, quantity } = req.body;

  const coffee = coffees.find(c => c.id === coffeeId);

  if (!coffee) {
    return res.status(400).json({ error: 'Invalid coffee ID' });
  }

  const order = {
    orderId: orders.length + 1,
    coffeeName: coffee.name,
    quantity,
    total: coffee.price * quantity
  };

  orders.push(order);

  // Record metrics for coffee order
  recordCoffeeOrder(coffee.name, order.total);

  res.status(201).json(order);
});

// Endpoint to fetch all orders
app.get('/orders', (req, res) => {
  res.json(orders);
});


// Health check endpoint used by CI/CD pipelines

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Version endpoint to track deployments
app.get('/version', (req, res) => {
  res.json({ 
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    deployment_env: ENVIRONMENT
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Start server only when run directly, not during testing.

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

// Export the app

module.exports = app
