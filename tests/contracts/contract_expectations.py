"""Hand-written gateway-to-service route expectations (issue #448).

This file is the contract the gateway keeps with each service. It is
deliberately explicit so that review diffs are readable:

* one entry per gateway proxy registration: ``prefix``, ``service`` (the key
  of the gateway ``services`` map) and the ``rewrite_to`` target of the
  gateway's pathRewrite rule;
* the concrete routes the gateway is expected to reach through that prefix,
  written as ``(method, gateway_path, auth)`` tuples. ``gateway_path`` uses
  the parameter style the service itself declares, because the contract
  checker compares the rewritten path against the service's route table.
  The optional fourth element lists the roles the gateway's RBAC middleware
  requires (``None`` when no gateway-side role rule applies) and the fifth
  says whether the gateway's MFA step-up guard applies to the route.
* ``auth`` is the strongest guard the API gateway itself applies:
  ``public`` (listed in the gateway PUBLIC_PREFIXES), ``gateway-jwt``
  (listed in the auth middleware's protected prefixes) or ``downstream``
  (the gateway forwards the request and the service authenticates it).

Rules for changing this file (the ownership rule from the contract suite):

1. Renaming or moving a service route requires updating the matching entry
   here in the same pull request. CI runs ``tests/contracts/check_contracts.py``
   and fails naming the route when the two sides drift.
2. Adding a new gateway proxy registration requires a new entry; the checker
   fails on a registration that no entry covers.
3. Changing a rewrite target, the proxy timeout or the gateway auth
   classification requires updating this file, which makes the change a
   reviewable diff instead of silent drift.
"""

PROXY_TIMEOUT_MS = 10000

EXPECTATIONS = [
    {
        "prefix": "/api/auth",
        "service": "auth",
        "rewrite_to": "",
        "routes": [
            ("POST", "/api/auth/login", "public", None, False),
            ("POST", "/api/auth/register", "public", None, False),
            ("POST", "/api/auth/refresh", "downstream", None, False),
            ("POST", "/api/auth/logout", "downstream", None, False),
            ("GET", "/api/auth/sessions", "downstream", None, False),
            ("DELETE", "/api/auth/sessions/:id", "downstream", None, False),
            ("GET", "/api/auth/devices", "downstream", None, False),
            ("POST", "/api/auth/mfa/setup", "downstream", None, False),
            ("POST", "/api/auth/mfa/verify", "downstream", None, False),
            ("POST", "/api/auth/mfa/validate", "downstream", None, False),
            ("POST", "/api/auth/webauthn/authenticate/begin", "public", None, False),
            ("POST", "/api/auth/webauthn/authenticate/complete", "public", None, False),
            ("POST", "/api/auth/oauth/login/:provider", "public", None, False),
            ("POST", "/api/auth/oauth/callback/:provider", "public", None, False),
            ("POST", "/api/auth/password/reset-request", "public", None, False),
            ("POST", "/api/auth/password/reset", "public", None, False),
            ("POST", "/api/auth/passwordless/request", "public", None, False),
            ("POST", "/api/auth/passwordless/verify", "public", None, False),
        ],
    },
    {
        "prefix": "/scim",
        "service": "auth",
        "rewrite_to": "",
        "routes": [
            ("GET", "/scim/v2/Users", "downstream", None, False),
            ("POST", "/scim/v2/Users", "downstream", None, False),
            ("GET", "/scim/v2/Users/:id", "downstream", None, False),
            ("PUT", "/scim/v2/Users/:id", "downstream", None, False),
            ("PATCH", "/scim/v2/Users/:id", "downstream", None, False),
            ("DELETE", "/scim/v2/Users/:id", "downstream", None, False),
        ],
    },
    {
        "prefix": "/saml",
        "service": "auth",
        "rewrite_to": "",
        "routes": [
            ("POST", "/saml/acs", "public", None, False),
            ("POST", "/saml/login", "public", None, False),
            ("GET", "/saml/metadata", "public", None, False),
        ],
    },
    {
        "prefix": "/api/employee",
        "service": "employee",
        "rewrite_to": "",
        "routes": [
            ("GET", "/api/employee/employees", "gateway-jwt", None, False),
            ("POST", "/api/employee/employees", "gateway-jwt", ["admin", "hr"], False),
            ("GET", "/api/employee/employees/{email}", "gateway-jwt", None, False),
            ("PUT", "/api/employee/employees/{email}", "gateway-jwt", ["admin", "hr"], False),
            ("DELETE", "/api/employee/employees/{email}", "gateway-jwt", ["admin", "hr"], False),
        ],
    },
    {
        "prefix": "/api/analytics",
        "service": "analytics",
        "rewrite_to": "/analytics",
        "routes": [
            ("GET", "/api/analytics/department", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("GET", "/api/analytics/payroll", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("GET", "/api/analytics/performance", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("POST", "/api/analytics/ai-insights", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("POST", "/api/analytics/payroll/invalidate", "gateway-jwt", ["admin", "manager", "hr"], False),
        ],
    },
    {
        "prefix": "/api/attendance",
        "service": "attendance",
        "rewrite_to": "/api/attendance",
        "routes": [
            ("GET", "/api/attendance", "gateway-jwt", None, False),
            ("POST", "/api/attendance/clock-in", "gateway-jwt", None, False),
            ("POST", "/api/attendance/clock-out", "gateway-jwt", None, False),
            ("GET", "/api/attendance/employee/{employeeId}", "gateway-jwt", None, False),
            ("GET", "/api/attendance/dashboard/summary", "gateway-jwt", None, False),
            ("GET", "/api/attendance/geo-fences", "gateway-jwt", None, False),
            ("POST", "/api/attendance/geo-fences", "gateway-jwt", None, False),
            ("GET", "/api/attendance/rosters", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/leave",
        "service": "leave",
        "rewrite_to": "/api/leave",
        "routes": [
            ("GET", "/api/leave", "gateway-jwt", None, False),
            ("POST", "/api/leave/request", "gateway-jwt", None, False),
            ("GET", "/api/leave/employee/{employeeId}", "gateway-jwt", None, False),
            ("PUT", "/api/leave/{id}/status", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/payroll",
        "service": "payroll",
        "rewrite_to": "/api/payroll",
        "routes": [
            ("GET", "/api/payroll", "gateway-jwt", ["admin", "hr"], False),
            ("POST", "/api/payroll/run", "gateway-jwt", ["admin", "hr"], True),
            ("GET", "/api/payroll/employee/{employeeId}", "gateway-jwt", ["admin", "hr"], False),
            ("GET", "/api/payroll/enterprise/dashboard", "gateway-jwt", ["admin", "hr"], False),
            ("GET", "/api/payroll/enterprise/payslips", "gateway-jwt", ["admin", "hr"], False),
            ("POST", "/api/payroll/enterprise/payrolls/run", "gateway-jwt", ["admin", "hr"], True),
        ],
    },
    {
        "prefix": "/api/notification",
        "service": "notification",
        "rewrite_to": "",
        "routes": [
            ("GET", "/api/notification/ws", "downstream", None, False),
            ("GET", "/api/notification/api/notifications", "downstream", None, False),
            ("POST", "/api/notification/api/notifications", "downstream", None, False),
        ],
    },
    {
        "prefix": "/api/ats",
        "service": "ats",
        "rewrite_to": "/api/v1",
        "routes": [
            ("GET", "/api/ats/jobs", "gateway-jwt", None, False),
            ("POST", "/api/ats/jobs", "gateway-jwt", None, False),
            ("GET", "/api/ats/jobs/{job_id}", "gateway-jwt", None, False),
            ("POST", "/api/ats/jobs/{job_id}/publish", "gateway-jwt", None, False),
            ("GET", "/api/ats/candidates", "gateway-jwt", None, False),
            ("GET", "/api/ats/applications", "gateway-jwt", None, False),
            ("PUT", "/api/ats/applications/{application_id}/status", "gateway-jwt", None, False),
            ("GET", "/api/ats/interviews", "gateway-jwt", None, False),
            ("GET", "/api/ats/offers", "gateway-jwt", None, False),
            ("POST", "/api/ats/offers/{offer_id}/send", "gateway-jwt", None, False),
            ("GET", "/api/ats/analytics/overview", "gateway-jwt", None, False),
            ("GET", "/api/ats/career/jobs", "public", None, False),
            ("POST", "/api/ats/career/apply", "public", None, False),
        ],
    },
    {
        "prefix": "/api/lms",
        "service": "lms",
        "rewrite_to": "/api/v1",
        "routes": [
            ("GET", "/api/lms/courses", "gateway-jwt", None, False),
            ("POST", "/api/lms/courses", "gateway-jwt", None, False),
            ("DELETE", "/api/lms/courses/{id}", "gateway-jwt", None, False),
            ("GET", "/api/lms/enrollments", "gateway-jwt", None, False),
            ("PUT", "/api/lms/enrollments/{id}/complete", "gateway-jwt", None, False),
            ("GET", "/api/lms/certifications", "gateway-jwt", None, False),
            ("GET", "/api/lms/skills/matrix", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/performance",
        "service": "performance",
        "rewrite_to": "/api/v1",
        "routes": [
            ("GET", "/api/performance/goals", "gateway-jwt", None, False),
            ("POST", "/api/performance/goals", "gateway-jwt", None, False),
            ("PUT", "/api/performance/goals/{id}/progress", "gateway-jwt", None, False),
            ("GET", "/api/performance/reviews", "gateway-jwt", None, False),
            ("PUT", "/api/performance/reviews/{id}/submit", "gateway-jwt", None, False),
            ("GET", "/api/performance/feedback", "gateway-jwt", None, False),
            ("GET", "/api/performance/analytics/overview", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/copilot",
        "service": "copilot",
        "rewrite_to": "/api/v1/copilot",
        "routes": [
            ("POST", "/api/copilot/chat", "gateway-jwt", None, False),
            ("GET", "/api/copilot/sessions/{session_id}", "gateway-jwt", None, False),
            ("DELETE", "/api/copilot/sessions/{session_id}", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/audit",
        "service": "audit",
        "rewrite_to": "/api/v1/audit",
        "routes": [
            ("POST", "/api/audit/log", "gateway-jwt", ["admin", "auditor"], True),
            ("GET", "/api/audit/logs", "gateway-jwt", ["admin", "auditor"], False),
            ("GET", "/api/audit/logs/{log_id}", "gateway-jwt", ["admin", "auditor"], False),
            ("GET", "/api/audit/verify-chain", "gateway-jwt", ["admin", "auditor"], False),
        ],
    },
    {
        "prefix": "/api/compliance",
        "service": "compliance",
        "rewrite_to": "/api/v1/compliance",
        "routes": [
            ("GET", "/api/compliance/policies", "gateway-jwt", ["admin", "compliance", "hr"], False),
            ("POST", "/api/compliance/policies", "gateway-jwt", ["admin", "compliance", "hr"], True),
            ("GET", "/api/compliance/violations", "gateway-jwt", ["admin", "compliance", "hr"], False),
            ("PUT", "/api/compliance/violations/{violation_id}/status", "gateway-jwt", ["admin", "compliance", "hr"], True),
            ("GET", "/api/compliance/summary", "gateway-jwt", ["admin", "compliance", "hr"], False),
        ],
    },
    {
        "prefix": "/api/integration",
        "service": "integration",
        "rewrite_to": "/api/v1/integration",
        "routes": [
            ("GET", "/api/integration/dashboard", "gateway-jwt", None, False),
            ("GET", "/api/integration/webhooks", "gateway-jwt", None, False),
            ("POST", "/api/integration/webhooks", "gateway-jwt", None, False),
            ("DELETE", "/api/integration/webhooks/{webhook_id}", "gateway-jwt", None, False),
            ("GET", "/api/integration/subscriptions", "gateway-jwt", None, False),
            ("GET", "/api/integration/outbox", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/lifecycle",
        "service": "lifecycle",
        "rewrite_to": "/api/v1/lifecycle",
        "routes": [
            ("GET", "/api/lifecycle/dashboard", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/onboarding/templates", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/offboarding", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/probation", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/career/frameworks", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/promotions", "gateway-jwt", None, False),
            ("GET", "/api/lifecycle/timeline/{employee_id}", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/security",
        "service": "security",
        "rewrite_to": "/api/v1/security",
        "routes": [
            ("GET", "/api/security/dashboard", "gateway-jwt", ["admin", "compliance", "auditor"], False),
            ("GET", "/api/security/conditional-access", "gateway-jwt", ["admin", "compliance", "auditor"], False),
            ("GET", "/api/security/dlp/incidents", "gateway-jwt", ["admin", "compliance", "auditor"], False),
            ("POST", "/api/security/encryption-keys", "gateway-jwt", ["admin", "compliance", "auditor"], False),
            ("GET", "/api/security/zero-trust", "gateway-jwt", ["admin", "compliance", "auditor"], False),
        ],
    },
    {
        "prefix": "/api/ai",
        "service": "ai",
        "rewrite_to": "/api/v1/ai",
        "routes": [
            ("POST", "/api/ai/attrition-prediction", "gateway-jwt", None, False),
            ("POST", "/api/ai/leave-assistant", "gateway-jwt", None, False),
            ("POST", "/api/ai/anomaly-detection", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/live",
        "service": "live",
        "rewrite_to": "/api/v1/live",
        "routes": [
            ("GET", "/api/live/presence", "gateway-jwt", None, False),
            ("GET", "/api/live/incidents", "gateway-jwt", None, False),
            ("GET", "/api/live/sse/{channel}", "gateway-jwt", None, False),
            ("POST", "/api/live/publish/{channel}", "gateway-jwt", None, False),
        ],
    },
    {
        "prefix": "/api/command-center",
        "service": "analytics",
        "rewrite_to": "/api/v1/command-center",
        "routes": [
            ("GET", "/api/command-center/overview", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("GET", "/api/command-center/org-health", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("GET", "/api/command-center/activity-feed", "gateway-jwt", ["admin", "manager", "hr"], False),
            ("GET", "/api/command-center/workforce-cost", "gateway-jwt", ["admin", "manager", "hr"], False),
        ],
    },
    {
        "prefix": "/api/workforce",
        "service": "workforce",
        "rewrite_to": "/api/v1/workforce",
        "routes": [
            ("GET", "/api/workforce/dashboard", "gateway-jwt", ["admin", "hr", "manager"], False),
            ("GET", "/api/workforce/forecasts", "gateway-jwt", ["admin", "hr", "manager"], False),
            ("GET", "/api/workforce/allocations", "gateway-jwt", ["admin", "hr", "manager"], False),
            ("GET", "/api/workforce/skill-gaps", "gateway-jwt", ["admin", "hr", "manager"], False),
            ("POST", "/api/workforce/simulations/run", "gateway-jwt", ["admin", "hr", "manager"], False),
        ],
    },
    {
        "prefix": "/api/learning",
        "service": "lms",
        "rewrite_to": "/api/v1/learning",
        "routes": [
            ("GET", "/api/learning/analytics/overview", "gateway-jwt", None, False),
            ("GET", "/api/learning/compliance", "gateway-jwt", None, False),
            ("GET", "/api/learning/journeys", "gateway-jwt", None, False),
            ("GET", "/api/learning/mentors", "gateway-jwt", None, False),
            ("GET", "/api/learning/knowledge", "gateway-jwt", None, False),
        ],
    },
]
