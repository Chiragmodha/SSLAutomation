# SSLAutomation

An enterprise-grade, lightweight SSL/TLS certificate management and automatic deployment platform designed to address the upcoming 47-day certificate lifespan standards.

## Key Features
- **Centralized Dashboard**: Track expiry dates, issuers, domains, and deployment logs across all virtual machines and clouds.
- **Auto-Discovery Scan**: Scans subdomains, ports, and internal endpoints to map certificates and flag expiring hosts.
- **Closed-Loop Deployment Hooks**: Pushes renewed certificates to target servers (Nginx over SSH, Cloudflare CDN, AWS ACM) and restarts services automatically.
- **Multi-Tenant Credentials**: Safe local key store for storing deployment API keys and SSH private keys.

## Quick Start (Docker Compose)

### 1. Build and Launch
Ensure you have Docker and Docker Compose installed, then run:
```bash
docker-compose up --build -d
```

### 2. Access the Application
- **Frontend Dashboard**: `http://localhost:3000`
- **Backend API Server**: `http://localhost:5000`
