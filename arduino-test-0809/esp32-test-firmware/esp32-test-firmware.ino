/*
 * ============================================================================
 *  EasyBlot — ESP32 connectivity test firmware
 *  DEVELOPMENT / BRING-UP ONLY. Not production EasyBlot firmware.
 * ============================================================================
 *
 *  Purpose: prove the dashboard can reach the board over local Wi-Fi and get
 *  a truthful answer back. No pumps, no MQTT, no cloud.
 *
 *  Endpoints
 *    GET /status          -> {"device":"EasyBlot-Test","status":"online"}
 *    GET /blink?count=N   -> {"success":true,"blink_count":N}   (1 <= N <= 20)
 *
 *  The /blink response is sent AFTER the LED finishes, so the website can only
 *  report success once the hardware has actually done the work.
 *
 *  Board support: Arduino IDE -> Boards Manager -> "esp32" by Espressif.
 *  Wi-Fi credentials live in arduino_secrets.h, which is git-ignored.
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>

// ---------------------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------------------
// Copy arduino_secrets.example.h to arduino_secrets.h and put your network
// details there. That file is git-ignored so real credentials never get
// committed. If you would rather not bother, delete the #include and set the
// two constants directly below it -- but then do not commit this file.
#include "arduino_secrets.h"

const char* WIFI_SSID     = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;

// ---------------------------------------------------------------------------
// LED pin  <-- CHANGE THIS IF NOTHING BLINKS
// ---------------------------------------------------------------------------
// The built-in LED is on a different pin depending on the board:
//   GPIO 2  - most DevKitC / NodeMCU-32S / WROOM-32 boards (the common case)
//   GPIO 5  - some LOLIN / WEMOS D1 Mini ESP32 boards (often inverted, see below)
//   GPIO 13 - many "TTGO" style boards
//   GPIO 22 - some ESP32-CAM style boards
//   GPIO 8  - ESP32-C3 SuperMini (addressable RGB on some variants)
// If the sketch uploads and /blink returns success but you see no light,
// this pin is almost certainly wrong. Try 2, then 5, then 13.
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif
const int LED_PIN = LED_BUILTIN;

// Some boards wire the LED active-LOW (it lights when the pin is LOW).
// If your LED is ON when idle and OFF when blinking, set this to true.
const bool LED_ACTIVE_LOW = false;

// ---------------------------------------------------------------------------
// Blink timing and limits -- must match the website's validation
// ---------------------------------------------------------------------------
const int  BLINK_MIN      = 1;
const int  BLINK_MAX      = 20;
const int  BLINK_ON_MS    = 300;
const int  BLINK_OFF_MS   = 300;
const long SERIAL_BAUD    = 115200;
const int  HTTP_PORT      = 80;

WebServer server(HTTP_PORT);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// *** DEVELOPMENT ONLY ***
// "*" lets any web page on your machine call this board. That is fine for a
// bring-up test on a private network, and MUST NOT ship in production
// EasyBlot firmware -- it would let any website a user visits drive their
// hardware. The production design should use authenticated MQTT, or at
// minimum an explicit origin allow-list plus a device token.
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "600");
}

void sendJson(int code, const String& body) {
  sendCorsHeaders();
  server.send(code, "application/json", body);
}

// Browsers only preflight non-simple requests. The dashboard sends plain GETs
// with no custom headers so this should never fire -- it is here so the board
// behaves correctly if that ever changes.
void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

// ---------------------------------------------------------------------------
// LED helpers
// ---------------------------------------------------------------------------
void ledWrite(bool on) {
  digitalWrite(LED_PIN, (on != LED_ACTIVE_LOW) ? HIGH : LOW);
}

void blinkTimes(int count) {
  Serial.printf("[blink] starting %d blink(s) on GPIO %d\n", count, LED_PIN);
  for (int i = 1; i <= count; i++) {
    ledWrite(true);
    delay(BLINK_ON_MS);
    ledWrite(false);
    delay(BLINK_OFF_MS);
    Serial.printf("[blink]   %d/%d\n", i, count);
  }
  Serial.println("[blink] sequence complete");
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
void handleStatus() {
  Serial.printf("[http] GET /status from %s\n", server.client().remoteIP().toString().c_str());
  sendJson(200, "{\"device\":\"EasyBlot-Test\",\"status\":\"online\"}");
}

void handleBlink() {
  Serial.printf("[http] GET /blink from %s\n", server.client().remoteIP().toString().c_str());

  if (!server.hasArg("count")) {
    Serial.println("[http] rejected: missing count");
    sendJson(400, "{\"success\":false,\"error\":\"missing_count\"}");
    return;
  }

  String raw = server.arg("count");
  raw.trim();

  // Reject anything that is not a plain positive integer. toInt() would
  // silently turn "abc" into 0 and "3.7" into 3, which would blink the wrong
  // number of times and make the test lie.
  bool digitsOnly = raw.length() > 0;
  for (unsigned int i = 0; i < raw.length(); i++) {
    if (!isDigit(raw[i])) { digitsOnly = false; break; }
  }
  if (!digitsOnly) {
    Serial.printf("[http] rejected: count '%s' is not a whole number\n", raw.c_str());
    sendJson(400, "{\"success\":false,\"error\":\"count_not_an_integer\"}");
    return;
  }

  long count = raw.toInt();
  if (count < BLINK_MIN || count > BLINK_MAX) {
    Serial.printf("[http] rejected: count %ld out of range %d-%d\n", count, BLINK_MIN, BLINK_MAX);
    sendJson(400, "{\"success\":false,\"error\":\"count_out_of_range\"}");
    return;
  }

  // Blink first, answer second: the website must not claim success before the
  // hardware has actually done it.
  blinkTimes((int)count);

  String body = "{\"success\":true,\"blink_count\":";
  body += count;
  body += "}";
  sendJson(200, body);
  Serial.printf("[http] responded success for %ld blink(s)\n", count);
}

void handleNotFound() {
  Serial.printf("[http] 404 %s\n", server.uri().c_str());
  sendJson(404, "{\"success\":false,\"error\":\"not_found\"}");
}

// ---------------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------------
void connectWifi() {
  Serial.printf("[wifi] connecting to \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    // Retry from scratch rather than hanging forever on a bad password or a
    // 5 GHz-only network (ESP32 is 2.4 GHz only).
    if (millis() - startedAt > 20000) {
      Serial.println();
      Serial.println("[wifi] still not connected after 20s -- retrying.");
      Serial.println("[wifi] check: 2.4 GHz network? SSID and password correct?");
      WiFi.disconnect();
      delay(500);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      startedAt = millis();
    }
  }

  Serial.println();
  Serial.println("[wifi] connected");
  Serial.print("[wifi] IP address: ");
  Serial.println(WiFi.localIP());
  Serial.printf("[wifi] signal: %d dBm\n", WiFi.RSSI());
  Serial.println();
  Serial.println("=============================================");
  Serial.print("  Enter this IP in the dashboard:  ");
  Serial.println(WiFi.localIP());
  Serial.println("=============================================");
  Serial.println();
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300);
  Serial.println();
  Serial.println("[boot] EasyBlot ESP32 connectivity test");
  Serial.printf("[boot] LED pin GPIO %d (active %s)\n", LED_PIN, LED_ACTIVE_LOW ? "LOW" : "HIGH");

  pinMode(LED_PIN, OUTPUT);
  ledWrite(false);

  connectWifi();

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/blink",  HTTP_GET, handleBlink);
  server.on("/blink",  HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.printf("[http] server listening on port %d\n", HTTP_PORT);
  Serial.println("[http] try http://<ip>/status in a browser to check");

  // Two quick blinks = firmware is up and on the network.
  blinkTimes(2);
}

void loop() {
  server.handleClient();

  // Rejoin automatically if the access point drops us.
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[wifi] connection lost -- reconnecting");
      connectWifi();
    }
  }
}
