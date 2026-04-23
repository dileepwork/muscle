const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// POST /api/alerts
router.post('/', async (req, res) => {
    try {
        const { deviceId, type, severity, message } = req.body;

        if (!deviceId || !type || !severity || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { data: savedAlert, error } = await supabase
            .from('alerts')
            .insert([{
                device_id: deviceId,
                type,
                severity,
                message,
                resolved: false
            }])
            .select();

        if (error) throw error;
        res.status(201).json(savedAlert[0]);
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// GET /api/alerts
router.get('/', async (req, res) => {
    try {
        const { deviceId, resolved } = req.query;
        let query = supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50);
        
        if (deviceId) {
            query = query.eq('device_id', deviceId);
        }
        if (resolved !== undefined) {
            query = query.eq('resolved', resolved === 'true');
        }

        const { data: alerts, error } = await query;
        if (error) throw error;
        
        res.status(200).json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: alert, error } = await supabase
            .from('alerts')
            .update({ resolved: true })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        if (!alert || alert.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        
        res.status(200).json(alert[0]);
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
