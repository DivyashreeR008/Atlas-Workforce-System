require('dotenv').config();
const express = require('express');
const http = require('http');
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
const AUDIT_INTERNAL_KEY = process.env.AUDIT_INTERNAL_KEY || 'atlas-internal-key-change-in-prod';
const AUDIT_SERVICE_URL = process.env.AUDIT_COMPLIANCE_SERVICE_URL || 'http://audit-compliance-service:8011';

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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth requests, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many API requests, please try again later' }
});

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to sensitive endpoints, please try again later' }
});

app.use('/api/auth', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/payroll', sensitiveLimiter);
app.use('/api/compliance', sensitiveLimiter);
app.use('/api/audit', sensitiveLimiter);

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
  ats: process.env.ATS_SERVICE_URL || 'http://ats-service:8012',
  lms: process.env.LMS_SERVICE_URL || 'http://lms-service:8013',
  performance:
    process.env.PERFORMANCE_SERVICE_URL || 'http://performance-service:8014',
  copilot:
    process.env.AI_COPILOT_SERVICE_URL || 'http://ai-copilot-service:8015',
  audit:
    process.env.AUDIT_COMPLIANCE_SERVICE_URL || 'http://audit-compliance-service:8011',
  compliance:
    process.env.AUDIT_COMPLIANCE_SERVICE_URL || 'http://audit-compliance-service:8011',
  integration:
    process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:8016',
  lifecycle:
    process.env.EMPLOYEE_LIFECYCLE_SERVICE_URL || 'http://employee-lifecycle-service:8020',
};

const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register'];

function isPublicPath(path) {
  if (path === '/health') return true;
  return PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(p + '?'));
}

function deviceTrustHeaderMiddleware(req, res, next) {
  const deviceId = req.headers['x-device-id'];
  const deviceFingerprint = req.headers['x-device-fingerprint'];

  if (deviceId) {
    req.headers['x-device-id'] = deviceId;
  }
  if (deviceFingerprint) {
    req.headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    req.headers['x-session-id'] = sessionId;
  }

  next();
}

app.use(deviceTrustHeaderMiddleware);

function auditProxyMiddleware(req, res, next) {
  if (req.method === 'GET') {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      return;
    }

    const auditPayload = {
      event_type: `gateway.${req.method.toLowerCase()}`,
      path: req.path,
      method: req.method,
      user_id: req.user?.id || null,
      user_email: req.user?.email || null,
      user_role: req.user?.role || null,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      device_id: req.headers['x-device-id'] || null,
      session_id: req.headers['x-session-id'] || null,
      status_code: res.statusCode,
      timestamp: new Date().toISOString(),
      service: 'api-gateway'
    };

    axios.post(`${AUDIT_SERVICE_URL}/api/v1/audit/log`, auditPayload, {
      headers: { 'X-Internal-Key': AUDIT_INTERNAL_KEY },
      timeout: 2000
    }).catch(err => {
      if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNABORTED') {
        console.error('Audit proxy error:', err.message);
      }
    });
  });

  next();
}

const SENSITIVE_ROUTES = ['/api/payroll', '/api/compliance', '/api/audit'];

function mfaStepUpMiddleware(req, res, next) {
  if (req.method === 'GET') {
    return next();
  }

  const isSensitive = SENSITIVE_ROUTES.some(
    (prefix) => req.path === prefix || req.path.startsWith(prefix + '/')
  );

  if (!isSensitive) {
    return next();
  }

  const mfaValidated = req.headers['x-mfa-validated'];
  if (mfaValidated === 'true') {
    return next();
  }

  const mfaToken = req.headers['x-mfa-token'];
  if (mfaToken) {
    try {
      const payload = jwt.verify(mfaToken, jwtSecret);
      if (payload.mfa_validated && payload.purpose === 'mfa_step_up') {
        req.headers['x-mfa-validated'] = 'true';
        return next();
      }
    } catch {
      // Token invalid, fall through to MFA required
    }
  }

  return res.status(403).json({
    message: 'MFA validation required for this resource',
    mfa_required: true,
    mfa_challenge_url: '/api/auth/mfa/challenge',
    detail: 'Please validate your identity with MFA before accessing sensitive resources'
  });
}

const PUBLIC_PREFIXES = [
  '/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/passwordless/request',
  '/api/auth/passwordless/verify',
  '/api/auth/saml/acs',
  '/api/auth/saml/login',
  '/api/auth/saml/metadata',
  '/saml/acs',
  '/saml/login',
  '/saml/metadata',
  '/api/webhooks',
];

function isPublicOrAuthPath(path) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

function authMiddleware(req, res, next) {
  if (isPublicOrAuthPath(req.path)) {
    return next();
  }

  const protectedPrefixes = [
    '/api/employee',
    '/api/payroll',
    '/api/analytics',
    '/api/notification',
    '/api/attendance',
    '/api/leave',
    '/api/ats',
    '/api/lms',
    '/api/performance',
    '/api/copilot',
    '/api/audit',
    '/api/compliance',
    '/api/integration',
    '/api/lifecycle',
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
  if (isPublicOrAuthPath(req.path)) {
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

  if (path.startsWith('/api/audit') && !['admin', 'auditor'].includes(role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges for audit' });
  }

  if (path.startsWith('/api/compliance') && !['admin', 'compliance', 'hr'].includes(role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges for compliance' });
  }

  next();
}

app.use(rbacMiddleware);

app.use(auditProxyMiddleware);
app.use(mfaStepUpMiddleware);

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
      text: `Leave request submitted for ${startDate} to ${endDate}`
    });
  } catch (err) {
    console.error('Slack Webhook Error:', err.response?.data || err.message);
    res.json({ response_type: "ephemeral", text: `Failed to submit leave: ${err.response?.data?.message || 'Error'}` });
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

function proxyService(target, prefix, pathRewrite) {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq(proxyReq) {
        const deviceId = proxyReq.getHeader('x-device-id');
        const deviceFp = proxyReq.getHeader('x-device-fingerprint');
        const sessionId = proxyReq.getHeader('x-session-id');
        const mfaValidated = proxyReq.getHeader('x-mfa-validated');
        const mfaToken = proxyReq.getHeader('x-mfa-token');
      }
    }
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
    checkCache(req, res, (err) => {
      if (err) return next(err);
      proxy(req, res, next);
    });
  };
}

app.use('/api/auth', proxyService(services.auth, '/api/auth', { '^/api/auth': '' }));
app.use('/scim', proxyService(services.auth, '/scim', { '^/scim': '' }));
app.use('/saml', proxyService(services.auth, '/saml', { '^/saml': '' }));

app.use('/api/employee', proxyService(services.employee, '/api/employee', { '^/api/employee': '' }));
app.use('/api/analytics', proxyService(services.analytics, '/api/analytics', { '^/api/analytics': '/analytics' }));
app.use('/api/attendance', proxyService(services.attendance, '/api/attendance', { '^/api/attendance': '' }));
app.use('/api/leave', proxyService(services.leave, '/api/leave', { '^/api/leave': '' }));
app.use('/api/payroll', proxyService(services.payroll, '/api/payroll', { '^/api/payroll': '' }));
app.use('/api/notification', proxyService(services.notification, '/api/notification', { '^/api/notification': '' }));

app.use('/api/ats', proxyService(services.ats, '/api/ats', { '^/api/ats': '' }));
app.use('/api/lms', proxyService(services.lms, '/api/lms', { '^/api/lms': '' }));
app.use('/api/performance', proxyService(services.performance, '/api/performance', { '^/api/performance': '' }));
app.use('/api/copilot', proxyService(services.copilot, '/api/copilot', { '^/api/copilot': '' }));
app.use('/api/audit', proxyService(services.audit, '/api/audit', { '^/api/audit': '' }));
app.use('/api/compliance', proxyService(services.compliance, '/api/compliance', { '^/api/compliance': '/api/v1' }));

app.use('/api/integration', proxyService(services.integration, '/api/integration', { '^/api/integration': '/api/v1/integration' }));
app.use('/api/lifecycle', proxyService(services.lifecycle, '/api/lifecycle', { '^/api/lifecycle': '/api/v1/lifecycle' }));

const server = app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const isWs = pathname === '/ws' || pathname.endsWith('/notification/ws');
  if (isWs) {
    const target = new URL(services.notification);
    target.pathname = '/ws';
    target.search = new URL(req.url, 'http://localhost').search;
    const proxyReq = http.request(target.toString(), { method: 'GET', headers: req.headers });
    proxyReq.on('upgrade', (proxyRes, proxySocket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + proxyRes.headers['sec-websocket-accept'] + '\r\n' +
        '\r\n');
      socket.pipe(proxySocket).pipe(socket);
    });
    proxyReq.on('error', () => socket.destroy());
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});
