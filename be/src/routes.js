import { Router } from 'express';
import { z } from 'zod';
// Note: Ensure this filename matches what you created (singular vs plural)
import { setStudentStatus, createDailyLog, createIntervention, completeInterventions, getPendingTask, triggerN8N } from './services/interventionService.js';
import { query } from './db.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

// Seed endpoint
router.post('/seed-student', async (req, res) => {
    const { name = 'Demo Student', email = 'student@example.com' } = req.body;
    try {
        const { rows } = await query(
            'INSERT INTO students (name, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id',
            [name, email]
        );
        res.json({ student_id: rows[0].id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Daily Check-in
const Checkin = z.object({
    student_id: z.number().int().positive(),
    quiz_score: z.number().int().min(0).max(10),
    focus_minutes: z.number().int().min(0)
});

router.post('/daily-checkin', async (req, res) => {
    const parse = Checkin.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

    const { student_id, quiz_score, focus_minutes } = parse.data;

    try {
        await createDailyLog(student_id, quiz_score, focus_minutes);

        if (quiz_score > 7 && focus_minutes > 60) {
            await setStudentStatus(student_id, 'on_track');
            return res.json({ status: 'On Track' });
        }

        await setStudentStatus(student_id, 'needs_intervention');
        await triggerN8N({ student_id, quiz_score, focus_minutes });

        return res.json({ status: 'Pending Mentor Review' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Assign Intervention
const Assign = z.object({
    student_id: z.number().int().positive(),
    task: z.string().min(3)
});

router.post('/assign-intervention', async (req, res) => {
    // FIX: Properly handle Zod result
    const parse = Assign.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

    const { student_id, task } = parse.data;

    await createIntervention(student_id, task);
    await setStudentStatus(student_id, 'remedial');

    // Socket Emit
    if (req.io) {
        req.io.to(String(student_id)).emit('status_update', {
            status: 'remedial',
            task: task
        });
    }

    res.json({ message: 'Intervention assigned & Client Notified' });
});

// 3. Mark Complete
// FIX: Added missing Schema
const Complete = z.object({
    student_id: z.number().int().positive()
});

router.post('/mark-complete', async (req, res) => {
    // FIX: Properly handle Zod result
    const parse = Complete.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

    const { student_id } = parse.data;

    await completeInterventions(student_id);
    await setStudentStatus(student_id, 'on_track');

    if (req.io) {
        req.io.to(String(student_id)).emit('status_update', {
            status: 'on_track',
            task: null
        });
    }

    res.json({ message: 'Returned to normal' });
});

// State Helper
router.get('/student/:id/state', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

    try {
        const { rows } = await query('SELECT id, name, status FROM students WHERE id = $1', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'not found' });

        const task = await getPendingTask(id);
        res.json({ ...rows[0], task });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;