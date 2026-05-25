require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const redis = require('redis');
const axios = require('axios');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redisClient = redis.createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis successfully'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis, caching disabled:', err);
  }
})();

async function checkCache(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }
  
  if (!redisClient.isOpen) {
    return next();
  }

  const userScope = req.user ? req.user.id : 'public';
  const key = `cache:${userScope}:${req.originalUrl}`;
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', 'application/json');
      return res.send(cachedData);
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  next();
}

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET is required in production');
  process.exit(1);
}

const jwtSecret = JWT_SECRET || 'dev-only-secret-change-in-production';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
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
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many auth requests, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:8010',
  employee: process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:8001',
  payroll: process.env.PAYROLL_SERVICE_URL || 'http://payroll-service:8002',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003',
  notification:
    process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8004',
  attendance:
    process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:8005',
  leave:
    process.env.LEAVE_SERVICE_URL || 'http://leave-service:8006',
};

const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register'];

function isPublicPath(path) {
  if (path === '/health') return true;
  return PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(p + '?'));
}

function authMiddleware(req, res, next) {
  if (isPublicPath(req.path)) {
    return next();
  }

  const protectedPrefixes = [
    '/api/employee',
    '/api/payroll',
    '/api/analytics',
    '/api/notification',
    '/api/attendance',
    '/api/leave',
  ];

  const needsAuth = protectedPrefixes.some(
    (prefix) => req.path === prefix || req.path.startsWith(prefix + '/')
  );

  if (!needsAuth) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

app.use(authMiddleware);

function rbacMiddleware(req, res, next) {
  if (isPublicPath(req.path)) {
    return next();
  }
  
  const role = req.user?.role || 'employee';
  const path = req.path;

  if (path.startsWith('/api/payroll') && !['admin', 'hr'].includes(role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges for payroll' });
  }

  if (path.startsWith('/api/analytics') && !['admin', 'manager', 'hr'].includes(role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges for analytics' });
  }

  if (path.startsWith('/api/employee') && req.method !== 'GET' && !['admin', 'hr'].includes(role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges to modify employees' });
  }

  next();
}

app.use(rbacMiddleware);

// Local webhook and integration endpoints
app.post('/api/webhooks/slack', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { text, user_name } = req.body;
    
    const employeeId = user_name || 'slack_user';
    const tenantId = 'default';
    
    const parts = text ? text.split(' ') : [];
    if (parts.length < 3) {
      return res.json({
        response_type: "ephemeral",
        text: "Please use format: `/atlas-leave YYYY-MM-DD to YYYY-MM-DD Reason`"
      });
    }
    
    const startDate = parts[0];
    const endDate = parts[2];
    const leaveType = 'VACATION';
    const reason = parts.slice(3).join(' ') || 'Slack request';

    const leaveServiceUrl = `${services.leave}/request`;
    const response = await axios.post(leaveServiceUrl, {
      employeeId, startDate, endDate, leaveType, reason
    }, {
      headers: { 'X-Tenant-Id': tenantId }
    });

    return res.json({
      response_type: "in_channel",
      text: `✅ Leave request submitted for ${startDate} to ${endDate}`
    });
  } catch (err) {
    console.error('Slack Webhook Error:', err.response?.data || err.message);
    res.json({ response_type: "ephemeral", text: `❌ Failed to submit leave: ${err.response?.data?.message || 'Error'}` });
  }
});

app.post('/api/billing/create-checkout-session', express.json(), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 'default';
    
    const employeeServiceUrl = `${services.employee}/employees`;
    const response = await axios.get(employeeServiceUrl, {
      headers: { 'X-Tenant-Id': tenantId }
    });
    
    const headcount = response.data?.total || 1;
    const perSeatPrice = 10;
    const totalAmount = headcount * perSeatPrice;
    
    return res.json({
      checkoutUrl: `https://mock-stripe.atlas.io/checkout/${tenantId}?amount=${totalAmount}`,
      headcount,
      totalAmount,
      currency: 'USD'
    });
  } catch (err) {
    console.error('Billing Error:', err.message);
    res.status(500).json({ message: 'Internal error generating checkout session' });
  }
});

function proxyService(target, prefix, pathRewrite, stripRootSlash) {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
  });
  return (req, res, next) => {
    if (req.user) {
      req.headers['X-User-Id'] = String(req.user.id);
      req.headers['X-User-Role'] = String(req.user.role);
      req.headers['X-User-Email'] = String(req.user.email);
      if (req.user.tenant_id) {
        req.headers['X-Tenant-Id'] = String(req.user.tenant_id);
      }
    }
    req.url = prefix + req.url;
    if (stripRootSlash && req.url === prefix + '/') {
      req.url = prefix;
    }
    checkCache(req, res, (err) => {
      if (err) return next(err);
      proxy(req, res, next);
    });
  };
}

app.use('/api/auth', proxyService(services.auth, '/api/auth', { '^/api/auth': '' }));
app.use('/api/employee', proxyService(services.employee, '/api/employee', { '^/api/employee': '' }));
app.use('/api/analytics', proxyService(services.analytics, '/api/analytics', { '^/api/analytics': '/analytics' }));
app.use('/api/attendance', proxyService(services.attendance, '/api/attendance'));
app.use('/api/leave', proxyService(services.leave, '/api/leave', null, true));
app.use('/api/payroll', proxyService(services.payroll, '/api/payroll', null, true));
app.use('/api/notification', proxyService(services.notification, '/api/notification'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
