import asyncio
import json
import ssl
import boto3
import websockets
import paho.mqtt.client as mqtt
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from datetime import datetime

# ================= KONFIGURASI =================
MQTT_BROKER = "fe30660ee0264ad6adb0b772e3d11a56.s1.eu.hivemq.cloud"
MQTT_PORT   = 8883
MQTT_USER   = "esp32"
MQTT_PASS   = "Esp12345"
MQTT_TOPICS = ["tol/gate1/event", "tol/gate2/event"]

TARIF_FLAT  = 5000

WS_HOST     = "0.0.0.0"
WS_PORT     = 8765

AWS_REGION   = "ap-southeast-1"
TABLE_EVENTS = "tol_events"
TABLE_CARDS  = "rfid-cards"

S3_BUCKET   = "tol-hadoop-raw-caturp"

# ================= AWS =================
dynamodb   = boto3.resource("dynamodb", region_name=AWS_REGION)
tbl_events = dynamodb.Table(TABLE_EVENTS)
tbl_cards  = dynamodb.Table(TABLE_CARDS)
s3         = boto3.client("s3", region_name=AWS_REGION)

# ================= GLOBAL =================
mqtt_pub_client = None
ws_clients      = set()

# ================= WEBSOCKET =================
async def ws_handler(websocket):
    ws_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        ws_clients.discard(websocket)

async def broadcast(payload: dict):
    if not ws_clients:
        return
    msg = json.dumps(payload, ensure_ascii=False)
    await asyncio.gather(
        *[ws.send(msg) for ws in list(ws_clients)],
        return_exceptions=True
    )

# ================= HELPER =================
def get_card(uid: str):
    """Ambil data kartu jika ada. Bisa return None jika tidak terdaftar."""
    try:
        resp = tbl_cards.get_item(Key={"uid": uid})
        return resp.get("Item")
    except ClientError as e:
        print(f"[DynamoDB] get_card error: {e}")
        return None

def deduct_saldo(uid: str, tarif: int) -> bool:
    try:
        tbl_cards.update_item(
            Key={"uid": uid},
            UpdateExpression="SET saldo = saldo - :tarif",
            ConditionExpression=Attr("saldo").gte(tarif),
            ExpressionAttributeValues={":tarif": tarif}
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        print(f"[DynamoDB] deduct_saldo error: {e}")
        return False

def get_saldo(uid: str) -> int:
    card = get_card(uid)
    return int(card["saldo"]) if card else 0

def simpan_event(uid, status, tipe_gate, waktu, **kwargs):
    item = {
        "uid":       uid,
        "waktu":     waktu,
        "status":    status,
        "tipe_gate": tipe_gate,
    }
    item.update({k: v for k, v in kwargs.items() if v is not None})
    try:
        tbl_events.put_item(Item=item)
        uid_clean = uid.replace(" ", "_")
        key = f"events/{waktu[:10]}/{tipe_gate}/{uid_clean}_{waktu}.json"
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(item))
    except ClientError as e:
        print(f"[DynamoDB] simpan_event error: {e}")

def _get_session_state(uid: str):
    """
    Scan semua event DITERIMA urut lama->baru, tracking pasangan MASUK-KELUAR.
    Return: last_masuk_waktu (str|None)
      - tidak None  = ada MASUK yang belum punya pasangan KELUAR → user di dalam
      - None        = semua MASUK sudah punya pasangan KELUAR   → user di luar
    """
    try:
        resp = tbl_events.query(
            KeyConditionExpression=Key("uid").eq(uid),
            ScanIndexForward=True
        )
        items = resp.get("Items", [])
        last_masuk_waktu = None
        for item in items:
            if item.get("status") != "DITERIMA":
                continue
            tipe = item.get("tipe_gate")
            if tipe == "MASUK":
                last_masuk_waktu = item.get("waktu")
            elif tipe == "KELUAR" and last_masuk_waktu is not None:
                last_masuk_waktu = None
        return last_masuk_waktu
    except ClientError as e:
        print(f"[DynamoDB] _get_session_state error: {e}")
        return None

def cek_sudah_masuk(uid: str) -> bool:
    """True jika user sedang di dalam (ada MASUK belum punya pasangan KELUAR)."""
    return _get_session_state(uid) is not None

def publish_response(topic: str, payload: dict):
    global mqtt_pub_client
    if mqtt_pub_client:
        msg = json.dumps(payload, ensure_ascii=False)
        mqtt_pub_client.publish(topic, msg)
        print(f"[RESP] -> {topic}: {msg}")

def build_ws_payload(uid, status, tipe_gate, waktu, **kwargs):
    payload = {
        "uid":       uid,
        "status":    status,
        "tipe_gate": tipe_gate,
        "waktu":     waktu,
        "tarif":     TARIF_FLAT,
    }
    payload.update({k: v for k, v in kwargs.items() if v is not None})
    return payload

# ================= GATE MASUK =================
def proses_gate_masuk(uid: str, waktu: str, loop):
    """
    Gate masuk: kartu apapun boleh masuk asal:
    1. Saldo cukup (kartu terdaftar di rfid-cards)
    2. Belum tercatat masuk (tidak double-entry)
    Saldo belum dipotong di sini — pemotongan terjadi saat KELUAR.
    """
    card = get_card(uid)

    # Kartu tidak terdaftar di sistem
    if card is None:
        alasan = "KARTU_TIDAK_DIKENAL"
        simpan_event(uid, "DITOLAK", "MASUK", waktu, alasan=alasan)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "MASUK", waktu,
                                       alasan=alasan)), loop)
        publish_response("tol/gate1/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan})
        print(f"[MASUK] DITOLAK uid={uid} alasan={alasan}")
        return

    nama           = card.get("nama", card.get("owner", uid))
    saldo_sekarang = int(card.get("saldo", 0))

    # Cek saldo cukup untuk tarif keluar nanti
    if saldo_sekarang < TARIF_FLAT:
        alasan = "SALDO_TIDAK_CUKUP"
        simpan_event(uid, "DITOLAK", "MASUK", waktu, alasan=alasan,
                     nama=nama, saldo_sebelum=saldo_sekarang,
                     saldo_sesudah=saldo_sekarang)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "MASUK", waktu,
                                       alasan=alasan, nama=nama,
                                       saldo_sebelum=saldo_sekarang,
                                       saldo_sesudah=saldo_sekarang)), loop)
        publish_response("tol/gate1/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan,
                          "saldo": saldo_sekarang})
        print(f"[MASUK] DITOLAK uid={uid} alasan={alasan} saldo={saldo_sekarang}")
        return

    # Cek double-entry
    if cek_sudah_masuk(uid):
        alasan = "SUDAH_MASUK"
        simpan_event(uid, "DITOLAK", "MASUK", waktu, alasan=alasan,
                     nama=nama, saldo_sebelum=saldo_sekarang,
                     saldo_sesudah=saldo_sekarang)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "MASUK", waktu,
                                       alasan=alasan, nama=nama,
                                       saldo_sebelum=saldo_sekarang,
                                       saldo_sesudah=saldo_sekarang)), loop)
        publish_response("tol/gate1/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan})
        print(f"[MASUK] DITOLAK uid={uid} alasan={alasan}")
        return

    # ✓ Semua lolos — catat masuk, saldo belum dipotong
    simpan_event(uid, "DITERIMA", "MASUK", waktu,
                 nama=nama, saldo_sebelum=saldo_sekarang,
                 saldo_sesudah=saldo_sekarang)
    asyncio.run_coroutine_threadsafe(
        broadcast(build_ws_payload(uid, "DITERIMA", "MASUK", waktu,
                                   nama=nama, saldo_sebelum=saldo_sekarang,
                                   saldo_sesudah=saldo_sekarang)), loop)
    publish_response("tol/gate1/response",
                     {"uid": uid, "status": "DITERIMA", "nama": nama,
                      "saldo": saldo_sekarang})
    print(f"[MASUK] DITERIMA uid={uid} nama={nama} saldo={saldo_sekarang}")

# ================= GATE KELUAR =================
def proses_gate_keluar(uid: str, waktu: str, loop):
    """
    Gate keluar: validasi ketat.
    1. Kartu harus terdaftar (ada di rfid-cards)
    2. Harus punya record MASUK yang belum dipasangkan KELUAR
    3. Saldo cukup → potong saldo di sini (payment at exit)
    """
    card = get_card(uid)

    if card is None:
        alasan = "KARTU_TIDAK_DIKENAL"
        simpan_event(uid, "DITOLAK", "KELUAR", waktu, alasan=alasan)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "KELUAR", waktu,
                                       alasan=alasan)), loop)
        publish_response("tol/gate2/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan})
        print(f"[KELUAR] DITOLAK uid={uid} alasan={alasan}")
        return

    nama          = card.get("nama", card.get("owner", uid))
    saldo_sebelum = int(card.get("saldo", 0))

    # Harus sudah masuk dulu
    if not cek_sudah_masuk(uid):
        alasan = "BELUM_MASUK"
        simpan_event(uid, "DITOLAK", "KELUAR", waktu, alasan=alasan,
                     nama=nama, saldo_sebelum=saldo_sebelum,
                     saldo_sesudah=saldo_sebelum)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "KELUAR", waktu,
                                       alasan=alasan, nama=nama,
                                       saldo_sebelum=saldo_sebelum,
                                       saldo_sesudah=saldo_sebelum)), loop)
        publish_response("tol/gate2/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan})
        print(f"[KELUAR] DITOLAK uid={uid} alasan={alasan}")
        return

    # Cek saldo
    if saldo_sebelum < TARIF_FLAT:
        alasan = "SALDO_TIDAK_CUKUP"
        simpan_event(uid, "DITOLAK", "KELUAR", waktu, alasan=alasan,
                     nama=nama, saldo_sebelum=saldo_sebelum,
                     saldo_sesudah=saldo_sebelum)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "KELUAR", waktu,
                                       alasan=alasan, nama=nama,
                                       saldo_sebelum=saldo_sebelum,
                                       saldo_sesudah=saldo_sebelum)), loop)
        publish_response("tol/gate2/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan,
                          "saldo": saldo_sebelum})
        print(f"[KELUAR] DITOLAK uid={uid} alasan={alasan} saldo={saldo_sebelum}")
        return

    # ✓ Potong saldo di gate keluar (payment at exit)
    ok = deduct_saldo(uid, TARIF_FLAT)
    if not ok:
        alasan = "SALDO_TIDAK_CUKUP"
        simpan_event(uid, "DITOLAK", "KELUAR", waktu, alasan=alasan,
                     nama=nama, saldo_sebelum=saldo_sebelum,
                     saldo_sesudah=saldo_sebelum)
        asyncio.run_coroutine_threadsafe(
            broadcast(build_ws_payload(uid, "DITOLAK", "KELUAR", waktu,
                                       alasan=alasan, nama=nama,
                                       saldo_sebelum=saldo_sebelum,
                                       saldo_sesudah=saldo_sebelum)), loop)
        publish_response("tol/gate2/response",
                         {"uid": uid, "status": "DITOLAK", "alasan": alasan})
        return

    saldo_sesudah = get_saldo(uid)
    # Simpan event dengan field biaya agar frontend bisa hitung revenue dari KELUAR
    simpan_event(uid, "DITERIMA", "KELUAR", waktu,
                 nama=nama, saldo_sebelum=saldo_sebelum,
                 saldo_sesudah=saldo_sesudah, biaya=TARIF_FLAT)
    asyncio.run_coroutine_threadsafe(
        broadcast(build_ws_payload(uid, "DITERIMA", "KELUAR", waktu,
                                   nama=nama, saldo_sebelum=saldo_sebelum,
                                   saldo_sesudah=saldo_sesudah,
                                   biaya=TARIF_FLAT)), loop)
    publish_response("tol/gate2/response",
                     {"uid": uid, "status": "DITERIMA", "nama": nama,
                      "saldo_sesudah": saldo_sesudah})
    print(f"[KELUAR] DITERIMA uid={uid} nama={nama} saldo {saldo_sebelum} -> {saldo_sesudah}")

# ================= MQTT CALLBACK =================
def on_message(client, userdata, msg):
    loop = userdata["loop"]
    try:
        data = json.loads(msg.payload.decode())
    except Exception as e:
        print(f"[MQTT] Parse error: {e}")
        return

    uid       = data.get("uid", "").strip().upper()
    tipe_gate = data.get("tipe_gate", "").upper()
    waktu     = data.get("waktu", datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))

    print(f"[MQTT] topic={msg.topic} uid={uid} tipe_gate={tipe_gate}")

    if tipe_gate == "MASUK":
        proses_gate_masuk(uid, waktu, loop)
    elif tipe_gate == "KELUAR":
        proses_gate_keluar(uid, waktu, loop)

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("[MQTT] Connected!")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
            print(f"[MQTT] Subscribed: {topic}")
    else:
        print(f"[MQTT] Connect failed rc={rc}")

# ================= MAIN =================
async def main():
    global mqtt_pub_client
    loop = asyncio.get_event_loop()

    mqtt_client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        userdata={"loop": loop}
    )
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)

    tls_ctx = ssl.create_default_context()
    tls_ctx.check_hostname = False
    tls_ctx.verify_mode    = ssl.CERT_NONE
    mqtt_client.tls_set_context(tls_ctx)

    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()

    mqtt_pub_client = mqtt_client

    print(f"[WS] Server listening on {WS_HOST}:{WS_PORT}")
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
