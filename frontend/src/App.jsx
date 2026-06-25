import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  RotateCw, 
  Network, 
  Terminal, 
  Globe, 
  Server, 
  Clock, 
  Activity, 
  Key, 
  Lock, 
  Mail, 
  User, 
  ArrowLeft, 
  LogOut, 
  Copy, 
  Check, 
  Plus, 
  Download, 
  X,
  FileText
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ssl_auth_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ssl_user')) || null);
  
  // Auth Form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Add Domain Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newTarget, setNewTarget] = useState('Nginx SSH Agent (vm-prod-02)');
  const [newAutoRenew, setNewAutoRenew] = useState(true);
  const [addError, setAddError] = useState('');

  // App States
  const [certs, setCerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [discoveryDomain, setDiscoveryDomain] = useState('zerobyte.dev');
  const [isScanning, setIsScanning] = useState(false);
  const [renewingId, setRenewingId] = useState(null);
  
  // Tab control in Details screen: 'overview' or 'keys'
  const [detailsTab, setDetailsTab] = useState('overview');

  // Search & Filter in Inventory
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Key Copy/Download feedback states
  const [copiedKey, setCopiedKey] = useState(null); // 'public', 'private', or 'ca'
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

  // Clear auth errors when swapping modes
  useEffect(() => {
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
  }, [isSignUp]);

  // Poll certificates every 1 second to fetch real-time expiry countdown ticks (authenticated)
  useEffect(() => {
    if (!token) {
      setCerts([]);
      return;
    }

    const fetchCerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/certificates`, {
          headers: { 'Authorization': token }
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setCerts(data);
      } catch (err) {
        console.error('Failed to poll certificates:', err);
      }
    };

    fetchCerts();
    const interval = setInterval(fetchCerts, 1000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const payload = isSignUp 
      ? { email: authEmail, password: authPassword, name: authName }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isSignUp) {
        setIsSignUp(false);
        setAuthError('Registration successful! Please login.');
      } else {
        localStorage.setItem('ssl_auth_token', data.token);
        localStorage.setItem('ssl_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ssl_auth_token');
    localStorage.removeItem('ssl_user');
    setToken(null);
    setUser(null);
    setSelectedId(null);
  };

  const handleForceRenew = async (id) => {
    setRenewingId(id);
    try {
      await fetch(`${API_BASE}/api/certificates/renew/${id}`, { 
        method: 'POST',
        headers: { 'Authorization': token }
      });
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ targetDomain: discoveryDomain }),
      });
      const data = await res.json();
      
      if (data.discovered) {
        setSelectedId(data.discovered.id);
        setDetailsTab('overview');
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddDomainSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    try {
      const res = await fetch(`${API_BASE}/api/certificates/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          domain: newDomain,
          deploymentTarget: newTarget,
          autoRenew: newAutoRenew
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register domain');
      }

      setIsAddModalOpen(false);
      setNewDomain('');
      // Open details page immediately
      setSelectedId(data.cert.id);
      setDetailsTab('overview');
    } catch (err) {
      setAddError(err.message);
    }
  };

  const handleCopyCryptoKey = (keyText, keyType) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Dynamic file downloads
  const downloadTextFile = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPfxFile = (domain, publicKey, privateKey) => {
    const mockPfxBase64 = "MIIJfgIBAzCCCX4GCSqGSIb3DQEHAaCCCW8EggleMIIJWiADAgECAgEBMA0GCSqGSIb3DQEBCwUAMDMxCzAJBgNVBAYTAlVTMRUwEwYDVQQKEwxMZXQncyBFbmNyeXB0MQswCQYDVQQDEwJEMzAeFw0y";
    const byteCharacters = atob(mockPfxBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/x-pkcs12' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${domain}.pfx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateMockKeys = (domainName) => {
    const cleanDomain = domainName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const partialKey = cleanDomain.substring(0, 16).padEnd(16, 'X');
    
    const publicKey = `-----BEGIN CERTIFICATE-----
MIIEDTCCAfagAwIBAgIQCgEBqV4zX9+${partialKey}LMA0GCSqGSIb3DQEBCwUA
MDMxCzAJBgNVBAYTAlVTMRUwEwYDVQQKEwxMZXQncyBFbmNyeXB0MQswCQYDVQQD
EwJEMzAeFw0yNjA2MjQwNjMwMDBaFw0yNjA5MjIwNjMwMDBaMBgxFjAUBgNVBAMT
D${domainName.substring(0,12)}IIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAzs6uPj3Xv+Zl${cleanDomain.substring(0,10)}9YtKprdgC_vjJ2gfBDNDgSRPKS
3ymOKebOWRztoGrWUW3btmhHTn-EQ9T_2Rgme0gOYMs4EoO4somNxPq7_jwb7zaA
-----END CERTIFICATE-----`;

    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAzs6uPj3Xv+Zl${cleanDomain.substring(0,8)}9YtKprdgC_vjJ2gfBDNDg
SRPKS3ymOKebOWRztoGrWUW3btmhHTn-EQ9T_2Rgme0gOYMs4EoO4somNxPq7_jw
b7zaA4+9dKjEy0WJuUdYiAlNZeJ_xZDV0lY91UF3yudaLotMo5lG9vUUPHMDxAgp
lVE7sy8uZvg+HSXa-0XUVAPMIIEpAIBAAKCAQEA3s6uPj3Xv+Zl${partialKey}
-----END RSA PRIVATE KEY-----`;

    const caBundle = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPGu2OCWLEwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTGEludGVybmV0IFNlY3VyaXR5IERldmVs
b3BtZW50IEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEw
-----END CERTIFICATE-----`;

    return { publicKey, privateKey, caBundle };
  };

  const selectedCert = certs.find(c => c.id === selectedId);

  // Statistics calculation helpers
  const total = certs.length;
  const activeCount = certs.filter(c => c.status === 'Active').length;
  const warningCount = certs.filter(c => c.status === 'Warning').length;
  const expiredCount = certs.filter(c => c.status === 'Expired').length;

  const formatTimeLeft = (sec) => {
    if (sec <= 0) return 'Expired';
    if (sec < 60) return `${sec} seconds left`;
    const days = Math.ceil(sec / (24 * 60 * 60));
    return `${days} days left`;
  };

  // Filter inventory
  const filteredCerts = certs.filter(c => {
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesSearch = c.domain.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // --------------------------------------------------
  // RENDER AUTHENTICATION VIEW (IF NOT LOGGED IN)
  // --------------------------------------------------
  if (!token) {
    return (
      <div className="auth-fullscreen-container">
        <div className="bg-glow-node"></div>
        <div className="bg-glow-node-bottom"></div>

        <div className="auth-card glass-panel">
          <div className="auth-icon-box">
            <Lock size={24} className="animate-pulse" />
          </div>

          <h2 className="auth-title">
            {isSignUp ? 'DevOps Onboarding' : 'Access Control'}
          </h2>
          <p className="auth-subtitle">
            {isSignUp ? 'Register to automate certificates across VM clusters' : 'Sign in to access your secure SRE console'}
          </p>

          {authError && (
            <div className={`auth-error-alert ${authError.includes('successful') || authError.includes('Please') ? 'success' : ''}`}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {isSignUp && (
              <div className="form-group">
                <label className="form-label"><User size={13} /> Full Name</label>
                <input 
                  type="text" 
                  value={authName} 
                  onChange={(e) => setAuthName(e.target.value)} 
                  placeholder="Chirag Modha"
                  className="form-input" 
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label"><Mail size={13} /> Email Address</label>
              <input 
                type="email" 
                value={authEmail} 
                onChange={(e) => setAuthEmail(e.target.value)} 
                placeholder="chirag@zerobyte.dev"
                className="form-input" 
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label"><Lock size={13} /> Password</label>
              <input 
                type="password" 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)} 
                placeholder="••••••••"
                className="form-input" 
                required
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn">
              <span>{isSignUp ? 'Register Console' : 'Authenticate Credentials'}</span>
            </button>
          </form>

          <div className="auth-toggle-link">
            {isSignUp ? (
              <span>Already registered? <button onClick={() => setIsSignUp(false)}>Login</button></span>
            ) : (
              <span>New administrator? <button onClick={() => setIsSignUp(true)}>Sign Up</button></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER DEDICATED CERTIFICATE DETAILS PAGE
  // --------------------------------------------------
  if (selectedCert) {
    const { publicKey, privateKey, caBundle } = generateMockKeys(selectedCert.domain);

    return (
      <div className="app-container">
        <div className="bg-glow-node"></div>
        <div className="bg-glow-node-bottom"></div>

        {/* Back navigation header */}
        <header className="dashboard-header">
          <div className="header-title-box">
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setSelectedId(null);
                setIsDownloadDropdownOpen(false);
              }}
              style={{ padding: '0.5rem 1rem' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Inventory</span>
            </button>
          </div>

          <div className="header-title-box" style={{ textAlign: 'right' }}>
            <span className={`cert-status-badge ${selectedCert.status.toLowerCase()}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}>
              {selectedCert.status}
            </span>
          </div>
        </header>

        {/* Details page content card */}
        <div className="glass-panel details-workspace-card">
          <div className="details-header-card">
            <div className="details-header-row">
              <h2>
                <Globe size={24} className="text-cyan" />
                <span>{selectedCert.domain}</span>
              </h2>

              <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                <button
                  onClick={() => handleForceRenew(selectedCert.id)}
                  disabled={selectedCert.status === 'Renewing' || renewingId === selectedCert.id}
                  className="btn btn-primary"
                >
                  <RotateCw size={15} className={selectedCert.status === 'Renewing' ? 'animate-spin' : ''} />
                  <span>{selectedCert.status === 'Renewing' ? 'ACME Renewal active...' : 'Force Renew'}</span>
                </button>

                {/* Dropdown Container (pure relative wrapper) */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                    className="btn btn-secondary"
                  >
                    <Download size={15} />
                    <span>Download Bundle</span>
                  </button>

                  {/* Absolute positioned floating dropdown */}
                  {isDownloadDropdownOpen && (
                    <div className="download-dropdown-menu">
                      <button 
                        onClick={() => {
                          downloadTextFile(publicKey, `${selectedCert.domain}.pem`);
                          setIsDownloadDropdownOpen(false);
                        }}
                        className="dropdown-item"
                      >
                        Public Certificate (.pem)
                      </button>
                      
                      <button 
                        onClick={() => {
                          downloadTextFile(privateKey, `${selectedCert.domain}.key`);
                          setIsDownloadDropdownOpen(false);
                        }}
                        className="dropdown-item"
                      >
                        Private RSA Key (.key)
                      </button>
                      
                      <button 
                        onClick={() => {
                          downloadTextFile(caBundle, `ca-bundle.crt`);
                          setIsDownloadDropdownOpen(false);
                        }}
                        className="dropdown-item"
                      >
                        CA Root Bundle (.crt)
                      </button>

                      <button 
                        onClick={() => {
                          downloadPfxFile(selectedCert.domain, publicKey, privateKey);
                          setIsDownloadDropdownOpen(false);
                        }}
                        className="dropdown-item"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#c084fc' }}
                      >
                        IIS PKCS#12 Bundle (.pfx)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details screen tabs switcher */}
          <div className="tab-row">
            <button 
              className={`tab-btn ${detailsTab === 'overview' ? 'active' : ''}`}
              onClick={() => {
                setDetailsTab('overview');
                setIsDownloadDropdownOpen(false);
              }}
            >
              Overview & Shell Logs
            </button>
            <button 
              className={`tab-btn ${detailsTab === 'keys' ? 'active' : ''}`}
              onClick={() => {
                setDetailsTab('keys');
                setIsDownloadDropdownOpen(false);
              }}
            >
              Cryptographic Bundle
            </button>
          </div>

          {/* Tab contents */}
          {detailsTab === 'overview' ? (
            <div className="details-overview-grid">
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <h3 className="spec-label" style={{ marginBottom: '1.25rem', color: '#fff', fontSize: '0.85rem' }}>Certificate Metadata Specifications</h3>
                
                <div className="spec-grid">
                  <div className="spec-field">
                    <span className="spec-label">CA Certificate Issuer</span>
                    <span className="spec-value">{selectedCert.issuer}</span>
                  </div>
                  <div className="spec-field">
                    <span className="spec-label">Remote Deploy Agent Target</span>
                    <span className="spec-value">{selectedCert.deploymentTarget}</span>
                  </div>
                  <div className="spec-field">
                    <span className="spec-label">Policy Expiry Timeleft</span>
                    <span className="spec-value mono">{formatTimeLeft(selectedCert.expirySecondsLeft)}</span>
                  </div>
                  <div className="spec-field">
                    <span className="spec-label">Auto-Renew Policy</span>
                    <span className="spec-value">
                      {selectedCert.autoRenew ? 'Active (renewal at <= 30s)' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Console log output terminal */}
              <div className="logs-console-card">
                <div className="terminal-header" style={{ border: 'none', padding: 0 }}>
                  <Terminal size={14} className="text-cyan" style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }} />
                  <span className="spec-label" style={{ color: '#fff', display: 'inline-block', verticalAlign: 'middle' }}>SSH & ACME Agent Console logs</span>
                </div>
                
                <div className="terminal-box">
                  {selectedCert.logs.map((logLine, idx) => (
                    <div key={idx} className="terminal-line">
                      {logLine}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Cryptographic Bundle tab */
            <div className="keys-grid-stack">
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div className="key-editor-block">
                  <div className="key-block-header">
                    <span>Public Key Certificate (fullchain.pem)</span>
                    <button 
                      onClick={() => handleCopyCryptoKey(publicKey, 'public')}
                      className="key-copy-btn"
                    >
                      {copiedKey === 'public' ? (
                        <span className="text-success" style={{ color: '#10b981' }}><Check size={12} /> Copied</span>
                      ) : (
                        <span><Copy size={12} /> Copy PEM</span>
                      )}
                    </button>
                  </div>
                  <pre className="key-terminal-display"><code>{publicKey}</code></pre>
                </div>

                <div className="key-editor-block" style={{ marginTop: '1.75rem' }}>
                  <div className="key-block-header">
                    <span>Private RSA Certificate Key (privkey.pem)</span>
                    <button 
                      onClick={() => handleCopyCryptoKey(privateKey, 'private')}
                      className="key-copy-btn"
                    >
                      {copiedKey === 'private' ? (
                        <span className="text-success" style={{ color: '#10b981' }}><Check size={12} /> Copied</span>
                      ) : (
                        <span><Copy size={12} /> Copy Key</span>
                      )}
                    </button>
                  </div>
                  <pre className="key-terminal-display" style={{ color: '#a855f7' }}><code>{privateKey}</code></pre>
                </div>

                <div className="key-editor-block" style={{ marginTop: '1.75rem' }}>
                  <div className="key-block-header">
                    <span>CA Root Bundle (ca-bundle.crt)</span>
                    <button 
                      onClick={() => handleCopyCryptoKey(caBundle, 'ca')}
                      className="key-copy-btn"
                    >
                      {copiedKey === 'ca' ? (
                        <span className="text-success" style={{ color: '#10b981' }}><Check size={12} /> Copied</span>
                      ) : (
                        <span><Copy size={12} /> Copy CRT</span>
                      )}
                    </button>
                  </div>
                  <pre className="key-terminal-display" style={{ color: '#6366f1' }}><code>{caBundle}</code></pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER MAIN INVENTORY DASHBOARD (IF LOGGED IN)
  // --------------------------------------------------
  return (
    <div className="app-container">
      <div className="bg-glow-node"></div>
      <div className="bg-glow-node-bottom"></div>

      {/* Main Header */}
      <header className="dashboard-header">
        <div className="header-title-box">
          <h1>
            <Activity size={26} className="animate-pulse" style={{ color: '#6366f1' }} />
            <span>SSL<span style={{ color: '#a855f7' }}>Automation</span></span>
          </h1>
          <p>DevOps Console: <span style={{ color: '#fff', fontWeight: 600 }}>{user.name}</span></p>
        </div>

        {/* Action Row: Scan & Add Domain & Logout */}
        <div className="header-actions-row">
          <form onSubmit={handleDiscoveryScan} className="discovery-input-box">
            <input
              type="text"
              placeholder="Target scope (e.g. site.com)"
              value={discoveryDomain}
              onChange={(e) => setDiscoveryDomain(e.target.value)}
              className="domain-input"
              disabled={isScanning}
            />
            <button type="submit" className="btn btn-secondary" disabled={isScanning} style={{ marginLeft: '0.5rem' }}>
              <Network size={16} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? 'Scanning...' : 'Discovery Scan'}</span>
            </button>
          </form>

          <button 
            onClick={() => setIsAddModalOpen(true)} 
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Add Domain</span>
          </button>

          <button onClick={handleLogout} className="btn btn-secondary" title="Sign out of console">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Summary Stats Cards */}
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
            <div className="stat-label">Expired Certs</div>
          </div>
        </div>
      </section>

      {/* Filters & Workspace Area */}
      <main className="glass-panel">
        <div className="controls-deck">
          <div className="cert-list-header" style={{ margin: 0, padding: 0, border: 'none' }}>
            <h2>Domain Certificate Inventory</h2>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input Box */}
            <div className="search-field-box">
              <input 
                type="text" 
                placeholder="Search domain..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {/* Status Filter Tab Buttons */}
            <div className="tab-row">
              {['All', 'Active', 'Warning', 'Expired'].map(statusOption => (
                <button
                  key={statusOption}
                  onClick={() => setFilterStatus(statusOption)}
                  className={`tab-btn ${filterStatus === statusOption ? 'active' : ''}`}
                >
                  {statusOption}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cert-items-stack" style={{ marginTop: '1.5rem' }}>
          {filteredCerts.length > 0 ? (
            filteredCerts.map(cert => (
              <div
                key={cert.id}
                onClick={() => setSelectedId(cert.id)}
                className="cert-card glass-panel"
                style={{ cursor: 'pointer' }}
              >
                <div className="cert-info-col">
                  <div className="cert-domain-name">{cert.domain}</div>
                  <div className="cert-issuer-lbl">CA Issuer: {cert.issuer}</div>
                  
                  <div className="cert-badge-row">
                    <span className={`cert-status-badge ${cert.status.toLowerCase()}`}>
                      {cert.status}
                    </span>
                    <span className="cert-tag-target">
                      <Server size={11} style={{ marginRight: '0.2rem', verticalAlign: 'middle' }} />
                      {cert.deploymentTarget.split(' ')[0]}
                    </span>
                    {cert.autoRenew && (
                      <span className="cert-tag-target" style={{ borderColor: 'var(--clr-purple)', color: '#c084fc' }}>
                        Auto-Renew
                      </span>
                    )}
                  </div>
                </div>

                <div className="cert-expiry-col">
                  <div className={`cert-expiry-counter ${cert.status.toLowerCase()}`}>
                    <Clock size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                    {formatTimeLeft(cert.expirySecondsLeft)}
                  </div>
                  
                  <div className="cert-action-row">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleForceRenew(cert.id);
                      }}
                      disabled={cert.status === 'Renewing' || renewingId === cert.id}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}
                    >
                      <RotateCw size={12} className={cert.status === 'Renewing' ? 'animate-spin' : ''} />
                      <span>{cert.status === 'Renewing' ? 'Renewing...' : 'Quick Renew'}</span>
                    </button>
                    
                    <button
                      onClick={() => setSelectedId(cert.id)}
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      <span>Spec Details</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-secondary)' }}>
              No certificates registered match current search or filters.
            </div>
          )}
        </div>
      </main>

      {/* --------------------------------------------------
         MODAL: ADD MANUALLY REGISTERED INGRESS DOMAIN
         -------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="add-domain-modal-overlay">
          <div className="add-modal-card glass-panel">
            <div className="add-modal-header">
              <h3>Register Domain Ingress</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="add-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div className="auth-error-alert" style={{ marginBottom: '1rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDomainSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label"><Globe size={13} /> Domain Ingress Name</label>
                <input 
                  type="text" 
                  value={newDomain} 
                  onChange={(e) => setNewDomain(e.target.value)} 
                  placeholder="chiragmodha.in"
                  className="form-input" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Server size={13} /> Deployment Target Agent</label>
                <select 
                  value={newTarget} 
                  onChange={(e) => setNewTarget(e.target.value)} 
                  className="form-input"
                  style={{ background: '#090d16', color: '#fff' }}
                >
                  <option value="Nginx SSH Agent (vm-prod-02)">Nginx SSH Agent (vm-prod-02)</option>
                  <option value="Cloudflare Edge CDN">Cloudflare Edge CDN</option>
                  <option value="Nginx SSH Agent (vm-auth-01)">Nginx SSH Agent (vm-auth-01)</option>
                  <option value="AWS ACM Deployer">AWS ACM Deployer</option>
                </select>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input 
                  type="checkbox" 
                  id="autoRenewCheckbox"
                  checked={newAutoRenew}
                  onChange={(e) => setNewAutoRenew(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="autoRenewCheckbox" style={{ fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer' }}>
                  Enable Auto-Renewal policy
                </label>
              </div>

              <button type="submit" className="btn btn-primary auth-submit-btn" style={{ marginTop: '0.5rem' }}>
                <span>Provision Domain Certificate</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
