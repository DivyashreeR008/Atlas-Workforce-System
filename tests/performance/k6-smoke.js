import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const HEALTH_ENDPOINTS = [
  { name: 'API Gateway', url: `${__ENV.BASE_URL || 'http://localhost:8080'}/health` },
  { name: 'Auth Service', url: `${__ENV.AUTH_URL || 'http://localhost:8010'}/health` },
  { name: 'Employee Service', url: `${__ENV.EMPLOYEE_URL || 'http://localhost:8001'}/health` },
  { name: 'Payroll Service', url: `${__ENV.PAYROLL_URL || 'http://localhost:8002'}/health` },
  { name: 'Analytics Service', url: `${__ENV.ANALYTICS_URL || 'http://localhost:8003'}/health` },
  { name: 'Attendance Service', url: `${__ENV.ATTENDANCE_URL || 'http://localhost:8005'}/health` },
  { name: 'Leave Service', url: `${__ENV.LEAVE_URL || 'http://localhost:8006'}/health` },
  { name: 'ATS Service', url: `${__ENV.ATS_URL || 'http://localhost:8012'}/health` },
  { name: 'LMS Service', url: `${__ENV.LMS_URL || 'http://localhost:8013'}/health` },
  { name: 'AI Copilot Service', url: `${__ENV.COPILOT_URL || 'http://localhost:8015'}/health` },
  { name: 'Audit Compliance Service', url: `${__ENV.AUDIT_URL || 'http://localhost:8011'}/health` },
];

export default function () {
  for (const ep of HEALTH_ENDPOINTS) {
    const res = http.get(ep.url);
    const ok = check(res, {
      [`${ep.name} returns 200`]: (r) => r.status === 200,
      [`${ep.name} responds in <500ms`]: (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok);
    sleep(0.5);
  }
}
