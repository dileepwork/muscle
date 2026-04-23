-- Enable the UUID extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the `sensor_data` table
CREATE TABLE sensor_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT NOT NULL,
  
  -- EMG Data
  emg_raw NUMERIC NOT NULL,
  emg_rms NUMERIC NOT NULL,
  emg_peak NUMERIC NOT NULL,
  
  -- IMU Data
  acc_x NUMERIC DEFAULT 0,
  acc_y NUMERIC DEFAULT 0,
  acc_z NUMERIC DEFAULT 0,
  gyro_x NUMERIC DEFAULT 0,
  gyro_y NUMERIC DEFAULT 0,
  gyro_z NUMERIC DEFAULT 0,
  pitch NUMERIC DEFAULT 0,
  roll NUMERIC DEFAULT 0,
  
  -- Intelligent Analysis
  fatigue TEXT DEFAULT 'low',
  posture TEXT DEFAULT 'good',
  risk TEXT DEFAULT 'normal',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster querying by device_id and time
CREATE INDEX idx_sensor_data_device_time ON sensor_data(device_id, created_at DESC);

-- 2. Create the `alerts` table
CREATE TABLE alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster querying of unresolved alerts
CREATE INDEX idx_alerts_device_resolved ON alerts(device_id, resolved, created_at DESC);

-- 3. Create the `device_calibrations` table
CREATE TABLE device_calibrations (
  device_id TEXT PRIMARY KEY,
  baseline_rms NUMERIC NOT NULL DEFAULT 0,
  max_rms NUMERIC NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
