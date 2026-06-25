const db = require('../db');

// Simulates key transfer and service reloading over secure SSH connections
async function deployToNginx(cert, addAuditLog) {
  const targetField = cert.deployment_target || cert.deploymentTarget;
  const vmName = targetField.split('(')[1].replace(')', '');
  
  await addAuditLog(`Deployer: Initializing SSH credentials connection to remote host ${vmName}...`);
  
  if (db.getUsePostgres()) {
    const getLogsRes = await db.query('SELECT logs FROM certificates WHERE id = $1', [cert.id]);
    let currentLogs = (getLogsRes.rows[0] && getLogsRes.rows[0].logs) || [];
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SSH channel opened successfully.`);
    await db.query('UPDATE certificates SET logs = $1 WHERE id = $2', [JSON.stringify(currentLogs), cert.id]);
  } else {
    cert.logs = cert.logs || [];
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SSH channel opened successfully.`);
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  await addAuditLog(`Deployer: Uploading fullchain.pem and privkey.pem to /etc/nginx/ssl/ via SFTP...`);
  if (db.getUsePostgres()) {
    const getLogsRes = await db.query('SELECT logs FROM certificates WHERE id = $1', [cert.id]);
    let currentLogs = (getLogsRes.rows[0] && getLogsRes.rows[0].logs) || [];
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SFTP transmission completed (100%).`);
    await db.query('UPDATE certificates SET logs = $1 WHERE id = $2', [JSON.stringify(currentLogs), cert.id]);
  } else {
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SFTP transmission completed (100%).`);
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  await addAuditLog(`Deployer: Running validation command "nginx -t" on remote host...`);
  if (db.getUsePostgres()) {
    const getLogsRes = await db.query('SELECT logs FROM certificates WHERE id = $1', [cert.id]);
    let currentLogs = (getLogsRes.rows[0] && getLogsRes.rows[0].logs) || [];
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Shell: nginx: syntax is ok, configuration test is successful`);
    await db.query('UPDATE certificates SET logs = $1 WHERE id = $2', [JSON.stringify(currentLogs), cert.id]);
  } else {
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Shell: nginx: syntax is ok, configuration test is successful`);
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  await addAuditLog(`Deployer: Triggering reload command "systemctl reload nginx" on ${vmName}...`);
  if (db.getUsePostgres()) {
    const getLogsRes = await db.query('SELECT logs FROM certificates WHERE id = $1', [cert.id]);
    let currentLogs = (getLogsRes.rows[0] && getLogsRes.rows[0].logs) || [];
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Shell: systemctl reload nginx command exited code 0`);
    currentLogs.unshift(`[${new Date().toLocaleTimeString()}] Success: Certificate redeployed and reloaded successfully.`);
    await db.query('UPDATE certificates SET logs = $1 WHERE id = $2', [JSON.stringify(currentLogs), cert.id]);
  } else {
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Shell: systemctl reload nginx command exited code 0`);
    cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Success: Certificate redeployed and reloaded successfully.`);
  }
  
  await addAuditLog(`Deployment successfully completed for ${cert.domain} on target ${vmName}.`);
}

module.exports = { deployToNginx };
