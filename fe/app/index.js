import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Platform, ScrollView
} from 'react-native';
import io from 'socket.io-client';

// CONFIGURATION
const API_URL = 'https://alcovia-615a.onrender.com';

export default function App() {
    const [studentId, setStudentId] = useState(10);
    const [status, setStatus] = useState('loading');
    const [task, setTask] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    const [viewMode, setViewMode] = useState('checkin');

    const [score, setScore] = useState('');
    const [focus, setFocus] = useState('');
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // 1. SOCKET & STATE SYNC 
    useEffect(() => {
        if (!studentId) return;

        // A. Fetch Initial State
        fetch(`${API_URL}/student/${studentId}/state`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setStatus('unknown'); // Handle invalid ID
                } else {
                    setStatus(data.status);
                    if (data.task) setTask(data.task);
                }
            })
            .catch(err => console.error("Failed to fetch state:", err));

        // B. Connect Real-Time Socket
        const socket = io(API_URL, {
            query: { student_id: studentId },
            transports: ['websocket'],
            path: '/socket.io/',
            secure: true,
        });

        socket.on('connect', () => {
            console.log('✅ Connected to Server via WebSockets');
            setSocketConnected(true);
        });

        socket.on('status_update', (payload) => {
            console.log("⚡ Real-time Update Received:", payload);
            setStatus(payload.status);
            if (payload.task) setTask(payload.task);
        });

        socket.on('disconnect', () => setSocketConnected(false));

        // --- CHEATER DETECTION ---
        const handleCheat = () => {
            if (status === 'on_track') {
                fetch(`${API_URL}/daily-checkin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, quiz_score: 0, focus_minutes: 0 }),
                });
                if (Platform.OS === 'web') alert('Focus lost — session failed!');
                setStatus('needs_intervention');
            }
        };

        let visibilityHandler;
        if (Platform.OS === 'web') {
            visibilityHandler = () => {
                if (document.hidden) handleCheat();
            };
            document.addEventListener('visibilitychange', visibilityHandler);
        }

        return () => {
            socket.disconnect();
            if (Platform.OS === 'web' && visibilityHandler) {
                document.removeEventListener('visibilitychange', visibilityHandler);
            }
        };
    }, [status, studentId]); // Re-run if ID or Status changes

    // 2. ACTIONS
    const createStudent = async () => {
        if (!newName || !newEmail) return Alert.alert("Error", "Please fill all fields");

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/seed-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, email: newEmail })
            });
            const data = await res.json();
            if (data.student_id) {
                Alert.alert("Success", `Student Created! Your ID is ${data.student_id}`);
                setStudentId(data.student_id); // Auto-login
                setViewMode('checkin'); // Go to checkin
            }
        } catch (err) {
            Alert.alert("Error", "Failed to create student");
        } finally {
            setSubmitting(false);
        }
    };

    const submitCheckin = async () => {
        if (!score || !focus) return Alert.alert("Error", "Please fill in all fields");

        setSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/daily-checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentId,
                    quiz_score: parseInt(score),
                    focus_minutes: parseInt(focus)
                })
            });
            const data = await response.json();

            if (data.status === 'Pending Mentor Review') {
                setStatus('needs_intervention');
            } else {
                setStatus('on_track');
                Alert.alert("Success", "Great job! You are on track.");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to submit check-in");
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
                body: JSON.stringify({ student_id: studentId })
            });
            setStatus('on_track');
        } catch (error) {
            Alert.alert("Error", "Could not mark complete");
        } finally {
            setSubmitting(false);
        }
    };

    // 3. UI RENDERING

    // Loading Screen
    if (status === 'loading') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 10 }}>Connecting...</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.statusBar}>
                <Text style={styles.logo}>Alcovia Focus</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Text style={styles.idText}>ID: {studentId}</Text>
                    <View style={[styles.badge, socketConnected ? styles.online : styles.offline]}>
                        <Text style={styles.badgeText}>{socketConnected ? 'LIVE' : 'OFFLINE'}</Text>
                    </View>
                </View>
            </View>

            {status !== 'needs_intervention' && status !== 'remedial' && (
                <View style={styles.toggleContainer}>
                    <TouchableOpacity onPress={() => setViewMode('checkin')}>
                        <Text style={[styles.toggleText, viewMode === 'checkin' && styles.activeText]}>Check-in</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#ccc' }}>|</Text>
                    <TouchableOpacity onPress={() => setViewMode('create')}>
                        <Text style={[styles.toggleText, viewMode === 'create' && styles.activeText]}>New Student</Text>
                    </TouchableOpacity>
                </View>
            )}

            {viewMode === 'create' && status === 'on_track' && (
                <View style={styles.card}>
                    <Text style={styles.title}>New Student</Text>
                    <Text style={styles.subtitle}>Create a profile to start tracking.</Text>

                    <Text style={styles.label}>Name</Text>
                    <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="John Doe" />

                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="john@example.com" keyboardType="email-address" />

                    <TouchableOpacity style={styles.button} onPress={createStudent} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create & Login</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {viewMode === 'checkin' && status === 'on_track' && (
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
                    <Text style={styles.lockedText}>Analysis in progress. Waiting for Mentor...</Text>
                    <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 20 }} />
                </View>
            )}

            {status === 'remedial' && (
                <View style={[styles.card, styles.remedialCard]}>
                    <Text style={styles.emoji}>📝</Text>
                    <Text style={styles.remedialTitle}>Intervention Assigned</Text>
                    <View style={styles.taskBox}>
                        <Text style={styles.taskLabel}>YOUR TASK:</Text>
                        <Text style={styles.taskText}>{task || "Review study materials"}</Text>
                    </View>
                    <TouchableOpacity style={[styles.button, styles.remedialButton]} onPress={markComplete} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mark Complete</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', padding: 20 },
    statusBar: { position: 'absolute', top: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
    logo: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
    idText: { fontSize: 12, color: '#6B7280', fontWeight: 'bold' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    online: { backgroundColor: '#D1FAE5' },
    offline: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#065F46' },

    toggleContainer: { flexDirection: 'row', gap: 20, marginBottom: 20 },
    toggleText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
    activeText: { color: '#4F46E5', textDecorationLine: 'underline' },

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

    remedialCard: { alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#F59E0B' },
    remedialTitle: { fontSize: 22, fontWeight: 'bold', color: '#B45309', marginTop: 16, marginBottom: 20 },
    taskBox: { width: '100%', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#FCD34D' },
    taskLabel: { fontSize: 10, fontWeight: 'bold', color: '#92400E', letterSpacing: 1 },
    taskText: { fontSize: 18, color: '#92400E', fontWeight: '500', marginTop: 4 },
    remedialButton: { backgroundColor: '#D97706', width: '100%' }
});