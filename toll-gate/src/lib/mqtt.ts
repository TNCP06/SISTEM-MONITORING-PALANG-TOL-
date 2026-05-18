import * as mqtt from "mqtt";

let client: mqtt.MqttClient | null = null;
let isConnected = false;

export function getMqttClient(): mqtt.MqttClient {
  if (client) {
    return client;
  }

  const mqttUrl = process.env.MQTT_URL || "mqtts://fe30660ee0264ad6adb0b772e3d11a56.s1.eu.hivemq.cloud:8883";
  const mqttUser = process.env.MQTT_USER || "esp32";
  const mqttPass = process.env.MQTT_PASS || "Esp12345";

  client = mqtt.connect(mqttUrl, {
    username: mqttUser,
    password: mqttPass,
    clientId: `backend-${Date.now()}`,
    reconnectPeriod: 1000,
    connectTimeout: 5000,
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err);
    isConnected = false;
  });

  client.on("connect", () => {
    console.log("[MQTT] Connected to broker");
    isConnected = true;
  });

  client.on("disconnect", () => {
    console.log("[MQTT] Disconnected from broker");
    isConnected = false;
  });

  return client;
}

export function publishGateControl(gate: "ENTRY" | "EXIT", action: "OPEN" | "CLOSE"): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    const gateNumber = gate === "ENTRY" ? "1" : "2";
    const topic = `tol/gate${gateNumber}/control`;
    const payload = JSON.stringify({
      action,
      timestamp: new Date().toISOString(),
    });

    console.log(`[MQTT] Attempting to publish to ${topic}`);
    console.log(`[MQTT] Client connected status:`, client.connected);
    console.log(`[MQTT] Payload:`, payload);

    let attempts = 0;
    const maxAttempts = 50; // 50 * 200ms = 10 seconds max wait

    // Wait for connection if not connected yet
    const attemptPublish = () => {
      attempts++;
      console.log(`[MQTT] Attempt ${attempts} - Client connected: ${client.connected}`);
      
      if (client.connected) {
        console.log(`[MQTT] Client is connected, publishing now...`);
        client.publish(topic, payload, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[MQTT] Failed to publish to ${topic}:`, err);
            reject(err);
          } else {
            console.log(`[MQTT] ✅ Successfully published to ${topic}`);
            resolve();
          }
        });
      } else {
        if (attempts >= maxAttempts) {
          console.error(`[MQTT] ❌ Connection timeout - could not connect after ${maxAttempts * 200}ms`);
          reject(new Error("MQTT connection timeout"));
        } else {
          // Wait a bit and retry
          setTimeout(attemptPublish, 200);
        }
      }
    };

    attemptPublish();
  });
}

export function closeMqttClient(): void {
  if (client) {
    client.end(true);
    client = null;
  }
}
