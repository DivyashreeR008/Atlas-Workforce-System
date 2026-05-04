require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
// Proxy logic - Routes to Microservices
const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:8010',
    employee: process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:8001',
    payroll: process.env.PAYROLL_SERVICE_URL || 'http://payroll-service:8002',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8004'
};

// Proxies must be defined before body-parsers to avoid stream consumption issues
app.use('/api/auth', createProxyMiddleware({ 
    target: services.auth, 
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' }
}));
app.use('/api/employee', createProxyMiddleware({ 
    target: services.employee, 
    changeOrigin: true,
    pathRewrite: { '^/api/employee': '' }
}));
app.use('/api/payroll', createProxyMiddleware({ 
    target: services.payroll, 
    changeOrigin: true,
    pathRewrite: { '^/api/payroll': '' }
}));
app.use('/api/analytics', createProxyMiddleware({ 
    target: services.analytics, 
    changeOrigin: true,
    pathRewrite: { '^/api/analytics': '' }
}));
app.use('/api/notification', createProxyMiddleware({ 
    target: services.notification, 
    changeOrigin: true,
    pathRewrite: { '^/api/notification': '' }
}));

// Body parsers
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
});
