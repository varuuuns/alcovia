import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Platform
} from 'react-native';
import io from 'socket.io-client';

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
// Replace with your Render/Railway backend URL
const API_URL = 'https://YOUR-BACKEND-ON-RENDER.com';
const STUDENT_ID = 1; // demo

export default function App() {
    const [status, setStatus] = useState('loading'); // 'on_track' | 'needs_intervention' | 'remedial'
    const [task, setTask] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    const [score, setScore] = useState('');
    const [focus, setFocus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // 1) INITIAL LOAD + SOCKETS
    useEffect(() => {
        // Initial state
        fetch(`${API_URL}/student/${STUDENT_ID}/state`)
            .then(res => res.json())
            .then(data => {
                setStatus(data.status);
                if (data.task) setTask(data.task);
            })
            .catch(err => console.error('Failed to fetch state:', err));

        // Socket
        const socket = io(API_URL, {
            query: { student_id: STUDENT_ID },
            transports: ['websocket'],
        });

        socket.on('connect', () => setSocketConnected(true));
        socket.on('status_update', (payload) => {
            setStatus(payload.status);
            setTask(payload.task ?? null);
        });
        socket.on('disconnect', () => setSocketConnected(false));

        // Fallback polling (optional) in case a socket event is missed
        const interval = setInterval(() => {
            fetch(`${API_URL}/student/${STUDENT_ID}/state`)
                .then(res => res.json())
                .then(data => {
                    setStatus(data.status);
                    setTask(data.task);
                })
                .catch(() => { });
        }, 60000);

        // Cheater Detection (optional bonus)
        const handleCheat = () => {
            fetch(`${API_URL}/daily-checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: STUDENT_ID, quiz_score: 0, focus_minutes: 0 }),
            });
            if (Platform.OS === 'web') alert('Focus lost — session failed!');
        };
        if (Platform.OS === 'web') {
            const handler = () => { if (document.hidden) handleCheat(); };
            document.addEventListener('visibilitychange', handler);
            return () => {
                socket.disconnect();
                clearInterval(interval);
                document.removeEventListener('visibilitychange', handler);
            };
        }

        return () => {
            socket.disconnect();
            clearInterval(interval);
        };
    }, []);

    // 2) ACTIONS
    const submitCheckin = async () => {
        if (!score || !focus) return Alert.alert('Error', 'Please fill in all fields');

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/daily-checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: STUDENT_ID,
                    quiz_score: parseInt(score),
                    focus_minutes: parseInt(focus),
                }),
            });
            const data = await res.json();
            if (data.status === 'Pending Mentor Review') {
                setStatus('needs_intervention');
            } else {
                setStatus('on_track');
                Alert.alert('Success', 'Great job! You are on track.');
            }
        } catch {
            Alert.alert('Error', 'Failed to submit check-in');
        } finally {
            setSubmitting(false);
            setScore('');
            setFocus('');
        }
    };

    const markComplete = async () => {
        setSubmitting(true);
        try {
            await fetch(`${API_URL}/mark-complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: STUDENT_ID }),
            });
            // socket will update UI; set optimistically too:
            setStatus('on_track');
            setTask(null);
        } catch {
            Alert.alert('Error', 'Could not mark complete');
        } finally {
            setSubmitting(false);
        }
    };

    // 3) RENDER
    if (status === 'loading') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 10 }}>Connecting to Alcovia HQ...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.statusBar}>
                <Text style={styles.logo}>Alcovia Focus</Text>
                <View style={[styles.badge, socketConnected ? styles.online : styles.offline]}>
                    <Text style={styles.badgeText}>{socketConnected ? 'LIVE' : 'OFFLINE'}</Text>
                </View>
            </View>

            {status === 'on_track' && (
                <View style={styles.card}>
                    <Text style={styles.title}>Daily Check-in</Text>
                    <Text style={styles.subtitle}>Log your progress to continue.</Text>

                    <Text style={styles.label}>Quiz Score (0-10)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 8" keyboardType="numeric" value={score} onChangeText={setScore} />
                    <Text style={styles.label}>Focus Time (Minutes)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 65" keyboardType="numeric" value={focus} onChangeText={setFocus} />

                    <TouchableOpacity style={styles.button} onPress={submitCheckin} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Log</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {(status === 'needs_intervention' || status === 'locked') && (
                <View style={[styles.card, styles.lockedCard]}>
                    <Text style={styles.emoji}>🔒</Text>
                    <Text style={styles.lockedTitle}>ACCESS DENIED</Text>
                    <Text style={styles.lockedText}>
                        Your stats have dropped below the threshold.{'\n'}
                        Analysis in progress. Waiting for Mentor...
                    </Text>
                    <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 20 }} />
                    <Text style={styles.hint}>(Keep this tab open. It will unlock automatically.)</Text>
                </View>
            )}

            {status === 'remedial' && (
                <View style={[styles.card, styles.remedialCard]}>
                    <Text style={styles.emoji}>📝</Text>
                    <Text style={styles.remedialTitle}>Intervention Assigned</Text>
                    <View style={styles.taskBox}>
                        <Text style={styles.taskLabel}>YOUR TASK:</Text>
                        <Text style={styles.taskText}>{task || 'Review study materials'}</Text>
                    </View>
                    <TouchableOpacity style={[styles.button, styles.remedialButton]} onPress={markComplete} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mark Complete</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', padding: 20 },
    statusBar: { position: 'absolute', top: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
    logo: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    online: { backgroundColor: '#D1FAE5' },
    offline: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#065F46' },
    card: { width: '100%', maxWidth: 400, backgroundColor: 'white', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
    button: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    lockedCard: { alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#EF4444' },
    lockedTitle: { fontSize: 22, fontWeight: 'bold', color: '#EF4444', marginTop: 16 },
    lockedText: { textAlign: 'center', color: '#374151', marginTop: 8, lineHeight: 22 },
    emoji: { fontSize: 48 },
    hint: { fontSize: 12, color: '#9CA3AF', marginTop: 24, fontStyle: 'italic' },
    remedialCard: { alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#F59E0B' },
    remedialTitle: { fontSize: 22, fontWeight: 'bold', color: '#B45309', marginTop: 16, marginBottom: 20 },
    taskBox: { width: '100%', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#FCD34D' },
    taskLabel: { fontSize: 10, fontWeight: 'bold', color: '#92400E', letterSpacing: 1 },
    taskText: { fontSize: 18, color: '#92400E', fontWeight: '500', marginTop: 4 },
    remedialButton: { backgroundColor: '#D97706', width: '100%' },
});