# Wearable Muscle Fatigue and Injury-Risk Monitoring System

A full-stack web application designed for real-time monitoring of sensor data from hardware devices. This dashboard provides live updates, historical data tracking, alert management, and rehabilitation progress monitoring with a clean, medical-technology aesthetic.

## Folder Structure

- `/backend`: Node.js + Express + Supabase REST API server
- `/frontend`: React.js + Vite + Tailwind CSS dashboard application

---

## Backend Setup

The backend serves as the bridge between the hardware devices and the frontend dashboard. It receives sensor data via REST API and stores it in Supabase.

### Prerequisites
- Node.js (v16+)
- Supabase Project (Create a free project at supabase.com)

### Installation & Running

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Check `.env` variables (A sample `.env` is already created):
   ```env
   PORT=5000
   FRONTEND_URL=https://muscle-h118.vercel.app,http://localhost:5173
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Start the server:
   ```bash
   npm start
   ```
   *(Server should run at `http://localhost:5000`)*

---

## Frontend Setup

The frontend provides a modern, responsive dashboard to monitor the sensor data.

### Prerequisites
- Node.js (v16+)

### Installation & Running

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Optional: create `frontend/.env` if the backend is not on `http://localhost:5000` or the deployed backend:
   ```env
   VITE_API_URL=https://muscle-gilt.vercel.app
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
   *(Frontend should run at `http://localhost:5173`)*

---

## Hardware Team Integration Guide

The backend is fully CORS-enabled and ready to accept data from your ESP32 or other microcontrollers.

### Backend URL Configuration

In your ESP32 / Arduino firmware code, you must specify the backend URL where the API is hosted. 
If running locally on the same Wi-Fi network, replace `YOUR_PC_IP_ADDRESS` with your actual IPv4 address (e.g., `192.168.1.100`).

```cpp
// Deployed Vercel API Configuration
const char* BACKEND_URL = "https://muscle-gilt.vercel.app"; 

// If running locally on the same Wi-Fi network, use:
// const char* BACKEND_URL = "http://YOUR_PC_IP_ADDRESS:5000"; 
// Example: "http://192.168.1.100:5000"
```

### Main API Endpoints

#### 1. Stream Intelligent Sensor Data
- **Endpoint:** `POST /api/sensor-data/stream`
- **Description:** Send continuously processed, intelligent data (EMG, IMU, Pitch/Roll, Risk Analysis) from the ESP32. This endpoint is rate-limited (max 2 req/sec).
- **Example Payload:**
  ```json
  {
    "device_id": "ESP32_01",
    "timestamp": "2023-10-25T14:32:00.000Z",
    "emg": {
      "raw": 450,
      "rms": 318,
      "peak": 500
    },
    "imu": {
      "acc": { "x": 0.1, "y": 0.2, "z": 9.8 },
      "gyro": { "x": 0, "y": 0, "z": 0 },
      "pitch": 15.2,
      "roll": -5.1
    },
    "analysis": {
      "fatigue": "moderate",
      "posture": "bad",
      "risk": "warning"
    }
  }
  ```

#### 2. Create Alert
- **Endpoint:** `POST /api/alerts`
- **Description:** Trigger an alert if the hardware detects sudden extreme values.
- **Example Payload:**
  ```json
  {
    "deviceId": "ESP32-MYO-01",
    "type": "Sudden Movement",
    "severity": "Warning",
    "message": "Rapid acceleration detected on Z axis."
  }
  ```

#### 3. Health Check
- **Endpoint:** `GET /api/health`
- **Description:** Simple endpoint to check if the backend is reachable.

---

## Features
- **Clean Professional Dashboard UI:** Uses Tailwind CSS for a premium medical-tech feel.
- **Responsive Design:** Optimized for both desktop and mobile views.
- **Real-Time Capabilities:** Backend API prepared for high-frequency hardware pushes. Dummy chart data provided for UI demonstration.
- **Alerts & History:** Comprehensive routes for tracking patient alerts and data over time.
