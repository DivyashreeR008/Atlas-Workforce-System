const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8010;
const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://atlas_user:REDACTED_DATABASE_PASSWORD@postgres:5432/atlas_db',
});

// Initialize DB table
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'employee',
        department VARCHAR(100),
        position VARCHAR(100)
      );
    `);
    
    // Create default admin user if not exists
    const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['REDACTED_EMAIL']);
    if (adminCheck.rows.length === 0) {
      const hashedPass = await bcrypt.hash('REDACTED_CREDENTIALS', 10);
      await pool.query(
        'INSERT INTO users (email, password, name, role, department, position) VALUES ($1, $2, $3, $4, $5, $6)',
        ['REDACTED_EMAIL', hashedPass, 'Super Admin', 'admin', 'Global', 'System Administrator']
      );
    }
    
    // Create default HR user
    const hrCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['hr@atlas.io']);
    if (hrCheck.rows.length === 0) {
      const hashedPass = await bcrypt.hash('REDACTED_CREDENTIALS', 10);
      await pool.query(
        'INSERT INTO users (email, password, name, role, department, position) VALUES ($1, $2, $3, $4, $5, $6)',
        ['hr@atlas.io', hashedPass, 'HR Manager', 'hr', 'Human Resources', 'HR Director']
      );
    }

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

initDB();

app.post('/register', async (req, res) => {
  const { email, password, name, role, department, position } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, department, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role',
      [email, hashedPassword, name, role || 'employee', department || 'General', position || 'Staff']
    );

    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        position: user.position
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Auth Service is healthy' });
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});
