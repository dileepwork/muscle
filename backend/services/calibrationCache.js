const DEFAULT_MAX_RMS = 120;

const { getCalibration } = require('./localStore');

const calibrationCache = new Map();

const toPositiveNumber = (value, fallback = DEFAULT_MAX_RMS) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const setCachedMaxRms = (deviceId, maxRms) => {
  if (!deviceId) return;
  calibrationCache.set(deviceId, toPositiveNumber(maxRms));
};

const getCachedMaxRms = async (supabase, deviceId) => {
  if (calibrationCache.has(deviceId)) {
    return calibrationCache.get(deviceId);
  }

  if (!supabase) {
    const maxRms = toPositiveNumber(getCalibration(deviceId).max_rms);
    setCachedMaxRms(deviceId, maxRms);
    return maxRms;
  }

  const { data, error } = await supabase
    .from('device_calibrations')
    .select('max_rms')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('Calibration lookup error:', error);
  }

  const maxRms = toPositiveNumber(data?.max_rms);
  setCachedMaxRms(deviceId, maxRms);
  return maxRms;
};

module.exports = {
  DEFAULT_MAX_RMS,
  getCachedMaxRms,
  setCachedMaxRms,
};
