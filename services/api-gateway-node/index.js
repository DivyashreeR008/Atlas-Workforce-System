require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

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
app.use(express.json());

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

app.use(
  '/api/auth',
  createProxyMiddleware({
    target: services.auth,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' },
  })
);

app.use(
  '/api/employee',
  createProxyMiddleware({
    target: services.employee,
    changeOrigin: true,
    pathRewrite: { '^/api/employee': '' },
  })
);

app.use(
  '/api/payroll',
  createProxyMiddleware({
    target: services.payroll,
    changeOrigin: true,
    pathRewrite: { '^/api/payroll': '' },
  })
);

app.use(
  '/api/analytics',
  createProxyMiddleware({
    target: services.analytics,
    changeOrigin: true,
    pathRewrite: { '^/api/analytics': '' },
  })
);

app.use(
  '/api/notification',
  createProxyMiddleware({
    target: services.notification,
    changeOrigin: true,
    pathRewrite: { '^/api/notification': '' },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
