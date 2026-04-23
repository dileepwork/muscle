const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const rateLimit = require('express-rate-limit');

// Simple in-memory cache for calibration data to avoid DB hits on every stream
const calibrationCache = new Map();

const getCalibration = async (device_id) => {
    if (calibrationCache.has(device_id)) return calibrationCache.get(device_id);
    
    try {
        const { data, error } = await supabase
            .from('device_calibrations')
            .select('*')
            .eq('device_id', device_id)
            .single();
            
        const max_rms = (data && data.max_rms) ? data.max_rms : 500;
        calibrationCache.set(device_id, max_rms);
        return max_rms;
    } catch (err) {
        return 500; // fallback default
    }
};

const streamLimiter = rateLimit({
    windowMs: 500, // 2 requests per second
    max: 2, 
    message: { error: 'Too many requests, please slow down.' }
});

const processAndStoreData = async (req, res) => {
    try {
        const { device_id, timestamp, emg, imu } = req.body;

        if (!device_id || !emg) {
            return res.status(400).json({ error: 'device_id and emg payload are required' });
        }

        // 1. Adaptive Fatigue Detection
        const max_rms = await getCalibration(device_id);
        const current_rms = emg.rms || 0;
        const fatigue_ratio = current_rms / max_rms;
        
        let fatigue = 'low';
        if (fatigue_ratio > 0.6) fatigue = 'high';
        else if (fatigue_ratio > 0.3) fatigue = 'moderate';

        // 2. Posture Detection Improvement
        const pitch = imu?.pitch || 0;
        const roll = imu?.roll || 0;
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
            device_id, 
            emg_raw: emg.raw || 0,
            emg_rms: current_rms,
            emg_peak: emg.peak || 0,
            acc_x: imu?.acc?.x || 0,
            acc_y: imu?.acc?.y || 0,
            acc_z: imu?.acc?.z || 0,
            gyro_x: imu?.gyro?.x || 0,
            gyro_y: imu?.gyro?.y || 0,
            gyro_z: imu?.gyro?.z || 0,
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
                time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' })
            });
        }

        // Insert into Supabase asynchronously (don't block response)
        supabase.from('sensor_data').insert([payloadToSave]).then(({ error }) => {
            if (error) console.error('DB Insert Error:', error);
        });

        // Auto-trigger alerts
        if (risk === 'warning' || risk === 'critical') {
            const alertType = risk === 'critical' ? 'Critical Risk Detected' : 'Safety Warning';
            const alertMessage = `Risk Level: ${risk}. Fatigue is ${fatigue}, Posture is ${posture}. (RMS: ${current_rms.toFixed(2)}, Pitch: ${pitch.toFixed(1)}°)`;

            supabase.from('alerts').insert([{
                device_id,
                type: alertType,
                severity: risk === 'critical' ? 'Critical' : 'Warning',
                message: alertMessage
            }]).then(({ error }) => {
                if (error) console.error('Error saving alert:', error);
            });
        }

        res.status(200).json({ status: 'Processed and streaming', risk });
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
