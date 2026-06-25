const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { 
  getCertificates, 
  renewCertificate, 
  discoverCertificates, 
  startCronLoop, 
  registerUser, 
  loginUser, 
  verifyToken,
  addCertificate
} = require('./acme');

const app = express();
const PORT = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 5000;

// Enable CORS and JSON body parsers
app.use(cors());
app.use(express.json());

// Token Extractor Middleware (now asynchronous to verify user from DB)
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization;
  try {
    const userId = await verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
};

// Auth API Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const user = await registerUser(email, password, name);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const data = await loginUser(email, password);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Authenticated Certificate API Routes
app.get('/api/certificates', authenticateUser, async (req, res) => {
  try {
    const certs = await getCertificates(req.userId);
    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

app.post('/api/certificates/renew/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await renewCertificate(id);
    res.json({ message: `Certificate renewal successfully triggered for ${id}`, result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Renewal failed' });
  }
});

app.post('/api/certificates/discover', authenticateUser, async (req, res) => {
  const { targetDomain } = req.body;
  try {
    const discovered = await discoverCertificates(targetDomain, req.userId);
    res.json({ message: 'Discovery scan completed', discovered });
  } catch (error) {
    res.status(500).json({ error: 'Discovery failed' });
  }
});

app.post('/api/certificates/add', authenticateUser, async (req, res) => {
  const { domain, deploymentTarget, autoRenew } = req.body;
  try {
    const newCert = await addCertificate(domain, deploymentTarget, autoRenew, req.userId);
    res.status(201).json({ message: 'Certificate created successfully', cert: newCert });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Initialize database schema, start scheduler, and boot Express API server
initDb()
  .then(() => {
    console.log('[SSLAutomation API] Database connection and schema initialized.');
    
    // Start background certificate checking scheduler
    startCronLoop();
    
    app.listen(PORT, () => {
      console.log(`[SSLAutomation API] Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('[SSLAutomation API] Database initialization failed:', err);
    process.exit(1);
  });
