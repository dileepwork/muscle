export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatNumber = (value, digits = 1, fallback = '--') => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

export const titleCase = (value, fallback = 'Unknown') => {
  if (!value) return fallback;
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const normalizeSensorRow = (row = {}) => ({
  id: row.id || `${row.device_id || 'device'}-${row.created_at || Date.now()}`,
  device_id: row.device_id || row.deviceId || 'Unknown',
  emg_raw: toNumber(row.emg_raw ?? row.emg?.raw),
  emg_rms: toNumber(row.emg_rms ?? row.emg?.rms),
  emg_peak: toNumber(row.emg_peak ?? row.emg?.peak),
  pitch: toNumber(row.pitch ?? row.imu?.pitch),
  roll: toNumber(row.roll ?? row.imu?.roll),
  fatigue: row.fatigue || row.analysis?.fatigue || 'low',
  posture: row.posture || row.analysis?.posture || 'good',
  risk: row.risk || row.analysis?.risk || 'normal',
  created_at: row.created_at || row.timestamp || new Date().toISOString(),
  time: row.time,
});

export const riskStatus = (risk) => {
  const normalized = String(risk || 'normal').toLowerCase();
  if (normalized === 'critical' || normalized === 'risk' || normalized === 'high') return 'risk';
  if (normalized === 'warning' || normalized === 'moderate') return 'warning';
  return 'normal';
};

export const summarizeSensorRows = (rows = []) => {
  const samples = rows.map(normalizeSensorRow);
  const latest = samples[0] || null;
  const count = samples.length || 1;
  const warningCount = samples.filter((sample) => riskStatus(sample.risk) === 'warning').length;
  const riskCount = samples.filter((sample) => riskStatus(sample.risk) === 'risk').length;
  const goodPostureCount = samples.filter((sample) => sample.posture === 'good').length;
  const avgRms = samples.reduce((sum, sample) => sum + sample.emg_rms, 0) / count;
  const peakRms = samples.reduce((max, sample) => Math.max(max, sample.emg_rms), 0);

  return {
    latest,
    total: samples.length,
    avgRms,
    peakRms,
    warningCount,
    riskCount,
    goodPostureRate: samples.length ? Math.round((goodPostureCount / samples.length) * 100) : 0,
  };
};
