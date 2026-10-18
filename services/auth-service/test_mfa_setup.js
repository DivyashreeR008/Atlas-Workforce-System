// Guards for #344: MFA setup ceremony, no silent disable, backup code expiry,
// case-insensitive comparison, and corruption-proof consumption.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

function testSetupRequiresConfirmation() {
  const start = source.indexOf("app.post('/mfa/setup'");
  const end = source.indexOf("app.post('/mfa/rotate-backup-codes'");
  assert.ok(start !== -1 && end > start, 'setup route must exist');
  const handler = source.slice(start, end);
  assert.ok(/bcrypt\.compare\(password, user\.password\)/.test(handler), 'setup must verify the account password');
  assert.ok(/authenticator\.check\(token, existingMfa\.rows\[0\]\.?mfa_secret\)/.test(handler), 'setup must accept a current TOTP code as confirmation');
  assert.ok(/res\.status\(403\)/.test(handler), 'unconfirmed setup must be rejected');
  console.log('PASS: setupRequiresConfirmation');
}

function testSetupNeverDisablesMfa() {
  const start = source.indexOf("app.post('/mfa/setup'");
  const end = source.indexOf("app.post('/mfa/rotate-backup-codes'");
  const handler = source.slice(start, end);
  assert.ok(!/mfa_enabled = false/.test(handler), 'setup must not flip mfa_enabled off as a side effect');
  assert.ok(/wasEnabled/.test(handler), 'setup must preserve the enabled state it observed');
  console.log('PASS: setupNeverDisablesMfa');
}

function testBackupCodesExpire() {
  assert.ok(/backup_codes_issued_at TIMESTAMP/.test(source), 'schema must carry issued_at');
  assert.ok(/backup_codes_expires_at TIMESTAMP/.test(source), 'schema must carry expires_at');
  assert.ok(/backup_codes_expires_at > NOW\(\)/.test(source), 'consumption must refuse expired sets');
  assert.ok(/90 \* 24 \* 60 \* 60 \* 1000/.test(source), 'issued sets must carry a bounded lifetime');
  console.log('PASS: backupCodesExpire');
}

function testComparisonCaseInsensitive() {
  assert.ok(/normalizedCode = String\(backup_code\)\.trim\(\)\.toUpperCase\(\)/.test(source), 'submitted codes must be trimmed and upper-cased');
  assert.ok(/upper\(btrim\(t\.value #>> '\{\}'\)\) = \$2/.test(source), 'legacy string entries must compare case-insensitively');
  assert.ok(/upper\(btrim\(t\.value ->> 'code'\)\) = \$2/.test(source), 'object entries must compare case-insensitively');
  console.log('PASS: comparisonCaseInsensitive');
}

function testCorruptionSafeConsumption() {
  assert.ok(!/typeof mfa\.backup_codes === 'string' \? JSON\.parse/.test(source), 'unguarded JSON.parse must be gone');
  assert.ok(/jsonb_array_elements/.test(source), 'consumption must operate inside jsonb where corruption cannot throw');
  console.log('PASS: corruptionSafeConsumption');
}

function testAtomicConsumption() {
  const m = source.match(/UPDATE user_mfa\s+SET backup_codes = \([\s\S]{0,600}?RETURNING user_id/);
  assert.ok(m, 'consumption must be a single UPDATE');
  assert.ok(/backup_codes_expires_at > NOW\(\)/.test(m[0]), 'the guarded UPDATE must carry the expiry check');
  assert.ok(/EXISTS \(/.test(m[0]), 'the guarded UPDATE must require the code to still be present');
  console.log('PASS: atomicConsumption');
}

module.exports = {
  testSetupRequiresConfirmation,
  testSetupNeverDisablesMfa,
  testBackupCodesExpire,
  testComparisonCaseInsensitive,
  testCorruptionSafeConsumption,
  testAtomicConsumption,
};

if (require.main === module) {
  testSetupRequiresConfirmation();
  testSetupNeverDisablesMfa();
  testBackupCodesExpire();
  testComparisonCaseInsensitive();
  testCorruptionSafeConsumption();
  testAtomicConsumption();
  console.log('ALL-MFA-TESTS-PASS');
}
