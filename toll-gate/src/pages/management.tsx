import styles from "@/styles/management.module.css";
import {
  Calendar,
  CreditCard,
  Lock,
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
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ── Cek session saat halaman dimuat ───────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/management")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) setIsAuthenticated(true);
      })
      .catch(() => {})
      .finally(() => setIsCheckingAuth(false));
  }, []);

  // ── State kartu ────────────────────────────────────────────────────────────
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE">("ALL");

  // ── Modal Add Card ─────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    uid: "",
    owner: "",
    status: "ACTIVE",
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Konfigurasi Tarif ─────────────────────────────────────────────────────
  const [tarif, setTarif] = useState<number | null>(null);
  const [tarifInput, setTarifInput] = useState("");
  const [isSavingTarif, setIsSavingTarif] = useState(false);
  const [tarifError, setTarifError] = useState<string | null>(null);
  const [tarifSuccess, setTarifSuccess] = useState(false);

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
    if (!isAuthenticated) return;
    fetchCards(true);
    fetch("/api/config/tarif")
      .then((r) => r.json())
      .then((d) => {
        if (d.tarif) {
          setTarif(d.tarif);
          setTarifInput(String(d.tarif));
        }
      })
      .catch(() => {});
    timerRef.current = setInterval(() => fetchCards(false), POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCards, isAuthenticated]);

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

  // ── Simpan Tarif ──────────────────────────────────────────────────────────
  const handleSaveTarif = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseInt(tarifInput.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 500 || nominal > 1_000_000) {
      setTarifError("Tarif harus antara Rp 500 dan Rp 1.000.000.");
      return;
    }
    setIsSavingTarif(true);
    setTarifError(null);
    setTarifSuccess(false);
    try {
      const res = await fetch("/api/config/tarif", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarif: nominal }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Gagal menyimpan tarif.");
      }
      const { tarif: saved } = await res.json();
      setTarif(saved);
      setTarifInput(String(saved));
      setTarifSuccess(true);
      setTimeout(() => setTarifSuccess(false), 3000);
    } catch (err) {
      setTarifError(
        err instanceof Error ? err.message : "Gagal menyimpan tarif.",
      );
    } finally {
      setIsSavingTarif(false);
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

  // ── Password submit ────────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    try {
      const res = await fetch("/api/auth/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordError(data.error ?? "Password salah. Coba lagi.");
        setPasswordInput("");
      }
    } catch {
      setPasswordError("Terjadi kesalahan. Coba lagi.");
      setPasswordInput("");
    }
  };

  // ── Password Gate ──────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className={styles.container}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2
            size={32}
            style={{
              animation: "spin 1s linear infinite",
              color: "var(--accent-cyan)",
            }}
          />
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Data Management | Smart Toll Gate</title>
        </Head>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface-1)",
              padding: "2.5rem",
              borderRadius: "16px",
              border: "1px solid var(--border-color)",
              width: "380px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <Lock size={24} color="var(--accent-cyan)" />
              </div>
              <h2
                style={{
                  color: "var(--text-strong)",
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                }}
              >
                Management Access
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  margin: "0.5rem 0 0",
                  textAlign: "center",
                }}
              >
                Masukkan password untuk melanjutkan
              </p>
            </div>

            {passwordError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  color: "var(--accent-red)",
                  fontSize: "0.82rem",
                  textAlign: "center",
                }}
              >
                ⚠️ {passwordError}
              </div>
            )}

            <form
              onSubmit={handlePasswordSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div style={{ position: "relative" }}>
                <input
                  autoFocus
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password..."
                  className={styles.searchInput}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(null);
                  }}
                  style={{ paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-faint)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "0.9rem",
                  borderRadius: 8,
                  border: "1px solid rgba(0,212,255,0.4)",
                  background: "rgba(0,212,255,0.1)",
                  color: "var(--accent-cyan)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <Head>
        <title>Data Management | Smart Toll Gate</title>
      </Head>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>DATA MANAGEMENT</h1>
          <p className={styles.subtitle}>Manage RFID cards and system data</p>
        </header>

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

        {/* ── Konfigurasi Tarif ── */}
        <div className={styles.sectionCard} style={{ marginBottom: "1.5rem" }}>
          <h2 className={styles.sectionTitle}>KONFIGURASI TARIF TOL</h2>
          <form onSubmit={handleSaveTarif}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <label
                  style={{
                    color: "var(--text-subtle)",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "0.5rem",
                  }}
                >
                  Tarif Flat (Rp) &nbsp;
                  {tarif !== null && (
                    <span
                      style={{ color: "var(--text-muted)", fontWeight: 400 }}
                    >
                      — saat ini:{" "}
                      <span
                        style={{ color: "var(--accent-cyan)", fontWeight: 600 }}
                      >
                        {formatRupiah(tarif)}
                      </span>
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  max="1000000"
                  required
                  className={styles.searchInput}
                  placeholder="Contoh: 5000"
                  value={tarifInput}
                  onChange={(e) => {
                    setTarifInput(e.target.value);
                    setTarifError(null);
                    setTarifSuccess(false);
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingTarif}
                className={styles.addBtn}
                style={{ padding: "0.65rem 1.25rem", whiteSpace: "nowrap" }}
              >
                {isSavingTarif ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: "spin 1s linear infinite" }}
                    />{" "}
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Tarif"
                )}
              </button>
            </div>
            {tarifError && (
              <p
                style={{
                  color: "var(--accent-red)",
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                }}
              >
                ⚠️ {tarifError}
              </p>
            )}
            {tarifSuccess && (
              <p
                style={{
                  color: "var(--accent-green)",
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                }}
              >
                ✓ Tarif berhasil diperbarui. Subscriber akan menggunakan tarif
                baru dalam &lt;60 detik.
              </p>
            )}
          </form>
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
            <div className={styles.registryActions}>
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

          {/* ── Search + Filter Status ── */}
          <div className={styles.filtersRow}>
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
              {(["ALL", "ACTIVE"] as const).map((s) => (
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
                          : "var(--accent-cyan)"
                        : "rgba(255,255,255,0.1)",
                    background:
                      filterStatus === s
                        ? s === "ACTIVE"
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(0,212,255,0.1)"
                        : "transparent",
                    color:
                      filterStatus === s
                        ? s === "ACTIVE"
                          ? "var(--accent-green)"
                          : "var(--accent-cyan)"
                        : "var(--text-muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableScroll}>
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
