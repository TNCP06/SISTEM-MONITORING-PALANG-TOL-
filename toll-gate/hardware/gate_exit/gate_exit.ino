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

// ================= KONFIGURASI =================------------------------------
const char* TOPIC_CONTROL      = "tol/gate2/control";
const char* TOPIC_SUB          = "tol/gate2/response"; 
const char* TOPIC_PUB          = "tol/gate2/event";
const char* ntpServer          = "pool.ntp.org";
const long  gmtOffset_sec      = 25200;
const int   daylightOffset_sec = 0;
const int JARAK_THRESHOLD = 12;

#define TIPE_GATE "KELUAR"

// ================= PIN =================
#define SERVO_PIN 14
#define TRIG_PIN  13
#define ECHO_PIN  12
#define BUZZER    21
#define SS_PIN     5
#define RST_PIN   22
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
const unsigned long TIMEOUT_MS = 20000;

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
  nyalakanWarna(0, 0, 255);
}

// ================= LED RGB =================
void nyalakanWarna(int r, int g, int b) {
  digitalWrite(redPin,   r > 0 ? HIGH : LOW);
  digitalWrite(greenPin, g > 0 ? HIGH : LOW);
  digitalWrite(bluePin,  b > 0 ? HIGH : LOW);
}

void kedipMerah(int jumlah) {
  for (int i = 0; i < jumlah; i++) {
    nyalakanWarna(255, 0, 0); delay(150);
    nyalakanWarna(0,   0, 0); delay(150);
  }
}

// ================= BUZZER =================
void buzzerOK() {
  // Pakai tone() khusus buat Passive Buzzer
  tone(BUZZER, 2000); // 2000Hz = Suara melengking
  delay(200);
  noTone(BUZZER);     // Matikan
}

void buzzerError() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER, 1000); // 1000Hz = Suara lebih berat
    delay(150);
    noTone(BUZZER);
    delay(150);
  }
}

// ================= RESPONSE HANDLER =================
void responDiterima(JsonDocument& doc) {
  String nama          = doc["nama"]          | "Unknown";
  int    saldo_sesudah = doc["saldo_sesudah"] | 0;

  Serial.println("[OK] DITERIMA nama=" + nama +
                 " saldo_sesudah=" + String(saldo_sesudah));

  nyalakanWarna(0, 255, 0);
  buzzerOK();

  tampilLCD("Terima kasih!", nama);
  delay(500);
  tampilLCD("Sisa Saldo:", "Rp " + String(saldo_sesudah));
  delay(500);

  bukaPalang();
  tungguMobilLewat();
  tutupPalang();

  tampilanStandby();
}

void responDitolak(JsonDocument& doc) {
  String alasan = doc["alasan"] | "DITOLAK";

  Serial.println("[TOLAK] alasan=" + alasan);

  nyalakanWarna(255, 0, 0);
  buzzerError();

  if (alasan == "BELUM_MASUK") {
    tampilLCD("Belum Tercatat", "Masuk!");
  } else if (alasan == "SALDO_TIDAK_CUKUP") {
    int saldo = doc["saldo"] | 0;
    tampilLCD("Saldo Kurang!", "Rp " + String(saldo));
  } else if (alasan == "KARTU_TIDAK_DIKENAL") {
    tampilLCD("Kartu Tidak", "Terdaftar");
  } else {
    tampilLCD("Akses Ditolak", alasan.substring(0, 16));
  }

  kedipMerah(2);
  tampilanStandby();
}

// ================= MQTT =================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("[MQTT] " + String(topic) + ": " + msg);

  if (String(topic) == TOPIC_CONTROL) {
    JsonDocument doc;
    if (deserializeJson(doc, msg)) {
      Serial.println("[ERR] JSON parse gagal pada control message");
      return;
    }
    String action = doc["action"] | "";
    if (action == "OPEN") {
      Serial.println("[CONTROL] Membuka palang...");
      nyalakanWarna(0, 255, 0);
      tampilLCD("Manual Control", "Palang Membuka");
      bukaPalang();
      delay(1000);
      tampilanStandby();
    } else if (action == "CLOSE") {
      Serial.println("[CONTROL] Menutup palang...");
      nyalakanWarna(255, 0, 0);
      tampilLCD("Manual Control", "Palang Menutup");
      tutupPalang();
      delay(1000);
      tampilanStandby();
    }
    return;
  }

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
    String clientId = "ESP32-GATE2-" + String(random(1000, 9999));
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
  int total = 0, valid = 0;
  for (int i = 0; i < 3; i++) {
    digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(4);
    digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long dur = pulseIn(ECHO_PIN, HIGH, 30000);
    if (dur > 0) {
      total += (int)(dur * 0.034 / 2);
      valid++;
    }
    delayMicroseconds(500);
  }
  int hasil = (valid > 0) ? total / valid : 0;
  // Serial.println("[SONAR] " + String(hasil) + "cm (valid=" + String(valid) + "/3)");
  return hasil;
}

void bukaPalang()  { palang.write(0);  Serial.println("[SERVO] Buka");  }
void tutupPalang() { palang.write(90); Serial.println("[SERVO] Tutup"); }

void tungguMobilLewat() {
  bool terdeteksi = false;
  unsigned long start = millis();
  while (millis() - start < 10000) {
    client.loop();
    int jarak = bacaJarak();
    if (jarak > 0 && jarak < JARAK_THRESHOLD) {
      if (!terdeteksi) Serial.println("[SENSOR] Mobil terdeteksi, jarak=" + String(jarak) + "cm");
      terdeteksi = true;
    }
    if (terdeteksi && (jarak == 0 || jarak >= JARAK_THRESHOLD)) {
      Serial.println("[SENSOR] Mobil sudah lewat, jarak=" + String(jarak) + "cm");
      break;
    }
    delay(200);
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
  jarakTerakhir = bacaJarak();

  if (jarakTerakhir == 0 || jarakTerakhir >= JARAK_THRESHOLD) {
    Serial.println("[RFID] Tidak ada kendaraan, jarak=" + String(jarakTerakhir) + "cm");
    tampilLCD("Tidak ada", "Kendaraan");
    buzzerError();
    kedipMerah(2);
    delay(500);
    tampilanStandby();
    rfid.PICC_HaltA();
    return;
  }

  String waktu   = getFormattedTime();
  String payload = "{\"uid\":\"" + uid + "\","
                   "\"tipe_gate\":\"" + String(TIPE_GATE) + "\","
                   "\"waktu\":\"" + waktu + "\"}";

  client.publish(TOPIC_PUB, payload.c_str());
  Serial.println("[PUB] " + String(TOPIC_PUB) + ": " + payload);

  menungguResponse = true;
  uidMenunggu      = uid;
  waktuKirim       = millis();

  nyalakanWarna(0, 0, 255);
  tampilLCD("Memproses...", "Harap Tunggu...");

  rfid.PICC_HaltA();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER,   OUTPUT);
  digitalWrite(BUZZER, LOW);

  pinMode(redPin,   OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin,  OUTPUT);

  nyalakanWarna(0, 0, 255);

  connectWiFi();
  syncNTP();

  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(onMqttMessage);

  // ── Servo di-attach SETELAH ledcAttachPin LED, supaya tidak rebut channel ──
  palang.setPeriodHertz(50);
  palang.attach(SERVO_PIN, 500, 2400);
  tutupPalang();

  Wire.begin(26, 25);
  lcd.init();
  lcd.backlight();

  SPI.begin();
  rfid.PCD_Init();

  tampilanStandby();

  Serial.println("[SETUP] Gate " + String(TIPE_GATE) + " Siap!");
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
    tampilanStandby();
  }

  bacaRFID();
  delay(100);
}