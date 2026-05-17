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
    backgroundColor: "rgba(15,23,42,0.7)",
    borderColor: "rgba(30,41,59,0.9)",
    color: "#64748b",
  },
  chipActive: {
    backgroundColor: "rgba(0,212,255,0.1)",
    borderColor: "rgba(0,212,255,0.5)",
    color: "#00d4ff",
  },
  divider: {
    width: "1px",
    height: "20px",
    backgroundColor: "rgba(30,41,59,0.9)",
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
    border: "1px solid rgba(30,41,59,0.9)",
    backgroundColor: "rgba(15,23,42,0.7)",
    color: "#94a3b8",
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
    color: "#475569",
    backgroundColor: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(30,41,59,0.6)",
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
    backgroundColor: "#0a1628",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: "8px",
    padding: "1rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: "280px",
  },
  popoverLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#334155",
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
    color: "#64748b",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    width: "28px",
    flexShrink: 0,
  },
  dateInput: {
    flex: 1,
    padding: "0.5rem 0.65rem",
    borderRadius: "5px",
    border: "1px solid rgba(30,41,59,0.9)",
    backgroundColor: "#060e1e",
    color: "#e2e8f0",
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
    border: "1px solid rgba(0,212,255,0.4)",
    backgroundColor: "rgba(0,212,255,0.1)",
    color: "#00d4ff",
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
    border: "1px solid rgba(30,41,59,0.9)",
    backgroundColor: "rgba(15,23,42,0.7)",
    color: "#475569",
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
                e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)";
                e.currentTarget.style.color = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!isPresetActive(p)) {
                e.currentTarget.style.borderColor = "rgba(30,41,59,0.9)";
                e.currentTarget.style.color = "#64748b";
              }
            }}
          >
            {isPresetActive(p) && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: "#00d4ff",
                  boxShadow: "0 0 6px #00d4ff",
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
                    borderColor: "rgba(0,212,255,0.5)",
                    color: "#00d4ff",
                    backgroundColor: "rgba(0,212,255,0.08)",
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
                          borderColor: "rgba(0,212,255,0.5)",
                          boxShadow: "0 0 0 2px rgba(0,212,255,0.1)",
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
                          borderColor: "rgba(0,212,255,0.5)",
                          boxShadow: "0 0 0 2px rgba(0,212,255,0.1)",
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
                    color: "#ef4444",
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
                  e.currentTarget.style.backgroundColor = "rgba(0,212,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0,212,255,0.1)";
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
            e.currentTarget.style.borderColor = "rgba(100,116,139,0.5)";
            e.currentTarget.style.color = "#94a3b8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(30,41,59,0.9)";
            e.currentTarget.style.color = "#475569";
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
  { date: todayStr(), name: "Accepted", value: 1847, fill: "#10b981" },
  { date: todayStr(), name: "Rejected", value: 153, fill: "#ef4444" },
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
      border: "1px solid rgba(148, 163, 184, 0.3)",
      backgroundColor: "rgba(148, 163, 184, 0.08)",
      color: "#cbd5e1",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff";
      (e.currentTarget as HTMLElement).style.backgroundColor =
        "rgba(0, 212, 255, 0.1)";
      (e.currentTarget as HTMLElement).style.color = "#00d4ff";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor =
        "rgba(148, 163, 184, 0.3)";
      (e.currentTarget as HTMLElement).style.backgroundColor =
        "rgba(148, 163, 184, 0.08)";
      (e.currentTarget as HTMLElement).style.color = "#cbd5e1";
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

  const [volumeStartDate, setVolumeStartDate] = useState(defaultStart);
  const [volumeEndDate, setVolumeEndDate] = useState(defaultEnd);
  const [validationStartDate, setValidationStartDate] = useState(defaultStart);
  const [validationEndDate, setValidationEndDate] = useState(defaultEnd);
  const [latencyStartDate, setLatencyStartDate] = useState(defaultStart);
  const [latencyEndDate, setLatencyEndDate] = useState(defaultEnd);
  const [heatmapStartDate, setHeatmapStartDate] = useState(defaultStart);
  const [heatmapEndDate, setHeatmapEndDate] = useState(defaultEnd);
  const [revenueStartDate, setRevenueStartDate] = useState(defaultStart);
  const [revenueEndDate, setRevenueEndDate] = useState(defaultEnd);

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

        {/* Top Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <TrendingUp size={16} />
              <span>Peak Hour</span>
            </div>
            <div className={`${styles.statValue} ${styles.textCyan}`}>
              16:00
            </div>
            <div className={styles.statMeta}>55 vehicles/hour</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Activity size={16} />
              <span>Avg Travel Time</span>
            </div>
            <div className={`${styles.statValue} ${styles.textGreen}`}>
              2m 32s
            </div>
            <div className={styles.statMeta}>Average toll duration</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Target size={16} />
              <span>Success Rate</span>
            </div>
            <div className={`${styles.statValue} ${styles.textPurple}`}>
              92.3%
            </div>
            <div className={styles.statMeta}>Acceptance ratio</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <Clock size={16} />
              <span>TOTAL Revenue</span>
            </div>
            <div className={`${styles.statValue} ${styles.textYellow}`}>
              Rp. 500,000
            </div>
            <div className={styles.statMeta}>Per day</div>
          </div>
        </div>

        {/* Volume Chart */}
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
              data={getFilteredData(volumeData, volumeStartDate, volumeEndDate)}
              filename="traffic-volume"
            />
          </div>
          <DateFilterControl
            startDate={volumeStartDate}
            setStartDate={setVolumeStartDate}
            endDate={volumeEndDate}
            setEndDate={setVolumeEndDate}
          />
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={getFilteredData(
                  volumeData,
                  volumeStartDate,
                  volumeEndDate,
                )}
              >
                <defs>
                  <linearGradient id="colorEntry" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Area
                  type="monotone"
                  dataKey="entry"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorEntry)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="exit"
                  stroke="#00d4ff"
                  fillOpacity={1}
                  fill="url(#colorExit)"
                  strokeWidth={2}
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
                style={{ backgroundColor: "#10b981" }}
              />{" "}
              Entry
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.dot}
                style={{ backgroundColor: "#00d4ff" }}
              />{" "}
              Exit
            </div>
          </div>
        </section>

        {/* Two Columns */}
        <div className={styles.chartRow}>
          {/* Access Validation */}
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
                data={getFilteredData(
                  validationData,
                  validationStartDate,
                  validationEndDate,
                )}
                filename="access-validation"
              />
            </div>
            <DateFilterControl
              startDate={validationStartDate}
              setStartDate={setValidationStartDate}
              endDate={validationEndDate}
              setEndDate={setValidationEndDate}
            />
            <div className={styles.pieContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={getFilteredData(
                      validationData,
                      validationStartDate,
                      validationEndDate,
                    )}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#0f172a"
                    strokeWidth={2}
                  >
                    {getFilteredData(
                      validationData,
                      validationStartDate,
                      validationEndDate,
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {getFilteredData(
                  validationData,
                  validationStartDate,
                  validationEndDate,
                ).length > 0 ? (
                  <>
                    <div className={styles.legendItem}>
                      <div
                        className={styles.dot}
                        style={{ backgroundColor: "#10b981" }}
                      />
                      Accepted:{" "}
                      {
                        getFilteredData(
                          validationData,
                          validationStartDate,
                          validationEndDate,
                        )[0]?.value
                      }
                    </div>
                    <div className={styles.legendItem}>
                      <div
                        className={styles.dot}
                        style={{ backgroundColor: "#ef4444" }}
                      />
                      Rejected:{" "}
                      {
                        getFilteredData(
                          validationData,
                          validationStartDate,
                          validationEndDate,
                        )[1]?.value
                      }
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#94a3b8" }}>
                    No data for selected date range
                  </div>
                )}
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
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
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
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Line
                  type="monotone"
                  dataKey="seconds"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: "#f59e0b", r: 5 }}
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
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#64748b"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 800]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Bar
                  dataKey="00:00 - 06:00"
                  stackId="a"
                  fill="#a855f7"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="06:00 - 12:00"
                  stackId="a"
                  fill="#00d4ff"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="12:00 - 18:00"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="18:00 - 24:00"
                  stackId="a"
                  fill="#10b981"
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
                  style={{ backgroundColor: "#a855f7" }}
                />{" "}
                00:00 - 06:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "#00d4ff" }}
                />{" "}
                06:00 - 12:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "#f59e0b" }}
                />{" "}
                12:00 - 18:00
              </div>
              <div className={styles.legendItem}>
                <div
                  className={styles.dot}
                  style={{ backgroundColor: "#10b981" }}
                />{" "}
                18:00 - 24:00
              </div>
            </div>
          </div>
        </section>

        {/* Total Revenue */}
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
            <h2 className={styles.chartTitle}>TOTAL Revenue - daily</h2>
            <ExportButton
              data={getFilteredData(
                queueData,
                revenueStartDate,
                revenueEndDate,
              )}
              filename="total-revenue-daily"
            />
          </div>
          <DateFilterControl
            startDate={revenueStartDate}
            setStartDate={setRevenueStartDate}
            endDate={revenueEndDate}
            setEndDate={setRevenueEndDate}
          />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={getFilteredData(
                queueData,
                revenueStartDate,
                revenueEndDate,
              )}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                dataKey="seg"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                barSize={60}
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
