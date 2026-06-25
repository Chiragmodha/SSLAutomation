const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/sslautomation';

let pool = null;
let usePostgres = false;

async function initDb() {
  console.log('[SSLAutomation DB] Checking database connectivity...');
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 1500 // Fail fast (1.5s timeout)
  });

  try {
    const client = await pool.connect();
    client.release();
    usePostgres = true;
    console.log('[SSLAutomation DB] Successfully connected to PostgreSQL.');
  } catch (err) {
    console.warn('[SSLAutomation DB] WARNING: PostgreSQL connection failed. Falling back to In-Memory storage.');
    usePostgres = false;
    pool = null;
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        domain VARCHAR(255) NOT NULL,
        issuer VARCHAR(255),
        status VARCHAR(50),
        expiry_time INTEGER,
        deployment_target VARCHAR(255),
        auto_renew BOOLEAN,
        logs JSONB
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp VARCHAR(50),
        message TEXT
      );
    `);

    const res = await pool.query('SELECT * FROM users WHERE email = $1', ['chirag@zerobyte.dev']);
    if (res.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        ['user-1', 'chirag@zerobyte.dev', 'password123', 'Chirag Modha']
      );

      await pool.query(`
        INSERT INTO certificates (id, user_id, domain, issuer, status, expiry_time, deployment_target, auto_renew, logs) VALUES
        ('1', 'user-1', 'api.zerobyte.dev', 'Let''s Encrypt Authority X3', 'Active', 2592000, 'Cloudflare Edge CDN', true, '["[04:22:10] Certificate checked. Verified at Cloudflare API edge."]'::jsonb),
        ('2', 'user-1', 'dashboard.zerobyte.dev', 'Let''s Encrypt Authority X3', 'Warning', 90, 'Nginx SSH Agent (vm-prod-02)', true, '["[09:12:05] Cname configured to local hostVM.", "[09:14:00] Warning: Certificate lifetime is dropping below 2 minutes."]'::jsonb),
        ('3', 'user-1', 'internal-auth.secure.local', 'Internal Private CA v2', 'Expired', -259200, 'Nginx SSH Agent (vm-auth-01)', false, '["[03:10:00] Expired: Private CA certificate could not renew due to manual approval gate block."]'::jsonb);
      `);
    }
  } catch (err) {
    console.error('[SSLAutomation DB] Schema creation failed, falling back to In-Memory mode:', err);
    usePostgres = false;
    pool = null;
  }
}

function getUsePostgres() {
  return usePostgres;
}

module.exports = {
  query: (text, params) => {
    if (!usePostgres || !pool) {
      throw new Error('Database is running in in-memory fallback mode.');
    }
    return pool.query(text, params);
  },
  initDb,
  getUsePostgres
};
