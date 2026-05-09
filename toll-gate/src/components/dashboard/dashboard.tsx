"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DoorOpen,
  DoorClosed,
  CheckCircle,
  XCircle,
  Car,
  Clock,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import styles from "@/styles/dashboard.module.css";

type GateStatus = "OPEN" | "CLOSED";
type TrafficLevel = "SMOOTH" | "MODERATE" | "CONGESTED";
type Transaction = {
  id: string;
  cardId: string;
  date: string;
  time: string;
  status: "ACCEPTED" | "REJECTED";
  gate: "ENTRY" | "EXIT";
};

export function Dashboard() {
  const [entryGateStatus, setEntryGateStatus] = useState<GateStatus>("CLOSED");
  const [exitGateStatus, setExitGateStatus] = useState<GateStatus>("CLOSED");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vehiclesEntered, setVehiclesEntered] = useState(0);
  const [vehiclesExited, setVehiclesExited] = useState(0);
  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel>("SMOOTH");
  const [responseTime, setResponseTime] = useState(0);

  const formatTravelTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // ==========================================
  // FETCH AWAL DARI DYNAMODB (via API route)
  // ==========================================
  const fetchInitialData = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();

      // Check if API returned an error
      if (data.error) {
        console.error("API Error:", data.error);
        return;
      }

      // Set statistik dari DynamoDB
      if (data.stats) {
        setVehiclesEntered(data.stats.total_masuk || 0);
        setVehiclesExited(data.stats.total_keluar || 0);
      }

      // Konversi format DynamoDB ke format Transaction
      if (data.transactions && Array.isArray(data.transactions)) {
        const converted: Transaction[] = data.transactions.map((item: any) => {
          const dt = new Date(item.waktu);
          return {
            id: `${item.uid}-${item.waktu}`,
            cardId: item.uid,
            date: dt.toISOString().split("T")[0],
            time: dt.toLocaleTimeString("en-US", { hour12: false }),
            status: item.status === "DITERIMA" ? "ACCEPTED" : "REJECTED",
            gate: item.tipe_gate === "MASUK" ? "ENTRY" : "EXIT",
          };
        });

        setTransactions(converted);
      }
    } catch (err) {
      console.error("Fetch DynamoDB error:", err);
    }
  }, []);

  // ==========================================
  // REKOMENDASI: realtime + polling fallback
  // ==========================================
  useEffect(() => {
    fetchInitialData();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    let ws: WebSocket | null = null;
    let pollingId: number | null = null;
    let reconnectId: number | null = null;

    const startPolling = () => {
      if (pollingId !== null) return;
      pollingId = window.setInterval(() => {
        fetchInitialData();
      }, 5000);
    };

    const stopPolling = () => {
      if (pollingId !== null) {
        window.clearInterval(pollingId);
        pollingId = null;
      }
    };

    const createWebSocket = () => {
      if (!wsUrl) {
        startPolling();
        return;
      }

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected to EC2");
        stopPolling();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("[WS] Received:", data);

          const dt = new Date(data.waktu);

          const newTx: Transaction = {
            id: `${data.uid}-${data.waktu}-${Date.now()}`,
            cardId: data.uid,
            date: dt.toISOString().split("T")[0],
            time: dt.toLocaleTimeString("en-US", { hour12: false }),
            status: data.status === "DITERIMA" ? "ACCEPTED" : "REJECTED",
            gate: data.tipe_gate === "MASUK" ? "ENTRY" : "EXIT",
          };

          setTransactions((prev) => [newTx, ...prev].slice(0, 10));

          if (data.status === "DITERIMA") {
            if (data.tipe_gate === "MASUK") {
              setEntryGateStatus("OPEN");
              setTimeout(() => setEntryGateStatus("CLOSED"), 3000);
              setVehiclesEntered((prev) => prev + 1);
            } else if (data.tipe_gate === "KELUAR") {
              setExitGateStatus("OPEN");
              setTimeout(() => setExitGateStatus("CLOSED"), 3000);
              setVehiclesExited((prev) => prev + 1);
            }
          }
        } catch (err) {
          console.error("[WS] Parse error:", err);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected, fallback to polling");
        ws = null;
        startPolling();
        reconnectId = window.setTimeout(() => {
          createWebSocket();
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        if (ws?.readyState !== WebSocket.OPEN) {
          startPolling();
        }
      };
    };

    createWebSocket();

    return () => {
      if (ws) ws.close();
      if (pollingId !== null) window.clearInterval(pollingId);
      if (reconnectId !== null) window.clearTimeout(reconnectId);
    };
  }, [fetchInitialData]);

  // ==========================================
  // TRAFFIC LEVEL
  // ==========================================
  useEffect(() => {
    const inside = vehiclesEntered - vehiclesExited;
    if (inside > 30) setTrafficLevel("CONGESTED");
    else if (inside > 15) setTrafficLevel("MODERATE");
    else setTrafficLevel("SMOOTH");
  }, [vehiclesEntered, vehiclesExited]);

  const handleGateControl = (
    gate: "ENTRY" | "EXIT",
    action: "OPEN" | "CLOSE",
  ) => {
    const status: GateStatus = action === "CLOSE" ? "CLOSED" : action;
    if (gate === "ENTRY") setEntryGateStatus(status);
    else setExitGateStatus(status);
  };

  const getTrafficStatusClass = () => {
    switch (trafficLevel) {
      case "SMOOTH":
        return styles.trafficSmooth;
      case "MODERATE":
        return styles.trafficModerate;
      case "CONGESTED":
        return styles.trafficCongested;
    }
  };

  // ==========================================
  // JSX — tidak ada yang diubah dari kode kamu
  // ==========================================
  return (
    <main className={styles.mainContent}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>REAL-TIME MONITORING</h1>
          <p>Live system status and gate control</p>
        </div>
        <div className={`${styles.trafficStatus} ${getTrafficStatusClass()}`}>
          <div className={styles.statusIndicator} />
          <span className={styles.statusText}>{trafficLevel}</span>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <ArrowRight size={16} style={{ color: "#00d4ff" }} />
            <span>VEHICLES ENTERED</span>
          </div>
          <p className={`${styles.statValue} ${styles.textCyan}`}>
            {vehiclesEntered}
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <ArrowLeft size={16} style={{ color: "#ec4899" }} />
            <span>VEHICLES EXITED</span>
          </div>
          <p className={`${styles.statValue} ${styles.textMagenta}`}>
            {vehiclesExited}
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <Car size={16} style={{ color: "#10b981" }} />
            <span>CURRENTLY INSIDE</span>
          </div>
          <p className={`${styles.statValue} ${styles.textGreen}`}>
            {vehiclesEntered - vehiclesExited}
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <Clock size={16} style={{ color: "#f59e0b" }} />
            <span>AVG TRAVEL TIME</span>
          </div>
          <p className={`${styles.statValue} ${styles.textYellow}`}>
            {formatTravelTime(responseTime)}
          </p>
        </div>
      </div>

      <div className={styles.gateGrid}>
        {/* Entry Gate */}
        <div className={styles.gateCard}>
          <div className={styles.gateHeader}>
            <h3 className={styles.gateTitle} style={{ color: "#00d4ff" }}>
              ENTRY GATE
            </h3>
          </div>
          <div className={styles.gateContent}>
            <div className={styles.gateStatus}>
              <div className={styles.gateStatusLeft}>
                {entryGateStatus === "OPEN" ? (
                  <DoorOpen
                    size={40}
                    style={{ color: "#00d4ff" }}
                    strokeWidth={1}
                  />
                ) : (
                  <DoorClosed
                    size={40}
                    style={{ color: "#64748b" }}
                    strokeWidth={1}
                  />
                )}
                <div>
                  <p className={styles.gateStatusLabel}>STATUS</p>
                  <p
                    className={styles.gateStatusValue}
                    style={{
                      color: entryGateStatus === "OPEN" ? "#00d4ff" : "#64748b",
                    }}
                  >
                    {entryGateStatus}
                  </p>
                </div>
              </div>
              <div
                className={`${styles.gateIndicator} ${entryGateStatus === "OPEN" ? styles.gateIndicatorActive : ""}`}
              >
                <div
                  className={`${styles.gateIndicatorDot} ${entryGateStatus === "OPEN" ? styles.gateIndicatorDotActive : ""}`}
                />
              </div>
            </div>
            <div className={styles.gateButtons}>
              <button
                onClick={() => handleGateControl("ENTRY", "OPEN")}
                disabled={entryGateStatus === "OPEN"}
                className={`${styles.gateBtn} ${styles.gateBtnOpen} ${entryGateStatus === "OPEN" ? styles.gateBtnDisabled : ""}`}
              >
                OPEN GATE
              </button>
              <button
                onClick={() => handleGateControl("ENTRY", "CLOSE")}
                disabled={entryGateStatus === "CLOSED"}
                className={`${styles.gateBtn} ${styles.gateBtnClose} ${entryGateStatus === "CLOSED" ? styles.gateBtnDisabled : ""}`}
              >
                CLOSE GATE
              </button>
            </div>
          </div>
        </div>

        {/* Exit Gate */}
        <div className={styles.gateCard}>
          <div className={styles.gateHeader}>
            <h3 className={styles.gateTitle} style={{ color: "#ec4899" }}>
              EXIT GATE
            </h3>
          </div>
          <div className={styles.gateContent}>
            <div className={styles.gateStatus}>
              <div className={styles.gateStatusLeft}>
                {exitGateStatus === "OPEN" ? (
                  <DoorOpen
                    size={40}
                    style={{ color: "#ec4899" }}
                    strokeWidth={1}
                  />
                ) : (
                  <DoorClosed
                    size={40}
                    style={{ color: "#64748b" }}
                    strokeWidth={1}
                  />
                )}
                <div>
                  <p className={styles.gateStatusLabel}>STATUS</p>
                  <p
                    className={styles.gateStatusValue}
                    style={{
                      color: exitGateStatus === "OPEN" ? "#ec4899" : "#64748b",
                    }}
                  >
                    {exitGateStatus}
                  </p>
                </div>
              </div>
              <div
                className={`${styles.gateIndicator} ${exitGateStatus === "OPEN" ? styles.gateIndicatorActive : ""}`}
                style={{
                  borderColor:
                    exitGateStatus === "OPEN"
                      ? "rgba(236,72,153,0.3)"
                      : undefined,
                }}
              >
                <div
                  className={`${styles.gateIndicatorDot} ${exitGateStatus === "OPEN" ? styles.gateIndicatorDotActive : ""}`}
                  style={{
                    background:
                      exitGateStatus === "OPEN" ? "#ec4899" : "#64748b",
                  }}
                />
              </div>
            </div>
            <div className={styles.gateButtons}>
              <button
                onClick={() => handleGateControl("EXIT", "OPEN")}
                disabled={exitGateStatus === "OPEN"}
                className={`${styles.gateBtn} ${styles.gateBtnOpen} ${exitGateStatus === "OPEN" ? styles.gateBtnDisabled : ""}`}
              >
                OPEN GATE
              </button>
              <button
                onClick={() => handleGateControl("EXIT", "CLOSE")}
                disabled={exitGateStatus === "CLOSED"}
                className={`${styles.gateBtn} ${styles.gateBtnClose} ${exitGateStatus === "CLOSED" ? styles.gateBtnDisabled : ""}`}
              >
                CLOSE GATE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Transaction Feed */}
      <div className={styles.transactionCard}>
        <div className={styles.transactionHeader}>
          <h3 className={styles.transactionTitle}>LIVE TRANSACTION FEED</h3>
          <div className={styles.realTimeIndicator}>
            <div className={styles.realTimeDot} />
            <span className={styles.realTimeText}>REAL-TIME</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className={styles.transactionTable}>
            <thead>
              <tr>
                <th className={styles.tableHeaderCell}>CARD ID</th>
                <th className={styles.tableHeaderCell}>GATE</th>
                <th className={styles.tableHeaderCell}>DATE</th>
                <th className={styles.tableHeaderCell}>ACCESS TIME</th>
                <th className={styles.tableHeaderCell}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#64748b",
                    }}
                  >
                    Menunggu data RFID... Tap kartu di Wokwi.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`${styles.tableBodyRow} ${
                      transaction.status === "ACCEPTED"
                        ? styles.tableBodyRowAccepted
                        : styles.tableBodyRowRejected
                    }`}
                  >
                    <td
                      className={`${styles.tableCell} ${styles.tableCellCardId}`}
                    >
                      {transaction.cardId}
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.gateTag}>
                        {transaction.gate === "ENTRY" ? (
                          <ArrowRight size={14} style={{ color: "#00d4ff" }} />
                        ) : (
                          <ArrowLeft size={14} style={{ color: "#ec4899" }} />
                        )}
                        {transaction.gate}
                      </span>
                    </td>
                    <td
                      className={`${styles.tableCell} ${styles.tableCellTime}`}
                    >
                      {transaction.date}
                    </td>
                    <td
                      className={`${styles.tableCell} ${styles.tableCellTime}`}
                    >
                      {transaction.time}
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.statusBadge}>
                        {transaction.status === "ACCEPTED" ? (
                          <>
                            <CheckCircle
                              size={18}
                              style={{ color: "#10b981" }}
                            />
                            <span className={styles.statusAccepted}>
                              ACCEPTED
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={18} style={{ color: "#ec4899" }} />
                            <span className={styles.statusRejected}>
                              REJECTED
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
