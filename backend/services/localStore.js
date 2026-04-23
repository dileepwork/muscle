const MAX_SENSOR_ROWS = 1000;
const DEFAULT_MAX_RMS = 500;

const sensorRows = [];
const alerts = [];
const calibrations = new Map();

const createId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createdAt = () => new Date().toISOString();

const newestFirst = (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

const insertSensorData = (payload) => {
  const saved = {
    id: createId('sensor'),
    created_at: payload.created_at || createdAt(),
    ...payload,
  };

  sensorRows.unshift(saved);
  if (sensorRows.length > MAX_SENSOR_ROWS) {
    sensorRows.length = MAX_SENSOR_ROWS;
  }

  return saved;
};

const listSensorData = ({ device_id, limit = 20 } = {}) =>
  sensorRows
    .filter((row) => !device_id || row.device_id === device_id)
    .sort(newestFirst)
    .slice(0, limit);

const getLatestSensorData = (deviceId) => listSensorData({ device_id: deviceId, limit: 1 })[0] || null;

const insertAlert = (payload) => {
  const saved = {
    id: createId('alert'),
    created_at: payload.created_at || createdAt(),
    resolved: false,
    ...payload,
  };

  alerts.unshift(saved);
  return saved;
};

const listAlerts = ({ deviceId, resolved, limit = 50 } = {}) =>
  alerts
    .filter((alert) => !deviceId || alert.device_id === deviceId)
    .filter((alert) => resolved === undefined || alert.resolved === resolved)
    .sort(newestFirst)
    .slice(0, limit);

const resolveAlert = (id) => {
  const alert = alerts.find((item) => item.id === id);
  if (!alert) return null;

  alert.resolved = true;
  return alert;
};

const upsertCalibration = ({ device_id, baseline_rms, max_rms }) => {
  const saved = {
    device_id,
    baseline_rms,
    max_rms,
    updated_at: createdAt(),
  };

  calibrations.set(device_id, saved);
  return saved;
};

const getCalibration = (deviceId) =>
  calibrations.get(deviceId) || {
    device_id: deviceId,
    baseline_rms: 0,
    max_rms: DEFAULT_MAX_RMS,
  };

module.exports = {
  getCalibration,
  getLatestSensorData,
  insertAlert,
  insertSensorData,
  listAlerts,
  listSensorData,
  resolveAlert,
  upsertCalibration,
};
