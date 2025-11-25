import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import router from './routes.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
        methods: ['GET', 'POST'],
    },
});

app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }));

app.use((req, _res, next) => {
    req.io = io;
    next();
});

io.on('connection', (socket) => {
    const studentId = socket.handshake.query.student_id;
    if (studentId) {
        console.log(`🔌 Student ${studentId} connected`);
        socket.join(String(studentId));
    }
    socket.on('disconnect', () => {
        if (studentId) console.log(`❌ Student ${studentId} disconnected`);
    });
});

app.use('/', router);

const port = Number(process.env.PORT) || 3333;
httpServer.listen(port, () => console.log(`🚀 API & Sockets listening on :${port}`));