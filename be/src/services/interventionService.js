import axios from 'axios';
import { query } from '../db.js';
import dotenv from "dotenv";
dotenv.config();

export async function setStudentStatus(studentId, status) {
    await query('UPDATE students SET status = $1 WHERE id = $2', [status, studentId]);
}

export async function createDailyLog(studentId, quiz, focus) {
    await query(
        'INSERT INTO daily_logs (student_id, quiz_score, focus_minutes) VALUES ($1, $2, $3)',
        [studentId, quiz, focus]
    );
}

export async function createIntervention(studentId, task) {
    await query('INSERT INTO interventions (student_id, task) VALUES ($1, $2)', [studentId, task]);
}

export async function completeInterventions(studentId) {
    await query(
        "UPDATE interventions SET status = 'completed', completed_at = NOW() WHERE student_id = $1 AND status = 'pending'",
        [studentId]
    );
}

export async function getPendingTask(studentId) {
    const { rows } = await query(
        "SELECT task FROM interventions WHERE student_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        [studentId]
    );
    return rows[0]?.task ?? null;
}

export async function triggerN8N(payload) {
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) {
        console.warn('Skipping n8n: No Webhook URL configured');
        return;
    }
    try {
        // Wait so we can log failures; flip to fire-and-forget if you want faster API latency
        await axios.post(url, payload, { timeout: 5000 });
    } catch (e) {
        console.error('n8n webhook failed:', e.message);
    }
}