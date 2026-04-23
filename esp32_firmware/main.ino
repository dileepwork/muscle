#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// =============================
// Wi-Fi and backend config
// =============================
const char* WIFI_SSID = "project1";
const char* WIFI_PASSWORD = "1234567001";
const char* BACKEND_URL = "https://muscle-gilt.vercel.app/api/sensor-data/stream";

const char* DEVICE_ID = "ESP32_01";
const char* FIRMWARE_VERSION = "emg-filter-v2";

// GPIO34 is ADC input only and has no internal pull-down resistor.
// Use an external 100k resistor from GPIO34 to GND to prevent floating readings.
const int EMG_PIN = 34;

// =============================
// Sampling and validation
// =============================
const unsigned long SAMPLE_INTERVAL_MS = 5;      // 200 Hz sampling
const unsigned long SEND_INTERVAL_MS = 500;      // 2 packets/sec backend rate limit
const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
const unsigned long INVALID_LOG_INTERVAL_MS = 2000;
const int MIN_SAMPLES_PER_PACKET = 40;

const int ADC_MIN_VALID = 120;                   // reject open/near-ground input but allow low-bias EMG modules
const int ADC_MAX_VALID = 3900;                  // reject saturated input
const int ADC_LOW_RAIL = 5;
const int ADC_HIGH_RAIL = 4090;
const int MAX_RAIL_HITS_PER_PACKET = 0;
const float MIN_SIGNAL_RMS = 18.0;               // ignore tiny no-contact wiggle/noise
const int MIN_PEAK_TO_PEAK = 85;                 // reject flat/no-signal intervals
const int MAX_PEAK_TO_PEAK = 2200;               // reject likely floating/noisy open pin intervals

const float RMS_SMOOTHING_ALPHA = 0.3;

WiFiClient plainClient;
WiFiClientSecure secureClient;

unsigned long lastSampleTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastInvalidLogTime = 0;

double sumRaw = 0;
double sumSquares = 0;
int sampleCount = 0;
int latestRaw = 0;
int minRaw = 4095;
int maxRaw = 0;
int railHitCount = 0;
float smoothedRms = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (lastWifiAttempt != 0 && now - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiAttempt = now;

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void resetPacketStats() {
  sumRaw = 0;
  sumSquares = 0;
  sampleCount = 0;
  latestRaw = 0;
  minRaw = 4095;
  maxRaw = 0;
  railHitCount = 0;
}

void sampleEmg() {
  const int raw = analogRead(EMG_PIN);
  latestRaw = raw;
  minRaw = min(minRaw, raw);
  maxRaw = max(maxRaw, raw);
  if (raw <= ADC_LOW_RAIL || raw >= ADC_HIGH_RAIL) {
    railHitCount++;
  }
  sumRaw += raw;
  sumSquares += (double)raw * raw;
  sampleCount++;
}

const char* getInvalidEmgReason(float meanRaw, float rms, int peakToPeak) {
  if (sampleCount < MIN_SAMPLES_PER_PACKET) return "not enough samples";
  if (railHitCount > MAX_RAIL_HITS_PER_PACKET) return "ADC rail hit";
  if (meanRaw < ADC_MIN_VALID) return "ADC too low / disconnected";
  if (meanRaw > ADC_MAX_VALID) return "ADC too high / saturated";
  if (rms < MIN_SIGNAL_RMS) return "RMS too weak";
  if (peakToPeak < MIN_PEAK_TO_PEAK) return "signal swing too small";
  if (peakToPeak > MAX_PEAK_TO_PEAK) return "signal swing too large / floating";
  return "";
}

bool isValidEmgInterval(float meanRaw, float rms, int peakToPeak) {
  return getInvalidEmgReason(meanRaw, rms, peakToPeak)[0] == '\0';
}

void logInvalidInterval(const char* reason, float meanRaw, float rms, int peakToPeak) {
  const unsigned long now = millis();
  if (now - lastInvalidLogTime < INVALID_LOG_INTERVAL_MS) return;
  lastInvalidLogTime = now;

  Serial.printf(
    "Skipped EMG packet (%s): samples=%d mean=%.1f rms=%.2f p2p=%d min=%d max=%d rails=%d\n",
    reason,
    sampleCount,
    meanRaw,
    rms,
    peakToPeak,
    minRaw,
    maxRaw,
    railHitCount
  );
}

bool beginHttp(HTTPClient& http) {
  const bool isHttps = String(BACKEND_URL).startsWith("https://");
  const bool started = isHttps ? http.begin(secureClient, BACKEND_URL) : http.begin(plainClient, BACKEND_URL);

  if (!started) {
    Serial.println("HTTP begin failed. Check BACKEND_URL.");
    return false;
  }

  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  return true;
}

void sendPayloadToServer(int raw, float meanRaw, float rms, int peak, int peakToPeak, float pitch, float roll) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Packet not sent.");
    connectWiFi();
    return;
  }

  HTTPClient http;
  if (!beginHttp(http)) return;

  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;

  JsonObject emg = doc.createNestedObject("emg");
  emg["raw"] = raw;
  emg["mean"] = meanRaw;
  emg["rms"] = rms;
  emg["peak"] = peak;
  emg["peak_to_peak"] = peakToPeak;

  JsonObject imu = doc.createNestedObject("imu");
  JsonObject acc = imu.createNestedObject("acc");
  acc["x"] = 0;
  acc["y"] = 0;
  acc["z"] = 9.81;

  JsonObject gyro = imu.createNestedObject("gyro");
  gyro["x"] = 0;
  gyro["y"] = 0;
  gyro["z"] = 0;

  imu["pitch"] = pitch;
  imu["roll"] = roll;

  String requestBody;
  serializeJson(doc, requestBody);

  const int responseCode = http.POST(requestBody);
  if (responseCode >= 200 && responseCode < 300) {
    Serial.printf("Sent: raw=%d mean=%.1f rms=%.2f peak=%d p2p=%d response=%d\n", raw, meanRaw, rms, peak, peakToPeak, responseCode);
  } else if (responseCode > 0) {
    Serial.printf("Server rejected packet: response=%d body=%s\n", responseCode, http.getString().c_str());
  } else {
    Serial.printf("HTTP error: %d %s\n", responseCode, http.errorToString(responseCode).c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);

  analogReadResolution(12);
  analogSetPinAttenuation(EMG_PIN, ADC_11db);
  pinMode(EMG_PIN, INPUT);

  secureClient.setInsecure();
  WiFi.mode(WIFI_STA);
  connectWiFi();

  Serial.println("ESP32 muscle monitor started.");
  Serial.print("Firmware: ");
  Serial.println(FIRMWARE_VERSION);
  Serial.println("Waiting for valid EMG signal before sending packets.");
}

void loop() {
  connectWiFi();

  const unsigned long now = millis();
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;
    sampleEmg();
  }

  if (now - lastSendTime < SEND_INTERVAL_MS) return;
  if (sampleCount < MIN_SAMPLES_PER_PACKET) return;
  lastSendTime = now;

  const float meanRaw = sumRaw / sampleCount;
  const double varianceValue = (sumSquares / sampleCount) - ((double)meanRaw * meanRaw);
  const float variance = varianceValue > 0 ? varianceValue : 0;
  const float currentRms = sqrt(variance);
  const int peakToPeak = maxRaw - minRaw;

  const char* invalidReason = getInvalidEmgReason(meanRaw, currentRms, peakToPeak);
  if (invalidReason[0] != '\0') {
    logInvalidInterval(invalidReason, meanRaw, currentRms, peakToPeak);
    smoothedRms = 0;
    resetPacketStats();
    return;
  }

  smoothedRms = smoothedRms <= 0
    ? currentRms
    : (smoothedRms * (1.0 - RMS_SMOOTHING_ALPHA)) + (currentRms * RMS_SMOOTHING_ALPHA);

  // Neutral IMU values. Add real MPU6050/MPU9250 reads here if your hardware includes an IMU.
  const float pitch = 0;
  const float roll = 0;

  sendPayloadToServer(latestRaw, meanRaw, smoothedRms, maxRaw, peakToPeak, pitch, roll);
  resetPacketStats();
}
