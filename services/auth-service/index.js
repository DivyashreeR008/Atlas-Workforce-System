require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

const PORT = process.env.PORT || 8010;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

if (!JWT_SECRET && NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET is required in production');
  process.exit(1);
}

const jwtSecret = JWT_SECRET || 'dev-only-secret-change-in-production';

const sslConfig = process.env.POSTGRES_SSL === 'true' || NODE_ENV === 'production' 
  ? { rejectUnauthorized: false } 
  : false;

const pool = new Pool({
  connectionString:
    process.env.POSTGRES_URL ||
    'postgresql://atlas_user:REDACTED_DATABASE_PASSWORD@postgres:5432/atlas_db',
  ssl: sslConfig,
});

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id || 'default' },
    jwtSecret,
    { expiresIn: ACCESS_EXPIRY }
  );
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  return token;
}

async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function verifyRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const result = await pool.query(
    `SELECT rt.*, u.id, u.email, u.name, u.role, u.department, u.position, u.tenant_id
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function recordFailedAttempt(email) {
  const lockedUntil = new Date();
  lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES);

  await pool.query(
    `INSERT INTO failed_attempts (email, attempts, locked_until)
     VALUES ($1, 1, NULL)
     ON CONFLICT (email) DO UPDATE SET
       attempts = failed_attempts.attempts + 1,
       locked_until = CASE
         WHEN failed_attempts.attempts + 1 >= $2 THEN $3
         ELSE failed_attempts.locked_until
       END`,
    [email, MAX_FAILED_ATTEMPTS, lockedUntil]
  );
}

async function clearFailedAttempts(email) {
  await pool.query('DELETE FROM failed_attempts WHERE email = $1', [email]);
}

async function isAccountLocked(email) {
  const result = await pool.query(
    'SELECT attempts, locked_until FROM failed_attempts WHERE email = $1',
    [email]
  );
  const row = result.rows[0];
  if (!row) return false;
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return true;
  }
  if (row.locked_until && new Date(row.locked_until) <= new Date()) {
    await pool.query('DELETE FROM failed_attempts WHERE email = $1', [email]);
    return false;
  }
  return false;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    position: user.position,
    tenant_id: user.tenant_id || 'default',
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, jwtSecret);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'employee',
      department VARCHAR(100),
      position VARCHAR(100),
      tenant_id VARCHAR(50) DEFAULT 'default'
    );
  `);

  try {
    await pool.query("ALTER TABLE users ADD COLUMN tenant_id VARCHAR(50) DEFAULT 'default';");
  } catch (err) {
    // Column might already exist
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS failed_attempts (
      email VARCHAR(255) PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP
    );
  `);

  const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', [
    'admin@atlas.io',
  ]);
  if (adminCheck.rows.length === 0) {
    const hashedPass = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10);
    await pool.query(
      'INSERT INTO users (email, password, name, role, department, position, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        'admin@atlas.io',
        hashedPass,
        'Super Admin',
        'admin',
        'Global',
        'System Administrator',
        'default'
      ]
    );
    console.log('Default admin user created (admin@atlas.io)');
  }

  console.log('Database initialized successfully.');
}

initDB().catch((err) => {
  console.error('Database initialization failed:', err);
});

app.post('/register', async (req, res) => {
  const { email, password, name, role, department, position, tenant_id } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, department, position, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, role, department, position, tenant_id',
      [
        email,
        hashedPassword,
        name,
        role || 'employee',
        department || 'General',
        position || 'Staff',
        tenant_id || 'default'
      ]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(result.rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    if (await isAccountLocked(email)) {
      return res.status(423).json({
        message: `Account locked. Try again in ${LOCKOUT_MINUTES} minutes.`,
      });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      await recordFailedAttempt(email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordFailedAttempt(email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await clearFailedAttempts(email);

    const token = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const row = await verifyRefreshToken(refreshToken);
    if (!row) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    await revokeRefreshToken(refreshToken);

    const user = {
      id: row.id,
      email: row.email,
      role: row.role,
    };
    const token = signAccessToken(user);
    const newRefreshToken = await createRefreshToken(row.user_id);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Token refreshed',
      token,
      refreshToken: newRefreshToken,
      user: sanitizeUser(row),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during token refresh' });
  }
});

app.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  try {
    await revokeRefreshToken(refreshToken);
    res.clearCookie('refreshToken');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Auth Service is healthy' });
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});

module.exports = { app, requireRole, pool };
