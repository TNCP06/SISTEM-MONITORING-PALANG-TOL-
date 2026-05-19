import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DoorOpen,
  DoorClosed,
  CheckCircle,
  XCircle,
  Car,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Filter,
  Wallet,
} from "lucide-react";
import styles from "@/styles/dashboard.module.css";

type GateStatus = "OPEN" | "CLOSED";
type TrafficLevel = "SMOOTH" | "MODERATE" | "CONGESTED";
type Transaction = {
  id: string;
  cardId: string;
  nama: string;
  date: string;
  time: string;
  month: string;
  status: "ACCEPTED" | "REJECTED";
  gate: "ENTRY" | "EXIT";
  biaya: number;
  saldo_sesudah: number | null;
  keterangan: string;
  timestamp: number;
};

const formatRupiah = (n: number) =>
  "Rp " + n.toLocaleString("id-ID");

const deriveKeterangan = (item: any): string => {
  if (item.status === "DITERIMA") return "Transaksi berhasil";

  const alasan = item.keterangan || item.alasan || item.reason || item.keterangan_raw || "";
  switch (String(alasan)) {
    case "SALDO_TIDAK_CUKUP":
      return item.saldo_sebelum !== undefined
        ? `Saldo tidak mencukupi (saldo: Rp ${Number(item.saldo_sebelum).toLocaleString("id-ID")})`
        : "Saldo tidak mencukupi";
    case "KARTU_TIDAK_DIKENAL":
      return "Kartu tidak terdaftar";
    case "SUDAH_MASUK":
      return "Sudah berada di dalam (keluar dulu)";
    case "BELUM_MASUK":
      return "Belum tercatat masuk";
    default:
      return alasan || "Tidak ada keterangan";
  }
};

export function Dashboard() {
  const [entryGateStatus, setEntryGateStatus] = useState<GateStatus>("CLOSED");
  const [exitGateStatus, setExitGateStatus] = useState<GateStatus>("CLOSED");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vehiclesEntered, setVehiclesEntered] = useState(0);
  const [vehiclesExited, setVehiclesExited] = useState(0);
  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel>("SMOOTH");
  const [totalRevenue, setTotalRevenue] = useState(0);

  // ---- Filter state ----
  const [searchCard, setSearchCard] = useState("");
  const [filterMonth, setFilterMonth] = useState(""); // "YYYY-MM" or ""
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACCEPTED" | "REJECTED">("ALL");

  // ---- Pagination state ----
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const getTransactionId = (item: any) => {
    const timestamp = new Date(item.waktu).getTime();
    const bucket = Math.floor(timestamp / 5000); // 5 second window to avoid hold duplicates
    return `${item.uid}-${item.tipe_gate}-${bucket}`;
  };

  const convertItem = (item: any): Transaction => {
    const waktuStr = (item.waktu ?? "").toString();
    return {
      id: getTransactionId(item),
      cardId: item.uid,
      nama: item.nama || "",
      date: waktuStr.slice(0, 10),   // "YYYY-MM-DD" langsung dari string, hindari UTC offset
      time: waktuStr.slice(11, 19),  // "HH:MM:SS"
      month: waktuStr.slice(0, 7),   // "YYYY-MM"
      status: item.status === "DITERIMA" ? "ACCEPTED" : "REJECTED",
      gate: item.tipe_gate === "MASUK" ? "ENTRY" : "EXIT",
      biaya: Number(item.biaya) || 0,
      saldo_sesudah: item.saldo_sesudah != null ? Number(item.saldo_sesudah) : null,
      keterangan: item.keterangan || deriveKeterangan(item),
      timestamp: new Date(waktuStr).getTime(),
    };
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.error) { console.error("API Error:", data.error); return; }

      if (data.stats) {
        setVehiclesEntered(data.stats.total_masuk || 0);
        setVehiclesExited(data.stats.total_keluar || 0);
        setTotalRevenue(data.stats.total_revenue || 0);
      }

      if (data.transactions && Array.isArray(data.transactions)) {
        const sorted = data.transactions
          .map(convertItem)
          .sort((a: Transaction, b: Transaction) =>
            `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
          );
        setTransactions(sorted);
      }
    } catch (err) {
      console.error("Fetch DynamoDB error:", err);
    }
  }, []);

  // WebSocket + polling
  useEffect(() => {
    fetchInitialData();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    let ws: WebSocket | null = null;
    let pollingId: number | null = null;
    let reconnectId: number | null = null;

    const startPolling = () => {
      if (pollingId !== null) return;
      pollingId = window.setInterval(fetchInitialData, 5000);
    };
    const stopPolling = () => {
      if (pollingId !== null) { window.clearInterval(pollingId); pollingId = null; }
    };

    const createWebSocket = () => {
      if (!wsUrl) { startPolling(); return; }
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { console.log("[WS] Connected"); stopPolling(); };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const newTx = convertItem(data);
          setTransactions((prev) => {
            const existingIndex = prev.findIndex((tx) => tx.id === newTx.id);
            if (existingIndex >= 0) {
              const existing = prev[existingIndex];
              const merged = {
                ...existing,
                ...newTx,
                keterangan:
                  existing.keterangan && existing.keterangan !== "Tidak ada keterangan" && existing.keterangan !== "-"
                    ? existing.keterangan
                    : newTx.keterangan,
              };
              return [merged, ...prev.filter((_, i) => i !== existingIndex)].slice(0, 200);
            }

            const duplicateIndex = prev.findIndex((tx) =>
              tx.cardId === newTx.cardId &&
              tx.gate === newTx.gate &&
              Math.abs(tx.timestamp - newTx.timestamp) < 5000,
            );
            if (duplicateIndex >= 0) {
              const existing = prev[duplicateIndex];
              const merged = {
                ...existing,
                ...newTx,
                keterangan:
                  existing.keterangan && existing.keterangan !== "Tidak ada keterangan" && existing.keterangan !== "-"
                    ? existing.keterangan
                    : newTx.keterangan,
              };
              return [merged, ...prev.filter((_, i) => i !== duplicateIndex)].slice(0, 200);
            }

            return [newTx, ...prev].slice(0, 200);
          });

          if (data.status === "DITERIMA") {
            if (data.tipe_gate === "MASUK") {
              setEntryGateStatus("OPEN");
              setTimeout(() => setEntryGateStatus("CLOSED"), 3000);
              setVehiclesEntered((p) => p + 1);
            } else if (data.tipe_gate === "KELUAR") {
              setExitGateStatus("OPEN");
              setTimeout(() => setExitGateStatus("CLOSED"), 3000);
              setVehiclesExited((p) => p + 1);
              // Revenue dihitung saat KELUAR karena pembayaran terjadi di exit gate
              setTotalRevenue((p) => p + (Number(data.biaya) || 0));
            }
          }

          setTimeout(() => {
            fetchInitialData();
          }, 1000);
        } catch (err) { console.error("[WS] Parse error:", err); }
      };
      ws.onclose = () => {
        ws = null; startPolling();
        reconnectId = window.setTimeout(createWebSocket, 5000);
      };
      ws.onerror = () => { if (ws?.readyState !== WebSocket.OPEN) startPolling(); };
    };

    createWebSocket();
    return () => {
      if (ws) ws.close();
      if (pollingId !== null) window.clearInterval(pollingId);
      if (reconnectId !== null) window.clearTimeout(reconnectId);
    };
  }, [fetchInitialData]);

  useEffect(() => {
    const inside = vehiclesEntered - vehiclesExited;
    if (inside > 30) setTrafficLevel("CONGESTED");
    else if (inside > 15) setTrafficLevel("MODERATE");
    else setTrafficLevel("SMOOTH");
  }, [vehiclesEntered, vehiclesExited]);

  const handleGateControl = async (gate: "ENTRY" | "EXIT", action: "OPEN" | "CLOSE") => {
    const status: GateStatus = action === "CLOSE" ? "CLOSED" : action;
    if (gate === "ENTRY") setEntryGateStatus(status);
    else setExitGateStatus(status);

    // Send command to hardware via API
    try {
      const response = await fetch("/api/gate-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gate, action }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log("[Gate Control] Success:", data.message);
      } else {
        console.error("[Gate Control] Error:", data.error);
        // Revert UI state on error
        if (gate === "ENTRY") setEntryGateStatus(status === "CLOSED" ? "OPEN" : "CLOSED");
        else setExitGateStatus(status === "CLOSED" ? "OPEN" : "CLOSED");
      }
    } catch (err) {
      console.error("[Gate Control] Request failed:", err);
      // Revert UI state on error
      if (gate === "ENTRY") setEntryGateStatus(status === "CLOSED" ? "OPEN" : "CLOSED");
      else setExitGateStatus(status === "CLOSED" ? "OPEN" : "CLOSED");
    }
  };

  const getTrafficStatusClass = () => {
    switch (trafficLevel) {
      case "SMOOTH": return styles.trafficSmooth;
      case "MODERATE": return styles.trafficModerate;
      case "CONGESTED": return styles.trafficCongested;
    }
  };

  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(transactions.map((t) => t.month))).sort(
      (a, b) => b.localeCompare(a),
    );
    return months;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (searchCard && !t.cardId.toLowerCase().includes(searchCard.toLowerCase())) return false;
      if (filterMonth && t.month !== filterMonth) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      return true;
    });
  }, [transactions, searchCard, filterMonth, filterStatus]);

  // Reset ke halaman 1 saat filter atau jumlah baris berubah
  useEffect(() => { setCurrentPage(1); }, [searchCard, filterMonth, filterStatus, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const formatMonth = (m: string) => {
    const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const parts = m.split("-");
    return `${names[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
  };

  const exportCSV = () => {
    const rows = filteredTransactions;
    const header = [
      "Card ID",
      "Nama",
      "Gate",
      "Tanggal",
      "Waktu",
      "Status",
      "Biaya (Rp)",
      "Saldo Akhir (Rp)",
      "Keterangan",
    ].join(",");

    const body = rows.map((t) =>
      [
        t.cardId,
        `"${(t.nama || "-").replace(/"/g, "'")}"`,
        t.gate,
        t.date,
        t.time,
        t.status,
        t.biaya,
        t.saldo_sesudah != null ? t.saldo_sesudah : "-",
        `"${t.keterangan.replace(/"/g, "'")}"`,
      ].join(","),
    );

    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const label = filterMonth || "semua";
    a.href = url;
    a.download = `tol-transaksi-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // dropdown style
  const dropdownStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px 7px 32px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#e2e8f0",
    fontSize: "0.78rem",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
    cursor: "pointer",
  };

  // JSX
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

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <ArrowRight size={16} style={{ color: "#00d4ff" }} />
            <span>VEHICLES ENTERED</span>
          </div>
          <p className={`${styles.statValue} ${styles.textCyan}`}>{vehiclesEntered}</p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <ArrowLeft size={16} style={{ color: "#ec4899" }} />
            <span>VEHICLES EXITED</span>
          </div>
          <p className={`${styles.statValue} ${styles.textMagenta}`}>{vehiclesExited}</p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <Car size={16} style={{ color: "#10b981" }} />
            <span>CURRENTLY INSIDE</span>
          </div>
          <p className={`${styles.statValue} ${styles.textGreen}`}>{vehiclesEntered - vehiclesExited}</p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <Wallet size={16} style={{ color: "#f59e0b" }} />
            <span>TOTAL REVENUE</span>
          </div>
          <p className={`${styles.statValue} ${styles.textYellow}`} style={{ fontSize: "1.1rem" }}>
            {formatRupiah(totalRevenue)}
          </p>
        </div>
      </div>

      {/* Gate Control */}
      <div className={styles.gateGrid}>
        {/* Entry Gate */}
        <div className={styles.gateCard}>
          <div className={styles.gateHeader}>
            <h3 className={styles.gateTitle} style={{ color: "#00d4ff" }}>ENTRY GATE</h3>
          </div>
          <div className={styles.gateContent}>
            <div className={styles.gateStatus}>
              <div className={styles.gateStatusLeft}>
                {entryGateStatus === "OPEN" ? (
                  <DoorOpen size={40} style={{ color: "#00d4ff" }} strokeWidth={1} />
                ) : (
                  <DoorClosed size={40} style={{ color: "#64748b" }} strokeWidth={1} />
                )}
                <div>
                  <p className={styles.gateStatusLabel}>STATUS</p>
                  <p className={styles.gateStatusValue} style={{ color: entryGateStatus === "OPEN" ? "#00d4ff" : "#64748b" }}>
                    {entryGateStatus}
                  </p>
                </div>
              </div>
              <div className={`${styles.gateIndicator} ${entryGateStatus === "OPEN" ? styles.gateIndicatorActive : ""}`}>
                <div className={`${styles.gateIndicatorDot} ${entryGateStatus === "OPEN" ? styles.gateIndicatorDotActive : ""}`} />
              </div>
            </div>
            <div className={styles.gateButtons}>
              <button onClick={() => handleGateControl("ENTRY", "OPEN")} disabled={entryGateStatus === "OPEN"}
                className={`${styles.gateBtn} ${styles.gateBtnOpen} ${entryGateStatus === "OPEN" ? styles.gateBtnDisabled : ""}`}>
                OPEN GATE
              </button>
              <button onClick={() => handleGateControl("ENTRY", "CLOSE")} disabled={entryGateStatus === "CLOSED"}
                className={`${styles.gateBtn} ${styles.gateBtnClose} ${entryGateStatus === "CLOSED" ? styles.gateBtnDisabled : ""}`}>
                CLOSE GATE
              </button>
            </div>
          </div>
        </div>

        {/* Exit Gate */}
        <div className={styles.gateCard}>
          <div className={styles.gateHeader}>
            <h3 className={styles.gateTitle} style={{ color: "#ec4899" }}>EXIT GATE</h3>
          </div>
          <div className={styles.gateContent}>
            <div className={styles.gateStatus}>
              <div className={styles.gateStatusLeft}>
                {exitGateStatus === "OPEN" ? (
                  <DoorOpen size={40} style={{ color: "#ec4899" }} strokeWidth={1} />
                ) : (
                  <DoorClosed size={40} style={{ color: "#64748b" }} strokeWidth={1} />
                )}
                <div>
                  <p className={styles.gateStatusLabel}>STATUS</p>
                  <p className={styles.gateStatusValue} style={{ color: exitGateStatus === "OPEN" ? "#ec4899" : "#64748b" }}>
                    {exitGateStatus}
                  </p>
                </div>
              </div>
              <div className={`${styles.gateIndicator} ${exitGateStatus === "OPEN" ? styles.gateIndicatorActive : ""}`}
                style={{ borderColor: exitGateStatus === "OPEN" ? "rgba(236,72,153,0.3)" : undefined }}>
                <div className={`${styles.gateIndicatorDot} ${exitGateStatus === "OPEN" ? styles.gateIndicatorDotActive : ""}`}
                  style={{ background: exitGateStatus === "OPEN" ? "#ec4899" : "#64748b" }} />
              </div>
            </div>
            <div className={styles.gateButtons}>
              <button onClick={() => handleGateControl("EXIT", "OPEN")} disabled={exitGateStatus === "OPEN"}
                className={`${styles.gateBtn} ${styles.gateBtnOpen} ${exitGateStatus === "OPEN" ? styles.gateBtnDisabled : ""}`}>
                OPEN GATE
              </button>
              <button onClick={() => handleGateControl("EXIT", "CLOSE")} disabled={exitGateStatus === "CLOSED"}
                className={`${styles.gateBtn} ${styles.gateBtnClose} ${exitGateStatus === "CLOSED" ? styles.gateBtnDisabled : ""}`}>
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

        {/* ---- FILTER BAR */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px" }}>

          {/* Search Card ID */}
          <div style={{ position: "relative", flex: "2 1 180px" }}>
            <Search size={14} style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder="Search by Card ID..."
              value={searchCard}
              onChange={(e) => setSearchCard(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: "0.78rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Filter Bulan */}
          <div style={{ position: "relative", flex: "1 1 140px" }}>
            <Filter size={14} style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none",
            }} />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{ ...dropdownStyle, color: filterMonth ? "#e2e8f0" : "#64748b" }}
            >
              <option value="">Semua Bulan</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} style={{ background: "#1e293b" }}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div style={{ position: "relative", flex: "1 1 140px" }}>
            <Filter size={14} style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none",
            }} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "ALL" | "ACCEPTED" | "REJECTED")}
              style={{
                ...dropdownStyle,
                color: filterStatus === "ACCEPTED" ? "#10b981" : filterStatus === "REJECTED" ? "#ec4899" : "#64748b",
                borderColor: filterStatus === "ACCEPTED"
                  ? "rgba(16,185,129,0.4)"
                  : filterStatus === "REJECTED"
                  ? "rgba(236,72,153,0.4)"
                  : "rgba(255,255,255,0.1)",
              }}
            >
              <option value="ALL" style={{ background: "#1e293b", color: "#e2e8f0" }}>Semua Status</option>
              <option value="ACCEPTED" style={{ background: "#1e293b", color: "#10b981" }}>✓ Diterima</option>
              <option value="REJECTED" style={{ background: "#1e293b", color: "#ec4899" }}>✗ Ditolak</option>
            </select>
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            title={`Export ${filteredTransactions.length} transaksi ke CSV`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid rgba(0,212,255,0.3)",
              background: "rgba(0,212,255,0.08)",
              color: "#00d4ff",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; }}
          >
            <Download size={14} />
            EXPORT CSV ({filteredTransactions.length})
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className={styles.transactionTable} style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "155px" }} />
              <col style={{ width: "105px" }} />
              <col style={{ width: "95px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.tableHeaderCell}>CARD ID</th>
                <th className={styles.tableHeaderCell}>NAMA</th>
                <th className={styles.tableHeaderCell}>GATE</th>
                <th className={styles.tableHeaderCell}>TANGGAL</th>
                <th className={styles.tableHeaderCell}>WAKTU</th>
                <th className={styles.tableHeaderCell}>STATUS</th>
                <th className={styles.tableHeaderCell}>BIAYA</th>
                <th className={styles.tableHeaderCell}>SALDO AKHIR</th>
                <th className={styles.tableHeaderCell}>KETERANGAN</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                    {transactions.length === 0
                      ? "Menunggu data RFID... Tap kartu di Wokwi."
                      : "Tidak ada transaksi yang sesuai filter."}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`${styles.tableBodyRow} ${
                      transaction.status === "ACCEPTED"
                        ? styles.tableBodyRowAccepted
                        : styles.tableBodyRowRejected
                    }`}
                  >
                    <td className={`${styles.tableCell} ${styles.tableCellCardId}`}>
                      {transaction.cardId}
                    </td>
                    <td className={styles.tableCell} style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                      {transaction.nama || "-"}
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
                    <td className={`${styles.tableCell} ${styles.tableCellTime}`}>
                      {transaction.date}
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellTime}`}>
                      {transaction.time}
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.statusBadge}>
                        {transaction.status === "ACCEPTED" ? (
                          <>
                            <CheckCircle size={18} style={{ color: "#10b981" }} />
                            <span className={styles.statusAccepted}>ACCEPTED</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={18} style={{ color: "#ec4899" }} />
                            <span className={styles.statusRejected}>REJECTED</span>
                          </>
                        )}
                      </div>
                    </td>
                    {/* Biaya */}
                    <td className={styles.tableCell} style={{
                      color: transaction.biaya > 0 ? "#f59e0b" : "#64748b",
                      fontWeight: transaction.biaya > 0 ? 600 : 400,
                      whiteSpace: "nowrap",
                    }}>
                      {transaction.biaya > 0 ? formatRupiah(transaction.biaya) : "-"}
                    </td>
                    {/* Saldo Akhir */}
                    <td className={styles.tableCell} style={{
                      color: transaction.saldo_sesudah != null ? "#10b981" : "#64748b",
                      fontSize: "0.78rem",
                      whiteSpace: "nowrap",
                    }}>
                      {transaction.saldo_sesudah != null ? formatRupiah(transaction.saldo_sesudah) : "-"}
                    </td>
                    {/* Keterangan */}
                    <td className={styles.tableCell} style={{
                      color: transaction.status === "ACCEPTED" ? "#64748b" : "#f87171",
                      fontSize: "0.75rem",
                      maxWidth: 220,
                    }}>
                      {transaction.keterangan || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem",
        }}>
          {/* Rows per page */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.78rem" }}>Baris per halaman:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, color: "#e2e8f0", fontSize: "0.78rem", padding: "4px 8px",
                outline: "none", cursor: "pointer",
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n} style={{ background: "#1e293b" }}>{n}</option>
              ))}
            </select>
          </div>

          {/* Page info + navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.78rem" }}>
              {filteredTransactions.length === 0 ? "0 data" : (
                `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, filteredTransactions.length)} dari ${filteredTransactions.length}`
              )}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, color: currentPage === 1 ? "#334155" : "#94a3b8",
                padding: "4px 8px", cursor: currentPage === 1 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ color: "#94a3b8", fontSize: "0.78rem", minWidth: "60px", textAlign: "center" }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, color: currentPage === totalPages ? "#334155" : "#94a3b8",
                padding: "4px 8px", cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        input::placeholder { color: #64748b; }
        select option { background: #1e293b; color: #e2e8f0; }
      `}</style>
    </main>
  );
}
