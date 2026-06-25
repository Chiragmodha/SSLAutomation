const db = require('./db');

// In-Memory Database Fallbacks
let IN_MEMORY_USERS = [
  { id: 'user-1', email: 'chirag@zerobyte.dev', password: 'password123', name: 'Chirag Modha' }
];

let IN_MEMORY_CERTIFICATES = [
  {
    id: '1',
    userId: 'user-1',
    domain: 'api.zerobyte.dev',
    issuer: "Let's Encrypt Authority X3",
    status: 'Active',
    expiryTime: 30 * 24 * 60 * 60,
    deploymentTarget: 'Cloudflare Edge CDN',
    autoRenew: true,
    logs: ['[04:22:10] Certificate checked. Verified at Cloudflare API edge.']
  },
  {
    id: '2',
    userId: 'user-1',
    domain: 'dashboard.zerobyte.dev',
    issuer: "Let's Encrypt Authority X3",
    status: 'Warning',
    expiryTime: 90,
    deploymentTarget: 'Nginx SSH Agent (vm-prod-02)',
    autoRenew: true,
    logs: ['[09:12:05] Cname configured to local hostVM.', '[09:14:00] Warning: Certificate lifetime is dropping below 2 minutes.']
  },
  {
    id: '3',
    userId: 'user-1',
    domain: 'internal-auth.secure.local',
    issuer: 'Internal Private CA v2',
    status: 'Expired',
    expiryTime: -3 * 24 * 60 * 60,
    deploymentTarget: 'Nginx SSH Agent (vm-auth-01)',
    autoRenew: false,
    logs: ['[03:10:00] Expired: Private CA certificate could not renew due to manual approval gate block.']
  }
];

let AUDIT_LOGS = [];

async function addAuditLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  if (db.getUsePostgres()) {
    try {
      await db.query('INSERT INTO audit_logs (timestamp, message) VALUES ($1, $2)', [timestamp, message]);
    } catch (err) {
      console.error('[SSLAutomation DB] Failed to insert audit log:', err);
    }
  } else {
    AUDIT_LOGS.unshift({ timestamp, message });
    console.log(`[AUDIT] ${timestamp} - ${message}`);
  }
}

async function getCertificates(userId) {
  if (db.getUsePostgres()) {
    const res = await db.query('SELECT * FROM certificates WHERE user_id = $1 ORDER BY domain ASC', [userId]);
    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      domain: row.domain,
      issuer: row.issuer,
      status: row.status,
      deploymentTarget: row.deployment_target,
      autoRenew: row.auto_renew,
      logs: row.logs || [],
      expiryDays: Math.ceil(row.expiry_time / (24 * 60 * 60)),
      expirySecondsLeft: row.expiry_time
    }));
  } else {
    return IN_MEMORY_CERTIFICATES
      .filter(cert => cert.userId === userId)
      .map(cert => ({
        ...cert,
        expiryDays: Math.ceil(cert.expiryTime / (24 * 60 * 60)),
        expirySecondsLeft: cert.expiryTime
      }));
  }
}

async function registerUser(email, password, name) {
  const normalizedEmail = email.toLowerCase().trim();
  const userName = name || 'User';

  if (db.getUsePostgres()) {
    const check = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (check.rows.length > 0) throw new Error('User already exists');

    const userId = `user-${Date.now()}`;
    await db.query(
      'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
      [userId, normalizedEmail, password, userName]
    );

    await addAuditLog(`User registered: ${normalizedEmail}`);

    const domainSuffix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const id1 = `cert-${Date.now()}-1`;
    const id2 = `cert-${Date.now()}-2`;

    await db.query(
      'INSERT INTO certificates (id, user_id, domain, issuer, status, expiry_time, deployment_target, auto_renew, logs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id1, userId, `api.${domainSuffix}.dev`, "Let's Encrypt Authority X3", 'Active', 45 * 24 * 60 * 60, 'Cloudflare Edge CDN', true, JSON.stringify(['[09:00:00] Certificate provisioned upon account creation.'])]
    );

    await db.query(
      'INSERT INTO certificates (id, user_id, domain, issuer, status, expiry_time, deployment_target, auto_renew, logs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id2, userId, `dashboard.${domainSuffix}.dev`, "Let's Encrypt Authority X3", 'Warning', 90, 'Nginx SSH Agent (vm-prod-02)', true, JSON.stringify(['[09:00:00] Seeded warning certificate to demonstrate automated renewals.'])]
    );

    return { id: userId, email: normalizedEmail, name: userName };
  } else {
    const exists = IN_MEMORY_USERS.find(u => u.email === normalizedEmail);
    if (exists) throw new Error('User already exists');

    const userId = `user-${Date.now()}`;
    const newUser = { id: userId, email: normalizedEmail, password, name: userName };
    IN_MEMORY_USERS.push(newUser);

    await addAuditLog(`User registered: ${newUser.email}`);

    const domainSuffix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    IN_MEMORY_CERTIFICATES.push(
      {
        id: `cert-${Date.now()}-1`,
        userId: newUser.id,
        domain: `api.${domainSuffix}.dev`,
        issuer: "Let's Encrypt Authority X3",
        status: 'Active',
        expiryTime: 45 * 24 * 60 * 60,
        deploymentTarget: 'Cloudflare Edge CDN',
        autoRenew: true,
        logs: ['[09:00:00] Certificate provisioned upon account creation.']
      },
      {
        id: `cert-${Date.now()}-2`,
        userId: newUser.id,
        domain: `dashboard.${domainSuffix}.dev`,
        issuer: "Let's Encrypt Authority X3",
        status: 'Warning',
        expiryTime: 90,
        deploymentTarget: 'Nginx SSH Agent (vm-prod-02)',
        autoRenew: true,
        logs: ['[09:00:00] Seeded warning certificate to demonstrate automated renewals.']
      }
    );

    return { id: newUser.id, email: newUser.email, name: newUser.name };
  }
}

async function loginUser(email, password) {
  const normalizedEmail = email.toLowerCase().trim();

  if (db.getUsePostgres()) {
    const res = await db.query('SELECT * FROM users WHERE email = $1 AND password = $2', [normalizedEmail, password]);
    if (res.rows.length === 0) throw new Error('Invalid email or password');

    const user = res.rows[0];
    const token = `mock-token-${user.id}`;
    await addAuditLog(`User authenticated: ${user.email}`);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token
    };
  } else {
    const user = IN_MEMORY_USERS.find(u => u.email === normalizedEmail && u.password === password);
    if (!user) throw new Error('Invalid email or password');

    const token = `mock-token-${user.id}`;
    await addAuditLog(`User authenticated: ${user.email}`);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token
    };
  }
}

async function verifyToken(token) {
  if (!token || !token.startsWith('mock-token-')) {
    throw new Error('Unauthorized');
  }
  const userId = token.replace('mock-token-', '');

  if (db.getUsePostgres()) {
    const res = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) throw new Error('Unauthorized');
    return userId;
  } else {
    const user = IN_MEMORY_USERS.find(u => u.id === userId);
    if (!user) throw new Error('Unauthorized');
    return userId;
  }
}

async function renewCertificate(id) {
  if (db.getUsePostgres()) {
    const res = await db.query('SELECT * FROM certificates WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error('Certificate not found');
    
    const cert = res.rows[0];
    if (cert.status === 'Renewing') return;

    const currentLogs = cert.logs || [];
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Info: Requesting renewal from Let's Encrypt...`);
    
    await db.query('UPDATE certificates SET status = $1, logs = $2 WHERE id = $3', [
      'Renewing',
      JSON.stringify(currentLogs),
      id
    ]);

    await addAuditLog(`Starting ACME challenge handshakes for ${cert.domain}...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const newLogs = [...currentLogs];
    newLogs.unshift(`[${new Date().toLocaleTimeString()}] Success: ACME validation passed. Issued new public key.`);
    
    const updatedCert = {
      ...cert,
      status: 'Active',
      expiry_time: 90 * 24 * 60 * 60,
      issuer: "Let's Encrypt Authority X3",
      logs: newLogs
    };

    await db.query(
      'UPDATE certificates SET status = $1, expiry_time = $2, issuer = $3, logs = $4 WHERE id = $5',
      [
        updatedCert.status,
        updatedCert.expiry_time,
        updatedCert.issuer,
        JSON.stringify(updatedCert.logs),
        id
      ]
    );

    await addAuditLog(`ACME validation succeeded for ${cert.domain}. Generating public/private keypairs.`);

    if (cert.deployment_target.includes('Nginx')) {
      const { deployToNginx } = require('./deployers/nginx');
      await deployToNginx(updatedCert, addAuditLog);
    } else {
      await addAuditLog(`Pushed certificate bundle for ${cert.domain} directly to ${cert.deployment_target} edge.`);
    }

    const finalRes = await db.query('SELECT * FROM certificates WHERE id = $1', [id]);
    return finalRes.rows[0];
  } else {
    const cert = IN_MEMORY_CERTIFICATES.find(c => c.id === id);
    if (!cert) throw new Error('Certificate not found');
    if (cert.status === 'Renewing') return;

    cert.status = 'Renewing';
    cert.logs = cert.logs || [];
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Info: Requesting renewal from Let's Encrypt...`);
    await addAuditLog(`Starting ACME challenge handshakes for ${cert.domain}...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    cert.status = 'Active';
    cert.expiryTime = 90 * 24 * 60 * 60;
    cert.issuer = "Let's Encrypt Authority X3";
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Success: ACME validation passed. Issued new public key.`);
    await addAuditLog(`ACME validation succeeded for ${cert.domain}. Generating public/private keypairs.`);

    if (cert.deploymentTarget.includes('Nginx')) {
      const { deployToNginx } = require('./deployers/nginx');
      await deployToNginx(cert, addAuditLog);
    } else {
      await addAuditLog(`Pushed certificate bundle for ${cert.domain} directly to ${cert.deploymentTarget} edge.`);
    }

    return cert;
  }
}

async function discoverCertificates(targetDomain, userId) {
  await addAuditLog(`Triggering discovery scanner for scope: *.${targetDomain}`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const certId = `cert-${Date.now()}`;
  const newCert = {
    id: certId,
    domain: `staging-api.${targetDomain}`,
    issuer: 'Sectigo RSA Domain Validation Secure Server CA',
    status: 'Active',
    expiryTime: 42 * 24 * 60 * 60,
    deploymentTarget: 'Nginx SSH Agent (vm-dev-01)',
    autoRenew: true,
    logs: [`[${new Date().toLocaleTimeString()}] Scanner discovered active public cert on staging ingress.`]
  };

  if (db.getUsePostgres()) {
    await db.query(
      'INSERT INTO certificates (id, user_id, domain, issuer, status, expiry_time, deployment_target, auto_renew, logs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        newCert.id,
        userId,
        newCert.domain,
        newCert.issuer,
        newCert.status,
        newCert.expiryTime,
        newCert.deploymentTarget,
        newCert.autoRenew,
        JSON.stringify(newCert.logs)
      ]
    );
  } else {
    IN_MEMORY_CERTIFICATES.push({
      ...newCert,
      userId
    });
  }

  await addAuditLog(`Discovery completed. Found 1 new active certificate: staging-api.${targetDomain}`);
  
  return {
    id: newCert.id,
    userId,
    domain: newCert.domain,
    issuer: newCert.issuer,
    status: newCert.status,
    deploymentTarget: newCert.deploymentTarget,
    autoRenew: newCert.autoRenew,
    logs: newCert.logs,
    expiryDays: Math.ceil(newCert.expiryTime / (24 * 60 * 60)),
    expirySecondsLeft: newCert.expiryTime
  };
}

function startCronLoop() {
  setInterval(async () => {
    try {
      if (db.getUsePostgres()) {
        const res = await db.query('SELECT * FROM certificates');
        for (const cert of res.rows) {
          let newExpiry = cert.expiry_time - 1;
          let newStatus = cert.status;

          if (cert.status !== 'Renewing') {
            if (newExpiry <= 0) {
              newStatus = 'Expired';
            } else if (newExpiry < 60) {
              newStatus = 'Warning';
            } else {
              newStatus = 'Active';
            }
          }

          await db.query('UPDATE certificates SET expiry_time = $1, status = $2 WHERE id = $3', [
            newExpiry,
            newStatus,
            cert.id
          ]);

          if (cert.auto_renew && newExpiry <= 30 && cert.status === 'Warning') {
            await addAuditLog(`Auto-renew triggered: ${cert.domain} has reached threshold limits.`);
            renewCertificate(cert.id).catch(err => {
              console.error(`Error auto-renewing ${cert.domain}:`, err);
            });
          }
        }
      } else {
        IN_MEMORY_CERTIFICATES.forEach(cert => {
          cert.expiryTime -= 1;
          if (cert.status !== 'Renewing') {
            if (cert.expiryTime <= 0) {
              cert.status = 'Expired';
            } else if (cert.expiryTime < 60) {
              cert.status = 'Warning';
            } else {
              cert.status = 'Active';
            }
          }

          if (cert.autoRenew && cert.expiryTime <= 30 && cert.status === 'Warning') {
            addAuditLog(`Auto-renew triggered: ${cert.domain} has reached threshold limits.`);
            renewCertificate(cert.id).catch(err => {
              console.error(`Error auto-renewing ${cert.domain}:`, err);
            });
          }
        });
      }
    } catch (err) {
      console.error('Error in cron loop:', err);
    }
  }, 1000);
}

async function addCertificate(domain, deploymentTarget, autoRenew, userId) {
  const normalizedDomain = domain.trim().toLowerCase();
  const certId = `cert-${Date.now()}`;
  
  const newCert = {
    id: certId,
    domain: normalizedDomain,
    issuer: "Let's Encrypt Authority X3",
    status: 'Warning',
    expiryTime: 45,
    deploymentTarget: deploymentTarget || 'Nginx SSH Agent (vm-prod-02)',
    autoRenew: autoRenew !== undefined ? autoRenew : true,
    logs: [`[${new Date().toLocaleTimeString()}] Certificate domain successfully registered manual scope.`]
  };

  if (db.getUsePostgres()) {
    await db.query(
      'INSERT INTO certificates (id, user_id, domain, issuer, status, expiry_time, deployment_target, auto_renew, logs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        newCert.id,
        userId,
        newCert.domain,
        newCert.issuer,
        newCert.status,
        newCert.expiryTime,
        newCert.deploymentTarget,
        newCert.autoRenew,
        JSON.stringify(newCert.logs)
      ]
    );
  } else {
    IN_MEMORY_CERTIFICATES.push({
      ...newCert,
      userId
    });
  }

  await addAuditLog(`Manually created certificate domain: ${newCert.domain}`);
  
  return {
    id: newCert.id,
    userId,
    domain: newCert.domain,
    issuer: newCert.issuer,
    status: newCert.status,
    deploymentTarget: newCert.deploymentTarget,
    autoRenew: newCert.autoRenew,
    logs: newCert.logs,
    expiryDays: Math.ceil(newCert.expiryTime / (24 * 60 * 60)),
    expirySecondsLeft: newCert.expiryTime
  };
}

module.exports = {
  getCertificates,
  renewCertificate,
  discoverCertificates,
  startCronLoop,
  registerUser,
  loginUser,
  verifyToken,
  addCertificate,
  AUDIT_LOGS
};
