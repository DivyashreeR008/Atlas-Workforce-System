// Dummy secrets so the gateway module can be required without real env.
// CI also sets these, but unit tests should work with plain `npm test`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-value';
process.env.INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET || 'unit-test-internal-secret-value';
process.env.AUDIT_INTERNAL_KEY = process.env.AUDIT_INTERNAL_KEY || 'unit-test-audit-key';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { csrfMiddleware, rbacMiddleware, services, isPublicOrAuthPath, authMiddleware, mfaStepUpMiddleware, auditProxyMiddleware, deviceTrustHeaderMiddleware, checkCache, cacheInvalidationMiddleware, verifySlackRequest, isWsPath, globalErrorHandler, consumeMfaJti, revokeCheck } = require('./index');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';

// Health check test - fails when the gateway is unreachable (no skipping).
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    http.get(GATEWAY_URL + '/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 200);
          const body = JSON.parse(data);
          assert.ok(body.status.includes('API Gateway'));
          console.log('PASS: /health returns 200');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(new Error('Gateway not reachable at ' + GATEWAY_URL + ': ' + err.message));
    });
  });
}

// CSRF middleware tests
function testCsrfMiddleware() {
  // Test 1: GET request should pass through without CSRF check
  let called = false;
  const req1 = { method: 'GET', path: '/api/employee', cookies: {}, headers: {} };
  const res1 = { statusCode: 200, setHeader: () => {}, cookie: () => {} };
  csrfMiddleware(req1, res1, () => { called = true; });
  assert.strictEqual(called, true, 'GET should pass CSRF check');
  console.log('PASS: csrfMiddleware allows GET requests');

  // Test 2: Public auth paths should bypass CSRF
  called = false;
  const req2 = { method: 'POST', path: '/api/auth/login', cookies: {}, headers: {} };
  csrfMiddleware(req2, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Public auth paths should bypass CSRF');
  console.log('PASS: csrfMiddleware allows public auth paths');

  // Test 3: POST without CSRF cookie should pass (API clients)
  called = false;
  const req3 = { method: 'POST', path: '/api/employee', cookies: {}, headers: {} };
  csrfMiddleware(req3, res1, () => { called = true; });
  assert.strictEqual(called, true, 'POST without CSRF cookie should pass');
  console.log('PASS: csrfMiddleware allows POST without CSRF cookie');

  // Test 4: POST with CSRF cookie but no header token should be blocked
  called = false;
  let blocked = false;
  const req4 = { method: 'POST', path: '/api/employee', cookies: { csrf_token: 'abc123' }, headers: {} };
  const res4 = {
    statusCode: 200,
    setHeader: () => {},
    cookie: () => {},
    status(code) { this.statusCode = code; return this; },
    json(data) { blocked = true; return this; }
  };
  csrfMiddleware(req4, res4, () => { called = true; });
  assert.strictEqual(called, false, 'POST with cookie but no header should be blocked');
  assert.strictEqual(blocked, true, 'Should return 403 JSON response');
  console.log('PASS: csrfMiddleware blocks POST with cookie but no header token');

  // Test 5: POST with matching CSRF cookie and header should pass
  called = false;
  const req5 = { method: 'POST', path: '/api/employee', cookies: { csrf_token: 'abc123' }, headers: { 'x-csrf-token': 'abc123' } };
  csrfMiddleware(req5, res1, () => { called = true; });
  assert.strictEqual(called, true, 'POST with matching cookie and header should pass');
  console.log('PASS: csrfMiddleware allows POST with matching CSRF tokens');

  // Test 6: POST with mismatched CSRF cookie and header should be blocked
  called = false;
  blocked = false;
  const req6 = { method: 'POST', path: '/api/employee', cookies: { csrf_token: 'abc123' }, headers: { 'x-csrf-token': 'xyz789' } };
  csrfMiddleware(req6, res4, () => { called = true; });
  assert.strictEqual(called, false, 'POST with mismatched tokens should be blocked');
  assert.strictEqual(blocked, true, 'Should return 403 JSON response');
  console.log('PASS: csrfMiddleware blocks POST with mismatched CSRF tokens');
}

// RBAC middleware tests
function testRbacMiddleware() {
  // Test 1: Admin should access payroll
  let called = false;
  const req1 = { path: '/api/payroll', method: 'GET', user: { role: 'admin' } };
  const res1 = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  rbacMiddleware(req1, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Admin should access payroll');
  console.log('PASS: rbacMiddleware allows admin to access payroll');

  // Test 2: Employee should NOT access payroll
  called = false;
  let blocked = false;
  const req2 = { path: '/api/payroll', method: 'GET', user: { role: 'employee' } };
  const res2 = { statusCode: 200, status(code) { this.statusCode = code; blocked = true; return this; }, json() { return this; } };
  rbacMiddleware(req2, res2, () => { called = true; });
  assert.strictEqual(called, false, 'Employee should not access payroll');
  assert.strictEqual(blocked, true, 'Should return 403');
  console.log('PASS: rbacMiddleware blocks employee from payroll');

  // Test 3: Manager should access analytics
  called = false;
  const req3 = { path: '/api/analytics', method: 'GET', user: { role: 'manager' } };
  rbacMiddleware(req3, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Manager should access analytics');
  console.log('PASS: rbacMiddleware allows manager to access analytics');

  // Test 4: Employee should NOT access analytics
  called = false;
  blocked = false;
  const req4 = { path: '/api/analytics', method: 'GET', user: { role: 'employee' } };
  rbacMiddleware(req4, res2, () => { called = true; });
  assert.strictEqual(called, false, 'Employee should not access analytics');
  assert.strictEqual(blocked, true, 'Should return 403');
  console.log('PASS: rbacMiddleware blocks employee from analytics');

  // Test 5: Public paths should bypass RBAC
  called = false;
  const req5 = { path: '/api/auth/login', method: 'POST', user: { role: 'employee' } };
  rbacMiddleware(req5, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Public paths should bypass RBAC');
  console.log('PASS: rbacMiddleware allows public auth paths');

  // Test 6: HR should access employee modification
  called = false;
  const req6 = { path: '/api/employee', method: 'POST', user: { role: 'hr' } };
  rbacMiddleware(req6, res1, () => { called = true; });
  assert.strictEqual(called, true, 'HR should modify employees');
  console.log('PASS: rbacMiddleware allows HR to modify employees');

  // Test 7: Employee should NOT modify employees
  called = false;
  blocked = false;
  const req7 = { path: '/api/employee', method: 'POST', user: { role: 'employee' } };
  rbacMiddleware(req7, res2, () => { called = true; });
  assert.strictEqual(called, false, 'Employee should not modify employees');
  assert.strictEqual(blocked, true, 'Should return 403');
  console.log('PASS: rbacMiddleware blocks employee from modifying employees');

  // Test 8: Employee can read their own payslips through the self-service path
  called = false;
  const req8 = { path: '/api/payroll/me/payslips', method: 'GET', user: { role: 'employee' } };
  rbacMiddleware(req8, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Employee should reach /api/payroll/me/*');
  console.log('PASS: rbacMiddleware allows employee self-service payslips');

  // Test 9: The self-service exemption must not leak to the rest of payroll
  called = false;
  blocked = false;
  const req9 = { path: '/api/payroll/me/payslips/1/download', method: 'GET', user: { role: 'manager' } };
  rbacMiddleware(req9, res2, () => { called = true; });
  assert.strictEqual(called, false, 'Manager should not read payslips for everyone');
  assert.strictEqual(blocked, true, 'Should return 403');
  console.log('PASS: rbacMiddleware keeps non-self payroll HR-only');

  // Test 10: Employee can edit their own profile
  called = false;
  const req10 = { path: '/api/employee/me', method: 'PUT', user: { role: 'employee' } };
  rbacMiddleware(req10, res1, () => { called = true; });
  assert.strictEqual(called, true, 'Employee should edit their own profile');
  console.log('PASS: rbacMiddleware allows employee profile self-edit');

  // Test 11: Profile edits for other employees stay HR-only
  called = false;
  blocked = false;
  const req11 = { path: '/api/employee/jane@acme.io', method: 'PUT', user: { role: 'employee' } };
  rbacMiddleware(req11, res2, () => { called = true; });
  assert.strictEqual(called, false, 'Employee should not edit other profiles');
  assert.strictEqual(blocked, true, 'Should return 403');
  console.log('PASS: rbacMiddleware blocks employee edits outside /me');
}

// Proxy rewrite table tests
function testProxyRewriteTable() {
  // Test that all expected services are in the rewrite table
  const expectedServices = [
    'auth', 'employee', 'payroll', 'analytics', 'notification',
    'attendance', 'leave', 'ats', 'lms', 'performance',
    'copilot', 'audit', 'compliance', 'integration', 'lifecycle',
    'security', 'ai', 'live', 'workforce'
  ];

  for (const svc of expectedServices) {
    assert.ok(services[svc], `Service "${svc}" should be in the rewrite table`);
    assert.ok(services[svc].startsWith('http'), `Service "${svc}" should have a valid URL`);
  }
  console.log('PASS: proxy rewrite table contains all expected services');

  // Test specific rewrite rules
  assert.strictEqual(services.auth, 'http://auth-service:8010');
  assert.strictEqual(services.employee, 'http://employee-service:8001');
  assert.strictEqual(services.payroll, 'http://payroll-service:8002');
  assert.strictEqual(services.analytics, 'http://analytics-service:8003');
  assert.strictEqual(services.notification, 'http://notification-service:8004');
  assert.strictEqual(services.attendance, 'http://attendance-service:8005');
  assert.strictEqual(services.leave, 'http://leave-service:8006');
  assert.strictEqual(services.audit, 'http://audit-compliance-service:8011');
  assert.strictEqual(services.workforce, 'http://workforce-planning-service:8017');
  console.log('PASS: proxy rewrite table has correct URLs');
}

// Public path detection tests
function testPublicPathDetection() {
  assert.strictEqual(isPublicOrAuthPath('/health'), true, '/health should be public');
  assert.strictEqual(isPublicOrAuthPath('/api/auth/login'), true, '/api/auth/login should be public');
  assert.strictEqual(isPublicOrAuthPath('/api/auth/register'), true, '/api/auth/register should be public');
  assert.strictEqual(isPublicOrAuthPath('/api/employee'), false, '/api/employee should not be public');
  assert.strictEqual(isPublicOrAuthPath('/api/payroll'), false, '/api/payroll should not be public');
  console.log('PASS: public path detection works correctly');
}

// Auth middleware tests (security-loaded: challenge rejection, denylist path)
function testAuthMiddleware() {
  // Public path bypasses auth
  let called = false;
  authMiddleware({ path: '/api/auth/login', headers: {} }, { status() { return this; }, json() { return this; } }, () => { called = true; });
  assert.strictEqual(called, true, 'Public auth path should bypass');
  console.log('PASS: authMiddleware bypasses public paths');

  // Protected path without token is 401
  called = false;
  let statusCode = 0;
  authMiddleware(
    { path: '/api/employee', headers: {}, originalUrl: '/api/employee', url: '/api/employee' },
    { status(c) { statusCode = c; return this; }, json() { return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, false, 'Missing token should not pass');
  assert.strictEqual(statusCode, 401, 'Missing token should be 401');
  console.log('PASS: authMiddleware rejects missing token with 401');

  // Challenge token must be rejected on protected routes
  const challengeToken = jwt.sign(
    { id: 1, purpose: 'mfa_challenge', aud: 'mfa-challenge' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '5m' }
  );
  called = false;
  statusCode = 0;
  authMiddleware(
    { path: '/api/payroll', headers: { authorization: 'Bearer ' + challengeToken }, originalUrl: '/api/payroll', url: '/api/payroll' },
    { status(c) { statusCode = c; return this; }, json() { return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, false, 'Challenge token should not pass');
  assert.strictEqual(statusCode, 401, 'Challenge token should be 401');
  console.log('PASS: authMiddleware rejects mfa-challenge tokens');

  // Non-protected unknown path passes through without token
  called = false;
  authMiddleware({ path: '/unknown', headers: {} }, {}, () => { called = true; });
  assert.strictEqual(called, true, 'Unknown non-protected path should pass');
  console.log('PASS: authMiddleware passes non-protected paths');
}

// MFA step-up middleware tests
async function testMfaStepUpMiddleware() {
  // GET bypasses step-up
  let called = false;
  await mfaStepUpMiddleware(
    { method: 'GET', path: '/api/payroll', headers: {} },
    { status() { return this; }, json() { return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, true, 'GET should bypass step-up');
  console.log('PASS: mfaStepUpMiddleware bypasses GET');

  // Non-sensitive POST bypasses step-up
  called = false;
  await mfaStepUpMiddleware(
    { method: 'POST', path: '/api/employee', headers: {} },
    { status() { return this; }, json() { return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, true, 'Non-sensitive route should bypass');
  console.log('PASS: mfaStepUpMiddleware bypasses non-sensitive routes');

  // Sensitive route without token is 403 with mfa_required
  called = false;
  let statusCode = 0;
  let body = null;
  await mfaStepUpMiddleware(
    { method: 'POST', path: '/api/payroll', headers: {} },
    { status(c) { statusCode = c; return this; }, json(d) { body = d; return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, false, 'Sensitive route without MFA should block');
  assert.strictEqual(statusCode, 403, 'Missing MFA token should be 403');
  assert.strictEqual(body.mfa_required, true, 'Response should flag mfa_required');
  console.log('PASS: mfaStepUpMiddleware blocks sensitive routes without step-up token');

  // Sensitive route with garbage token is 403
  called = false;
  statusCode = 0;
  await mfaStepUpMiddleware(
    { method: 'POST', path: '/api/payroll', headers: { 'x-mfa-token': 'garbage' } },
    { status(c) { statusCode = c; return this; }, json(d) { body = d; return this; } },
    () => { called = true; }
  );
  assert.strictEqual(called, false, 'Garbage MFA token should block');
  assert.strictEqual(statusCode, 403, 'Garbage MFA token should be 403');
  console.log('PASS: mfaStepUpMiddleware rejects invalid step-up tokens');
}

// Auth-store (Redis) fail-closed policy tests (#329)
function fakeAuthStore({ isOpen = true, failGet = false, failSet = false } = {}) {
  const store = new Map();
  const sets = [];
  return {
    isOpen,
    store,
    sets,
    async get(key) {
      if (failGet) throw new Error('store down');
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, opts = {}) {
      if (failSet) throw new Error('store down');
      sets.push({ key, value, opts });
      if (opts.NX && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
  };
}

async function quietly(fn) {
  const error = console.error;
  const warn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

async function testAuthStoreFailClosed() {
  // Denylist: a disconnected store refuses the request (503) instead of
  // admitting a possibly revoked token.
  const closed = fakeAuthStore({ isOpen: false });
  const denied = await quietly(() => revokeCheck(closed, { jti: 'j1', sid: 's1' }));
  assert.strictEqual(denied.status, 503, 'Disconnected store must refuse');
  assert.strictEqual(denied.body.code, 'auth_store_unavailable', 'Refusal must carry the store code');
  assert.strictEqual(denied.body.retryable, true, 'Refusal must be retryable');
  console.log('PASS: denylist check fails closed when Redis is down');

  // A denylisted token is still refused with 401 when the store is healthy;
  // a clean token passes.
  const open = fakeAuthStore();
  open.store.set('denylist:jti:j1', '1');
  const revoked = await quietly(() => revokeCheck(open, { jti: 'j1' }));
  assert.strictEqual(revoked.status, 401, 'Denylisted token must be 401');
  assert.strictEqual(revoked.body.message, 'Session revoked', 'Denylisted token message kept');
  const clean = await quietly(() => revokeCheck(fakeAuthStore(), { jti: 'j2', sid: 's2' }));
  assert.strictEqual(clean, null, 'Clean token must pass');

  // Store read failures also fail closed; tokens with nothing to denylist
  // (no jti and no sid) need no store read.
  const brokenRead = await quietly(() => revokeCheck(fakeAuthStore({ failGet: true }), { jti: 'j3' }));
  assert.strictEqual(brokenRead.status, 503, 'Read failure must fail closed');
  const nothing = await quietly(() => revokeCheck(closed, {}));
  assert.strictEqual(nothing, null, 'Token without jti/sid needs no store read');
  console.log('PASS: denylist policy allows clean tokens and refuses on store failure');

  // MFA replay: disconnected store refuses; healthy store consumes the jti
  // atomically and a second use is a replay.
  const expMs = Date.now() + 5 * 60 * 1000;
  const noStore = await quietly(() => consumeMfaJti(fakeAuthStore({ isOpen: false }), 'jti-1', expMs));
  assert.strictEqual(noStore.status, 503, 'Replay check must fail closed without Redis');
  assert.strictEqual(noStore.body.code, 'auth_store_unavailable', 'Replay refusal carries the store code');

  const healthy = fakeAuthStore();
  const first = await quietly(() => consumeMfaJti(healthy, 'jti-2', expMs));
  assert.strictEqual(first, null, 'First use passes');
  assert.strictEqual(healthy.sets.length, 1, 'First use writes the jti');
  assert.strictEqual(healthy.sets[0].key, 'mfa_jti:jti-2', 'jti key shape');
  assert.ok(healthy.sets[0].opts.NX === true && healthy.sets[0].opts.EX > 0, 'jti write is atomic NX with TTL');
  const second = await quietly(() => consumeMfaJti(healthy, 'jti-2', expMs));
  assert.strictEqual(second.status, 403, 'Replay must be 403');
  assert.strictEqual(second.body.mfa_required, true, 'Replay refusal flags mfa_required');

  const brokenWrite = await quietly(() => consumeMfaJti(fakeAuthStore({ failSet: true }), 'jti-3', expMs));
  assert.strictEqual(brokenWrite.status, 503, 'Write failure must fail closed');
  console.log('PASS: MFA replay enforcement is atomic and fails closed');

  // Wiring: middleware must route through the fail-closed helpers and the
  // degraded counter must exist for alerts.
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.ok(source.includes('revokeCheck(redisClient, payload)'), 'authMiddleware must use revokeCheck');
  assert.ok(source.includes('consumeMfaJti(redisClient, jti, expMs)'), 'step-up must use consumeMfaJti');
  assert.ok(!source.includes('allowing request'), 'no fail-open denylist path may remain');
  assert.ok(!source.includes('replay check skipped'), 'no fail-open replay path may remain');
  assert.ok(source.includes('atlas_gateway_redis_degraded_total'), 'degraded counter must exist for alerting');
  console.log('PASS: fail-closed helpers are wired and observable');
}

// Audit proxy middleware tests
function testAuditProxyMiddleware() {
  // GET passes through immediately
  let called = false;
  const resGet = { statusCode: 200, on() {} };
  auditProxyMiddleware({ method: 'GET', path: '/api/employee' }, resGet, () => { called = true; });
  assert.strictEqual(called, true, 'GET should pass audit proxy');
  console.log('PASS: auditProxyMiddleware passes GET through');

  // Mutating request registers a finish listener and passes through
  called = false;
  let finishHandler = null;
  const resPost = { statusCode: 201, on(ev, fn) { if (ev === 'finish') finishHandler = fn; } };
  auditProxyMiddleware(
    { method: 'POST', path: '/api/employee', user: { id: 1 }, ip: '1.2.3.4', headers: {} },
    resPost,
    () => { called = true; }
  );
  assert.strictEqual(called, true, 'POST should pass through');
  assert.ok(typeof finishHandler === 'function', 'POST should register finish hook');
  console.log('PASS: auditProxyMiddleware hooks finish on mutating requests');
}

// Device trust header middleware tests
function testDeviceTrustMiddleware() {
  let called = false;
  const req = { headers: { 'x-device-id': 'd1', 'x-device-fingerprint': 'f1', 'x-session-id': 's1' } };
  deviceTrustHeaderMiddleware(req, {}, () => { called = true; });
  assert.strictEqual(called, true, 'Device trust should pass through');
  assert.strictEqual(req.headers['x-device-id'], 'd1', 'Device id should be preserved');
  assert.strictEqual(req.headers['x-device-fingerprint'], 'f1', 'Fingerprint should be preserved');
  assert.strictEqual(req.headers['x-session-id'], 's1', 'Session id should be preserved');
  console.log('PASS: deviceTrustHeaderMiddleware preserves device headers');

  called = false;
  deviceTrustHeaderMiddleware({ headers: {} }, {}, () => { called = true; });
  assert.strictEqual(called, true, 'Requests without device headers should pass');
  console.log('PASS: deviceTrustHeaderMiddleware passes requests without device headers');
}

// Caching pair tests
async function testCachingPair() {
  // Non-GET bypasses cache read
  let called = false;
  await checkCache({ method: 'POST', path: '/api/employee', headers: {}, user: null, originalUrl: '/api/employee' }, { setHeader() {}, send() {} }, () => { called = true; });
  assert.strictEqual(called, true, 'Non-GET should bypass cache');
  console.log('PASS: checkCache bypasses non-GET');

  // Live paths bypass cache read
  called = false;
  await checkCache({ method: 'GET', path: '/api/live/ws', headers: {}, user: null, originalUrl: '/api/live/ws' }, { setHeader() {}, send() {} }, () => { called = true; });
  assert.strictEqual(called, true, 'Live paths should bypass cache');
  console.log('PASS: checkCache bypasses live paths');

  // Mutating requests pass through invalidation middleware
  called = false;
  cacheInvalidationMiddleware({ method: 'GET', path: '/api/employee', user: null, headers: {} }, { on() {} }, () => { called = true; });
  assert.strictEqual(called, true, 'GET should pass invalidation');
  called = false;
  cacheInvalidationMiddleware({ method: 'POST', path: '/api/employee', user: null, headers: {} }, { on(ev, fn) {}, statusCode: 200 }, () => { called = true; });
  assert.strictEqual(called, true, 'POST should pass invalidation');
  console.log('PASS: cacheInvalidationMiddleware passes through and hooks writes');
}

// Webhook verification tests
function testWebhookVerification() {
  // Without secrets configured, every request is invalid (fail closed)
  const missing = verifySlackRequest({ headers: {}, rawBody: '' });
  assert.strictEqual(missing.valid, false, 'Missing signature should be invalid');
  console.log('PASS: verifySlackRequest rejects missing signatures');

  // Stale timestamps are rejected when a signing secret is present only if
  // the module was loaded with one; otherwise the missing-secret path already
  // fails closed above. Either way the result must be invalid here.
  const stale = verifySlackRequest({ headers: { 'x-slack-signature': 'v0=abc', 'x-slack-request-timestamp': '1' }, rawBody: 'a=1' });
  assert.strictEqual(stale.valid, false, 'Stale/forged webhook should be invalid');
  console.log('PASS: verifySlackRequest rejects forged webhooks');

  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.ok(source.includes('SLACK_SIGNING_SECRET') && source.includes('503'), 'Webhook must fail closed without secrets');
  console.log('PASS: slack webhook fails closed without signing secrets');
}

// Billing route tests (source + behavior contract)
function testBillingRoute() {
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const at = source.indexOf('/api/billing/create-checkout-session');
  assert.ok(at !== -1, 'Billing checkout route must exist');
  const block = source.slice(at, at + 1500);
  assert.ok(block.includes('Authentication required'), 'Billing must require authentication');
  assert.ok(block.includes('Tenant context missing'), 'Billing must require tenant context');
  assert.ok(block.includes('status(500)') || block.includes('500'), 'Billing must map failures to error status');
  console.log('PASS: billing checkout validates auth, tenant, and error mapping');
}

// Upgrade path tests
function testUpgradePath() {
  assert.strictEqual(isWsPath('/ws'), true, '/ws should be a WS path');
  assert.strictEqual(isWsPath('/notification/ws'), true, '/notification/ws should be a WS path');
  assert.strictEqual(isWsPath('/api/live/ws'), true, '/api/live/ws should be a WS path');
  assert.strictEqual(isWsPath('/api/live/ws/abc'), true, 'Live subpaths should be WS paths');
  assert.strictEqual(isWsPath('/api/employee'), false, 'API paths should not be WS paths');
  console.log('PASS: upgrade path allowlist (isWsPath) is strict');

  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.ok(source.includes("server.on('upgrade'"), 'Upgrade handler must exist');
  assert.ok(source.includes('401 Unauthorized'), 'Upgrade must reject unauthenticated sockets');
  assert.ok(source.includes('mfa_challenge'), 'Upgrade must reject challenge tokens');
  console.log('PASS: upgrade handshake enforces token checks');
}

// Error shape tests
function testErrorShape() {
  let statusCode = 0;
  let body = null;
  globalErrorHandler(new Error('boom'), {}, { status(c) { statusCode = c; return this; }, json(d) { body = d; return this; } }, () => {});
  assert.strictEqual(statusCode, 500, 'Default error status should be 500');
  assert.ok(body && typeof body.message === 'string', 'Error body must carry a message envelope');
  console.log('PASS: globalErrorHandler keeps the message envelope');

  statusCode = 0;
  body = null;
  const withStatus = new Error('teapot');
  withStatus.status = 418;
  globalErrorHandler(withStatus, {}, { status(c) { statusCode = c; return this; }, json(d) { body = d; return this; } }, () => {});
  assert.strictEqual(statusCode, 418, 'Custom status should be honored');
  assert.ok(body && typeof body.message === 'string', 'Custom errors must keep the envelope');
  console.log('PASS: globalErrorHandler honors custom statuses without leaking stacks');
}

async function run() {
  // Unit tests run without a live server.
  testCsrfMiddleware();
  testRbacMiddleware();
  testProxyRewriteTable();
  testPublicPathDetection();
  testAuthMiddleware();
  await testMfaStepUpMiddleware();
  await testAuthStoreFailClosed();
  testAuditProxyMiddleware();
  testDeviceTrustMiddleware();
  await testCachingPair();
  testWebhookVerification();
  testBillingRoute();
  testUpgradePath();
  testErrorShape();

  // Integration test needs the gateway running (CI starts it, see ci.yml).
  await testHealthEndpoint();

  console.log('All gateway tests passed.');
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch((e) => {
    console.error('Test failed:', e.message);
    process.exit(1);
  });
}

module.exports = {
  testCsrfMiddleware,
  testRbacMiddleware,
  testProxyRewriteTable,
  testPublicPathDetection,
  testAuthMiddleware,
  testMfaStepUpMiddleware,
  testAuditProxyMiddleware,
  testDeviceTrustMiddleware,
  testCachingPair,
  testWebhookVerification,
  testBillingRoute,
  testUpgradePath,
  testErrorShape,
  testHealthEndpoint,
  run,
};
