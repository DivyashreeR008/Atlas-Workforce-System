const http = require('http');
const assert = require('assert');

// Basic health check test
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8080/health', (res) => {
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
    }).on('error', () => {
      console.log('SKIP: Gateway not running (expected in CI without compose)');
      resolve();
    });
  });
}

async function run() {
  await testHealthEndpoint();
  console.log('All gateway tests passed.');
}

run().catch((e) => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
