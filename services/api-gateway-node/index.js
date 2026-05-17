require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const redis = require('redis');

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

  const key = `cache:${req.originalUrl}`;
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

const cacheInterceptor = responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
  const response = responseBuffer.toString('utf8');
  if (req.method === 'GET' && proxyRes.statusCode === 200 && redisClient.isOpen) {
    const key = `cache:${req.originalUrl}`;
    try {
      await redisClient.setEx(key, 15, response);
    } catch (err) {
      console.error('Failed to write to cache:', err);
    }
  }
  return responseBuffer;
});

function getProxyOptions(target, prefix) {
  return {
    target,
    changeOrigin: true,
    pathRewrite: { [`^${prefix}`]: '' },
    selfHandleResponse: true,
    onProxyReq(proxyReq, req, res) {
      if (req.user) {
        proxyReq.setHeader('X-User-Id', String(req.user.id));
        proxyReq.setHeader('X-User-Role', String(req.user.role));
        proxyReq.setHeader('X-User-Email', String(req.user.email));
      }
      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: cacheInterceptor,
  };
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
  checkCache,
  createProxyMiddleware(getProxyOptions(services.employee, '/api/employee'))
);

app.use(
  '/api/payroll',
  checkCache,
  createProxyMiddleware(getProxyOptions(services.payroll, '/api/payroll'))
);

app.use(
  '/api/analytics',
  checkCache,
  createProxyMiddleware(getProxyOptions(services.analytics, '/api/analytics'))
);

app.use(
  '/api/notification',
  checkCache,
  createProxyMiddleware(getProxyOptions(services.notification, '/api/notification'))
);

app.use(
  '/api/attendance',
  checkCache,
  createProxyMiddleware(getProxyOptions(services.attendance, '/api/attendance'))
);

app.use(
  '/api/leave',
  checkCache,
  createProxyMiddleware(getProxyOptions(services.leave, '/api/leave'))
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
