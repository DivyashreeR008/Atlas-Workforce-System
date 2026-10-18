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
  generateApiKey,
  parseApiKeyFormat,
  validateApiKeyScopes,
  scimScopeForRequest,
  apiKeyHasScope,
  normalizeApiKeyScopes,
  apiKeyStateError,
  API_KEY_SCOPES,
  API_KEY_DEFAULT_EXPIRY_DAYS,
  API_KEY_MAX_EXPIRY_DAYS,
} = require('./index');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

function testGenerateAndParse() {
  assert.deepStrictEqual(API_KEY_SCOPES, ['scim:read', 'scim:write']);

  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const { keyId, secret, apiKey } = generateApiKey();
    assert.ok(/^[0-9a-f]{16}$/.test(keyId), 'key id must be 16 hex chars');
    assert.ok(/^[0-9a-f]{64}$/.test(secret), 'secret must be 64 hex chars');
    assert.strictEqual(apiKey, `atlas_${keyId}_${secret}`);
    assert.ok(!seen.has(apiKey), 'keys must be unique per call');
    seen.add(apiKey);

    const parsed = parseApiKeyFormat(apiKey);
    assert.deepStrictEqual(parsed, { keyId, secret });
  }

  assert.strictEqual(parseApiKeyFormat(''), null);
  assert.strictEqual(parseApiKeyFormat(null), null);
  assert.strictEqual(parseApiKeyFormat('atlas_1234_abcd'), null, 'short segments rejected');
  assert.strictEqual(parseApiKeyFormat(`xatlas_${'a'.repeat(16)}_${'b'.repeat(64)}`), null, 'prefix required');
  assert.strictEqual(parseApiKeyFormat(`atlas_${'A'.repeat(16)}_${'b'.repeat(64)}`), null, 'uppercase hex rejected');
  assert.strictEqual(parseApiKeyFormat(`atlas_${'a'.repeat(16)}_${'b'.repeat(63)}`), null, 'wrong secret length rejected');
  assert.strictEqual(parseApiKeyFormat(`atlas_${'a'.repeat(16)}_${'b'.repeat(64)}_extra`), null, 'trailing data rejected');
  console.log('PASS: key generation and format parsing');
}

function testScopeValidation() {
  assert.strictEqual(validateApiKeyScopes(['scim:read']), null);
  assert.strictEqual(validateApiKeyScopes(['scim:read', 'scim:write']), null);
  assert.strictEqual(validateApiKeyScopes(['scim:read', 'scim:read']), null, 'duplicates are de-duplicated by the endpoint');
  assert.strictEqual(validateApiKeyScopes(['nope']), 'Unsupported scope: nope');
  assert.strictEqual(validateApiKeyScopes(['scim:read', 'nope']), 'Unsupported scope: nope');
  assert.strictEqual(validateApiKeyScopes([]), 'scopes must be a non-empty array');
  assert.strictEqual(validateApiKeyScopes(undefined), 'scopes must be a non-empty array');
  assert.strictEqual(validateApiKeyScopes('scim:read'), 'scopes must be a non-empty array');
  console.log('PASS: scope validation');
}

function testScopeForRequest() {
  assert.strictEqual(scimScopeForRequest('GET'), 'scim:read');
  assert.strictEqual(scimScopeForRequest('get'), 'scim:read');
  assert.strictEqual(scimScopeForRequest('HEAD'), 'scim:read');
  assert.strictEqual(scimScopeForRequest('POST'), 'scim:write');
  assert.strictEqual(scimScopeForRequest('PUT'), 'scim:write');
  assert.strictEqual(scimScopeForRequest('PATCH'), 'scim:write');
  assert.strictEqual(scimScopeForRequest('DELETE'), 'scim:write');
  assert.strictEqual(scimScopeForRequest(undefined), 'scim:write');
  console.log('PASS: method to scope mapping');
}

function testScopeEnforcement() {
  // Wrong-scope rejection: a read key can never mutate.
  assert.strictEqual(apiKeyHasScope(['scim:read'], 'scim:read'), true);
  assert.strictEqual(apiKeyHasScope(['scim:read'], 'scim:write'), false);
  // Documented implication: write keys can read.
  assert.strictEqual(apiKeyHasScope(['scim:write'], 'scim:write'), true);
  assert.strictEqual(apiKeyHasScope(['scim:write'], 'scim:read'), true);
  assert.strictEqual(apiKeyHasScope(['scim:read', 'scim:write'], 'scim:read'), true);
  assert.strictEqual(apiKeyHasScope([], 'scim:read'), false);
  assert.strictEqual(apiKeyHasScope(null, 'scim:write'), false);
  assert.strictEqual(apiKeyHasScope('scim:read', 'scim:read'), false, 'non-array scopes grant nothing');

  assert.deepStrictEqual(normalizeApiKeyScopes(['scim:read']), ['scim:read']);
  assert.deepStrictEqual(normalizeApiKeyScopes('["scim:write"]'), ['scim:write'], 'stringified jsonb tolerated');
  assert.deepStrictEqual(normalizeApiKeyScopes('garbage'), []);
  assert.deepStrictEqual(normalizeApiKeyScopes(undefined), []);
  console.log('PASS: scope enforcement and wrong-scope rejection');
}

function testStateErrors() {
  assert.strictEqual(apiKeyStateError(null), 'Invalid API key');
  assert.strictEqual(apiKeyStateError({ revoked_at: null, expires_at: null }), null);
  assert.strictEqual(apiKeyStateError({ revoked_at: null, expires_at: new Date(Date.now() + 86400000).toISOString() }), null, 'active key usable');

  const past = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual(apiKeyStateError({ revoked_at: null, expires_at: past }), 'API key has expired');

  const revoked = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual(apiKeyStateError({ revoked_at: revoked, expires_at: null }), 'API key has been revoked');
  assert.strictEqual(
    apiKeyStateError({ revoked_at: revoked, expires_at: past }),
    'API key has been revoked',
    'revocation wins over expiry'
  );

  const exactlyNow = new Date().toISOString();
  assert.strictEqual(apiKeyStateError({ revoked_at: null, expires_at: exactlyNow }, Date.now() + 1000), 'API key has expired');
  assert.strictEqual(API_KEY_DEFAULT_EXPIRY_DAYS, 90);
  assert.strictEqual(API_KEY_MAX_EXPIRY_DAYS, 730);
  console.log('PASS: key state errors (expiry, revocation, order)');
}

async function testHashOnlyStorageShape() {
  // Mirrors the issuance path: the stored value is a bcrypt hash of the
  // secret and the plaintext never appears in the stored material.
  const { secret } = generateApiKey();
  const keyHash = await bcrypt.hash(secret, 4);
  assert.notStrictEqual(keyHash, secret);
  assert.ok(!keyHash.includes(secret), 'hash must not contain the plaintext');
  assert.strictEqual(await bcrypt.compare(secret, keyHash), true);
  assert.strictEqual(await bcrypt.compare(`${secret.slice(0, -1)}0`, keyHash), false);
  console.log('PASS: hash-only storage shape');
}

function testSourceWiring() {
  assert.ok(source.includes('CREATE TABLE IF NOT EXISTS api_keys'), 'api_keys table must exist');
  assert.ok(source.includes('key_hash VARCHAR(255) NOT NULL'), 'only the hash column is required');
  assert.ok(source.includes('revoked_at TIMESTAMP'), 'revocation timestamp column expected');
  assert.ok(source.includes('last_used_at TIMESTAMP'), 'usage timestamp column expected');

  const issueStart = source.indexOf("app.post('/auth/admin/api-keys'");
  assert.ok(issueStart !== -1, 'issuance endpoint must exist');
  const issueBlock = source.slice(issueStart, issueStart + 3200);
  assert.ok(issueBlock.includes("requireRole('admin')"), 'issuance is admin-only');
  assert.ok(issueBlock.includes('generateApiKey()'), 'issuance mints a fresh key');
  assert.ok(issueBlock.includes('bcrypt.hash(secret, BCRYPT_COST)'), 'secret is bcrypt hashed');
  assert.ok(issueBlock.includes('INSERT INTO api_keys (key_id, key_hash, label, scopes, tenant_id, created_by, expires_at)'), 'insert stores the hash and metadata');
  assert.ok(issueBlock.includes('never be shown again'), 'secret is returned exactly once');
  assert.ok(issueBlock.includes('auth.api_key_issued'), 'issuance is audited');
  const auditIndex = issueBlock.indexOf('auth.api_key_issued');
  const auditSlice = issueBlock.slice(Math.max(0, auditIndex - 60), auditIndex + 400);
  assert.ok(!auditSlice.includes('apiKey'), 'audit details must never contain the plaintext key');

  const listStart = source.indexOf("app.get('/auth/admin/api-keys'");
  assert.ok(listStart !== -1, 'list endpoint must exist');
  const listBlock = source.slice(listStart, listStart + 1200);
  assert.ok(listBlock.includes("requireRole('admin')"), 'listing is admin-only');
  assert.ok(!listBlock.includes('key_hash'), 'listing must not expose hashes');

  const revokeStart = source.indexOf("app.delete('/auth/admin/api-keys/:keyId'");
  assert.ok(revokeStart !== -1, 'revocation endpoint must exist');
  const revokeBlock = source.slice(revokeStart, revokeStart + 2200);
  assert.ok(revokeBlock.includes("requireRole('admin')"), 'revocation is admin-only');
  assert.ok(revokeBlock.includes('revoked_at = NOW()'), 'revocation flips the timestamp');
  assert.ok(revokeBlock.includes('auth.api_key_revoked'), 'revocation is audited');

  const authStart = source.indexOf('async function requireScimAuth');
  assert.ok(authStart !== -1, 'requireScimAuth must accept scoped keys');
  const authBlock = source.slice(authStart, authStart + 3400);
  assert.ok(authBlock.includes('resolveScimTenant'), 'legacy shared keys keep working');
  assert.ok(authBlock.indexOf('resolveScimTenant') < authBlock.indexOf('parseApiKeyFormat'), 'legacy path is checked before scoped keys');
  assert.ok(authBlock.includes('api_keys WHERE key_id'), 'scoped keys are looked up by key id');
  assert.ok(authBlock.includes('bcrypt.compare(parsed.secret, keyRow.key_hash)'), 'secret is verified against the hash');
  const compareIndex = authBlock.indexOf('bcrypt.compare(parsed.secret');
  const stateIndex = authBlock.indexOf('apiKeyStateError(keyRow)');
  const scopeIndex = authBlock.indexOf('apiKeyHasScope(scopes, requiredScope)');
  assert.ok(compareIndex !== -1 && stateIndex !== -1 && scopeIndex !== -1, 'verification chain present');
  assert.ok(compareIndex < stateIndex, 'state errors are revealed only after the secret matches');
  assert.ok(stateIndex < scopeIndex, 'scope check runs on an authenticated key');
  assert.ok(authBlock.includes("'API key has been revoked'") || source.includes('API key has been revoked'), 'revocation error text');
  assert.ok(source.includes('API key has expired'), 'expiry error text');
  assert.ok(authBlock.includes('last_used_at'), 'usage is tracked');
  assert.ok(authBlock.includes('req.scimTenant'), 'tenant is set for downstream routes');
  console.log('PASS: source wiring for scoped API keys');
}

testGenerateAndParse();
testScopeValidation();
testScopeForRequest();
testScopeEnforcement();
testStateErrors();
testSourceWiring();
testHashOnlyStorageShape()
  .then(() => {
    console.log('All API key tests passed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
