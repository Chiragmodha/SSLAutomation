import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, RotateCw, Network, Terminal, Globe, Server, Clock, Activity, Check } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function App() {
  const [certs, setCerts] = useState([]);
  const [selectedId, setSelectedId] = useState('2'); // Select warning cert by default
  const [discoveryDomain, setDiscoveryDomain] = useState('zerobyte.dev');
  const [isScanning, setIsScanning] = useState(false);
  const [renewingId, setRenewingId] = useState(null);

  // Poll certificates every 1 second to fetch real-time expiry countdown ticks
  useEffect(() => {
    const fetchCerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/certificates`);
        const data = await res.json();
        setCerts(data);
      } catch (err) {
        console.error('Failed to poll certificates:', err);
      }
    };

    fetchCerts();
    const interval = setInterval(fetchCerts, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleForceRenew = async (id) => {
    setRenewingId(id);
    try {
      await fetch(`${API_BASE}/api/certificates/renew/${id}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to renew certificate:', err);
    } finally {
      setRenewingId(null);
    }
  };

  const handleDiscoveryScan = async (e) => {
    e.preventDefault();
    if (!discoveryDomain) return;
    setIsScanning(true);

    try {
      const res = await fetch(`${API_BASE}/api/certificates/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDomain: discoveryDomain }),
      });
      const data = await res.json();
      
      // Auto-select the newly discovered cert
      if (data.discovered) {
        setSelectedId(data.discovered.id);
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const selectedCert = certs.find(c => c.id === selectedId);

  // Expiry counters stats helper
  const total = certs.length;
  const activeCount = certs.filter(c => c.status === 'Active').length;
  const warningCount = certs.filter(c => c.status === 'Warning').length;
  const expiredCount = certs.filter(c => c.status === 'Expired').length;

  // Format seconds into readable time (days or seconds left)
  const formatTimeLeft = (sec) => {
    if (sec <= 0) return 'Expired';
    if (sec < 60) return `${sec} seconds left`;
    const days = Math.ceil(sec / (24 * 60 * 60));
    return `${days} days left`;
  };

  return (
    <div className="app-container">
      {/* Background neon light nodes */}
      <div className="bg-glow-node"></div>
      <div className="bg-glow-node-bottom"></div>

      {/* Title Header */}
      <header className="dashboard-header">
        <div className="header-title-box">
          <h1>
            <Activity size={26} className="text-cyan animate-pulse" />
            <span>SSL<span style={{ color: '#a855f7' }}>Automation</span></span>
          </h1>
          <p>DevSecOps automatic certificate renewer, discovery scanner, and SSH host reload agent.</p>
        </div>

        {/* Discovery Scan Controller */}
        <form onSubmit={handleDiscoveryScan} className="discovery-input-box">
          <input
            type="text"
            placeholder="Target domain (e.g. company.com)"
            value={discoveryDomain}
            onChange={(e) => setDiscoveryDomain(e.target.value)}
            className="domain-input"
            disabled={isScanning}
          />
          <button type="submit" className="btn btn-primary" disabled={isScanning}>
            <Network size={16} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning...' : 'Discovery Scan'}</span>
          </button>
        </form>
      </header>

      {/* Summary Count Statistics Card Grid */}
      <section className="stat-summary-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper cyan">
            <Globe size={22} />
          </div>
          <div className="stat-info-text">
            <div className="stat-val">{total}</div>
            <div className="stat-label">Monitored Domains</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper success">
            <ShieldCheck size={22} />
          </div>
          <div className="stat-info-text">
            <div className="stat-val">{activeCount}</div>
            <div className="stat-label">Active & Secured</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper warning">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-info-text">
            <div className="stat-val">{warningCount}</div>
            <div className="stat-label">Expiring Soon</div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon-wrapper danger">
            <ShieldX size={22} />
          </div>
          <div className="stat-info-text">
            <div className="stat-val">{expiredCount}</div>
            <div className="stat-label">Certificates Expired</div>
          </div>
        </div>
      </section>

      {/* Workspace Area: Left List, Right Inspector */}
      <div className="workspace-grid">
        {/* Main certificates stack */}
        <main className="main-column">
          <div className="glass-panel">
            <div className="cert-list-header">
              <h2>Certificate Inventory</h2>
            </div>

            <div className="cert-items-stack">
              {certs.map(cert => (
                <div
                  key={cert.id}
                  onClick={() => setSelectedId(cert.id)}
                  className={`cert-card glass-panel ${selectedId === cert.id ? 'selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cert-info-col">
                    <div className="cert-domain-name">{cert.domain}</div>
                    <div className="cert-issuer-lbl">CA: {cert.issuer}</div>
                    
                    <div className="cert-badge-row">
                      <span className={`cert-status-badge ${cert.status.toLowerCase()}`}>
                        {cert.status}
                      </span>
                      <span className="cert-tag-target">
                        <Server size={11} style={{ marginRight: '0.2rem', verticalAlign: 'middle' }} />
                        {cert.deploymentTarget.split(' ')[0]}
                      </span>
                      {cert.autoRenew && (
                        <span className="cert-tag-target" style={{ borderColor: '#a855f7', color: '#c084fc' }}>
                          Auto
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="cert-expiry-col">
                    {/* Expiry Counters */}
                    <div className={`cert-expiry-counter ${cert.status.toLowerCase()}`}>
                      <Clock size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                      {formatTimeLeft(cert.expirySecondsLeft)}
                    </div>
                    
                    <div className="cert-action-row">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Avoid selecting card
                          handleForceRenew(cert.id);
                        }}
                        disabled={cert.status === 'Renewing' || renewingId === cert.id}
                        className="btn btn-secondary cert-read-btn"
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }}
                      >
                        <RotateCw size={12} className={cert.status === 'Renewing' ? 'animate-spin' : ''} />
                        <span>Force Renew</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Right Inspection Panel */}
        <aside className="glass-panel inspector-panel">
          <div className="inspector-header">
            <h2>Certificate Details</h2>
          </div>

          {selectedCert ? (
            <>
              <div className="inspector-meta-grid">
                <div className="meta-field">
                  <span className="meta-label">Domain Name</span>
                  <span className="meta-value" style={{ color: '#06b6d4', fontSize: '1.2rem' }}>{selectedCert.domain}</span>
                </div>

                <div className="meta-field">
                  <span className="meta-label">Authority CA Issuer</span>
                  <span className="meta-value">{selectedCert.issuer}</span>
                </div>

                <div className="meta-field">
                  <span className="meta-label">Deployment Target VM</span>
                  <span className="meta-value">{selectedCert.deploymentTarget}</span>
                </div>

                <div className="meta-field">
                  <span className="meta-label">Auto-Renew Policy</span>
                  <span className="meta-value">
                    {selectedCert.autoRenew ? 'Enabled (Triggers auto renewal <= 30 seconds left)' : 'Disabled'}
                  </span>
                </div>

                <div className="meta-field">
                  <span className="meta-label">Remaining Lifetime</span>
                  <span className="meta-value mono">
                    {selectedCert.expirySecondsLeft > 0 
                      ? `${selectedCert.expirySecondsLeft} seconds remaining` 
                      : 'Expired'
                    }
                  </span>
                </div>
              </div>

              {/* Console log outputs terminal */}
              <div className="console-logs-box">
                <div className="console-logs-header">
                  <Terminal size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  <span>Deployment Execution Console Logs</span>
                </div>
                <div className="console-terminal">
                  {selectedCert.logs.map((logLine, idx) => (
                    <div key={idx} className="console-line">
                      {logLine}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="no-cert-selected">
              Select a certificate from the inventory list to view live deployment logs.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
