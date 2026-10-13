"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";
import { SubjectAttendance } from "../../types/attendance";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TodayClass {
  slot_index: number;
  time: string;
  subject_code: string;
  subject_name: string;
  type: string;
  room: string;
  faculty: string;
  percentage?: number;
  bunk_budget?: number;
  status?: string;
  attended?: number;
  conducted?: number;
}

interface TodayData {
  today: {
    date: string;
    day: number;
    weekday: string;
    weekday_full: string;
    is_past: boolean;
    is_today: boolean;
    is_teaching: boolean;
    reason: string | null;
    note: string | null;
    classes: TodayClass[];
    plan_summary: {
      total_classes: number;
      planned_attend: number;
      planned_skip: number;
      mode: "all_attend" | "all_skip" | "custom" | "none";
      is_planned: boolean;
    };
    day_plan?: {
      mode: "all_attend" | "all_skip" | "custom";
      slots: Record<string, "attend" | "bunk">;
      updated_at?: string;
    };
  } | null;
  saved_plan?: {
    mode: "all_attend" | "all_skip" | "custom";
    slots: Record<string, "attend" | "bunk">;
  };
  all_plans?: Record<string, any>;
  date_str: string;
  formatted_date: string;
}

type SlotAction = "attend" | "bunk";

export default function Dashboard() {
  const [data, setData] = useState<SubjectAttendance[]>([]);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [todaySlots, setTodaySlots] = useState<Record<string, SlotAction>>({});
  const [todayMode, setTodayMode] = useState<"all_attend" | "all_skip" | "custom" | "none">("none");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Fetch Attendance & Today's Plan concurrently
  useEffect(() => {
    Promise.all([
      fetchApi("/api/attendance"),
      fetchApi("/api/weekly/today").catch((err) => {
        console.warn("Failed to fetch today's plan:", err);
        return null;
      }),
    ])
      .then(([attRes, tRes]) => {
        setData(attRes);
        setLastUpdated(new Date().toLocaleTimeString());

        if (tRes && tRes.today) {
          setTodayData(tRes);

          // Restore plan from server or localStorage backup
          let currentSlots: Record<string, SlotAction> = tRes.saved_plan?.slots || {};
          let currentMode: "all_attend" | "all_skip" | "custom" | "none" = tRes.saved_plan?.mode || "none";

          try {
            const localStored = localStorage.getItem("attendwise_monthly_plans");
            if (localStored) {
              const parsed = JSON.parse(localStored);
              if (parsed[todayStr]) {
                currentSlots = { ...currentSlots, ...(parsed[todayStr].slots || {}) };
                if (parsed[todayStr].mode) {
                  currentMode = parsed[todayStr].mode;
                }
              }
            }
          } catch {
            // ignore localStorage parsing errors
          }

          setTodaySlots(currentSlots);
          setTodayMode(currentMode);
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load dashboard data.");
        setLoading(false);
      });
  }, [todayStr]);

  // Persist Today's Plan to Backend & LocalStorage
  const persistTodayPlan = useCallback(
    async (
      slots: Record<string, SlotAction>,
      mode: "all_attend" | "all_skip" | "custom"
    ) => {
      setSaveStatus("saving");
      try {
        const dayPlan = {
          mode,
          slots,
          updated_at: new Date().toISOString(),
        };

        // Update localStorage
        let existingPlans: Record<string, any> = {};
        try {
          const raw = localStorage.getItem("attendwise_monthly_plans");
          if (raw) existingPlans = JSON.parse(raw);
        } catch {
          // ignore
        }
        existingPlans[todayStr] = dayPlan;
        localStorage.setItem("attendwise_monthly_plans", JSON.stringify(existingPlans));

        // Call backend API
        await fetchApi("/api/weekly/plan", {
          method: "POST",
          body: JSON.stringify({
            date: todayStr,
            day_plan: dayPlan,
          }),
        });

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.warn("Error persisting today plan to backend:", err);
        setSaveStatus("idle");
      }
    },
    [todayStr]
  );

  // Toggle individual slot decision
  const handleSlotToggle = (slotIndex: number, action: SlotAction) => {
    const classes = todayData?.today?.classes || [];
    if (classes.length === 0) return;

    const newSlots = { ...todaySlots, [slotIndex]: action };

    // Compute whole day status
    const total = classes.length;
    const attends = Object.values(newSlots).filter((v) => v === "attend").length;
    const bunks = Object.values(newSlots).filter((v) => v === "bunk").length;

    let mode: "all_attend" | "all_skip" | "custom" = "custom";
    if (attends === total) mode = "all_attend";
    else if (bunks === total) mode = "all_skip";

    setTodaySlots(newSlots);
    setTodayMode(mode);
    persistTodayPlan(newSlots, mode);
  };

  // Whole Day Action: Attend All
  const handleAttendAll = () => {
    const classes = todayData?.today?.classes || [];
    if (classes.length === 0) return;

    const newSlots: Record<string, SlotAction> = {};
    classes.forEach((_, idx) => {
      newSlots[idx] = "attend";
    });

    setTodaySlots(newSlots);
    setTodayMode("all_attend");
    persistTodayPlan(newSlots, "all_attend");
  };

  // Whole Day Action: Skip Entire Day
  const handleSkipEntireDay = () => {
    const classes = todayData?.today?.classes || [];
    if (classes.length === 0) return;

    const newSlots: Record<string, SlotAction> = {};
    classes.forEach((_, idx) => {
      newSlots[idx] = "bunk";
    });

    setTodaySlots(newSlots);
    setTodayMode("all_skip");
    persistTodayPlan(newSlots, "all_skip");
  };

  // Reset Today's Plan
  const handleResetDay = async () => {
    setTodaySlots({});
    setTodayMode("none");
    setSaveStatus("saving");

    try {
      // Remove from localStorage
      try {
        const raw = localStorage.getItem("attendwise_monthly_plans");
        if (raw) {
          const parsed = JSON.parse(raw);
          delete parsed[todayStr];
          localStorage.setItem("attendwise_monthly_plans", JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }

      await fetchApi("/api/weekly/plan/reset", {
        method: "POST",
        body: JSON.stringify({ date: todayStr }),
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.warn("Failed to reset today plan:", err);
      setSaveStatus("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10 mx-auto text-muted">
          Fetching live attendance and timetable data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10 mx-auto text-danger">
          {error}
        </div>
      </div>
    );
  }

  const safeCount = data.filter((d) => d.status === "Safe").length;
  const riskCount = data.length - safeCount;
  const avgAttendance =
    data.length > 0
      ? (data.reduce((acc, curr) => acc + curr.percentage, 0) / data.length).toFixed(1)
      : "0.0";

  const chartData = {
    labels: data.map((d) => d.subject),
    datasets: [
      {
        data: data.map((d) => d.percentage),
        backgroundColor: data.map((d) =>
          d.percentage >= 80 ? "#3ecf8e" : d.percentage >= 75 ? "#f5a623" : "#f05c5c"
        ),
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#13161d",
        borderColor: "#2e3347",
        borderWidth: 1,
        titleColor: "#e4e6f0",
        bodyColor: "#6b7191",
        callbacks: { label: (ctx: any) => ` ${ctx.parsed.y}%` },
      },
    },
    scales: {
      x: { ticks: { color: "#6b7191", font: { size: 11 } }, grid: { color: "#1f2330" } },
      y: {
        min: 0,
        max: 100,
        ticks: { color: "#6b7191", font: { size: 11 }, callback: (v: any) => v + "%" },
        grid: { color: "#1f2330" },
      },
    },
  };

  const todayClasses = todayData?.today?.classes || [];
  const totalTodayClasses = todayClasses.length;
  const plannedAttends = Object.values(todaySlots).filter((v) => v === "attend").length;
  const plannedSkips = Object.values(todaySlots).filter((v) => v === "bunk").length;
  const hasPlan = Object.keys(todaySlots).length > 0;

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-[1440px] px-4 sm:px-6 lg:px-8 py-7 mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Attendance Overview</h1>
            <p className="text-[13px] text-muted mt-0.5">Live ERP data · Updated at {lastUpdated}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/weekly"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface2 text-accent text-[13px] font-medium transition-colors"
            >
              <span>Monthly Planner</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* 1. Stats Grid (Across full available width) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">
              Total Subjects
            </div>
            <div className="text-[28px] font-bold font-mono leading-none text-accent">
              {data.length}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">
              Safe Subjects
            </div>
            <div className="text-[28px] font-bold font-mono leading-none text-success">
              {safeCount}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">
              At Risk
            </div>
            <div className="text-[28px] font-bold font-mono leading-none text-danger">
              {riskCount}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">
              Avg Attendance
            </div>
            <div className="text-[28px] font-bold font-mono leading-none text-text">
              {avgAttendance}%
            </div>
          </div>
        </div>

        {/* 2. Middle Section: Today's Plan + Attendance Distribution (Balanced 2-Column Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-start">
          {/* Column A: Dedicated Today's Plan Card (7 cols) */}
          <div className="lg:col-span-7 bg-surface border border-border rounded-xl p-6 flex flex-col gap-5">
            {/* Today's Plan Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent font-mono">
                    Today&apos;s Plan
                  </span>
                  {saveStatus === "saving" && (
                    <span className="text-[11px] text-muted animate-pulse">Saving...</span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-[11px] text-success font-medium">✓ Saved</span>
                  )}
                </div>
                <h2 className="text-[17px] font-bold text-text mt-0.5">
                  {todayData?.formatted_date || new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </h2>
              </div>

              {/* Status summary & link to monthly */}
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full bg-surface2 border border-border text-[11.5px] font-medium font-mono text-muted">
                  {totalTodayClasses > 0
                    ? `${totalTodayClasses} ${totalTodayClasses === 1 ? "class" : "classes"} · ${plannedAttends} attend · ${plannedSkips} skip`
                    : "No classes scheduled"}
                </span>
                <Link
                  href="/weekly"
                  className="text-[12px] font-medium text-accent hover:underline whitespace-nowrap"
                >
                  Plan Other Dates &rarr;
                </Link>
              </div>
            </div>

            {/* Whole-Day Presets & Controls */}
            {totalTodayClasses > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-surface2/60 border border-border/80 rounded-lg p-3">
                <span className="text-[12px] font-medium text-muted">Whole-day actions:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAttendAll}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                      todayMode === "all_attend"
                        ? "bg-success text-white shadow-sm"
                        : "bg-surface border border-border hover:border-success/50 text-text"
                    }`}
                  >
                    Attend All
                  </button>
                  <button
                    onClick={handleSkipEntireDay}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                      todayMode === "all_skip"
                        ? "bg-danger text-white shadow-sm"
                        : "bg-surface border border-border hover:border-danger/50 text-text"
                    }`}
                  >
                    Skip Entire Day
                  </button>
                  {hasPlan && (
                    <button
                      onClick={handleResetDay}
                      className="px-2.5 py-1.5 rounded-md text-[12px] text-muted hover:text-text hover:bg-border transition-colors"
                      title="Reset today's decisions"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Classes List or Empty State */}
            {todayData?.today?.reason ? (
              <div className="p-8 border border-border rounded-xl text-center bg-surface2/30 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">🏖️</span>
                <div className="text-[15px] font-semibold text-text">Non-Teaching Day</div>
                <div className="text-[13px] text-muted max-w-sm">{todayData.today.reason}</div>
              </div>
            ) : totalTodayClasses === 0 ? (
              <div className="p-8 border border-border rounded-xl text-center bg-surface2/30 text-muted text-[13.5px]">
                No classes scheduled for today.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {todayClasses.map((cls, idx) => {
                  const decision = todaySlots[idx];
                  const isAttend = decision === "attend";
                  const isSkip = decision === "bunk";

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isAttend
                          ? "bg-success/5 border-success/30"
                          : isSkip
                          ? "bg-danger/5 border-danger/30"
                          : "bg-surface2/40 border-border hover:border-border-hi"
                      }`}
                    >
                      {/* Left info */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-accent font-semibold text-[12px]">
                            {cls.time}
                          </span>
                          <span className="px-1.5 py-0.5 bg-surface border border-border text-muted text-[10px] font-semibold rounded uppercase">
                            {cls.type === "P" ? "Practical" : cls.type === "L" ? "Lecture" : cls.type}
                          </span>
                          {cls.percentage !== undefined && (
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                cls.percentage >= 80
                                  ? "text-success"
                                  : cls.percentage >= 75
                                  ? "text-warning"
                                  : "text-danger"
                              }`}
                            >
                              Current: {cls.percentage.toFixed(1)}%
                            </span>
                          )}
                          {cls.bunk_budget !== undefined && (
                            <span className="text-[11px] text-muted font-mono">
                              ({cls.bunk_budget} {cls.bunk_budget === 1 ? "bunk left" : "bunks left"})
                            </span>
                          )}
                        </div>

                        <div className="font-semibold text-[14px] text-text truncate">
                          {cls.subject_name}
                        </div>

                        <div className="text-[12px] text-muted flex items-center gap-2">
                          <span className="font-mono">{cls.subject_code}</span>
                          {cls.room && (
                            <>
                              <span>•</span>
                              <span>Room {cls.room}</span>
                            </>
                          )}
                          {cls.faculty && (
                            <>
                              <span>•</span>
                              <span className="truncate">{cls.faculty}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right decision toggle buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <button
                          onClick={() => handleSlotToggle(idx, "attend")}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all inline-flex items-center gap-1.5 ${
                            isAttend
                              ? "bg-success/20 text-success border border-success/40 shadow-sm"
                              : "bg-surface border border-border text-muted hover:text-text hover:bg-border"
                          }`}
                        >
                          <span>✓</span>
                          <span>Attend</span>
                        </button>
                        <button
                          onClick={() => handleSlotToggle(idx, "bunk")}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all inline-flex items-center gap-1.5 ${
                            isSkip
                              ? "bg-danger/20 text-danger border border-danger/40 shadow-sm"
                              : "bg-surface border border-border text-muted hover:text-text hover:bg-border"
                          }`}
                        >
                          <span>✕</span>
                          <span>Skip</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column B: Attendance Distribution & Calendar Shortcut (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Chart Card */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-[14px]">Attendance Distribution</div>
                <span className="text-[11px] text-muted font-mono">{data.length} subjects</span>
              </div>
              <div className="h-[210px] relative">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Calendar Quick Link */}
            <Link
              href="/calendar"
              className="bg-surface border border-border rounded-xl p-5 hover:border-border-hi transition-colors block group"
            >
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-text group-hover:text-accent transition-colors">
                    View Attendance Calendar
                  </span>
                  <span className="text-[12.5px] text-muted">
                    Explore daily class history and filter by subjects
                  </span>
                </div>
                <div className="text-accent text-[20px] font-mono group-hover:translate-x-1 transition-transform">
                  &rarr;
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 3. Lower Section: Attendance Summary Table (Full Width) */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2.5 mb-4 font-semibold text-[14px]">
            Attendance Summary
            <span className="text-[11px] font-medium bg-border text-muted px-2 py-0.5 rounded-full font-mono">
              {data.length} subjects
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Subject
                  </th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Attendance
                  </th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Progress
                  </th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Bunk Budget
                  </th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Recovery
                  </th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const pct = s.percentage;
                  const isSafe = s.status === "Safe";
                  const isBelow = s.status === "Below Threshold";
                  const pillCls = isSafe
                    ? "text-success bg-success/10"
                    : isBelow
                    ? "text-danger bg-danger/10"
                    : "text-warning bg-warning/10";
                  const pillLabel = isSafe ? "Safe" : isBelow ? "Below 75%" : "Warning";

                  return (
                    <tr
                      key={s.code}
                      className="border-b border-border hover:bg-surface2 transition-colors last:border-b-0"
                    >
                      <td className="p-3.5 font-medium text-[13.5px]">
                        <Link href={`/subject/${s.code}`} className="hover:underline">
                          {s.subject}
                        </Link>
                      </td>
                      <td
                        className={`p-3.5 font-mono font-semibold text-[13.5px] ${
                          pct >= 80 ? "text-success" : pct >= 75 ? "text-warning" : "text-danger"
                        }`}
                      >
                        {pct}%
                      </td>
                      <td className="p-3.5">
                        <div className="h-[5px] w-full bg-border rounded-full overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 80 ? "bg-success" : pct >= 75 ? "bg-warning" : "bg-danger"
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-[13.5px]">{s.bunk_budget}</td>
                      <td
                        className={`p-3.5 font-mono text-[13.5px] ${
                          s.recovery_classes > 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {s.recovery_classes}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${pillCls}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSafe ? "bg-success" : isBelow ? "bg-danger" : "bg-warning"
                            }`}
                          />
                          {pillLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
