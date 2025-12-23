const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('✓ Database connected successfully');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make pool available to routes
app.locals.pool = pool;

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Aegis-Link Backend is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// USER ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const did = `did:aegis:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, did) VALUES ($1, $2, $3, $4) RETURNING id, name, email, did, created_at',
      [name, email, hashedPassword, did]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        did: user.did,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        did: user.did,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, did, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CREDENTIAL ROUTES
// ============================================

app.get('/api/credentials', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credentials WHERE user_id = $1 ORDER BY issued_date DESC',
      [req.user.id]
    );

    res.json({ credentials: result.rows });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/credentials', authenticateToken, async (req, res) => {
  try {
    const { type, issuer, private_data, schema } = req.body;

    if (!type || !issuer || !private_data) {
      return res.status(400).json({ error: 'Type, issuer, and private_data are required' });
    }

    const result = await pool.query(
      'INSERT INTO credentials (user_id, type, issuer, private_data, schema) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, type, issuer, JSON.stringify(private_data), schema || null]
    );

    res.status(201).json({
      message: 'Credential added successfully',
      credential: result.rows[0]
    });
  } catch (error) {
    console.error('Add credential error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/credentials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM credentials WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// VERIFICATION ROUTES
// ============================================

app.post('/api/verifications', authenticateToken, async (req, res) => {
  try {
    const { service_name, purpose, data_requested, retention_period, required_proof } = req.body;

    if (!service_name || !purpose || !data_requested) {
      return res.status(400).json({ error: 'Service name, purpose, and data requested are required' });
    }

    const result = await pool.query(
      'INSERT INTO verification_requests (user_id, service_name, purpose, data_requested, retention_period, required_proof, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        req.user.id,
        service_name,
        purpose,
        JSON.stringify(data_requested),
        retention_period || '90 days',
        JSON.stringify(required_proof),
        'pending'
      ]
    );

    res.status(201).json({
      message: 'Verification request created',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Create verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/verifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM verification_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/verifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, ai_analysis, zk_proof } = req.body;

    const result = await pool.query(
      'UPDATE verification_requests SET status = $1, ai_analysis = $2, zk_proof = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 RETURNING *',
      [status, JSON.stringify(ai_analysis), zk_proof, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification request not found' });
    }

    res.json({
      message: 'Verification updated',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// STATISTICS ROUTES
// ============================================

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const verificationsResult = await pool.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as successful FROM verification_requests WHERE user_id = $2',
      ['completed', req.user.id]
    );

    const credentialsResult = await pool.query(
      'SELECT COUNT(*) as total FROM credentials WHERE user_id = $1',
      [req.user.id]
    );

    const stats = verificationsResult.rows[0];
    const totalVerifications = parseInt(stats.total);
    const successfulVerifications = parseInt(stats.successful);
    const successRate = totalVerifications > 0 
      ? ((successfulVerifications / totalVerifications) * 100).toFixed(1)
      : 0;

    res.json({
      stats: {
        totalVerifications,
        successRate: parseFloat(successRate),
        totalCredentials: parseInt(credentialsResult.rows[0].total),
        averageTrustScore: 76,
        dataPrivacySaved: '4.2 GB'
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ACTIVITY LOG ROUTES
// ============================================

app.get('/api/activity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/activity', authenticateToken, async (req, res) => {
  try {
    const { action, status, details } = req.body;

    const result = await pool.query(
      'INSERT INTO activity_log (user_id, action, status, details) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, action, status || 'info', details || null]
    );

    res.status(201).json({
      message: 'Activity logged',
      activity: result.rows[0]
    });
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CONSENT ROUTES - INTEGRATED
// ============================================

// Import consent routes
const consentRoutes = require('./routes/consentRoutes');

// Use consent routes with authentication
app.use('/api', authenticateToken, consentRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n🚀 Aegis-Link Backend Server`);
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   ✓ Consent Management: Enabled\n`);
});