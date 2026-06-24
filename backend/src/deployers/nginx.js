// Simulates key transfer and service reloading over secure SSH connections
async function deployToNginx(cert, addAuditLog) {
  const vmName = cert.deploymentTarget.split('(')[1].replace(')', '');
  
  addAuditLog(`Deployer: Initializing SSH credentials connection to remote host ${vmName}...`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SSH channel opened successfully.`);

  await new Promise(resolve => setTimeout(resolve, 1500));

  addAuditLog(`Deployer: Uploading fullchain.pem and privkey.pem to /etc/nginx/ssl/ via SFTP...`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Deployment: SFTP transmission completed (100%).`);

  await new Promise(resolve => setTimeout(resolve, 1500));

  addAuditLog(`Deployer: Running validation command "nginx -t" on remote host...`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Shell: nginx: syntax is ok, configuration test is successful`);

  await new Promise(resolve => setTimeout(resolve, 1500));

  addAuditLog(`Deployer: Triggering reload command "systemctl reload nginx" on ${vmName}...`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Shell: systemctl reload nginx command exited code 0`);
  cert.logs.unshift(`[${new Date().toLocaleTimeString()}] Success: Certificate redeployed and reloaded successfully.`);
  
  addAuditLog(`Deployment successfully completed for ${cert.domain} on target ${vmName}.`);
}

module.exports = { deployToNginx };
