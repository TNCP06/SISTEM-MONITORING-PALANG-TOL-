import styles from "@/styles/management.module.css";
import {
  Calendar,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Head from "next/head";
import React, { useMemo, useState } from "react";

const initialCardData = [
  { uid: "RFID-4521", owner: "John Doe",       date: "2026-01-15", status: "ACTIVE"   },
  { uid: "RFID-7832", owner: "Jane Smith",     date: "2026-02-08", status: "ACTIVE"   },
  { uid: "RFID-3345", owner: "Bob Johnson",    date: "2026-03-12", status: "ACTIVE"   },
  { uid: "RFID-6678", owner: "Alice Williams", date: "2026-03-25", status: "ACTIVE"   },
  { uid: "RFID-1234", owner: "Charlie Brown",  date: "2026-04-01", status: "INACTIVE" },
];

const ManagementPage = () => {
  const [cards, setCards]             = useState(initialCardData);
  const [searchTerm, setSearchTerm]   = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCard, setNewCard]         = useState({ uid: "", owner: "", status: "ACTIVE" });

  // ── State export ──────────────────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [exportError, setExportError]   = useState<string | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────────
  const filteredCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
          card.owner.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [cards, searchTerm]
  );

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total:    cards.length,
      active:   cards.filter((c) => c.status === "ACTIVE").length,
      inactive: cards.filter((c) => c.status === "INACTIVE").length,
    }),
    [cards]
  );

  // ── Helper: download blob sebagai file ────────────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href  = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Export kartu RFID (dari state lokal) ──────────────────────────────────────
  const handleExportCards = () => {
    if (cards.length === 0) return;
    const headers = ["uid", "owner", "date", "status"];
    const escape  = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...cards.map((row) => headers.map((h) => escape(row[h as keyof typeof row])).join(",")),
    ].join("\n");
    const blob     = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = `rfid_cards_${new Date().toISOString().split("T")[0]}.csv`;
    downloadBlob(blob, filename);
  };

  // ── Export transaction logs (dari DynamoDB via API Route) ─────────────────────
  const handleExportLogs = async () => {
    setExportStatus("loading");
    setExportError(null);

    try {
      const response = await fetch("/api/transactions/export");

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? `Server error: ${response.status}`);
      }

      const blob     = await response.blob();
      const filename = `tol_events_${new Date().toISOString().split("T")[0]}.csv`;
      downloadBlob(blob, filename);

      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setExportError(message);
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 5000);
    }
  };

  // ── Add Card ──────────────────────────────────────────────────────────────────
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.uid || !newCard.owner) return;
    const today = new Date().toISOString().split("T")[0];
    setCards([{ ...newCard, date: today }, ...cards]);
    setNewCard({ uid: "", owner: "", status: "ACTIVE" });
    setIsModalOpen(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = (uid: string) => {
    if (confirm(`Hapus kartu ${uid}?`)) {
      setCards(cards.filter((c) => c.uid !== uid));
    }
  };

  const isExporting = exportStatus === "loading";

  return (
    <div className={styles.container}>
      <Head>
        <title>Data Management | Smart Toll Gate</title>
      </Head>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>DATA MANAGEMENT</h1>
          <p className={styles.subtitle}>Manage RFID cards and export system logs</p>
        </header>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}><CreditCard size={14} /><span>Total Cards</span></div>
            <div className={`${styles.statValue} ${styles.textCyan}`}>{stats.total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}><CreditCard size={14} /><span>Active Cards</span></div>
            <div className={`${styles.statValue} ${styles.textGreen}`}>{stats.active}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}><CreditCard size={14} /><span>Inactive Cards</span></div>
            <div className={`${styles.statValue} ${styles.textRed}`}>{stats.inactive}</div>
          </div>
        </div>

        {/* Export Section */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Export System Logs</h2>

          {/* Banner error */}
          {exportStatus === "error" && exportError && (
            <div style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#f87171",
              fontSize: "0.85rem",
            }}>
              ⚠️ {exportError}
            </div>
          )}

          {/* Banner sukses */}
          {exportStatus === "success" && (
            <div style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#4ade80",
              fontSize: "0.85rem",
            }}>
              ✅ File berhasil diunduh!
            </div>
          )}

          <div className={styles.exportButtons}>
            {/* Export kartu RFID */}
            <button
              onClick={handleExportCards}
              disabled={isExporting || cards.length === 0}
              className={`${styles.exportBtn} ${styles.btnCyan}`}
              style={{ opacity: cards.length === 0 ? 0.5 : 1 }}
            >
              <Download size={18} />
              <span>Export Cards (CSV)</span>
            </button>

            {/* Export transaction logs dari DynamoDB */}
            <button
              onClick={handleExportLogs}
              disabled={isExporting}
              className={`${styles.exportBtn} ${styles.btnGreen}`}
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
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
            Generate comprehensive reports including all gate transactions, access logs, and system events
          </p>
        </div>

        {/* RFID Card Registry */}
        <div className={styles.sectionCard}>
          <div className={styles.registryHeader}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              RFID CARD REGISTRY
            </h2>
            <button onClick={() => setIsModalOpen(true)} className={styles.addBtn}>
              <Plus size={16} />
              <span>Add Card</span>
            </button>
          </div>

          <div className={styles.searchContainer}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by UID or owner name..."
              className={`${styles.searchInput} ${styles.searchIconPadding}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table className={styles.tableContainer}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Card UID</th>
                <th className={styles.tableHeader}>Owner</th>
                <th className={styles.tableHeader}>Registered Date</th>
                <th className={styles.tableHeader}>Status</th>
                <th className={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card) => (
                <tr key={card.uid} className={styles.row}>
                  <td className={`${styles.cell} ${styles.uid}`}>{card.uid}</td>
                  <td className={styles.cell} style={{ color: "white", fontWeight: 500 }}>
                    {card.owner}
                  </td>
                  <td className={styles.cell}>
                    <div className={styles.dateCell}>
                      <Calendar size={14} />
                      {card.date}
                    </div>
                  </td>
                  <td className={styles.cell}>
                    <span className={`${styles.statusBadge} ${card.status === "ACTIVE" ? styles.activeBadge : styles.inactiveBadge}`}>
                      {card.status}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <button onClick={() => handleDelete(card.uid)} className={styles.deleteBtn}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCards.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                    No cards found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Add Card */}
        {isModalOpen && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: "#0f172a", padding: "2rem",
              borderRadius: "12px", border: "1px solid #1e293b", width: "400px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <h3 style={{ color: "white", margin: 0 }}>Add New RFID Card</h3>
                <X size={20} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setIsModalOpen(false)} />
              </div>
              <form onSubmit={handleAddCard} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.5rem" }}>
                    Card UID
                  </label>
                  <input required className={styles.searchInput} placeholder="e.g. RFID-9999"
                    value={newCard.uid} onChange={(e) => setNewCard({ ...newCard, uid: e.target.value })} />
                </div>
                <div>
                  <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.5rem" }}>
                    Owner Name
                  </label>
                  <input required className={styles.searchInput} placeholder="Full Name"
                    value={newCard.owner} onChange={(e) => setNewCard({ ...newCard, owner: e.target.value })} />
                </div>
                <div>
                  <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.5rem" }}>
                    Status
                  </label>
                  <select className={styles.searchInput} style={{ appearance: "none" }}
                    value={newCard.status} onChange={(e) => setNewCard({ ...newCard, status: e.target.value })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <button type="submit" className={styles.addBtn}
                  style={{ width: "100%", justifyContent: "center", marginTop: "1rem", padding: "1rem" }}>
                  Save Card
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
