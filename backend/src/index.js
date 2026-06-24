const express = require('express');
const cors = require('cors');
const { getCertificates, renewCertificate, discoverCertificates, startCronLoop } = require('./acme');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parsers
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/certificates', (req, res) => {
  try {
    const certs = getCertificates();
    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

app.post('/api/certificates/renew/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await renewCertificate(id);
    res.json({ message: `Certificate renewal successfully triggered for ${id}`, result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Renewal failed' });
  }
});

app.post('/api/certificates/discover', async (req, res) => {
  const { targetDomain } = req.body;
  try {
    const discovered = await discoverCertificates(targetDomain);
    res.json({ message: 'Discovery scan completed', discovered });
  } catch (error) {
    res.status(500).json({ error: 'Discovery failed' });
  }
});

// Seed data and background checking cron loop
startCronLoop();

// Start Server
app.listen(PORT, () => {
  console.log(`[SSLAutomation API] Server running on port ${PORT}`);
});
