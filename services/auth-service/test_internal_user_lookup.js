const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
const source = fs.readFileSync(indexPath, 'utf8');

function section(name, fn) {
  fn();
  console.log(`PASS: ${name}`);
}

function extractInternalLookupBlock() {
  const at = source.indexOf("app.get('/internal/atlas-user'");
  assert.ok(at !== -1, 'internal atlas-user lookup route must exist');
  const durations = [source.indexOf('POOL_END_MARKER_NA', at), source.length];
  const next = source.indexOf("app.get('/sessions'", at);
  return source.slice(at, next !== -1 ? next : durations[1]);
}

section('internal atlas-user lookup requires the internal service token', () => {
  const block = extractInternalLookupBlock();
  assert.ok(block.includes("req.headers['x-internal-auth']"), 'lookup must read the internal token header');
  assert.ok(block.includes('jwt.verify'), 'lookup must verify the internal token');
  assert.ok(block.includes("algorithms: ['HS256']"), 'lookup must pin the HMAC algorithm');
  assert.ok(block.includes('401'), 'missing or invalid internal token must be a 401');
});

section('internal atlas-user lookup is tenant scoped by token claims', () => {
  const block = extractInternalLookupBlock();
  assert.ok(block.includes('claims.tenant_id'), 'tenant must come from the internal token claims');
  assert.ok(block.includes('AND tenant_id = $2'), 'query must filter the users table by tenant');
  assert.ok(!/req\.query\.tenant/.test(block), 'tenant must never come from query input');
});

section('internal atlas-user lookup validates the email and returns a minimal projection', () => {
  const block = extractInternalLookupBlock();
  assert.ok(block.includes('req.query.email') && block.includes('trim().toLowerCase()'), 'email must be normalized from the query');
  assert.ok(block.includes('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/'), 'email format must be validated');
  assert.ok(block.includes('SELECT id, email, name, role, tenant_id, active'), 'lookup must return a minimal, non-sensitive projection');
  assert.ok(block.includes('active === false'), 'inactive users must not resolve');
  assert.ok(block.includes('404'), 'missing users must 404, not 200-empty');
});

section('the gateway shoots its lookup at this endpoint with a tenant-scoped internal token', () => {
  // Cross-check against the api-gateway source: the Slack identity resolver
  // mints the internal token with the Slack workspace tenant and calls this
  // route, so both halves of the contract are exercised together.
  const gatewaySource = fs.readFileSync(path.join(__dirname, '..', 'api-gateway-node', 'index.js'), 'utf8');
  assert.ok(gatewaySource.includes('/internal/atlas-user'), 'gateway must call the internal atlas-user route');
  assert.ok(gatewaySource.includes("sub: 'api-gateway-slack'") && gatewaySource.includes('tenant_id: teamId'), 'gateway lookup token must carry the workspace tenant');
});

console.log('All internal atlas-user lookup tests passed.');
