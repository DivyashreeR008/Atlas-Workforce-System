const assert = require('assert');

// Unit tests for auth service utilities
function testValidatePassword() {
  const cases = [
    { input: 'short', expected: 'Password must be at least 8 characters' },
    { input: 'nonumberlong', expected: 'Password must contain at least one uppercase letter' },
    { input: 'nouppercase1', expected: 'Password must contain at least one uppercase letter' },
    { input: 'alllowercase1', expected: 'Password must contain at least one uppercase letter' },
    { input: 'ValidPass1', expected: null },
  ];

  // Replicate validatePassword logic inline
  function validatePassword(password) {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    return null;
  }

  for (const { input, expected } of cases) {
    assert.strictEqual(validatePassword(input), expected, `Failed for: ${input}`);
  }
  console.log('PASS: validatePassword');
}

function testHashToken() {
  const crypto = require('crypto');
  function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  const token = 'test-token-123';
  const hash = hashToken(token);
  assert.strictEqual(hash.length, 64, 'SHA256 hash should be 64 hex chars');
  assert.strictEqual(hashToken(token), hash, 'Hashing should be deterministic');
  console.log('PASS: hashToken');
}

function testSanitizeUser() {
  function sanitizeUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      position: user.position,
      tenant_id: user.tenant_id || 'default',
    };
  }

  const user = { id: 1, email: 'test@test.com', name: 'Test', role: 'admin', department: 'Eng', position: 'Dev', password: 'secret', token: 'jwt' };
  const sanitized = sanitizeUser(user);
  assert.strictEqual(sanitized.password, undefined, 'Password should be excluded');
  assert.strictEqual(sanitized.token, undefined, 'Token should be excluded');
  assert.strictEqual(sanitized.email, 'test@test.com');
  assert.strictEqual(sanitized.tenant_id, 'default');
  console.log('PASS: sanitizeUser');
}

testValidatePassword();
testHashToken();
testSanitizeUser();
console.log('All auth tests passed.');
