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
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 2. Socket.io Setup - Use config
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
    },
});

// Middleware to inject io
app.use((req, _res, next) => {
    req.io = io;
    next();
});

// Socket Logic
io.on('connection', (socket) => {
    const studentId = socket.handshake.query.student_id;

    if (studentId) {
        console.log(`🔌 Student ${studentId} connected via WebSocket`);
        socket.join(String(studentId));
    }

    socket.on('disconnect', () => {
        if (studentId) console.log(`❌ Student ${studentId} disconnected`);
    });
});

app.use('/', router);

httpServer.listen(process.env.PORT, () => {
    console.log(`🚀 API & Sockets listening on :${process.env.PORT}`);
});