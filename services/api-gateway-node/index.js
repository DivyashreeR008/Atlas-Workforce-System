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
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

// Proxy logic - Routes to Microservices
// In a real environment, URLs would come from env vars
const services = {
    employee: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:8001',
    payroll: process.env.PAYROLL_SERVICE_URL || 'http://localhost:8002',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8003',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8004'
};

// Mock Auth endpoint
app.post('/api/auth/login', (req, res) => {
    // Dummy login endpoint
    const { email, password } = req.body;
    if (email && password) {
        // Return a mock JWT
        res.status(200).json({ 
            token: 'mock-jwt-token-12345',
            user: { id: 1, name: 'Admin User', email } 
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Simple Gateway Proxy setup
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

app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
});
