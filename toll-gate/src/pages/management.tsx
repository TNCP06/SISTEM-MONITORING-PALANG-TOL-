import styles from "@/styles/management.module.css";
import {
  Calendar,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Head from "next/head";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Tipe data kartu ────────────────────────────────────────────────────────────
interface RFIDCard {
  uid: string;
  owner: string;
  date: string;
  status: string;
  saldo: number;
}

const formatRupiah = (n: number) => "Rp " + Number(n).toLocaleString("id-ID");

const POLL_INTERVAL = 10_000;

const ManagementPage = () => {
  // ── State kartu ────────────────────────────────────────────────────────────
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  // ── Modal Add Card ─────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    uid: "",
    owner: "",
    status: "ACTIVE",
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Top-up Modal ───────────────────────────────────────────────────────────
  const [topupCard, setTopupCard] = useState<RFIDCard | null>(null);
  const [topupJumlah, setTopupJumlah] = useState("");
  const [isTopuping, setIsTopuping] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  // ── Fetch kartu ────────────────────────────────────────────────────────────
  const fetchCards = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/cards");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: RFIDCard[] = await res.json();
      const sorted = [...data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setCards(sorted);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Gagal mengambil data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards(true);
    timerRef.current = setInterval(() => fetchCards(false), POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCards]);

  // ── Filter + Search ────────────────────────────────────────────────────────
  const filteredCards = useMemo(
    () =>
      cards.filter((card) => {
        const matchSearch =
          card.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
          card.owner.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus =
          filterStatus === "ALL" || card.status === filterStatus;
        return matchSearch && matchStatus;
      }),
    [cards, searchTerm, filterStatus],
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: cards.length,
      active: cards.filter((c) => c.status === "ACTIVE").length,
      inactive: cards.filter((c) => c.status === "INACTIVE").length,
    }),
    [cards],
  );

  // ── Helper download blob ───────────────────────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Export Cards CSV (tanpa saldo) ─────────────────────────────────────────
  const handleExportCards = () => {
    if (cards.length === 0) return;
    const headers = ["uid", "owner", "date", "status"];
    const escape = (val: unknown) =>
      `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...cards.map((row) =>
        headers.map((h) => escape(row[h as keyof typeof row])).join(","),
      ),
    ].join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `rfid_cards_${new Date().toISOString().split("T")[0]}.csv`,
    );
  };

  // ── Export Transaction Logs ────────────────────────────────────────────────
  const handleExportLogs = async () => {
    setExportStatus("loading");
    setExportError(null);
    try {
      const response = await fetch("/api/transactions/export");
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? `Server error: ${response.status}`);
      }
      const blob = await response.blob();
      downloadBlob(
        blob,
        `tol_events_${new Date().toISOString().split("T")[0]}.csv`,
      );
      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 5000);
    }
  };

  // ── Add Card ───────────────────────────────────────────────────────────────
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.uid || !newCard.owner) return;
    setIsSaving(true);
    setModalError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Gagal menyimpan kartu.");
      }
      const saved: RFIDCard = await res.json();
      setCards((prev) => [saved, ...prev]);
      setNewCard({ uid: "", owner: "", status: "ACTIVE" });
      setIsModalOpen(false);
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal menyimpan kartu.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Top-up Saldo ──────────────────────────────────────────────────────────
  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupCard) return;
    const jumlah = parseInt(topupJumlah.replace(/\D/g, ""), 10);
    if (!jumlah || jumlah <= 0) {
      setTopupError("Masukkan nominal yang valid.");
      return;
    }
    setIsTopuping(true);
    setTopupError(null);
    try {
      const res = await fetch(
        `/api/cards/${encodeURIComponent(topupCard.uid)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jumlah }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Gagal mengupdate saldo.");
      }
      const { saldo: newSaldo } = await res.json();
      setCards((prev) =>
        prev.map((c) =>
          c.uid === topupCard.uid ? { ...c, saldo: newSaldo } : c,
        ),
      );
      setTopupCard(null);
      setTopupJumlah("");
    } catch (err) {
      setTopupError(
        err instanceof Error ? err.message : "Gagal mengupdate saldo.",
      );
    } finally {
      setIsTopuping(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (uid: string) => {
    if (!confirm(`Hapus kartu ${uid}?`)) return;
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(uid)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Gagal menghapus kartu.");
      }
      setCards((prev) => prev.filter((c) => c.uid !== uid));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus kartu.");
    }
  };

  const isExporting = exportStatus === "loading";

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <Head>
        <title>Data Management | Smart Toll Gate</title>
      </Head>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>DATA MANAGEMENT</h1>
          <p className={styles.subtitle}>
            Manage RFID cards and export system logs
          </p>
        </header>

        {/* ── Stats (tanpa saldo) ── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <CreditCard size={14} />
              <span>Total Cards</span>
            </div>
            <div className={`${styles.statValue} ${styles.textCyan}`}>
              {isLoading ? "—" : stats.total}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <CreditCard size={14} />
              <span>Active Cards</span>
            </div>
            <div className={`${styles.statValue} ${styles.textGreen}`}>
              {isLoading ? "—" : stats.active}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <CreditCard size={14} />
              <span>Inactive Cards</span>
            </div>
            <div className={`${styles.statValue} ${styles.textRed}`}>
              {isLoading ? "—" : stats.inactive}
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {fetchError && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "var(--accent-red)",
              fontSize: "0.85rem",
            }}
          >
            ⚠️ {fetchError} —{" "}
            <span
              style={{ textDecoration: "underline", cursor: "pointer" }}
              onClick={() => fetchCards(true)}
            >
              Coba lagi
            </span>
          </div>
        )}

        {/* ── Export Section ── */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Export System Logs</h2>

          {exportStatus === "error" && exportError && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                color: "var(--accent-red)",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ {exportError}
            </div>
          )}
          {exportStatus === "success" && (
            <div
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                color: "var(--accent-green)",
                fontSize: "0.85rem",
              }}
            >
              ✅ File berhasil diunduh!
            </div>
          )}

          <div className={styles.exportButtons}>
            <button
              onClick={handleExportCards}
              disabled={isExporting || cards.length === 0}
              className={`${styles.exportBtn} ${styles.btnCyan}`}
              style={{ opacity: cards.length === 0 ? 0.5 : 1 }}
            >
              <Download size={18} />
              <span>Export Cards (CSV)</span>
            </button>
            <button
              onClick={handleExportLogs}
              disabled={isExporting}
              className={`${styles.exportBtn} ${styles.btnGreen}`}
            >
              {isExporting ? (
                <>
                  <Loader2
                    size={18}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  <span>Mengambil data...</span>
                </>
              ) : (
                <>
                  <FileText size={18} />
                  <span>Export Transaction Logs</span>
                </>
              )}
            </button>
          </div>
          <p className={styles.btnDesc}>
            Generate comprehensive reports including all gate transactions,
            access logs, and system events
          </p>
        </div>

        {/* ── RFID Card Registry ── */}
        <div className={styles.sectionCard}>
          <div className={styles.registryHeader}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              RFID CARD REGISTRY
              <span
                style={{
                  marginLeft: "0.75rem",
                  fontSize: "0.7rem",
                  fontWeight: 400,
                  color: "var(--accent-green)",
                  verticalAlign: "middle",
                }}
              >
                ● LIVE
              </span>
            </h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => fetchCards(true)}
                disabled={isLoading}
                className={styles.addBtn}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                }}
                title="Refresh"
              >
                <RefreshCw
                  size={16}
                  style={{
                    animation: isLoading ? "spin 1s linear infinite" : "none",
                  }}
                />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className={styles.addBtn}
              >
                <Plus size={16} />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {/* ── Search + Filter Status: satu baris ── */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              margin: "1rem 0",
              alignItems: "center",
            }}
          >
            <div
              className={styles.searchContainer}
              style={{ flex: 1, margin: 0 }}
            >
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by UID or owner name..."
                className={`${styles.searchInput} ${styles.searchIconPadding}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderColor:
                      filterStatus === s
                        ? s === "ACTIVE"
                          ? "var(--accent-green)"
                          : s === "INACTIVE"
                            ? "var(--accent-magenta)"
                            : "var(--accent-cyan)"
                        : "rgba(255,255,255,0.1)",
                    background:
                      filterStatus === s
                        ? s === "ACTIVE"
                          ? "rgba(16,185,129,0.15)"
                          : s === "INACTIVE"
                            ? "rgba(236,72,153,0.15)"
                            : "rgba(0,212,255,0.1)"
                        : "transparent",
                    color:
                      filterStatus === s
                        ? s === "ACTIVE"
                          ? "var(--accent-green)"
                          : s === "INACTIVE"
                            ? "var(--accent-magenta)"
                            : "var(--accent-cyan)"
                        : "var(--text-muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <table className={styles.tableContainer}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Card UID</th>
                <th className={styles.tableHeader}>Owner</th>
                <th className={styles.tableHeader}>Registered Date</th>
                <th className={styles.tableHeader}>Saldo</th>
                <th className={styles.tableHeader}>Status</th>
                <th className={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && cards.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Loader2
                      size={20}
                      style={{
                        animation: "spin 1s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ marginLeft: "0.5rem" }}>
                      Memuat data dari DynamoDB...
                    </span>
                  </td>
                </tr>
              ) : filteredCards.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    No cards found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCards.map((card) => (
                  <tr key={card.uid} className={styles.row}>
                    <td className={`${styles.cell} ${styles.uid}`}>
                      {card.uid}
                    </td>
                    <td
                      className={styles.cell}
                      style={{ color: "white", fontWeight: 500 }}
                    >
                      {card.owner}
                    </td>
                    <td className={styles.cell}>
                      <div className={styles.dateCell}>
                        <Calendar size={14} />
                        {card.date}
                      </div>
                    </td>
                    <td
                      className={styles.cell}
                      style={{
                        color:
                          (card.saldo ?? 0) > 0
                            ? "var(--accent-green)"
                            : "var(--accent-red)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatRupiah(card.saldo ?? 0)}
                    </td>
                    <td className={styles.cell}>
                      <span
                        className={`${styles.statusBadge} ${card.status === "ACTIVE" ? styles.activeBadge : styles.inactiveBadge}`}
                      >
                        {card.status}
                      </span>
                    </td>
                    <td className={styles.cell}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => {
                            setTopupCard(card);
                            setTopupJumlah("");
                            setTopupError(null);
                          }}
                          title="Top-up Saldo"
                          style={{
                            background: "rgba(16,185,129,0.1)",
                            border: "1px solid rgba(16,185,129,0.3)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            cursor: "pointer",
                            color: "var(--accent-green)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Wallet size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(card.uid)}
                          className={styles.deleteBtn}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Modal Add Card ── */}
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "var(--surface-1)",
                padding: "2rem",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                width: "420px",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "1.5rem",
                }}
              >
                <h3 style={{ color: "white", margin: 0 }}>Add New RFID Card</h3>
                <X
                  size={20}
                  color="var(--text-muted)"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalError(null);
                  }}
                />
              </div>

              {modalError && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    color: "var(--accent-red)",
                    fontSize: "0.8rem",
                  }}
                >
                  ⚠️ {modalError}
                </div>
              )}

              <form
                onSubmit={handleAddCard}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  <label
                    style={{
                      color: "var(--text-subtle)",
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Card UID
                  </label>
                  <input
                    required
                    className={styles.searchInput}
                    placeholder="e.g. A3:B2:C1:D0"
                    value={newCard.uid}
                    onChange={(e) =>
                      setNewCard({ ...newCard, uid: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      color: "var(--text-subtle)",
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Owner Name
                  </label>
                  <input
                    required
                    className={styles.searchInput}
                    placeholder="Nama Lengkap"
                    value={newCard.owner}
                    onChange={(e) =>
                      setNewCard({ ...newCard, owner: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      color: "var(--text-subtle)",
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Status
                  </label>
                  <select
                    className={styles.searchInput}
                    style={{ appearance: "none" }}
                    value={newCard.status}
                    onChange={(e) =>
                      setNewCard({ ...newCard, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className={styles.addBtn}
                  disabled={isSaving}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    marginTop: "0.5rem",
                    padding: "0.9rem",
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Menyimpan...
                    </>
                  ) : (
                    "Save Card"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal Top-up Saldo ── */}
        {topupCard && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "var(--surface-1)",
                padding: "2rem",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                width: "380px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "1.5rem",
                }}
              >
                <h3
                  style={{
                    color: "white",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Wallet size={18} color="var(--accent-green)" /> Top-up Saldo
                </h3>
                <X
                  size={20}
                  color="var(--text-muted)"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setTopupCard(null);
                    setTopupError(null);
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 8,
                }}
              >
                <p
                  style={{
                    color: "var(--text-subtle)",
                    fontSize: "0.78rem",
                    margin: 0,
                  }}
                >
                  Kartu:{" "}
                  <span style={{ color: "var(--accent-cyan)" }}>
                    {topupCard.uid}
                  </span>
                </p>
                <p
                  style={{
                    color: "var(--text-subtle)",
                    fontSize: "0.78rem",
                    margin: "4px 0 0",
                  }}
                >
                  Owner:{" "}
                  <span style={{ color: "var(--text-strong)" }}>
                    {topupCard.owner}
                  </span>
                </p>
                <p
                  style={{
                    color: "var(--text-subtle)",
                    fontSize: "0.78rem",
                    margin: "4px 0 0",
                  }}
                >
                  Saldo saat ini:{" "}
                  <span
                    style={{ color: "var(--accent-green)", fontWeight: 600 }}
                  >
                    {formatRupiah(topupCard.saldo ?? 0)}
                  </span>
                </p>
              </div>

              {topupError && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    color: "var(--accent-red)",
                    fontSize: "0.8rem",
                  }}
                >
                  ⚠️ {topupError}
                </div>
              )}

              <form
                onSubmit={handleTopup}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  <label
                    style={{
                      color: "var(--text-subtle)",
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Nominal Top-up (Rp)
                  </label>
                  <input
                    required
                    type="number"
                    min="1000"
                    step="1000"
                    className={styles.searchInput}
                    placeholder="Contoh: 50000"
                    value={topupJumlah}
                    onChange={(e) => setTopupJumlah(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTopuping}
                  style={
                    {
                      width: "100%",
                      padding: "0.9rem",
                      borderRadius: 8,
                      border: "1px solid rgba(16,185,129,0.3)",
                      background: isTopuping
                        ? "var(--surface-3)"
                        : "rgba(16,185,129,0.2)",
                      color: "var(--accent-green)",
                      fontWeight: 600,
                      cursor: isTopuping ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    } as React.CSSProperties
                  }
                >
                  {isTopuping ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Wallet size={16} /> Top-up Saldo
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ height: "50px" }} />
      </main>
    </div>
  );
};

export default ManagementPage;
