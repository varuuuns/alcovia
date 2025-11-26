import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import router from './routes.js';
import dotenv from "dotenv";
dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(express.json());

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Allow both to be safe
    allowEIO3: true // Compatibility mode
});

// Middleware to inject io
app.use((req, _res, next) => {
    req.io = io;
    next();
});

// Socket Logic
io.on('connection', (socket) => {
    console.log(`🔌 New Connection: ${socket.id}`);

    const studentId = socket.handshake.query.student_id;

    if (studentId) {
        console.log(`👤 Student ${studentId} joined room ${studentId}`);
        socket.join(String(studentId));
    }

    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);
    });
});

app.use('/', router);

httpServer.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
});