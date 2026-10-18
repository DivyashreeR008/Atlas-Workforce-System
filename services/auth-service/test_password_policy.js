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
const bcrypt = require('bcryptjs');
const {
  validatePassword,
  clampPasswordPolicy,
  validatePasswordPolicyInput,
  isCommonPassword,
  isPasswordReused,
  passwordExpiryStatus,
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_HARD_FLOOR,
  PASSWORD_HISTORY_MAX_RETENTION,
  COMMON_PASSWORD_LIST_VERSION,
} = require('./index');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// The pre-policy global rules must not regress: default-policy validation
// keeps the exact behavior test_auth.js asserts.
function testDefaultPolicyPreservesBehavior() {
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
  assert.deepStrictEqual(clampPasswordPolicy(undefined), { ...DEFAULT_PASSWORD_POLICY });
  assert.deepStrictEqual(clampPasswordPolicy(null), { ...DEFAULT_PASSWORD_POLICY });
  assert.deepStrictEqual(clampPasswordPolicy({}), { ...DEFAULT_PASSWORD_POLICY });
  console.log('PASS: default policy preserves behavior');
}

function testClampBounds() {
  const floorFromBelow = clampPasswordPolicy({ min_length: 4 });
  assert.strictEqual(floorFromBelow.min_length, PASSWORD_HARD_FLOOR, 'min_length must clamp up to the hard floor');

  const cappedHigh = clampPasswordPolicy({ min_length: 1000 });
  assert.strictEqual(cappedHigh.min_length, 128, 'min_length must clamp down to the cap');

  const exact = clampPasswordPolicy({ min_length: 14, require_lower: true, require_symbol: true });
  assert.strictEqual(exact.min_length, 14);
  assert.strictEqual(exact.require_lower, true);
  assert.strictEqual(exact.require_symbol, true);
  assert.strictEqual(exact.require_upper, true, 'unspecified toggles keep secure defaults');

  const history = clampPasswordPolicy({ history_count: 900 });
  assert.strictEqual(history.history_count, PASSWORD_HISTORY_MAX_RETENTION, 'history_count must clamp to the retention cap');
  assert.strictEqual(clampPasswordPolicy({ history_count: -3 }).history_count, 0);

  const longAge = clampPasswordPolicy({ max_age_days: 5000 });
  assert.strictEqual(longAge.max_age_days, 730, 'max_age_days must clamp to the cap');
  assert.strictEqual(clampPasswordPolicy({ max_age_days: 0 }).max_age_days, null, 'zero days disables expiry');
  assert.strictEqual(clampPasswordPolicy({ max_age_days: 'soon' }).max_age_days, null, 'garbage disables expiry rather than expiring instantly');

  const garbage = clampPasswordPolicy({ min_length: 'a lot', require_upper: 'yes please' });
  assert.strictEqual(garbage.min_length, PASSWORD_HARD_FLOOR, 'non-numeric min_length falls back to the floor');
  assert.strictEqual(garbage.require_upper, true, 'non-boolean toggles fall back to defaults');
  console.log('PASS: clamp bounds');
}

function testHardFloorNotConfigurableAway() {
  // Even if a persisted row somehow stores 4, the effective policy still
  // enforces 8 characters at validation time.
  assert.strictEqual(
    validatePassword('1234567', { min_length: 4 }),
    'Password must be at least 8 characters',
    'hard floor must survive a below-floor policy value'
  );
  console.log('PASS: hard floor is not configurable away');
}

function testValidatePasswordWithPolicy() {
  const strict = {
    min_length: 12,
    require_upper: true,
    require_lower: true,
    require_digit: true,
    require_symbol: true,
    history_count: 0,
    max_age_days: null,
  };
  assert.strictEqual(validatePassword('Short1!', strict), 'Password must be at least 12 characters');
  assert.strictEqual(validatePassword('longerpass1!', strict), 'Password must contain at least one uppercase letter');
  assert.strictEqual(validatePassword('LONGERPASS1!', strict), 'Password must contain at least one lowercase letter');
  assert.strictEqual(validatePassword('LongerPassNoDigit!', strict), 'Password must contain at least one number');
  assert.strictEqual(validatePassword('LongerPass1234', strict), 'Password must contain at least one symbol');
  assert.strictEqual(validatePassword('LongerPass1!', strict), null, 'a policy-compliant password must pass');

  // Lowercase-only tenant policy: uppercase is optional when the toggle is off.
  assert.strictEqual(validatePassword('alllowercase1', { require_upper: false }), null);
  console.log('PASS: validatePassword honors tenant policy');
}

function testCommonPasswordDenylist() {
  assert.strictEqual(isCommonPassword('password'), true);
  assert.strictEqual(isCommonPassword('PASSWORD123'), true, 'case-insensitive exact match');
  assert.strictEqual(isCommonPassword('Qwerty2026!'), true, 'base word with trailing digits/punctuation');
  assert.strictEqual(isCommonPassword('Tr0ub4dor&3xample'), false);
  assert.strictEqual(isCommonPassword(''), false);

  const denied = validatePassword('Password123');
  assert.ok(denied && denied.includes(COMMON_PASSWORD_LIST_VERSION), 'denylist error must pin the list version');
  assert.strictEqual(validatePassword('ValidPass1'), null, 'denylist must not reject ordinary passwords');
  console.log('PASS: common password denylist');
}

function testPasswordExpiryStatus() {
  const now = Date.UTC(2026, 0, 31, 12, 0, 0);
  const days = (n) => new Date(now - n * 24 * 60 * 60 * 1000);

  const disabled = passwordExpiryStatus(days(400), null, now);
  assert.strictEqual(disabled.expired, false);
  assert.strictEqual(disabled.days_until_expiry, null);

  const fresh = passwordExpiryStatus(days(0), 30, now);
  assert.strictEqual(fresh.expired, false);
  assert.strictEqual(fresh.days_until_expiry, 30);
  assert.strictEqual(fresh.expires_at, new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString());

  const soon = passwordExpiryStatus(days(29.5), 30, now);
  assert.strictEqual(soon.expired, false);
  assert.strictEqual(soon.days_until_expiry, 1, 'rounds up to the nearest day');

  const old = passwordExpiryStatus(days(31), 30, now);
  assert.strictEqual(old.expired, true);
  assert.strictEqual(old.days_until_expiry, 0, 'never negative');
  assert.strictEqual(passwordExpiryStatus(null, 30, now).expired, false, 'unknown change date must not read as expired');
  assert.strictEqual(passwordExpiryStatus('not-a-date', 30, now).expired, false);
  console.log('PASS: password expiry status math');
}

async function testPasswordReuseComparison() {
  const hash = await bcrypt.hash('HistoryPass1!', 4);
  assert.strictEqual(await isPasswordReused('HistoryPass1!', [hash]), true);
  assert.strictEqual(await isPasswordReused('DifferentPass1!', [hash]), false);
  assert.strictEqual(await isPasswordReused('HistoryPass1!', []), false);
  assert.strictEqual(await isPasswordReused('HistoryPass1!', [null, undefined]), false);
  console.log('PASS: password reuse comparison');
}

function testInputValidation() {
  assert.deepStrictEqual(validatePasswordPolicyInput({ min_length: 4 }), {
    min_length: `min_length must be an integer between ${PASSWORD_HARD_FLOOR} and 128`,
  });
  assert.ok(validatePasswordPolicyInput({ require_upper: 'yes please' }).require_upper);
  assert.ok(validatePasswordPolicyInput({ history_count: PASSWORD_HISTORY_MAX_RETENTION + 1 }).history_count);
  assert.ok(validatePasswordPolicyInput({ max_age_days: 731 }).max_age_days);
  assert.strictEqual(validatePasswordPolicyInput({ max_age_days: 0 }), null, 'zero is accepted as disabled');
  assert.strictEqual(validatePasswordPolicyInput({ max_age_days: null }), null);
  assert.strictEqual(validatePasswordPolicyInput({ min_length: 12, require_symbol: true, history_count: 5, max_age_days: 90 }), null);
  console.log('PASS: admin input validation');
}

function testSourceWiring() {
  assert.ok(source.includes('CREATE TABLE IF NOT EXISTS password_policies'), 'policy table must be created');
  assert.ok(source.includes("VALUES ('default') ON CONFLICT (tenant_id) DO NOTHING") || source.includes('password_policies (tenant_id)'), 'existing tenants must be backfilled');
  assert.ok(source.includes('CREATE TABLE IF NOT EXISTS password_history'), 'history table must be created');
  assert.ok(source.includes('ADD COLUMN IF NOT EXISTS password_changed_at'), 'users must track password change time');

  const registerBlock = source.slice(source.indexOf("app.post('/register'"), source.indexOf("app.post('/register'") + 3200);
  assert.ok(registerBlock.includes('getPasswordPolicyForTenant'), 'register must load the tenant policy');
  assert.ok(registerBlock.includes('validatePassword(password, policy)'), 'register must validate against the policy');
  assert.ok(registerBlock.includes('recordPasswordHistory'), 'register must seed password history');

  const resetBlock = source.slice(source.indexOf("app.post('/auth/password/reset'"), source.indexOf("app.post('/auth/password/reset'") + 3600);
  assert.ok(resetBlock.includes('getPasswordPolicyForTenant'), 'reset must load the user tenant policy');
  assert.ok(resetBlock.includes('enforcePasswordHistory'), 'reset must enforce reuse rejection');

  const adminResetBlock = source.slice(source.indexOf("app.post('/auth/admin/password-reset'"), source.indexOf("app.post('/auth/admin/password-reset'") + 3600);
  assert.ok(adminResetBlock.includes('enforcePasswordHistory'), 'admin reset must enforce reuse rejection');

  const scimBlock = source.slice(source.indexOf("app.post('/scim/v2/Users'"), source.indexOf("app.post('/scim/v2/Users'") + 3200);
  assert.ok(scimBlock.includes('getPasswordPolicyForTenant'), 'SCIM provisioning must enforce the key tenant policy');

  assert.ok(source.includes("app.get('/auth/admin/password-policy'"), 'policy read endpoint must exist');
  assert.ok(source.includes("app.put('/auth/admin/password-policy'"), 'policy update endpoint must exist');
  assert.ok(source.includes('auth.password_policy_updated'), 'policy updates must be audited');

  const loginBlock = source.slice(source.indexOf("app.post('/login'"), source.indexOf("app.post('/login'") + 8000);
  assert.ok(loginBlock.includes('passwordExpiryStatus'), 'login must compute expiry status');
  assert.ok(loginBlock.includes('days_until_password_expiry'), 'login response must report days until expiry');
  console.log('PASS: source wiring for policy enforcement');
}

function testHistoryStoresOnlyHashes() {
  const insertLine = source
    .split('\n')
    .find((line) => line.includes('INSERT INTO password_history'));
  assert.ok(insertLine, 'history insert must exist');
  assert.ok(insertLine.includes('password_hash'), 'history rows must store the hash column');
  assert.ok(!insertLine.includes('newPassword') && !insertLine.includes('plaintext'), 'history insert must never receive a plaintext password');
  assert.ok(source.includes('ORDER BY created_at DESC, id DESC LIMIT $2'), 'history reads must be capped by the retention limit');
  console.log('PASS: password history stores only hashes');
}

testDefaultPolicyPreservesBehavior();
testClampBounds();
testHardFloorNotConfigurableAway();
testValidatePasswordWithPolicy();
testCommonPasswordDenylist();
testPasswordExpiryStatus();
testInputValidation();
testSourceWiring();
testHistoryStoresOnlyHashes();
testPasswordReuseComparison()
  .then(() => {
    console.log('All password policy tests passed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
