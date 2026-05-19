#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <ArduinoJson.h>
#include "secrets.h"

// ================= KONFIGURASI =================
const char* TOPIC_PUB          = "tol/gate1/event";
const char* TOPIC_SUB          = "tol/gate1/response";
const char* TOPIC_CONTROL      = "tol/gate1/control";
const char* ntpServer          = "pool.ntp.org";
const long  gmtOffset_sec      = 25200;  // UTC+7 WIB
const int   daylightOffset_sec = 0;

// ================= PIN =================
#define SERVO_PIN  4     // SG90 di D4
#define TRIG_PIN   13    // Ultrasonik Trig
#define ECHO_PIN   12    // Ultrasonik Echo
#define BUZZER     21    // Active Buzzer
#define SS_PIN     5     // RFID SDA
#define RST_PIN    22    // RFID RST
const int redPin   = 32;
const int greenPin = 33;
const int bluePin  = 27;

// ================= OBJEK =================
WiFiClientSecure espClient;
PubSubClient client(espClient);
Servo palang;
MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ================= STATE =================
bool          menungguResponse = false;
String        uidMenunggu      = "";
unsigned long waktuKirim       = 0;
unsigned long waktuTerakhir    = 0;
int           jarakTerakhir    = 100;
const unsigned long TIMEOUT_MS = 8000;

// ================= PROTOTYPE =================
void connectWiFi();
void syncNTP();
void connectMQTT();
String getFormattedTime();
int  bacaJarak();
void bukaPalang();
void tutupPalang();
void tungguMobilLewat();
void tampilLCD(String baris1, String baris2 = "");
void tampilanStandby();
void nyalakanWarna(int r, int g, int b);
void kedipMerah(int jumlah);
void buzzerOK();
void buzzerError();
void responDiterima(JsonDocument& doc);
void responDitolak(JsonDocument& doc);
void bacaRFID();

// ================= WIFI =================
void connectWiFi() {
  Serial.print("Connecting WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi Connected: " + WiFi.localIP().toString());
}

// ================= NTP =================
void syncNTP() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Sync NTP");
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry++ < 10) {
    delay(1000); Serial.print(".");
  }
  Serial.println(retry < 10 ? "\nNTP OK!" : "\nNTP GAGAL");
}

String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01T00:00:00";
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &timeinfo);
  return String(buf);
}

// ================= LCD =================
void tampilLCD(String baris1, String baris2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(baris1.substring(0, 16));
  if (baris2 != "") {
    lcd.setCursor(0, 1); lcd.print(baris2.substring(0, 16));
  }
}

void tampilanStandby() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(" Gerbang Tol V2 ");
  lcd.setCursor(0, 1); lcd.print(" Tap Kartu Anda ");
}

// ================= LED RGB =================
void nyalakanWarna(int r, int g, int b) {
  analogWrite(redPin,   r);
  analogWrite(greenPin, g);
  analogWrite(bluePin,  b);
}

void kedipMerah(int jumlah) {
  for (int i = 0; i < jumlah; i++) {
    nyalakanWarna(255, 0, 0); delay(150);
    nyalakanWarna(0,   0, 0); delay(150);
  }
}

// ================= BUZZER (Active Buzzer, pakai digitalWrite) =================
void buzzerOK() {
  // Tit pendek sekali = akses OK
  digitalWrite(BUZZER, HIGH); delay(200);
  digitalWrite(BUZZER, LOW);
}

void buzzerError() {
  // Tit-tit-tit = ditolak / error
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH); delay(150);
    digitalWrite(BUZZER, LOW);  delay(150);
  }
}

// ================= RESPONSE HANDLER =================
void responDiterima(JsonDocument& doc) {
  String nama  = doc["nama"]  | "Tamu";
  int    saldo = doc["saldo"] | 0;

  Serial.println("[MASUK] DITERIMA nama=" + nama + " saldo=" + String(saldo));

  nyalakanWarna(0, 255, 0); // Hijau
  buzzerOK();

  tampilLCD("Selamat Datang!", nama);
  delay(400);
  tampilLCD("Saldo Anda:", "Rp " + String(saldo));
  delay(400);

  bukaPalang();
  tungguMobilLewat();
  tutupPalang();

  nyalakanWarna(0, 0, 255); // Balik ke biru standby
  tampilanStandby();
}

void responDitolak(JsonDocument& doc) {
  String alasan = doc["alasan"] | "DITOLAK";
  int    saldo  = doc["saldo"]  | 0;

  Serial.println("[MASUK] DITOLAK alasan=" + alasan);

  nyalakanWarna(255, 0, 0); // Merah
  buzzerError();

  if (alasan == "SALDO_TIDAK_CUKUP") {
    tampilLCD("Saldo Kurang!", "Rp " + String(saldo));
  } else if (alasan == "SUDAH_MASUK") {
    tampilLCD("Sudah di dalam!", "Keluar dulu");
  } else if (alasan == "KARTU_TIDAK_DIKENAL") {
    tampilLCD("Kartu Tidak", "Terdaftar");
  } else {
    tampilLCD("Akses Ditolak", alasan.substring(0, 16));
  }

  kedipMerah(2);
  nyalakanWarna(0, 0, 255); // Balik ke biru standby
  tampilanStandby();
}

// ================= MQTT =================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("[MQTT] " + String(topic) + ": " + msg);

  // === HANDLE GATE CONTROL COMMANDS ===
  Serial.println("[DEBUG] Checking if topic is TOPIC_CONTROL...");
  Serial.println("[DEBUG] Received topic: " + String(topic));
  Serial.println("[DEBUG] Expected topic: " + String(TOPIC_CONTROL));
  
  if (String(topic) == TOPIC_CONTROL) {
    Serial.println("[DEBUG] ✓ Topic matched!");
    JsonDocument doc;
    if (deserializeJson(doc, msg)) {
      Serial.println("[ERR] JSON parse gagal pada control message");
      return;
    }
    String action = doc["action"] | "";
    Serial.println("[DEBUG] Action: " + action);
    
    if (action == "OPEN") {
      Serial.println("[CONTROL] ✓ Opening gate...");
      nyalakanWarna(0, 255, 0);
      tampilLCD("Manual Control", "Palang Membuka");
      bukaPalang();
      delay(1000);
      tampilanStandby();
      nyalakanWarna(0, 0, 255);
      Serial.println("[CONTROL] ✓ Gate opened");
    } else if (action == "CLOSE") {
      Serial.println("[CONTROL] ✓ Closing gate...");
      nyalakanWarna(255, 0, 0);
      tampilLCD("Manual Control", "Palang Menutup");
      tutupPalang();
      delay(1000);
      tampilanStandby();
      nyalakanWarna(0, 0, 255);
      Serial.println("[CONTROL] ✓ Gate closed");
    } else {
      Serial.println("[DEBUG] Unknown action: " + action);
    }
    return;
  } else {
    Serial.println("[DEBUG] ✗ Topic didn't match");
  }

  // === HANDLE SERVER RESPONSE ===
  if (String(topic) != TOPIC_SUB) return;
  if (!menungguResponse) return;

  JsonDocument doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[ERR] JSON parse gagal");
    return;
  }

  String uid = doc["uid"] | "";
  if (uid != uidMenunggu) return;

  menungguResponse = false;
  String status = doc["status"] | "";

  if (status == "DITERIMA") {
    responDiterima(doc);
  } else {
    responDitolak(doc);
  }
}

void connectMQTT() {
  int retry = 0;
  while (!client.connected() && retry < 5) {
    String clientId = "ESP32-GATE1-" + String(random(1000, 9999));
    Serial.print("MQTT connecting...");
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      client.subscribe(TOPIC_SUB);
      client.subscribe(TOPIC_CONTROL);
      Serial.println("OK! Subscribe: " + String(TOPIC_SUB) + " + " + String(TOPIC_CONTROL));
    } else {
      Serial.println("GAGAL rc=" + String(client.state()));
      retry++;
      delay(2000);
    }
  }
}

// ================= SERVO & ULTRASONIK =================
int bacaJarak() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long dur = pulseIn(ECHO_PIN, HIGH, 30000);
  return dur * 0.034 / 2;
}

void bukaPalang()  { palang.write(0); Serial.println("[SERVO] Buka");  }
void tutupPalang() { palang.write(90);  Serial.println("[SERVO] Tutup"); }

void tungguMobilLewat() {
  bool terdeteksi = false;
  unsigned long start = millis();
  while (millis() - start < 10000) {  // max 10 detik
    client.loop();
    int jarak = bacaJarak();
    if (jarak > 0 && jarak < 13) terdeteksi = true;
    if (terdeteksi && jarak > 12) {
      Serial.println("[SENSOR] Mobil lewat");
      break;
    }
    delay(100);
  }
  if (!terdeteksi) Serial.println("[TIMEOUT] Mobil tidak kunjung lewat");
}

// ================= RFID =================
void bacaRFID() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  if (menungguResponse) {
    Serial.println("[RFID] Masih menunggu response server...");
    rfid.PICC_HaltA();
    return;
  }

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += " ";
  }
  uid.toUpperCase();
  Serial.println("[RFID] UID: " + uid);

  // Ambil jarak terbaru saat kartu di-tap
  jarakTerakhir = bacaJarak();

  // Cek kendaraan
  if (jarakTerakhir == 0 || jarakTerakhir > 20) {
    tampilLCD("Tidak ada", "Kendaraan");
    kedipMerah(2);
    delay(500);
    tampilanStandby();
    rfid.PICC_HaltA();
    return;
  }

  // Kirim ke server — server yang memutuskan
  String waktu   = getFormattedTime();
  String payload = "{\"uid\":\"" + uid + "\","
                   "\"tipe_gate\":\"MASUK\","
                   "\"waktu\":\"" + waktu + "\"}";

  client.publish(TOPIC_PUB, payload.c_str());
  Serial.println("[PUB] " + String(TOPIC_PUB) + ": " + payload);

  menungguResponse = true;
  uidMenunggu      = uid;
  waktuKirim       = millis();

  nyalakanWarna(0, 0, 255); // Biru "Memproses"
  tampilLCD("Memproses...", "Harap Tunggu...");

  rfid.PICC_HaltA();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  connectWiFi();
  syncNTP();

  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(onMqttMessage);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(redPin,   OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin,  OUTPUT);
  pinMode(BUZZER,   OUTPUT);

  palang.setPeriodHertz(50);
  palang.attach(SERVO_PIN, 500, 2400);
  tutupPalang();

  Wire.begin(26, 25);
  lcd.init();
  lcd.backlight();

  SPI.begin();
  rfid.PCD_Init();

  nyalakanWarna(0, 0, 255); // Standby = Biru
  tampilanStandby();

  Serial.println("[SETUP] Gate 1 MASUK Siap!");
}

// ================= LOOP =================
void loop() {
  if (WiFi.status() == WL_CONNECTED && !client.connected()) connectMQTT();
  client.loop();

  if (millis() - waktuTerakhir > 1000) {
    jarakTerakhir = bacaJarak();
    byte versi = rfid.PCD_ReadRegister(rfid.VersionReg);
    if (versi == 0x00 || versi == 0xFF) {
      Serial.println("[WARN] RFID tidak responsif, restart SPI...");
      SPI.begin();
      rfid.PCD_Init();
    }
    waktuTerakhir = millis();
  }

  if (menungguResponse && millis() - waktuKirim > TIMEOUT_MS) {
    Serial.println("[TIMEOUT] Tidak ada response dari server");
    menungguResponse = false;
    uidMenunggu      = "";
    nyalakanWarna(255, 0, 0);
    tampilLCD("Server Timeout", "Coba lagi");
    buzzerError();
    delay(2000);
    nyalakanWarna(0, 0, 255);
    tampilanStandby();
  }

  bacaRFID();
  delay(100);
}
