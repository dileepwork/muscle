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

// GPIO34 is ADC input only and has no internal pull-down resistor.
// If readings appear without a sensor connected, add a 100k resistor from GPIO34 to GND,
// or move the sensor signal to GPIO32/33 and enable INPUT_PULLDOWN below.
const int EMG_PIN = 34;

// =============================
// Sampling and validation
// =============================
const unsigned long SAMPLE_INTERVAL_MS = 5;      // 200 Hz sampling
const unsigned long SEND_INTERVAL_MS = 500;      // 2 packets/sec backend rate limit
const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
const int MIN_SAMPLES_PER_PACKET = 40;

const int ADC_MIN_VALID = 30;                    // reject near-ground disconnected/pulled-down input
const int ADC_MAX_VALID = 4065;                  // reject saturated input
const int MIN_PEAK_TO_PEAK = 8;                  // reject flat/no-signal intervals
const int MAX_PEAK_TO_PEAK = 3600;               // reject likely floating/noisy open pin intervals

const float RMS_SMOOTHING_ALPHA = 0.3;

WiFiClient plainClient;
WiFiClientSecure secureClient;

unsigned long lastSampleTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastWifiAttempt = 0;

double sumRaw = 0;
double sumSquares = 0;
int sampleCount = 0;
int latestRaw = 0;
int minRaw = 4095;
int maxRaw = 0;
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
}

void sampleEmg() {
  const int raw = analogRead(EMG_PIN);
  latestRaw = raw;
  minRaw = min(minRaw, raw);
  maxRaw = max(maxRaw, raw);
  sumRaw += raw;
  sumSquares += (double)raw * raw;
  sampleCount++;
}

bool isValidEmgInterval(float meanRaw, int peakToPeak) {
  if (sampleCount < MIN_SAMPLES_PER_PACKET) return false;
  if (meanRaw < ADC_MIN_VALID || meanRaw > ADC_MAX_VALID) return false;
  if (peakToPeak < MIN_PEAK_TO_PEAK) return false;
  if (peakToPeak > MAX_PEAK_TO_PEAK) return false;
  return true;
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

void sendPayloadToServer(int raw, float rms, int peak, float pitch, float roll) {
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
  emg["rms"] = rms;
  emg["peak"] = peak;

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
  if (responseCode > 0) {
    Serial.printf("Sent: raw=%d rms=%.2f peak=%d response=%d\n", raw, rms, peak, responseCode);
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
  if (EMG_PIN == 32 || EMG_PIN == 33) {
    pinMode(EMG_PIN, INPUT_PULLDOWN);
  } else {
    pinMode(EMG_PIN, INPUT);
  }

  secureClient.setInsecure();
  WiFi.mode(WIFI_STA);
  connectWiFi();

  Serial.println("ESP32 muscle monitor started.");
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
  lastSendTime = now;

  if (sampleCount == 0) return;

  const float meanRaw = sumRaw / sampleCount;
  const double varianceValue = (sumSquares / sampleCount) - ((double)meanRaw * meanRaw);
  const float variance = varianceValue > 0 ? varianceValue : 0;
  const float currentRms = sqrt(variance);
  const int peakToPeak = maxRaw - minRaw;

  if (!isValidEmgInterval(meanRaw, peakToPeak)) {
    Serial.printf(
      "Skipped invalid EMG interval: samples=%d mean=%.1f p2p=%d min=%d max=%d\n",
      sampleCount,
      meanRaw,
      peakToPeak,
      minRaw,
      maxRaw
    );
    resetPacketStats();
    return;
  }

  smoothedRms = (smoothedRms * (1.0 - RMS_SMOOTHING_ALPHA)) + (currentRms * RMS_SMOOTHING_ALPHA);

  // Neutral IMU values. Add real MPU6050/MPU9250 reads here if your hardware includes an IMU.
  const float pitch = 0;
  const float roll = 0;

  sendPayloadToServer(latestRaw, smoothedRms, maxRaw, pitch, roll);
  resetPacketStats();
}
