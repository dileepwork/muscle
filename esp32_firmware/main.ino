#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char* WIFI_SSID     = "project1";
const char* WIFI_PASSWORD = "1234567001";

// Replace YOUR_PC_IP with the IPv4 address of your computer running the Node.js backend
// Example: http://192.168.1.100:5000/api/sensor-data/stream
const char* BACKEND_URL   = "https://muscle-gilt.vercel.app/api/sensor-data/stream";

const String DEVICE_ID    = "ESP32_01";
const int EMG_PIN         = 34; // Analog pin for EMG sensor

WiFiClient plainClient;
WiFiClientSecure secureClient;

// ==========================================
// TIMING & SIGNAL PROCESSING VARIABLES
// ==========================================
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 500; // Send payload every 500ms (max 2 per sec to respect rate limits)

// EMG Sampling
unsigned long lastSampleTime = 0;
const int sampleInterval = 5; // Sample every 5ms (200Hz)
float sumOfSquares = 0;
int sampleCount = 0;
int peakEMG = 0;

// Exponential Moving Average (EMA) smoothing for RMS
float smoothedRMS = 0;
const float alpha = 0.3; // Smoothing factor (0.0 to 1.0)

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 has 12-bit ADC (0 - 4095)
  secureClient.setInsecure(); // Use a root CA certificate instead for production HTTPS verification.
  
  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. CONTINUOUS NON-BLOCKING SAMPLING
  if (currentMillis - lastSampleTime >= sampleInterval) {
    lastSampleTime = currentMillis;
    
    int rawEMG = analogRead(EMG_PIN);
    
    // Track Peak
    if (rawEMG > peakEMG) {
      peakEMG = rawEMG;
    }
    
    // Accumulate for RMS
    // Assuming the signal is centered. If not, you may need to subtract DC offset first.
    sumOfSquares += (float)rawEMG * (float)rawEMG;
    sampleCount++;
  }

  // 2. SEND DATA AT SPECIFIED INTERVAL
  if (currentMillis - lastSendTime >= sendInterval) {
    lastSendTime = currentMillis;
    
    if (sampleCount > 0) {
      // Calculate current interval RMS
      float currentRMS = sqrt(sumOfSquares / sampleCount);
      
      // Apply EMA smoothing filter
      smoothedRMS = (smoothedRMS * (1.0 - alpha)) + (currentRMS * alpha);
      
      // Grab current raw value just for telemetry
      int currentRaw = analogRead(EMG_PIN);

      // (Simulated) Read IMU Data. Replace this with real MPU6050 reading logic
      float pitch = random(-5, 5); 
      float roll = random(-2, 2);

      // Send to Backend
      sendPayloadToServer(currentRaw, smoothedRMS, peakEMG, pitch, roll);

      // Reset accumulators for next interval
      sumOfSquares = 0;
      sampleCount = 0;
      peakEMG = 0;
    }
  }
}

void sendPayloadToServer(int raw, float rms, int peak, float pitch, float roll) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    const bool requestStarted = String(BACKEND_URL).startsWith("https://")
      ? http.begin(secureClient, BACKEND_URL)
      : http.begin(plainClient, BACKEND_URL);

    if (!requestStarted) {
      Serial.println("Unable to start HTTP request. Check BACKEND_URL.");
      return;
    }

    http.setTimeout(5000);
    http.addHeader("Content-Type", "application/json");

    // Create JSON document
    // Capacity 512 bytes is generally enough for this payload
    StaticJsonDocument<512> doc;
    
    doc["device_id"] = DEVICE_ID;
    
    // Add EMG Data
    JsonObject emg = doc.createNestedObject("emg");
    emg["raw"] = raw;
    emg["rms"] = rms;
    emg["peak"] = peak;

    // Add IMU Data
    JsonObject imu = doc.createNestedObject("imu");
    JsonObject acc = imu.createNestedObject("acc");
    acc["x"] = 0; acc["y"] = 0; acc["z"] = 9.81;
    JsonObject gyro = imu.createNestedObject("gyro");
    gyro["x"] = 0; gyro["y"] = 0; gyro["z"] = 0;
    imu["pitch"] = pitch;
    imu["roll"] = roll;

    // Serialize JSON into string
    String requestBody;
    serializeJson(doc, requestBody);

    // Send POST Request
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Error code: %d\n", httpResponseCode);
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Cannot send data.");
  }
}
