const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/device/status
router.get('/status', (req, res) => {
    const { deviceId } = req.query;
    res.status(200).json({
        deviceId: deviceId || 'unknown',
        status: 'Connected',
        batteryLevel: '85%',
        lastSeen: new Date(),
        firmwareVersion: 'v2.0.0 (Smart Edge)'
    });
});

// POST /api/device/calibrate
router.post('/calibrate', async (req, res) => {
    try {
        const { device_id, baseline_rms, max_rms } = req.body;

        if (!device_id || baseline_rms === undefined || max_rms === undefined) {
            return res.status(400).json({ error: 'device_id, baseline_rms, and max_rms are required' });
        }

        const { data, error } = await supabase
            .from('device_calibrations')
            .upsert([{ 
                device_id, 
                baseline_rms, 
                max_rms,
                updated_at: new Date().toISOString()
            }], { onConflict: 'device_id' })
            .select();

        if (error) throw error;

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
                max_rms: 500 // fallback safe max
            });
        }
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching calibration:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
