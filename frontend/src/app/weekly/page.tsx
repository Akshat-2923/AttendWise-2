"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";
import { SubjectAttendance } from "../../types/attendance";

interface TimetableSlot {
  time: string;
  subject_code: string;
  subject_name: string;
  faculty: string;
  type: string;
  room: string;
}

interface TimetableData {
  [day: string]: TimetableSlot[];
}

interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  day: number;
  weekday: string;
  weekday_full: string;
  is_past: boolean;
  is_today: boolean;
  is_teaching: boolean;
  reason: string | null;
  note: string | null;
  classes: {
    slot_index: number;
    time: string;
    subject_code: string;
    subject_name: string;
    type: string;
    room: string;
    faculty: string;
  }[];
  plan_summary: {
    total_classes: number;
    planned_attend: number;
    planned_skip: number;
    mode: "all_attend" | "all_skip" | "custom" | "none";
    is_planned: boolean;
  };
}

interface MonthCalendarData {
  year: number;
  month: number;
  month_name: string;
  days: CalendarDay[];
  semester_start: string;
  semester_end: string;
  can_prev: boolean;
  can_next: boolean;
}

type SlotAction = "attend" | "bunk";

interface DayPlan {
  mode: "all_attend" | "all_skip" | "custom";
  slots: Record<string, SlotAction>;
  updated_at?: string;
}

type UserPlans = Record<string, DayPlan>;

interface ProjectedSubject {
  code: string;
  subject: string;
  orig_attended: number;
  orig_conducted: number;
  orig_percentage: number;
  attended: number;
  conducted: number;
  percentage: number;
  bunk_budget: number;
  recovery_classes: number;
  statusLabel: string;
  color: string;
  bg: string;
  planned_attends: number;
  planned_skips: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_FULL_MAP: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export default function MonthlyPlannerPage() {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [calendarData, setCalendarData] = useState<MonthCalendarData | null>(null);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [attendance, setAttendance] = useState<SubjectAttendance[]>([]);
  const [plans, setPlans] = useState<UserPlans>({});
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Format date helper: YYYY-MM-DD
  const formatDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => formatDateStr(today), [today]);

  // Initial Data Load
  useEffect(() => {
    Promise.all([
      fetchApi(`/api/weekly/month?year=${currentYear}&month=${currentMonth}`),
      fetchApi("/api/timetable"),
      fetchApi("/api/attendance"),
    ])
      .then(([monthRes, ttRes, attRes]) => {
        setCalendarData(monthRes.calendar);
        setTimetable(ttRes);
        setAttendance(attRes);

        const serverPlans = monthRes.saved_plan?.plans || {};
        
        // Check localStorage backup
        let mergedPlans = serverPlans;
        try {
          const localStored = localStorage.getItem("attendwise_monthly_plans");
          if (localStored) {
            const parsed = JSON.parse(localStored);
            mergedPlans = { ...parsed, ...serverPlans };
          }
        } catch {
          // ignore parsing error
        }

        setPlans(mergedPlans);

        // Select today if in current month, otherwise 1st day of month
        const hasToday = monthRes.calendar?.days?.some((d: CalendarDay) => d.date === todayStr);
        if (hasToday) {
          setSelectedDate(todayStr);
        } else if (monthRes.calendar?.days?.length > 0) {
          setSelectedDate(monthRes.calendar.days[0].date);
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load planner data:", err);
        setError("Failed to load monthly planner data. Please verify your connection.");
        setLoading(false);
      });
  }, [currentYear, currentMonth, todayStr]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (!calendarData?.can_prev) return;
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!calendarData?.can_next) return;
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  // Find Selected Day Info
  const selectedDay = useMemo(() => {
    if (!calendarData || !selectedDate) return null;
    return calendarData.days.find((d) => d.date === selectedDate) || null;
  }, [calendarData, selectedDate]);

  // Current decisions for selected date
  const selectedDayDecisions = useMemo(() => {
    if (!selectedDate || !plans[selectedDate]) return {};
    return plans[selectedDate].slots || {};
  }, [plans, selectedDate]);

  // Persist Plan to Backend & LocalStorage
  const persistPlans = useCallback(
    async (updatedPlans: UserPlans, targetDate?: string, targetDayPlan?: DayPlan) => {
      setSaveStatus("saving");
      try {
        localStorage.setItem("attendwise_monthly_plans", JSON.stringify(updatedPlans));
        
        if (targetDate && targetDayPlan) {
          await fetchApi("/api/weekly/plan", {
            method: "POST",
            body: JSON.stringify({
              date: targetDate,
              day_plan: targetDayPlan,
            }),
          });
        } else {
          await fetchApi("/api/weekly/plan", {
            method: "POST",
            body: JSON.stringify({ plans: updatedPlans }),
          });
        }

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (e) {
        console.warn("Backend save deferred to local storage:", e);
        setSaveStatus("idle");
      }
    },
    []
  );

  // Toggle individual class decision
  const handleSlotToggle = (slotIndex: number, action: SlotAction) => {
    if (!selectedDay || selectedDay.is_past) return;
    const dateStr = selectedDay.date;
    const currentSlots = { ...(plans[dateStr]?.slots || {}) };

    currentSlots[slotIndex] = action;

    // Check whole day mode
    const totalSlots = selectedDay.classes.length;
    const attends = Object.values(currentSlots).filter((v) => v === "attend").length;
    const bunks = Object.values(currentSlots).filter((v) => v === "bunk").length;

    let mode: "all_attend" | "all_skip" | "custom" = "custom";
    if (attends === totalSlots) mode = "all_attend";
    else if (bunks === totalSlots) mode = "all_skip";

    const dayPlan: DayPlan = {
      mode,
      slots: currentSlots,
      updated_at: new Date().toISOString(),
    };

    const newPlans: UserPlans = {
      ...plans,
      [dateStr]: dayPlan,
    };

    setPlans(newPlans);
    persistPlans(newPlans, dateStr, dayPlan);
  };

  // Whole-Day Action: Attend All Classes
  const handleAttendAll = () => {
    if (!selectedDay || selectedDay.is_past || selectedDay.classes.length === 0) return;
    const dateStr = selectedDay.date;
    const newSlots: Record<string, SlotAction> = {};

    selectedDay.classes.forEach((_, idx) => {
      newSlots[idx] = "attend";
    });

    const dayPlan: DayPlan = {
      mode: "all_attend",
      slots: newSlots,
      updated_at: new Date().toISOString(),
    };

    const newPlans: UserPlans = {
      ...plans,
      [dateStr]: dayPlan,
    };

    setPlans(newPlans);
    persistPlans(newPlans, dateStr, dayPlan);
  };

  // Whole-Day Action: Skip Entire Day
  const handleSkipEntireDay = () => {
    if (!selectedDay || selectedDay.is_past || selectedDay.classes.length === 0) return;
    const dateStr = selectedDay.date;
    const newSlots: Record<string, SlotAction> = {};

    selectedDay.classes.forEach((_, idx) => {
      newSlots[idx] = "bunk";
    });

    const dayPlan: DayPlan = {
      mode: "all_skip",
      slots: newSlots,
      updated_at: new Date().toISOString(),
    };

    const newPlans: UserPlans = {
      ...plans,
      [dateStr]: dayPlan,
    };

    setPlans(newPlans);
    persistPlans(newPlans, dateStr, dayPlan);
  };

  // Reset Selected Day's Plan
  const handleResetDay = () => {
    if (!selectedDay || selectedDay.is_past) return;
    const dateStr = selectedDay.date;
    const newPlans = { ...plans };
    delete newPlans[dateStr];

    setPlans(newPlans);
    persistPlans(newPlans, dateStr, { mode: "custom", slots: {} });
  };

  // Reset Entire Month Plans
  const handleResetAllPlans = async () => {
    if (!confirm("Are you sure you want to reset all planned attendance decisions?")) return;
    setPlans({});
    localStorage.removeItem("attendwise_monthly_plans");
    try {
      await fetchApi("/api/weekly/plan/reset", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {
      // ignore
    }
  };

  // Calculate Real-Time Projections across all planned upcoming dates
  const projected = useMemo(() => {
    if (!timetable || attendance.length === 0) return {};

    const proj: Record<string, ProjectedSubject> = {};

    // Initialize with actual attendance
    attendance.forEach((sub) => {
      proj[sub.code] = {
        code: sub.code,
        subject: sub.subject,
        orig_attended: sub.attended,
        orig_conducted: sub.conducted,
        orig_percentage: sub.percentage,
        attended: sub.attended,
        conducted: sub.conducted,
        percentage: sub.percentage,
        bunk_budget: sub.bunk_budget,
        recovery_classes: sub.recovery_classes,
        statusLabel: sub.status,
        color: "text-success",
        bg: "bg-success/10 border-success/30",
        planned_attends: 0,
        planned_skips: 0,
      };
    });

    // Helper to find matching subject code (hyphen-agnostic)
    const findProjCode = (slotCode: string): string | null => {
      const sClean = slotCode.trim().toUpperCase().replace("-", "");
      for (const k of Object.keys(proj)) {
        if (k.trim().toUpperCase().replace("-", "") === sClean) {
          return k;
        }
      }
      return null;
    };

    // Iterate through all planned dates that are upcoming (today or future)
    Object.entries(plans).forEach(([dateStr, dayPlan]) => {
      if (dateStr < todayStr) return; // Ignore past dates

      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekdayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];

      // Check if day has slots in timetable
      const slots = timetable[weekdayAbbr] || [];
      if (!slots || slots.length === 0) return;

      const slotMap = dayPlan.slots || {};

      slots.forEach((slot, idx) => {
        const pKey = findProjCode(slot.subject_code);
        if (!pKey || !proj[pKey]) return;

        const action = slotMap[idx] || "attend";
        proj[pKey].conducted += 1;

        if (action === "attend") {
          proj[pKey].attended += 1;
          proj[pKey].planned_attends += 1;
        } else {
          proj[pKey].planned_skips += 1;
        }
      });
    });

    // Recompute percentage, bunk budget, and status
    Object.keys(proj).forEach((code) => {
      const p = proj[code];
      p.percentage = p.conducted > 0 ? (p.attended / p.conducted) * 100 : 0;

      const rawBudget = Math.floor((p.attended - 0.75 * p.conducted) / 0.75);
      p.bunk_budget = Math.max(0, rawBudget);

      const rawRecovery = Math.ceil((0.75 * p.conducted - p.attended) / 0.25);
      p.recovery_classes = p.percentage >= 75 ? 0 : Math.max(0, rawRecovery);

      if (p.percentage >= 80 && p.bunk_budget >= 2) {
        p.statusLabel = "SAFE";
        p.color = "text-success";
        p.bg = "bg-success/10 border-success/30";
      } else if (p.percentage >= 75) {
        p.statusLabel = "RISKY";
        p.color = "text-warning";
        p.bg = "bg-warning/10 border-warning/30";
      } else {
        p.statusLabel = "MUST ATTEND";
        p.color = "text-danger";
        p.bg = "bg-danger/10 border-danger/30";
      }
    });

    return proj;
  }, [plans, timetable, attendance, todayStr]);

  // Overall Totals
  const totals = useMemo(() => {
    let totalPlannedClasses = 0;
    let totalPlannedAttend = 0;
    let totalPlannedSkip = 0;

    Object.entries(plans).forEach(([dateStr, dayPlan]) => {
      if (dateStr < todayStr) return;
      const slots = dayPlan.slots || {};
      Object.values(slots).forEach((act) => {
        totalPlannedClasses++;
        if (act === "bunk") totalPlannedSkip++;
        else totalPlannedAttend++;
      });
    });

    let safeBunksTotal = 0;
    Object.values(projected).forEach((p) => {
      safeBunksTotal += p.bunk_budget;
    });

    return {
      totalPlannedClasses,
      totalPlannedAttend,
      totalPlannedSkip,
      safeBunksTotal,
    };
  }, [plans, projected, todayStr]);

  // Identify dates that have an unsafe plan (where a planned bunk makes attendance < 75%)
  const unsafeDateSet = useMemo(() => {
    const unsafe = new Set<string>();

    Object.entries(plans).forEach(([dateStr, dayPlan]) => {
      if (dateStr < todayStr) return;
      const slots = dayPlan.slots || {};
      const hasBunk = Object.values(slots).some((a) => a === "bunk");
      if (!hasBunk) return;

      // Check if any subject has MUST ATTEND in projected
      const hasMustAttend = Object.values(projected).some(
        (p) => p.statusLabel === "MUST ATTEND" && p.planned_skips > 0
      );
      if (hasMustAttend) {
        unsafe.add(dateStr);
      }
    });

    return unsafe;
  }, [plans, projected, todayStr]);

type CalendarCell =
  | { isBlank: true; id: string }
  | { isBlank: false; day: CalendarDay };

  // Calendar Grid Cells (pad leading blank cells before day 1)
  const calendarCells: CalendarCell[] = useMemo(() => {
    if (!calendarData) return [];

    const firstDateObj = new Date(currentYear, currentMonth - 1, 1);
    // getDay() gives 0 for Sunday, 1 for Monday... 6 for Saturday
    // Convert to Monday=0..Sunday=6
    const leadingBlanks = (firstDateObj.getDay() + 6) % 7;

    const blanks: CalendarCell[] = Array.from({ length: leadingBlanks }, (_, i) => ({
      isBlank: true,
      id: `blank-${i}`,
    }));

    const days: CalendarCell[] = calendarData.days.map((day) => ({
      isBlank: false,
      day,
    }));

    return [...blanks, ...days];
  }, [calendarData, currentYear, currentMonth]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1240px] mx-auto text-muted flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Monthly Attendance Planner...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1240px] mx-auto">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[14px]">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <Nav />
      <div className="p-5 md:p-7 max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Monthly Attendance Planner</h1>
            <p className="text-[13px] text-muted mt-1">
              Select upcoming dates in your calendar, schedule your attendance, and see projected forecasts
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-[12px] text-muted flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span> Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[12px] text-success font-semibold flex items-center gap-1">
                ✓ Saved
              </span>
            )}

            <button
              onClick={handleResetAllPlans}
              className="px-3.5 py-2 bg-surface2 hover:bg-surface border border-border rounded-lg text-[13px] font-semibold text-muted hover:text-text transition-colors"
            >
              Reset All
            </button>
            <button
              onClick={() => persistPlans(plans)}
              className="px-4 py-2 bg-accent hover:bg-accent-hi text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2"
            >
              Save Plan
            </button>
          </div>
        </div>

        {/* Top Analytics Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4 mb-7">
          <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Planned Classes
            </div>
            <div className="text-[26px] md:text-[28px] font-bold font-mono text-text">
              {totals.totalPlannedClasses}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Planned Attend
            </div>
            <div className="text-[26px] md:text-[28px] font-bold font-mono text-accent">
              {totals.totalPlannedAttend}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Planned Skips
            </div>
            <div className="text-[26px] md:text-[28px] font-bold font-mono text-warning">
              {totals.totalPlannedSkip}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Safe Bunks Left
            </div>
            <div className="text-[26px] md:text-[28px] font-bold font-mono text-success">
              {totals.safeBunksTotal}
            </div>
          </div>
        </div>

        {/* Main 3-Column Layout: Calendar (Left), Selected Day Panel (Center), Projections (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SECTION 1: Monthly Calendar (Cols 1-7) */}
          <div className="lg:col-span-7 bg-surface border border-border rounded-xl p-5 md:p-6">
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[17px] font-bold tracking-tight">
                  {calendarData?.month_name} {currentYear}
                </h2>
                <button
                  onClick={handleJumpToToday}
                  className="px-2 py-0.5 text-[11px] font-medium bg-surface2 border border-border rounded hover:bg-border transition-colors text-muted hover:text-text"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  disabled={!calendarData?.can_prev}
                  className="w-8 h-8 rounded-lg bg-surface2 border border-border hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-text transition-colors"
                  aria-label="Previous Month"
                >
                  &larr;
                </button>
                <button
                  onClick={handleNextMonth}
                  disabled={!calendarData?.can_next}
                  className="w-8 h-8 rounded-lg bg-surface2 border border-border hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-text transition-colors"
                  aria-label="Next Month"
                >
                  &rarr;
                </button>
              </div>
            </div>

            {/* Weekday Grid Labels */}
            <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2 text-center">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-[11px] font-semibold text-muted uppercase tracking-wider py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Day Grid */}
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {calendarCells.map((cell, idx) => {
                if (cell.isBlank) {
                  return (
                    <div
                      key={cell.id}
                      className="min-h-[72px] md:min-h-[82px] rounded-lg bg-surface2/20 border border-transparent opacity-30"
                    />
                  );
                }

                const day = cell.day;
                const isSelected = selectedDate === day.date;
                const isPast = day.is_past;
                const isToday = day.is_today;
                const hasClasses = day.classes.length > 0;
                const planState = plans[day.date];
                const isUnsafe = unsafeDateSet.has(day.date);

                // Determine indicator on tile
                let badgeLabel: string | null = null;
                let badgeClass = "";

                if (day.reason && !day.is_teaching) {
                  badgeLabel = day.reason.includes("Holiday")
                    ? "Holiday"
                    : day.reason.includes("Mid-Sem")
                    ? "Exam"
                    : day.reason.includes("Sunday")
                    ? "Off"
                    : "Off";
                  badgeClass = "bg-border text-muted";
                } else if (hasClasses) {
                  if (planState) {
                    if (planState.mode === "all_skip") {
                      badgeLabel = "All Skip";
                      badgeClass = "bg-warning/20 text-warning border border-warning/30";
                    } else if (planState.mode === "all_attend") {
                      badgeLabel = "All Attend";
                      badgeClass = "bg-success/20 text-success border border-success/30";
                    } else {
                      const total = day.classes.length;
                      const att = Object.values(planState.slots || {}).filter(
                        (v) => v === "attend"
                      ).length;
                      badgeLabel = `${att}/${total} Attend`;
                      badgeClass = "bg-accent/20 text-accent border border-accent/30";
                    }
                  } else if (!isPast) {
                    badgeLabel = `${day.classes.length} cls`;
                    badgeClass = "bg-surface2 text-muted";
                  }
                }

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`min-h-[72px] md:min-h-[82px] p-1.5 md:p-2 rounded-xl flex flex-col justify-between text-left transition-all relative border
                      ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-[0_0_12px_rgba(79,110,247,0.2)]"
                          : isToday
                          ? "border-accent/50 bg-surface2 hover:bg-surface2/80"
                          : isPast
                          ? "border-border/40 bg-surface2/30 opacity-60 hover:opacity-80"
                          : "border-border bg-surface hover:bg-surface2"
                      }
                      ${isUnsafe ? "ring-1 ring-danger/50" : ""}
                    `}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span
                        className={`text-[12px] md:text-[13px] font-bold font-mono
                          ${
                            isToday
                              ? "text-accent bg-accent/20 px-1.5 py-0.2 rounded"
                              : isSelected
                              ? "text-text"
                              : isPast
                              ? "text-muted"
                              : "text-text"
                          }
                        `}
                      >
                        {day.day}
                      </span>

                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1 mr-0.5" />
                      )}
                      {isUnsafe && (
                        <span
                          className="w-2 h-2 rounded-full bg-danger animate-ping"
                          title="Unsafe Skip planned!"
                        />
                      )}
                    </div>

                    {/* Compact Tile Indicator */}
                    <div className="w-full mt-1">
                      {badgeLabel && (
                        <span
                          className={`text-[9px] md:text-[10px] font-medium px-1 md:px-1.5 py-0.5 rounded truncate block text-center ${badgeClass}`}
                        >
                          {badgeLabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-4 text-[11px] text-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent"></span>
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                <span>All Attend</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warning"></span>
                <span>All Skip</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-danger"></span>
                <span>Unsafe Skip</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-border"></span>
                <span>Holiday / Off</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Selected Date Class Management Panel (Cols 8-12) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface border border-border rounded-xl p-5 md:p-6">
              {/* Selected Date Header */}
              {selectedDay ? (
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        Selected Date
                      </div>
                      <h2 className="text-[18px] font-bold text-text mt-0.5">
                        {selectedDay.weekday_full}, {selectedDay.day}{" "}
                        {calendarData?.month_name} {currentYear}
                      </h2>
                    </div>

                    {selectedDay.is_today && (
                      <span className="text-[11px] bg-accent/20 text-accent font-semibold px-2 py-0.5 rounded">
                        Today
                      </span>
                    )}
                    {selectedDay.is_past && (
                      <span className="text-[11px] bg-border text-muted font-medium px-2 py-0.5 rounded">
                        Past Date
                      </span>
                    )}
                  </div>

                  {/* Non-Teaching Day Reason or Note */}
                  {selectedDay.reason && (
                    <div className="mb-4 p-3 rounded-lg bg-surface2 border border-border text-[12.5px] text-muted flex items-center gap-2">
                      <span>ℹ️</span>
                      <span>{selectedDay.reason}</span>
                    </div>
                  )}

                  {selectedDay.note && (
                    <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-[12.5px] text-accent flex items-center gap-2 font-medium">
                      <span>📅</span>
                      <span>{selectedDay.note}</span>
                    </div>
                  )}

                  {/* Whole-Day Planning Action Bar (Only for upcoming teaching days with classes) */}
                  {!selectedDay.is_past && selectedDay.classes.length > 0 && (
                    <div className="mb-5 p-3 rounded-xl bg-surface2 border border-border">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                          Whole-Day Action
                        </span>
                        <span className="text-[11px] font-mono text-muted">
                          {selectedDay.classes.length} scheduled{" "}
                          {selectedDay.classes.length === 1 ? "class" : "classes"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={handleAttendAll}
                          className="py-1.5 px-2 bg-success/15 hover:bg-success/25 text-success border border-success/30 rounded-lg text-[11px] font-bold uppercase transition-colors"
                        >
                          Attend All
                        </button>
                        <button
                          onClick={handleSkipEntireDay}
                          className="py-1.5 px-2 bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 rounded-lg text-[11px] font-bold uppercase transition-colors"
                        >
                          Skip Entire
                        </button>
                        <button
                          onClick={handleResetDay}
                          className="py-1.5 px-2 bg-surface hover:bg-border text-muted hover:text-text border border-border rounded-lg text-[11px] font-bold uppercase transition-colors"
                        >
                          Reset Day
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Scheduled Classes List */}
                  {selectedDay.classes.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">
                          Scheduled Classes
                        </h3>
                        <div className="text-[11px] text-muted font-medium">
                          {Object.values(selectedDayDecisions).filter((v) => v === "attend").length}{" "}
                          Attend ·{" "}
                          {Object.values(selectedDayDecisions).filter((v) => v === "bunk").length}{" "}
                          Skip
                        </div>
                      </div>

                      {selectedDay.classes.map((cls) => {
                        const decision = selectedDayDecisions[cls.slot_index] || "attend";
                        const isBunk = decision === "bunk";

                        // Current subject stats
                        const sub = attendance.find(
                          (a) =>
                            a.code.trim().toUpperCase().replace("-", "") ===
                            cls.subject_code.trim().toUpperCase().replace("-", "")
                        );

                        return (
                          <div
                            key={cls.slot_index}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isBunk
                                ? "bg-surface2/60 border-warning/30"
                                : "bg-surface2 border-border"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <div>
                                <span className="font-mono text-accent text-[11px] font-semibold mr-2">
                                  {cls.time}
                                </span>
                                <span className="text-[10px] bg-border text-muted px-1.5 py-0.2 rounded font-mono font-medium">
                                  {cls.type === "P"
                                    ? "Practical"
                                    : cls.type === "T"
                                    ? "Tutorial"
                                    : "Lecture"}
                                </span>
                              </div>
                              {sub && (
                                <span
                                  className={`text-[11px] font-mono font-semibold ${
                                    sub.percentage >= 80
                                      ? "text-success"
                                      : sub.percentage >= 75
                                      ? "text-warning"
                                      : "text-danger"
                                  }`}
                                >
                                  {sub.percentage}%
                                </span>
                              )}
                            </div>

                            <div className="font-semibold text-[13px] text-text mb-1 leading-snug">
                              {cls.subject_name}
                            </div>
                            <div className="text-[11px] text-muted flex items-center gap-2 mb-3 font-mono">
                              <span>{cls.subject_code}</span>
                              {cls.room && <span>· Room: {cls.room}</span>}
                              {cls.faculty && <span>· {cls.faculty}</span>}
                            </div>

                            {/* Attend / Skip Toggle Buttons */}
                            {!selectedDay.is_past ? (
                              <div className="flex rounded-lg overflow-hidden border border-border">
                                <button
                                  onClick={() => handleSlotToggle(cls.slot_index, "attend")}
                                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                                    !isBunk
                                      ? "bg-accent text-white shadow-sm"
                                      : "bg-surface hover:bg-surface2 text-muted"
                                  }`}
                                >
                                  Attend
                                </button>
                                <button
                                  onClick={() => handleSlotToggle(cls.slot_index, "bunk")}
                                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                                    isBunk
                                      ? "bg-warning text-white shadow-sm"
                                      : "bg-surface hover:bg-surface2 text-muted"
                                  }`}
                                >
                                  Skip
                                </button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted italic bg-surface/50 p-1.5 rounded text-center">
                                Past class (read-only)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Empty State */
                    <div className="p-8 rounded-xl bg-surface2/50 border border-border/50 text-center flex flex-col items-center">
                      <div className="text-[28px] mb-2">🏖️</div>
                      <div className="font-semibold text-[14px] text-text">No Classes Scheduled</div>
                      <div className="text-[12px] text-muted mt-1 max-w-xs">
                        {selectedDay.reason ||
                          "There are no timetable classes scheduled for this day."}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-muted text-[13px]">
                  Select a date from the calendar to manage its classes
                </div>
              )}
            </div>

            {/* SECTION 3: Projected Attendance Sidebar */}
            <div className="bg-surface border border-border rounded-xl p-5 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-bold tracking-tight">Projected Attendance</h3>
                <span className="text-[11px] font-mono text-muted">Real-time Forecast</span>
              </div>

              <div className="space-y-3">
                {Object.keys(projected).length > 0 ? (
                  Object.keys(projected).map((code) => {
                    const p = projected[code];
                    const diff = (p.percentage - p.orig_percentage).toFixed(1);
                    const isPositive = parseFloat(diff) >= 0;

                    return (
                      <div
                        key={code}
                        className={`border rounded-xl p-3.5 flex flex-col gap-2 transition-colors ${p.bg}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="font-semibold text-[12.5px] leading-snug line-clamp-1">
                            {p.subject}
                          </div>
                          <div
                            className={`text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-surface border border-border/50 ${p.color}`}
                          >
                            {p.statusLabel}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex flex-col">
                            <span className="text-[9.5px] text-muted uppercase tracking-widest">
                              Current
                            </span>
                            <span className="font-mono font-medium text-[13px]">
                              {p.orig_percentage.toFixed(1)}%
                            </span>
                          </div>

                          <span className="text-muted text-[11px]">→</span>

                          <div className="flex flex-col items-end">
                            <span className="text-[9.5px] text-muted uppercase tracking-widest">
                              Projected
                            </span>
                            <div className="flex items-center gap-1.5">
                              {parseFloat(diff) !== 0 && (
                                <span
                                  className={`text-[10px] font-mono font-medium ${
                                    isPositive ? "text-success" : "text-danger"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {diff}%
                                </span>
                              )}
                              <span className="font-mono font-bold text-[14px]">
                                {p.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-[10.5px] text-muted flex justify-between border-t border-border/40 pt-1.5 mt-0.5">
                          <span>Safe bunks left: <strong>{p.bunk_budget}</strong></span>
                          {p.planned_skips > 0 && (
                            <span className="text-warning">
                              {p.planned_skips} planned {p.planned_skips === 1 ? "skip" : "skips"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-muted text-[12px] text-center p-4">
                    No subjects loaded.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
