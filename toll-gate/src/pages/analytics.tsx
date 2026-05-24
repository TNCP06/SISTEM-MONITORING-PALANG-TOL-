import Sidebar from "@/components/sidebar/sidebar";
import styles from "@/styles/analytics.module.css";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";

// Fix for "The width(-1) and height(-1) of chart should be greater than 0"
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false },
);
const AreaChart = dynamic(
  () => import("recharts").then((mod) => mod.AreaChart),
  { ssr: false },
);
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), {
  ssr: false,
});
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), {
  ssr: false,
});
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false },
);
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), {
  ssr: false,
});
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), {
  ssr: false,
});

// ─────────────────────────────────────────────
//  DateFilterControl
// ─────────────────────────────────────────────

const fmtDate = (d: Date) => d.toISOString().split("T")[0];
const todayStr = () => fmtDate(new Date());
const daysAgo = (n: number) => fmtDate(new Date(Date.now() - n * 86_400_000));

const PRESETS = [
  { label: "Today", start: () => todayStr(), end: () => todayStr() },
  { label: "7D", start: () => daysAgo(6), end: () => todayStr() },
  { label: "14D", start: () => daysAgo(13), end: () => todayStr() },
  { label: "30D", start: () => daysAgo(29), end: () => todayStr() },
  { label: "90D", start: () => daysAgo(89), end: () => todayStr() },
];

const humanRange = (start: string, end: string): string => {
  if (start === end && start === todayStr()) return "Today";
  for (const p of PRESETS) {
    if (p.start() === start && p.end() === end) return `Last ${p.label}`;
  }
  const s = new Date(start);
  const e = new Date(end);
  const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)} (${diffDays}d)`;
};

const DF_S: Record<string, React.CSSProperties> = {
  wrapper: {
    marginBottom: "1.5rem",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.35rem 0.75rem",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.15s ease",
    userSelect: "none",
    whiteSpace: "nowrap",
    background: "none",
  },
  chipInactive: {
    backgroundColor: "var(--chip-bg)",
    borderColor: "var(--chip-border)",
    color: "var(--chip-text)",
  },
  chipActive: {
    backgroundColor: "var(--chip-active-bg)",
    borderColor: "var(--chip-active-border)",
    color: "var(--chip-active-text)",
  },
  divider: {
    width: "1px",
    height: "20px",
    backgroundColor: "var(--chip-border)",
    margin: "0 0.25rem",
    flexShrink: 0,
  },
  customBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.35rem 0.85rem",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    border: "1px solid var(--chip-border)",
    backgroundColor: "var(--chip-bg)",
    color: "var(--text-subtle)",
    transition: "all 0.15s ease",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  badge: {
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.3rem 0.65rem",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 500,
    color: "var(--text-faint)",
    backgroundColor: "var(--badge-bg)",
    border: "1px solid var(--badge-border)",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  popoverWrap: {
    position: "relative",
    display: "inline-block",
  },
  popover: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    zIndex: 100,
    backgroundColor: "var(--surface-overlay)",
    border: "1px solid var(--chip-active-border)",
    borderRadius: "8px",
    padding: "1rem",
    boxShadow: "var(--popover-shadow)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: "280px",
  },
  popoverLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "var(--text-faint)",
    textTransform: "uppercase",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  inputLabel: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    width: "28px",
    flexShrink: 0,
  },
  dateInput: {
    flex: 1,
    padding: "0.5rem 0.65rem",
    borderRadius: "5px",
    border: "1px solid var(--input-border)",
    backgroundColor: "var(--input-bg)",
    color: "var(--text-main)",
    fontSize: "11px",
    fontWeight: 500,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    cursor: "pointer",
    width: "100%",
  },
  applyBtn: {
    width: "100%",
    padding: "0.55rem",
    borderRadius: "5px",
    border: "1px solid var(--chip-active-border)",
    backgroundColor: "var(--chip-active-bg)",
    color: "var(--chip-active-text)",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  resetBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.35rem 0.55rem",
    borderRadius: "4px",
    border: "1px solid var(--chip-border)",
    backgroundColor: "var(--chip-bg)",
    color: "var(--text-faint)",
    cursor: "pointer",
    fontSize: "11px",
    transition: "all 0.15s ease",
  },
};

interface DateFilterControlProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

const DateFilterControl = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DateFilterControlProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ start: startDate, end: endDate });
  const [inputFocus, setInputFocus] = useState<"start" | "end" | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setDraft({ start: startDate, end: endDate });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, startDate, endDate]);

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setStartDate(p.start());
    setEndDate(p.end());
  };

  const applyCustom = () => {
    if (draft.start && draft.end && draft.start <= draft.end) {
      setStartDate(draft.start);
      setEndDate(draft.end);
      setOpen(false);
    }
  };

  const isPresetActive = (p: (typeof PRESETS)[0]) =>
    p.start() === startDate && p.end() === endDate;

  const isCustomActive =
    !PRESETS.some(isPresetActive) && !!(startDate && endDate);
  const rangeLabel =
    startDate && endDate ? humanRange(startDate, endDate) : "—";

  return (
    <div style={DF_S.wrapper}>
      <div style={DF_S.row}>
        {/* Preset chips */}
        {PRESETS.map((p) => (
          <button
            key={p.label}
            style={{
              ...DF_S.chip,
              ...(isPresetActive(p) ? DF_S.chipActive : DF_S.chipInactive),
            }}
            onClick={() => applyPreset(p)}
            onMouseEnter={(e) => {
              if (!isPresetActive(p)) {
                e.currentTarget.style.borderColor = "var(--chip-active-border)";
                e.currentTarget.style.color = "var(--text-subtle)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isPresetActive(p)) {
                e.currentTarget.style.borderColor = "var(--chip-border)";
                e.currentTarget.style.color = "var(--chip-text)";
              }
            }}
          >
            {isPresetActive(p) && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-cyan)",
                  boxShadow: "0 0 6px var(--accent-cyan)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
            {p.label}
          </button>
        ))}

        <div style={DF_S.divider} />

        {/* Custom range dropdown */}
        <div style={DF_S.popoverWrap} ref={popoverRef}>
          <button
            style={{
              ...DF_S.customBtn,
              ...(open || isCustomActive
                ? {
                    borderColor: "var(--chip-active-border)",
                    color: "var(--chip-active-text)",
                    backgroundColor: "var(--chip-active-bg)",
                  }
                : {}),
            }}
            onClick={() => setOpen((v) => !v)}
          >
            <CalendarDays size={11} />
            Custom
            <ChevronDown
              size={11}
              style={{
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {open && (
            <div style={DF_S.popover}>
              <span style={DF_S.popoverLabel}>Custom date range</span>

              <div style={DF_S.inputRow}>
                <span style={DF_S.inputLabel}>From</span>
                <input
                  type="date"
                  value={draft.start}
                  max={draft.end || todayStr()}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, start: e.target.value }))
                  }
                  style={{
                    ...DF_S.dateInput,
                    ...(inputFocus === "start"
                      ? {
                          borderColor: "var(--chip-active-border)",
                          boxShadow: "0 0 0 2px var(--chip-active-bg)",
                        }
                      : {}),
                  }}
                  onFocus={() => setInputFocus("start")}
                  onBlur={() => setInputFocus(null)}
                />
              </div>

              <div style={DF_S.inputRow}>
                <span style={DF_S.inputLabel}>To</span>
                <input
                  type="date"
                  value={draft.end}
                  min={draft.start}
                  max={todayStr()}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, end: e.target.value }))
                  }
                  style={{
                    ...DF_S.dateInput,
                    ...(inputFocus === "end"
                      ? {
                          borderColor: "var(--chip-active-border)",
                          boxShadow: "0 0 0 2px var(--chip-active-bg)",
                        }
                      : {}),
                  }}
                  onFocus={() => setInputFocus("end")}
                  onBlur={() => setInputFocus(null)}
                />
              </div>

              {draft.start > draft.end && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--accent-red)",
                    letterSpacing: "0.03em",
                  }}
                >
                  ⚠ End date must be after start date
                </span>
              )}

              <button
                style={DF_S.applyBtn}
                onClick={applyCustom}
                disabled={!draft.start || !draft.end || draft.start > draft.end}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--chip-active-bg-strong)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--chip-active-bg)";
                }}
              >
                Apply Range
              </button>
            </div>
          )}
        </div>

        {/* Reset */}
        <button
          style={DF_S.resetBtn}
          title="Reset to last 7 days"
          onClick={() => {
            setStartDate(daysAgo(6));
            setEndDate(todayStr());
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--chip-border)";
            e.currentTarget.style.color = "var(--text-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--chip-border)";
            e.currentTarget.style.color = "var(--text-faint)";
          }}
        >
          <X size={11} />
        </button>

        {/* Active range badge */}
        <div style={DF_S.badge}>
          <CalendarDays size={10} style={{ opacity: 0.5 }} />
          {rangeLabel}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Chart Data
// ─────────────────────────────────────────────

const volumeData = [
  { date: daysAgo(6), name: "00:00", entry: 12, exit: 10 },
  { date: daysAgo(6), name: "02:00", entry: 8, exit: 6 },
  { date: daysAgo(6), name: "04:00", entry: 5, exit: 4 },
  { date: daysAgo(6), name: "06:00", entry: 25, exit: 20 },
  { date: daysAgo(6), name: "08:00", entry: 45, exit: 40 },
  { date: daysAgo(5), name: "10:00", entry: 38, exit: 35 },
  { date: daysAgo(5), name: "12:00", entry: 42, exit: 38 },
  { date: daysAgo(5), name: "14:00", entry: 48, exit: 45 },
  { date: daysAgo(4), name: "16:00", entry: 55, exit: 50 },
  { date: daysAgo(4), name: "18:00", entry: 45, exit: 42 },
  { date: daysAgo(3), name: "20:00", entry: 32, exit: 30 },
  { date: daysAgo(3), name: "22:00", entry: 22, exit: 20 },
];

const validationData = [
  {
    date: todayStr(),
    name: "Accepted",
    value: 1847,
    fill: "var(--accent-green)",
  },
  { date: todayStr(), name: "Rejected", value: 153, fill: "var(--accent-red)" },
];

const latencyData = [
  { date: daysAgo(2), name: "00:00", seconds: 145 },
  { date: daysAgo(2), name: "04:00", seconds: 132 },
  { date: daysAgo(1), name: "08:00", seconds: 158 },
  { date: daysAgo(1), name: "12:00", seconds: 172 },
  { date: todayStr(), name: "16:00", seconds: 165 },
  { date: todayStr(), name: "20:00", seconds: 140 },
];

const queueData = [
  { date: daysAgo(7), time: "06:00", seg: 2.5 },
  { date: daysAgo(6), time: "08:00", seg: 4.2 },
  { date: daysAgo(5), time: "10:00", seg: 3.1 },
  { date: daysAgo(4), time: "12:00", seg: 3.8 },
  { date: daysAgo(3), time: "14:00", seg: 2.9 },
  { date: daysAgo(2), time: "16:00", seg: 4.5 },
  { date: daysAgo(1), time: "18:00", seg: 5.2 },
  { date: todayStr(), time: "20:00", seg: 3.4 },
];

const weeklyTrafficData = [
  {
    date: daysAgo(6),
    day: "Mon",
    "00:00 - 06:00": 40,
    "06:00 - 12:00": 150,
    "12:00 - 18:00": 300,
    "18:00 - 24:00": 400,
  },
  {
    date: daysAgo(5),
    day: "Tue",
    "00:00 - 06:00": 35,
    "06:00 - 12:00": 140,
    "12:00 - 18:00": 280,
    "18:00 - 24:00": 380,
  },
  {
    date: daysAgo(4),
    day: "Wed",
    "00:00 - 06:00": 45,
    "06:00 - 12:00": 160,
    "12:00 - 18:00": 320,
    "18:00 - 24:00": 420,
  },
  {
    date: daysAgo(3),
    day: "Thu",
    "00:00 - 06:00": 50,
    "06:00 - 12:00": 170,
    "12:00 - 18:00": 340,
    "18:00 - 24:00": 440,
  },
  {
    date: daysAgo(2),
    day: "Fri",
    "00:00 - 06:00": 55,
    "06:00 - 12:00": 180,
    "12:00 - 18:00": 360,
    "18:00 - 24:00": 460,
  },
  {
    date: daysAgo(1),
    day: "Sat",
    "00:00 - 06:00": 30,
    "06:00 - 12:00": 120,
    "12:00 - 18:00": 250,
    "18:00 - 24:00": 350,
  },
  {
    date: todayStr(),
    day: "Sun",
    "00:00 - 06:00": 25,
    "06:00 - 12:00": 100,
    "12:00 - 18:00": 220,
    "18:00 - 24:00": 320,
  },
];

// ─────────────────────────────────────────────
//  Export Helpers
// ─────────────────────────────────────────────

const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${fmtDate(new Date())}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const ExportButton = ({
  data,
  filename,
}: {
  data: any[];
  filename: string;
}) => (
  <button
    onClick={() => exportToCSV(data, filename)}
    title="Export data to CSV"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      padding: "0.5rem 0.9rem",
      borderRadius: "6px",
      border: "1px solid var(--accent-neutral-border)",
      backgroundColor: "var(--accent-neutral-bg)",
      color: "var(--accent-neutral-text)",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-cyan)";
      (e.currentTarget as HTMLElement).style.backgroundColor =
        "var(--chip-active-bg)";
      (e.currentTarget as HTMLElement).style.color = "var(--accent-cyan)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor =
        "var(--accent-neutral-border)";
      (e.currentTarget as HTMLElement).style.backgroundColor =
        "var(--accent-neutral-bg)";
      (e.currentTarget as HTMLElement).style.color =
        "var(--accent-neutral-text)";
    }}
  >
    <Download size={14} />
    Export
  </button>
);

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const formatTravelTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
};

const getFilteredData = (
  data: any[],
  startDate: string,
  endDate: string,
  dateKey: string = "date",
) => {
  if (!data || data.length === 0) return data;
  return data.filter((item) => {
    const itemDate = item[dateKey];
    return itemDate >= startDate && itemDate <= endDate;
  });
};

// ─────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────

const AnalyticsPage = () => {
  const defaultStart = daysAgo(6);
  const defaultEnd = todayStr();

  // ── Single date range for real-data charts ────────────────────────────────
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // ── Keep separate date for mock charts ────────────────────────────────────
  const [latencyStartDate, setLatencyStartDate] = useState(defaultStart);
  const [latencyEndDate, setLatencyEndDate] = useState(defaultEnd);
  const [heatmapStartDate, setHeatmapStartDate] = useState(defaultStart);
  const [heatmapEndDate, setHeatmapEndDate] = useState(defaultEnd);

  // ── Analytics data from API ────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData] = useState<{
    trafficVolume: { jam: string; masuk: number; keluar: number }[];
    accessValidation: { name: string; value: number }[];
    revenueHarian: { tanggal: string; revenue: number }[];
    stats: {
      totalMasuk: number;
      totalKeluar: number;
      diDalam: number;
      totalRevenue: number;
      totalTransaksi: number;
      successRate: number;
    };
  } | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  useEffect(() => {
    setIsLoadingAnalytics(true);
    fetch(`/api/analytics?from=${startDate}&to=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setAnalyticsData(data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingAnalytics(false));
  }, [startDate, endDate]);

  return (
    <div className={styles.container}>
      <Head>
        <title>Data Analytics | Smart Toll Gate</title>
      </Head>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>DATA ANALYTICS</h1>
          <p className={styles.subtitle}>
            Traffic insights and system performance metrics
          </p>
        </header>

        {/* Top Stats — data real dari API */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <TrendingUp size={16} />
              <span>Total Masuk</span>
            </div>
            <div className={`${styles.statValue} ${styles.textCyan}`}>
              {isLoadingAnalytics
                ? "—"
                : (analyticsData?.stats.totalMasuk ?? 0)}
            </div>
            <div className={styles.statMeta}>Kendaraan masuk</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Activity size={16} />
              <span>Total Keluar</span>
            </div>
            <div className={`${styles.statValue} ${styles.textGreen}`}>
              {isLoadingAnalytics
                ? "—"
                : (analyticsData?.stats.totalKeluar ?? 0)}
            </div>
            <div className={styles.statMeta}>Kendaraan keluar</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Target size={16} />
              <span>Success Rate</span>
            </div>
            <div className={`${styles.statValue} ${styles.textPurple}`}>
              {isLoadingAnalytics
                ? "—"
                : `${analyticsData?.stats.successRate ?? 0}%`}
            </div>
            <div className={styles.statMeta}>Acceptance ratio</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Clock size={16} />
              <span>Total Revenue</span>
            </div>
            <div
              className={`${styles.statValue} ${styles.textYellow}`}
              style={{ fontSize: "2.2rem" }}
            >
              {isLoadingAnalytics
                ? "—"
                : `Rp ${(analyticsData?.stats.totalRevenue ?? 0).toLocaleString("id-ID")}`}
            </div>
            <div className={styles.statMeta}>Dari gate keluar</div>
          </div>
        </div>

        {/* Volume Chart — data real per jam */}
        <section className={styles.chartSection}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h2 className={styles.chartTitle}>
              Traffic Volume - Hourly Breakdown
            </h2>
            <ExportButton
              data={analyticsData?.trafficVolume ?? []}
              filename="traffic-volume"
            />
          </div>
          <DateFilterControl
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData?.trafficVolume ?? []}>
                <defs>
                  <linearGradient id="colorEntry" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--accent-green)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--accent-green)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="colorExit" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--accent-cyan)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--accent-cyan)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                  vertical={false}
                />
                <XAxis
                  dataKey="jam"
                  stroke="var(--text-muted)"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-1)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "var(--text-main)" }}
                />
                <Area
                  type="monotone"
                  dataKey="masuk"
                  stroke="var(--accent-green)"
                  fillOpacity={1}
                  fill="url(#colorEntry)"
                  strokeWidth={2}
                  name="Masuk"
                />
                <Area
                  type="monotone"
                  dataKey="keluar"
                  stroke="var(--accent-cyan)"
                  fillOpacity={1}
                  fill="url(#colorExit)"
                  strokeWidth={2}
                  name="Keluar"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div
            className={styles.pieLegend}
            style={{ justifyContent: "center" }}
          >
            <div className={styles.legendItem}>
              <div
                className={styles.dot}
                style={{ backgroundColor: "var(--accent-green)" }}
              />{" "}
              Entry
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.dot}
                style={{ backgroundColor: "var(--accent-cyan)" }}
              />{" "}
              Exit
            </div>
          </div>
        </section>

        {/* Two Columns */}
        <div className={styles.chartRow}>
          {/* Access Validation — data real */}
          <section className={styles.chartSection} style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h2 className={styles.chartTitle}>Access Validation</h2>
              <ExportButton
                data={analyticsData?.accessValidation ?? []}
                filename="access-validation"
              />
            </div>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-faint)",
                margin: "0 0 1rem",
              }}
            >
              Menggunakan rentang tanggal yang sama dengan Traffic Volume
            </p>
            <div className={styles.pieContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Diterima",
                        value: analyticsData?.accessValidation[0]?.value ?? 0,
                        fill: "var(--accent-green)",
                      },
                      {
                        name: "Ditolak",
                        value: analyticsData?.accessValidation[1]?.value ?? 0,
                        fill: "var(--accent-red)",
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                  >
                    <Cell fill="var(--accent-green)" />
                    <Cell fill="var(--accent-red)" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-1)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                <div className={styles.legendItem}>
                  <div
                    className={styles.dot}
                    style={{ backgroundColor: "var(--accent-green)" }}
                  />
                  Diterima: {analyticsData?.accessValidation[0]?.value ?? 0}
                </div>
                <div className={styles.legendItem}>
                  <div
                    className={styles.dot}
                    style={{ backgroundColor: "var(--accent-red)" }}
                  />
                  Ditolak: {analyticsData?.accessValidation[1]?.value ?? 0}
                </div>
              </div>
            </div>
          </section>

          {/* Avg Travel Time */}
          <section className={styles.chartSection} style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h2 className={styles.chartTitle}>
                Avg Travel Time - Hourly Trend
              </h2>
              <ExportButton
                data={getFilteredData(
                  latencyData,
                  latencyStartDate,
                  latencyEndDate,
                )}
                filename="avg-travel-time"
              />
            </div>
            <DateFilterControl
              startDate={latencyStartDate}
              setStartDate={setLatencyStartDate}
              endDate={latencyEndDate}
              setEndDate={setLatencyEndDate}
            />
            <ResponsiveContainer width="100%" height={250}>
              <LineChart
                data={getFilteredData(
                  latencyData,
                  latencyStartDate,
                  latencyEndDate,
                )}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 200]}
                />
                <Tooltip
                  formatter={(value: any) =>
                    value !== undefined ? formatTravelTime(Number(value)) : ""
                  }
                  contentStyle={{
                    backgroundColor: "var(--surface-1)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "var(--text-main)" }}
                />
                <Line
                  type="monotone"
                  dataKey="seconds"
                  stroke="var(--accent-yellow)"
                  strokeWidth={3}
                  dot={{ fill: "var(--accent-yellow)", r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* Weekly Traffic Heatmap */}
        <section className={styles.chartSection} style={{ marginTop: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h2 className={styles.chartTitle}>WEEKLY TRAFFIC HEATMAP</h2>
            <ExportButton
              data={getFilteredData(
                weeklyTrafficData,
                heatmapStartDate,
                heatmapEndDate,
              )}
              filename="weekly-traffic-heatmap"
            />
          </div>
          <DateFilterControl
            startDate={heatmapStartDate}
            setStartDate={setHeatmapStartDate}
            endDate={heatmapEndDate}
            setEndDate={setHeatmapEndDate}
          />
          <div style={{ padding: "0 20px" }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={getFilteredData(
                  weeklyTrafficData,
                  heatmapStartDate,
                  heatmapEndDate,
                )}
                barGap={8}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="var(--text-muted)"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 800]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-1)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Bar
                  dataKey="00:00 - 06:00"
                  stackId="a"
                  fill="var(--accent-purple)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="06:00 - 12:00"
                  stackId="a"
                  fill="var(--accent-cyan)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="12:00 - 18:00"
                  stackId="a"
                  fill="var(--accent-yellow)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="18:00 - 24:00"
                  stackId="a"
                  fill="var(--accent-green)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            <div
              className={styles.pieLegend}
              style={{
                justifyContent: "center",
                marginTop: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "var(--accent-purple)" }}
                />{" "}
                00:00 - 06:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "var(--accent-cyan)" }}
                />{" "}
                06:00 - 12:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "var(--accent-yellow)" }}
                />{" "}
                12:00 - 18:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "var(--accent-green)" }}
                />{" "}
                18:00 - 24:00
              </div>
            </div>
          </div>
        </section>

        {/* Total Revenue — data real dari gate KELUAR */}
        <section className={styles.chartSection} style={{ marginTop: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h2 className={styles.chartTitle}>
              TOTAL Revenue - Daily (Gate Keluar)
            </h2>
            <ExportButton
              data={analyticsData?.revenueHarian ?? []}
              filename="total-revenue-daily"
            />
          </div>
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--text-faint)",
              margin: "0 0 1rem",
            }}
          >
            Menggunakan rentang tanggal yang sama dengan Traffic Volume
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analyticsData?.revenueHarian ?? []}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
                vertical={false}
              />
              <XAxis
                dataKey="tanggal"
                stroke="var(--text-muted)"
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: any) => [
                  `Rp ${Number(value).toLocaleString("id-ID")}`,
                  "Revenue",
                ]}
                contentStyle={{
                  backgroundColor: "var(--surface-1)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                }}
                itemStyle={{ color: "var(--text-main)" }}
              />
              <Bar
                dataKey="revenue"
                fill="var(--accent-green)"
                radius={[4, 4, 0, 0]}
                barSize={40}
                name="Revenue"
              />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <div style={{ height: "50px" }} />
      </main>
    </div>
  );
};

export default AnalyticsPage;
