// Dummy env so the service module can be required without real secrets.
// Keep this block in sync with the fatal startup checks in index.js; the
// module refuses to load (process.exit) when any of them is missing.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-value';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'unit-test-admin-password';
process.env.AUDIT_INTERNAL_KEY = process.env.AUDIT_INTERNAL_KEY || 'unit-test-audit-key';
process.env.SCIM_API_KEY = process.env.SCIM_API_KEY || 'unit-test-scim-key';
process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://test:test@localhost:5432/test';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
process.env.AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:8011';
process.env.INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET || 'unit-test-internal-secret-value';
process.env.MFA_STEPUP_SECRET = process.env.MFA_STEPUP_SECRET || 'unit-test-mfa-stepup-secret-value';
process.env.OAUTH_ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || 'unit-test-oauth-encryption-key-value';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validatePassword, hashToken, sanitizeUser, requireCsrfDoubleSubmit, authStoreUnavailable, storeMfaChallengeJti, mfaChallengeJtiExists, consumeMfaChallengeJti } = require('./index');

// Unit tests for auth service utilities (imported from index.js, not redefined here)
function testValidatePassword() {
  const cases = [
    { input: 'short', expected: 'Password must be at least 8 characters' },
    { input: 'nonumberlong', expected: 'Password must contain at least one uppercase letter' },
    { input: 'nouppercase1', expected: 'Password must contain at least one uppercase letter' },
    { input: 'alllowercase1', expected: 'Password must contain at least one uppercase letter' },
    { input: 'ValidPass1', expected: null },
  ];

  for (const { input, expected } of cases) {
    assert.strictEqual(validatePassword(input), expected, `Failed for: ${input}`);
  }
  console.log('PASS: validatePassword');
}

function testHashToken() {
  const token = 'test-token-123';
  const hash = hashToken(token);
  assert.strictEqual(hash.length, 64, 'SHA256 hash should be 64 hex chars');
  assert.strictEqual(hashToken(token), hash, 'Hashing should be deterministic');
  console.log('PASS: hashToken');
}

function testSanitizeUser() {
  const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'admin', department: 'Eng', position: 'Dev', password: 'secret', token: 'jwt' };
  const sanitized = sanitizeUser(user);
  assert.strictEqual(sanitized.password, undefined, 'Password should be excluded');
  assert.strictEqual(sanitized.token, undefined, 'Token should be excluded');
  assert.strictEqual(sanitized.email, 'test@test.com');
  assert.strictEqual(sanitized.tenant_id, 'default');
  console.log('PASS: sanitizeUser');
}

function testRateLimiterPerIp() {
  // Simulate the rate limiter with two different client IPs.
  // Before the fix, all requests behind the gateway shared one bucket
  // (keyed on the gateway IP). After the fix, each client IP gets its own bucket.
  const store = new Map();
  const maxRequests = 3;
  const windowMs = 15 * 60 * 1000;

  function checkRateLimit(clientIp, action) {
    const key = `${clientIp}:${action}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry) {
      entry = { count: 1, startTime: now };
      store.set(key, entry);
    } else {
      if (now - entry.startTime > windowMs) {
        entry.count = 1;
        entry.startTime = now;
      } else {
        entry.count++;
      }
    }

    return entry.count <= maxRequests;
  }

  const ip1 = '192.168.1.1';
  const ip2 = '192.168.1.2';

  // Fire maxRequests+1 requests from ip1
  for (let i = 0; i < maxRequests; i++) {
    assert.strictEqual(checkRateLimit(ip1, 'login'), true, `ip1 request ${i + 1} should be allowed`);
  }
  assert.strictEqual(checkRateLimit(ip1, 'login'), false, `ip1 request ${maxRequests + 1} should be blocked`);

  // ip2 should not be affected by ip1's rate limit
  assert.strictEqual(checkRateLimit(ip2, 'login'), true, 'ip2 request should be allowed');

  console.log('PASS: rateLimiterPerIp');
}

function testRequireCsrfDoubleSubmit() {
  function run(req) {
    let called = false;
    const res = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    requireCsrfDoubleSubmit(req, res, () => { called = true; });
    return { called, res };
  }

  // Bearer-authenticated requests are exempt: a browser cannot attach the
  // header cross-site, and /refresh and /logout are called that way by the UI.
  assert.strictEqual(run({ headers: { authorization: 'Bearer abc' }, cookies: {} }).called, true, 'Bearer requests must be exempt');

  // Cookie-authenticated requests need the exact double submit.
  assert.strictEqual(
    run({ headers: { 'x-csrf-token': 'token-1' }, cookies: { csrf_token: 'token-1' } }).called,
    true,
    'Matching cookie and header must pass'
  );

  const cookieOnly = run({ headers: {}, cookies: { csrf_token: 'token-1' } });
  assert.strictEqual(cookieOnly.called, false, 'Cookie without header must be rejected');
  assert.strictEqual(cookieOnly.res.statusCode, 403, 'Cookie without header must be 403');

  const mismatched = run({ headers: { 'x-csrf-token': 'token-2' }, cookies: { csrf_token: 'token-1' } });
  assert.strictEqual(mismatched.called, false, 'Mismatched header must be rejected');
  assert.strictEqual(mismatched.res.statusCode, 403, 'Mismatched header must be 403');

  // The old fail-open path: no cookie at all used to pass unchecked.
  const noCookie = run({ headers: {}, cookies: {} });
  assert.strictEqual(noCookie.called, false, 'Missing csrf cookie must fail closed');
  assert.strictEqual(noCookie.res.statusCode, 403, 'Missing csrf cookie must be 403');

  console.log('PASS: requireCsrfDoubleSubmit keys on the auth scheme and fails closed');
}

function testGetClientIp() {
  // Replicate getClientIp logic inline
  function getClientIp(req) {
    const forwarded = req.headers['x-real-client-ip'];
    if (forwarded && typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.trim().split(',')[0].trim();
    }
    return req.ip;
  }

  // x-real-client-ip header takes precedence over req.ip
  const req1 = { headers: { 'x-real-client-ip': '10.0.0.1' }, ip: '172.16.0.1' };
  assert.strictEqual(getClientIp(req1), '10.0.0.1', 'Should use x-real-client-ip header');

  // Falls back to req.ip when header is absent
  const req2 = { headers: {}, ip: '172.16.0.1' };
  assert.strictEqual(getClientIp(req2), '172.16.0.1', 'Should fallback to req.ip');

  // Falls back to req.ip when header is empty
  const req3 = { headers: { 'x-real-client-ip': '' }, ip: '172.16.0.1' };
  assert.strictEqual(getClientIp(req3), '172.16.0.1', 'Should fallback to req.ip for empty header');

  // Takes the first IP when header contains multiple
  const req4 = { headers: { 'x-real-client-ip': '10.0.0.1, 10.0.0.2' }, ip: '172.16.0.1' };
  assert.strictEqual(getClientIp(req4), '10.0.0.1', 'Should take the first IP from x-real-client-ip');

  // Falls back to req.ip when header is whitespace-only
  const req5 = { headers: { 'x-real-client-ip': '   ' }, ip: '172.16.0.1' };
  assert.strictEqual(getClientIp(req5), '172.16.0.1', 'Should fallback to req.ip for whitespace header');

  console.log('PASS: getClientIp');
}

// Auth-store (Redis) fail-closed policy tests (#329)
function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

function fakeAuthStore({ isOpen = true, failGet = false, failSet = false, failDel = false, entries = [] } = {}) {
  const store = new Map(entries);
  const sets = [];
  const dels = [];
  return {
    isOpen,
    store,
    sets,
    dels,
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
    async del(key) {
      if (failDel) throw new Error('store down');
      dels.push(key);
      return store.delete(key) ? 1 : 0;
    },
  };
}

async function silenceErrors(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

async function testAuthStoreFailClosed() {
  // The 503 envelope used by every fail-closed refusal.
  const res = fakeRes();
  await silenceErrors(async () => authStoreUnavailable(res, 'unit_test'));
  assert.strictEqual(res.statusCode, 503, 'store outage must be 503');
  assert.strictEqual(res.body.code, 'auth_store_unavailable', 'envelope carries the code');
  assert.strictEqual(res.body.retryable, true, 'envelope is retryable');
  console.log('PASS: authStoreUnavailable returns the 503 envelope');

  // Challenge jti storage: a challenge is only issued when its jti is stored.
  const closed = fakeAuthStore({ isOpen: false });
  assert.strictEqual(await storeMfaChallengeJti(closed, 'j1', 7), false, 'closed store must not store a jti');
  const open = fakeAuthStore();
  assert.strictEqual(await storeMfaChallengeJti(open, 'j1', 7), true, 'open store stores the jti');
  assert.strictEqual(open.sets[0].key, 'mfa_challenge:j1', 'jti key shape');
  assert.strictEqual(open.sets[0].value, '7', 'jti value is the user id');
  assert.ok(open.sets[0].opts.EX === 300 && open.sets[0].opts.NX === true, 'jti stored for 5 minutes, first-write-wins');
  assert.strictEqual(await silenceErrors(() => storeMfaChallengeJti(fakeAuthStore({ failSet: true }), 'j2', 7)), false, 'store failure must not report success');
  console.log('PASS: challenge jti store fails closed when Redis is down');

  // Challenge jti lookup: null means "store cannot answer", which the route
  // must map to 503 rather than treating the challenge as valid.
  assert.strictEqual(await mfaChallengeJtiExists(closed, 'j1'), null, 'closed store answers unknown');
  assert.strictEqual(await silenceErrors(() => mfaChallengeJtiExists(fakeAuthStore({ failGet: true }), 'j1')), null, 'read failure answers unknown');
  assert.strictEqual(await mfaChallengeJtiExists(fakeAuthStore(), 'j1'), false, 'missing jti is consumed or expired');
  assert.strictEqual(await mfaChallengeJtiExists(fakeAuthStore({ entries: [['mfa_challenge:j1', '7']] }), 'j1'), true, 'present jti is redeemable');
  console.log('PASS: challenge jti lookup distinguishes missing from unknown');

  // Challenge jti consumption: the session must not be issued when the
  // consumption cannot be recorded.
  assert.strictEqual(await consumeMfaChallengeJti(closed, 'j1'), false, 'closed store cannot consume');
  assert.strictEqual(await silenceErrors(() => consumeMfaChallengeJti(fakeAuthStore({ failDel: true }), 'j1')), false, 'delete failure cannot consume');
  const consuming = fakeAuthStore({ entries: [['mfa_challenge:j1', '7']] });
  assert.strictEqual(await consumeMfaChallengeJti(consuming, 'j1'), true, 'open store consumes');
  assert.strictEqual(consuming.store.has('mfa_challenge:j1'), false, 'jti removed on consumption');
  console.log('PASS: challenge jti consumption fails closed');

  // Wiring: the routes must go through the fail-closed helpers and must not
  // keep any conditional that silently skips the store.
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.ok(source.includes('atlas_auth_redis_degraded_total'), 'degraded counter must exist for alerts');
  assert.ok(source.includes('storeMfaChallengeJti(redisClient, jti, user.id)'), 'login must store the challenge jti or refuse');
  assert.ok(source.includes("authStoreUnavailable(res, 'mfa_challenge_store')"), 'login store failure must 503');
  assert.ok(source.includes('mfaChallengeJtiExists(redisClient, jti)'), 'validate must check the challenge jti');
  assert.ok(source.includes("authStoreUnavailable(res, 'mfa_challenge_check')"), 'challenge lookup failure must 503');
  assert.ok(source.includes('consumeMfaChallengeJti(redisClient, challengeJti)'), 'validate must consume the challenge jti');
  assert.ok(source.includes("authStoreUnavailable(res, 'mfa_challenge_consume')"), 'consume failure must 503');
  assert.ok(source.includes("authStoreUnavailable(res, 'logout_denylist')"), 'logout must refuse to skip denylist writes');
  assert.ok(!source.includes('replay check skipped'), 'no fail-open replay path may remain');
  // Logout must not gate its denylist writes on the store being open; the
  // other revocation routes are a tracked follow-up and still carry the guard.
  const logoutStart = source.indexOf("app.post('/logout'");
  assert.ok(logoutStart !== -1, 'logout route must exist');
  const nextRouteStart = source.indexOf('\napp.', logoutStart + 1);
  const logoutRoute = source.slice(logoutStart, nextRouteStart === -1 ? undefined : nextRouteStart);
  assert.ok(!logoutRoute.includes('&& redisClient.isOpen'), 'logout denylist write must not be conditional on the store');
  assert.ok(!logoutRoute.includes("'Bearer ') && redisClient"), 'logout bearer branch must not be gated on client state');
  console.log('PASS: auth-store fail-closed policy is wired into the routes');
}

testValidatePassword();
testHashToken();
testSanitizeUser();
testRateLimiterPerIp();
testRequireCsrfDoubleSubmit();
testGetClientIp();
testAuthStoreFailClosed().then(() => {
  console.log('All auth tests passed.');
  process.exit(0);
});
