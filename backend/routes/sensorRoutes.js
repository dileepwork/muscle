const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const rateLimit = require('express-rate-limit');
const { getCachedMaxRms } = require('../services/calibrationCache');
const localStore = require('../services/localStore');

const ALERT_COOLDOWN_MS = 30000;
const alertCooldown = new Map();

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const requiredNumber = (value, field) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return { error: `${field} must be a valid number` };
    }

    return { value: parsed };
};

const shouldSaveAlert = (deviceId, risk) => {
    const key = `${deviceId}:${risk}`;
    const now = Date.now();
    const previous = alertCooldown.get(key) || 0;

    if (now - previous < ALERT_COOLDOWN_MS) {
        return false;
    }

    alertCooldown.set(key, now);
    return true;
};

const streamLimiter = rateLimit({
    windowMs: 1000,
    max: 2,
    message: { error: 'Too many requests, please slow down.' }
});

const processAndStoreData = async (req, res) => {
    try {
        const { device_id, timestamp, emg, imu } = req.body;

        if (!device_id || !emg || typeof emg !== 'object') {
            return res.status(400).json({ error: 'device_id and emg payload are required' });
        }

        const rawReading = requiredNumber(emg.raw, 'emg.raw');
        const rmsReading = requiredNumber(emg.rms, 'emg.rms');
        const peakReading = requiredNumber(emg.peak, 'emg.peak');

        if (rawReading.error || rmsReading.error || peakReading.error) {
            return res.status(400).json({
                error: rawReading.error || rmsReading.error || peakReading.error
            });
        }

        // 1. Adaptive Fatigue Detection
        const max_rms = await getCachedMaxRms(supabase, device_id);
        const current_rms = rmsReading.value;
        const fatigue_ratio = current_rms / max_rms;
        
        let fatigue = 'low';
        if (fatigue_ratio > 0.6) fatigue = 'high';
        else if (fatigue_ratio > 0.3) fatigue = 'moderate';

        // 2. Posture Detection Improvement
        const pitch = toNumber(imu?.pitch);
        const roll = toNumber(imu?.roll);
        let posture = 'good';
        if (Math.abs(pitch) > 30 || Math.abs(roll) > 20) {
            posture = 'bad';
        }

        // 3. Smart Risk Engine
        let risk = 'normal';
        if (fatigue === 'high' && posture === 'bad') {
            risk = 'critical';
        } else if (fatigue === 'high' || posture === 'bad') {
            risk = 'warning';
        }

        const payloadToSave = {
            created_at: new Date().toISOString(),
            device_id, 
            emg_raw: rawReading.value,
            emg_rms: current_rms,
            emg_peak: peakReading.value,
            acc_x: toNumber(imu?.acc?.x),
            acc_y: toNumber(imu?.acc?.y),
            acc_z: toNumber(imu?.acc?.z),
            gyro_x: toNumber(imu?.gyro?.x),
            gyro_y: toNumber(imu?.gyro?.y),
            gyro_z: toNumber(imu?.gyro?.z),
            pitch,
            roll,
            fatigue,
            posture,
            risk
        };

        // Emit instantly via WebSocket for ZERO DELAY live dashboard
        const io = req.app.get('io');
        if (io) {
            io.emit('sensor_update', {
                ...payloadToSave,
                source_timestamp: timestamp,
                time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' })
            });
        }

        // Store asynchronously when Supabase is configured, otherwise keep local runs usable in memory.
        if (supabase) {
            supabase.from('sensor_data').insert([payloadToSave]).then(({ error }) => {
                if (error) console.error('DB Insert Error:', error);
            });
        } else {
            localStore.insertSensorData(payloadToSave);
        }

        // Auto-trigger alerts
        if ((risk === 'warning' || risk === 'critical') && shouldSaveAlert(device_id, risk)) {
            const alertType = risk === 'critical' ? 'Critical Risk Detected' : 'Safety Warning';
            const alertMessage = `Risk Level: ${risk}. Fatigue is ${fatigue}, Posture is ${posture}. (RMS: ${current_rms.toFixed(2)}, Pitch: ${pitch.toFixed(1)} deg, Roll: ${roll.toFixed(1)} deg)`;

            const alertPayload = {
                device_id,
                type: alertType,
                severity: risk === 'critical' ? 'Critical' : 'Warning',
                message: alertMessage
            };

            if (supabase) {
                supabase.from('alerts').insert([alertPayload]).then(({ error }) => {
                    if (error) console.error('Error saving alert:', error);
                });
            } else {
                localStore.insertAlert(alertPayload);
            }
        }

        res.status(200).json({
            status: 'processed',
            analysis: { fatigue, posture, risk },
            risk
        });
    } catch (error) {
        console.error('Error processing sensor stream:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.post('/', processAndStoreData);
router.post('/stream', streamLimiter, processAndStoreData);

// ... keeping history/latest for initial loads ...
router.get('/latest', async (req, res) => {
    try {
        const { device_id } = req.query;

        if (!supabase) {
            return res.status(200).json(localStore.listSensorData({ device_id, limit: 20 }));
        }

        let query = supabase.from('sensor_data').select('*').order('created_at', { ascending: false }).limit(20);
        if (device_id) query = query.eq('device_id', device_id);
        const { data, error } = await query;
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/history', async (req, res) => {
    try {
        const { device_id } = req.query;

        if (!supabase) {
            return res.status(200).json(localStore.listSensorData({ device_id, limit: 100 }));
        }

        let query = supabase.from('sensor_data').select('*').order('created_at', { ascending: false }).limit(100);
        if (device_id) query = query.eq('device_id', device_id);
        const { data, error } = await query;
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
