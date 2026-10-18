// Token-lifecycle guards for #347: single-statement atomic consumption,
// bounded issuance, no raw tokens in responses, no secrets in mail logs.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tokenLifecycleSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

function testPasswordlessAtomicConsume() {
  const re = /UPDATE passwordless_tokens SET used = true WHERE token_hash = \$1 AND used = false AND expires_at > NOW\(\) RETURNING \*/;
  assert.ok(re.test(tokenLifecycleSource), 'passwordless verify must consume atomically in one guarded UPDATE');
  assert.ok(!/SELECT \* FROM passwordless_tokens WHERE token/.test(tokenLifecycleSource), 'passwordless read-then-write must be gone');
  console.log('PASS: passwordlessAtomicConsume');
}

function testPasswordResetAtomicConsume() {
  const re = /UPDATE password_reset_tokens SET used = true WHERE token_hash = \$1 AND used = false AND expires_at > NOW\(\) RETURNING \*/;
  assert.ok(re.test(tokenLifecycleSource), 'password reset must consume atomically in one guarded UPDATE');
  console.log('PASS: passwordResetAtomicConsume');
}

function testNoRawTokenInResponse() {
  assert.ok(!/response\.reset_token/.test(tokenLifecycleSource), 'reset response must never carry the raw token');
  assert.ok(!/response\.reset_url/.test(tokenLifecycleSource), 'reset response must never carry the reset URL');
  console.log('PASS: noRawTokenInResponse');
}

function testMailBodyNotLogged() {
  assert.ok(!/body=\$\{text\}/.test(tokenLifecycleSource), 'mail bodies (reset URLs) must not hit the logs');
  console.log('PASS: mailBodyNotLogged');
}

function testTokenColumnRenamed() {
  assert.ok(/token_hash VARCHAR\(64\) NOT NULL UNIQUE/.test(tokenLifecycleSource), 'passwordless table must store token_hash, not a column named token');
  assert.ok(/RENAME COLUMN token TO token_hash/.test(tokenLifecycleSource), 'migration rename must exist for old installs');
  console.log('PASS: tokenColumnRenamed');
}

module.exports = {
  testPasswordlessAtomicConsume,
  testPasswordResetAtomicConsume,
  testNoRawTokenInResponse,
  testMailBodyNotLogged,
  testTokenColumnRenamed,
};

if (require.main === module) {
  testPasswordlessAtomicConsume();
  testPasswordResetAtomicConsume();
  testNoRawTokenInResponse();
  testMailBodyNotLogged();
  testTokenColumnRenamed();
  console.log('ALL-TOKEN-TESTS-PASS');
}
