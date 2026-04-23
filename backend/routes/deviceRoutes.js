const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { DEFAULT_MAX_RMS, setCachedMaxRms } = require('../services/calibrationCache');
const localStore = require('../services/localStore');

const DEVICE_ONLINE_WINDOW_MS = 15000;

const buildDeviceStatus = (deviceId, latestSample) => {
    const lastSeen = latestSample?.created_at || null;
    const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
    const isOnline = Boolean(lastSeenMs && Date.now() - lastSeenMs <= DEVICE_ONLINE_WINDOW_MS);

    return {
        deviceId,
        status: isOnline ? 'Connected' : 'Disconnected',
        isOnline,
        batteryLevel: null,
        lastSeen,
        staleAfterMs: DEVICE_ONLINE_WINDOW_MS,
        firmwareVersion: isOnline ? 'ESP32 stream active' : 'No recent ESP32 packets'
    };
};

// GET /api/device/status
router.get('/status', async (req, res) => {
    try {
        const deviceId = req.query.deviceId || 'ESP32_01';

        if (!supabase) {
            return res.status(200).json(buildDeviceStatus(deviceId, localStore.getLatestSensorData(deviceId)));
        }

        const { data, error } = await supabase
            .from('sensor_data')
            .select('device_id, created_at')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        res.status(200).json(buildDeviceStatus(deviceId, data));
    } catch (error) {
        console.error('Error fetching device status:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// POST /api/device/calibrate
router.post('/calibrate', async (req, res) => {
    try {
        const { device_id, baseline_rms, max_rms } = req.body;
        const baselineValue = Number(baseline_rms);
        const maxValue = Number(max_rms);

        if (!device_id || baseline_rms === undefined || max_rms === undefined) {
            return res.status(400).json({ error: 'device_id, baseline_rms, and max_rms are required' });
        }

        if (!Number.isFinite(baselineValue) || baselineValue < 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
            return res.status(400).json({ error: 'baseline_rms must be 0 or higher and max_rms must be greater than 0' });
        }

        if (!supabase) {
            const data = localStore.upsertCalibration({
                device_id,
                baseline_rms: baselineValue,
                max_rms: maxValue
            });

            setCachedMaxRms(device_id, maxValue);

            return res.status(200).json({
                message: 'Calibration saved successfully',
                data
            });
        }

        const { data, error } = await supabase
            .from('device_calibrations')
            .upsert([{ 
                device_id, 
                baseline_rms: baselineValue,
                max_rms: maxValue,
                updated_at: new Date().toISOString()
            }], { onConflict: 'device_id' })
            .select();

        if (error) throw error;
        setCachedMaxRms(device_id, maxValue);

        res.status(200).json({
            message: 'Calibration saved successfully',
            data: data[0]
        });
    } catch (error) {
        console.error('Error saving calibration:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// GET /api/device/calibration/:device_id
router.get('/calibration/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;

        if (!supabase) {
            return res.status(200).json(localStore.getCalibration(device_id));
        }

        const { data, error } = await supabase
            .from('device_calibrations')
            .select('*')
            .eq('device_id', device_id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignore not found error
        
        // Return default calibration if not found
        if (!data) {
            return res.status(200).json({
                device_id,
                baseline_rms: 0,
                max_rms: DEFAULT_MAX_RMS
            });
        }
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching calibration:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
