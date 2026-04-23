require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const sensorRoutes = require('./routes/sensorRoutes');
const alertRoutes = require('./routes/alertRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const allowLocalDevOrigins = process.env.ALLOW_LOCAL_DEV_ORIGINS !== 'false';

const corsOptions = {
    origin(origin, callback) {
        if (
            !origin ||
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(origin) ||
            (allowLocalDevOrigins && localDevOriginPattern.test(origin)) ||
            (origin && origin.endsWith('.vercel.app'))
        ) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS']
};

// Create HTTP Server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Initialize Supabase Client
const supabase = require('./config/supabase');
console.log('Supabase client initialized');

// Make io accessible to routers
app.set('io', io);

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log(`New client connected via WebSocket: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Routes
app.use('/api/sensor-data', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/device', deviceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Default route
app.get('/', (req, res) => {
    res.send('Muscle Fatigue Monitoring API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`Server & WebSocket running on port ${PORT}`);
    });
}

// Export the Express app for Vercel serverless deployment
module.exports = server;
