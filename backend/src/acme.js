const { deployToNginx } = require('./deployers/nginx');

// In-memory certificate database
let CERTIFICATES = [
  {
    id: '1',
    domain: 'api.zerobyte.dev',
    issuer: "Let's Encrypt Authority X3",
    status: 'Active', // Active, Warning, Expired, Renewing
    expiryTime: 30 * 24 * 60 * 60, // 30 days in seconds
    deploymentTarget: 'Cloudflare Edge CDN',
    autoRenew: true,
    logs: ['[04:22:10] Certificate checked. Verified at Cloudflare API edge.']
  },
  {
    id: '2',
    domain: 'dashboard.zerobyte.dev',
    issuer: "Let's Encrypt Authority X3",
    status: 'Warning',
    expiryTime: 90, // Expiring in 90 seconds (so it auto-renews dynamically during demo!)
    deploymentTarget: 'Nginx SSH Agent (vm-prod-02)',
    autoRenew: true,
    logs: ['[09:12:05] Cname configured to local hostVM.', '[09:14:00] Warning: Certificate lifetime is dropping below 2 minutes.']
  },
  {
    id: '3',
    domain: 'internal-auth.secure.local',
    issuer: 'Internal Private CA v2',
    status: 'Expired',
    expiryTime: -3 * 24 * 60 * 60, // Expired 3 days ago
    deploymentTarget: 'Nginx SSH Agent (vm-auth-01)',
    autoRenew: false,
    logs: ['[03:10:00] Expired: Private CA certificate could not renew due to manual approval gate block.']
  }
];

let AUDIT_LOGS = [
  { timestamp: new Date().toLocaleTimeString(), message: 'System initialized. Loaded 3 certificates.' },
  { timestamp: new Date().toLocaleTimeString(), message: 'Discovery cron scheduled to scan subdomains every 1 hour.' }
];

function getCertificates() {
  return CERTIFICATES.map(cert => ({
    ...cert,
    expiryDays: Math.ceil(cert.expiryTime / (24 * 60 * 60)),
    expirySecondsLeft: cert.expiryTime
  }));
}

function addAuditLog(message) {
  AUDIT_LOGS.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message
  });
}

// Simulates the ACME protocol DNS/HTTP challenge validation and Nginx reload
async function renewCertificate(id) {
  const cert = CERTIFICATES.find(c => c.id === id);
  if (!cert) throw new Error('Certificate not found');
  if (cert.status === 'Renewing') return;

  cert.status = 'Renewing';
  addAuditLog(`Starting ACME challenge handshakes for ${cert.domain}...`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Info: Requesting renewal from Let's Encrypt...`);

  // Simulate ACME challenges latency
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Update certificate properties
  cert.status = 'Active';
  cert.expiryTime = 90 * 24 * 60 * 60; // Renew for full 90 days
  cert.issuer = "Let's Encrypt Authority X3";
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Success: ACME validation passed. Issued new public key.`);
  addAuditLog(`ACME validation succeeded for ${cert.domain}. Generating public/private keypairs.`);

  // Trigger Deployment Hook
  if (cert.deploymentTarget.includes('Nginx')) {
    await deployToNginx(cert, addAuditLog);
  } else {
    addAuditLog(`Pushed certificate bundle for ${cert.domain} directly to ${cert.deploymentTarget} edge.`);
  }

  return cert;
}

// Scans target subdomain ranges to verify certificate configurations
async function discoverCertificates(targetDomain) {
  addAuditLog(`Triggering discovery scanner for scope: *.${targetDomain}`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const newCert = {
    id: String(CERTIFICATES.length + 1),
    domain: `staging-api.${targetDomain}`,
    issuer: 'Sectigo RSA Domain Validation Secure Server CA',
    status: 'Active',
    expiryTime: 42 * 24 * 60 * 60, // 42 days left
    deploymentTarget: 'Nginx SSH Agent (vm-dev-01)',
    autoRenew: true,
    logs: [`[${new Date().toLocaleTimeString()}] Scanner discovered active public cert on staging ingress.`]
  };

  CERTIFICATES.push(newCert);
  addAuditLog(`Discovery completed. Found 1 new active certificate: staging-api.${targetDomain}`);
  return newCert;
}

// Background scheduler
function startCronLoop() {
  setInterval(() => {
    CERTIFICATES.forEach(cert => {
      // Degrade time
      cert.expiryTime -= 1;

      // Update statuses based on expiry time
      if (cert.status !== 'Renewing') {
        if (cert.expiryTime <= 0) {
          cert.status = 'Expired';
        } else if (cert.expiryTime < 60) {
          cert.status = 'Warning';
        } else {
          cert.status = 'Active';
        }
      }

      // Check auto-renew threshold (e.g. 30 seconds left for the warning cert)
      if (cert.autoRenew && cert.expiryTime <= 30 && cert.status === 'Warning') {
        addAuditLog(`Auto-renew triggered: ${cert.domain} has reached threshold limits.`);
        renewCertificate(cert.id).catch(err => {
          addAuditLog(`Error auto-renewing ${cert.domain}: ${err.message}`);
        });
      }
    });
  }, 1000);
}

module.exports = {
  getCertificates,
  renewCertificate,
  discoverCertificates,
  startCronLoop,
  AUDIT_LOGS
};
