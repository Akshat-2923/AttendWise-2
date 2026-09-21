"use client";

import { useEffect, useState, useMemo } from "react";
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

type PlanState = {
  [day: string]: {
    [slotIndex: number]: "attend" | "bunk";
  };
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ProjectedSubject {
  subject: string;
  orig_attended: number;
  orig_conducted: number;
  orig_percentage: number;
  attended: number;
  conducted: number;
  percentage: number;
  bunk_budget: number;
  statusLabel: string;
  color: string;
  bg: string;
}

export default function WeeklyPlannerPage() {
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [attendance, setAttendance] = useState<SubjectAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<PlanState>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi("/api/timetable"),
      fetchApi("/api/attendance")
    ]).then(([ttRes, attRes]) => {
      setTimetable(ttRes);
      setAttendance(attRes);
      
      // Initialize default plan (all attend)
      const initialPlan: PlanState = {};
      DAYS.forEach(day => {
        initialPlan[day] = {};
        if (ttRes[day]) {
          ttRes[day].forEach((_: unknown, idx: number) => {
            initialPlan[day][idx] = "attend";
          });
        }
      });
      
      // Load from local storage if exists
      const stored = localStorage.getItem("attendwise_weekly_plan");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPlan(parsed);
        } catch {
          setPlan(initialPlan);
        }
      } else {
        setPlan(initialPlan);
      }
      
      setLoading(false);
    }).catch(() => {
      setError("Failed to load data for the planner.");
      setLoading(false);
    });
  }, []);

  const handleToggle = (day: string, idx: number, choice: "attend" | "bunk") => {
    setPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [idx]: choice
      }
    }));
    setSaved(false);
  };

  const handleReset = () => {
    const initialPlan: PlanState = {};
    DAYS.forEach(day => {
      initialPlan[day] = {};
      if (timetable?.[day]) {
        timetable[day].forEach((_, idx) => {
          initialPlan[day][idx] = "attend";
        });
      }
    });
    setPlan(initialPlan);
    setSaved(false);
    localStorage.removeItem("attendwise_weekly_plan");
  };

  const handleConfirm = () => {
    localStorage.setItem("attendwise_weekly_plan", JSON.stringify(plan));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const projected = useMemo(() => {
    if (!timetable || attendance.length === 0) return {};

    const proj: Record<string, ProjectedSubject> = {};
    
    attendance.forEach(sub => {
      proj[sub.code] = { 
        subject: sub.subject,
        orig_attended: sub.attended,
        orig_conducted: sub.conducted,
        orig_percentage: sub.percentage,
        attended: sub.attended, 
        conducted: sub.conducted,
        percentage: 0,
        bunk_budget: 0,
        statusLabel: "",
        color: "",
        bg: "",
      };
    });

    DAYS.forEach(day => {
      timetable[day]?.forEach((slot, idx) => {
        const choice = plan[day]?.[idx] || "attend";
        const code = slot.subject_code;
        if (proj[code]) {
          proj[code].conducted += 1;
          if (choice === "attend") {
            proj[code].attended += 1;
          }
        }
      });
    });

    Object.keys(proj).forEach(code => {
      const p = proj[code];
      p.percentage = p.conducted > 0 ? (p.attended / p.conducted) * 100 : 0;
      
      const rawBudget = Math.floor((p.attended - 0.75 * p.conducted) / 0.75);
      p.bunk_budget = Math.max(0, rawBudget);

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
  }, [plan, timetable, attendance]);

  // Totals
  const totals = useMemo(() => {
    let totalClasses = 0;
    let plannedAttend = 0;
    let plannedBunk = 0;

    DAYS.forEach(day => {
      timetable?.[day]?.forEach((_, idx) => {
        totalClasses++;
        if (plan[day]?.[idx] === "bunk") plannedBunk++;
        else plannedAttend++;
      });
    });

    let safeBunks = 0;
    Object.values(projected).forEach((p) => {
      safeBunks += p.bunk_budget;
    });

    return { totalClasses, plannedAttend, plannedBunk, safeBunks };
  }, [plan, timetable, projected]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1200px] mx-auto text-muted">Loading planner...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1200px] mx-auto text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[1200px] mx-auto">
        <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">Weekly Attendance Planner</h1>
            <p className="text-[13px] text-muted mt-1">Plan your week and see projected attendance instantly</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleReset}
              className="px-4 py-2 bg-surface2 hover:bg-surface border border-border rounded-lg text-[13px] font-semibold transition-colors"
            >
              Reset Plan
            </button>
            <button 
              onClick={handleConfirm}
              className="px-4 py-2 bg-accent hover:bg-accent-hi text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2"
            >
              {saved ? "Saved!" : "Confirm Week"}
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Total Classes</div>
            <div className="text-[28px] font-bold font-mono text-text">{totals.totalClasses}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Planned Attend</div>
            <div className="text-[28px] font-bold font-mono text-accent">{totals.plannedAttend}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Planned Bunks</div>
            <div className="text-[28px] font-bold font-mono text-warning">{totals.plannedBunk}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Safe Bunks Left</div>
            <div className="text-[28px] font-bold font-mono text-success">{totals.safeBunks}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Planner Grid */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-[16px] font-semibold">Weekly Schedule</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {DAYS.map((day) => {
                const slots = timetable?.[day] || [];
                if (slots.length === 0) return null;

                // Check if day is unsafe: ANY planned bunk that results in MUST ATTEND
                const isUnsafe = slots.some((slot, idx) => {
                  const p = projected[slot.subject_code];
                  return plan[day]?.[idx] === "bunk" && p?.statusLabel === "MUST ATTEND";
                });

                return (
                  <div key={day} className={`bg-surface border rounded-xl flex flex-col overflow-hidden transition-shadow ${isUnsafe ? 'border-danger/50 shadow-[0_0_15px_rgba(240,92,92,0.1)]' : 'border-border'}`}>
                    <div className={`p-3 font-semibold text-center text-[13px] uppercase tracking-widest border-b transition-colors ${isUnsafe ? 'bg-danger/10 text-danger border-danger/20' : 'bg-surface2 text-muted border-border'}`}>
                      {day}
                      {isUnsafe && <span className="ml-2 text-[10px] bg-danger text-white px-1.5 py-0.5 rounded">UNSAFE</span>}
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-3">
                      {slots.map((slot, idx) => {
                        const choice = plan[day]?.[idx] || "attend";
                        const isBunk = choice === "bunk";
                        
                        return (
                          <div key={idx} className={`rounded-lg p-3 border transition-colors ${isBunk ? 'bg-surface2/50 border-border/30 opacity-75' : 'bg-surface2 border-border/50'}`}>
                            <div className="font-mono text-accent text-[11px] mb-1 font-semibold">{slot.time}</div>
                            <div className="font-bold text-[12px] mb-2 line-clamp-2 leading-snug">{slot.subject_name || slot.subject_code}</div>
                            
                            <div className="flex rounded-md overflow-hidden border border-border mt-2">
                              <button
                                onClick={() => handleToggle(day, idx, "attend")}
                                className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors ${!isBunk ? 'bg-accent text-white' : 'bg-surface hover:bg-surface2 text-muted'}`}
                              >
                                Attend
                              </button>
                              <button
                                onClick={() => handleToggle(day, idx, "bunk")}
                                className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors ${isBunk ? 'bg-warning text-white' : 'bg-surface hover:bg-surface2 text-muted'}`}
                              >
                                Bunk
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projections Sidebar */}
          <div className="space-y-6">
            <h2 className="text-[16px] font-semibold">Projected Attendance</h2>
            <div className="flex flex-col gap-3">
              {Object.keys(projected).map(code => {
                const p = projected[code];
                const diff = (p.percentage - p.orig_percentage).toFixed(1);
                const isPositive = parseFloat(diff) >= 0;

                return (
                  <div key={code} className={`bg-surface border rounded-xl p-4 flex flex-col gap-2 transition-colors ${p.bg}`}>
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-[13px] leading-snug pr-4">{p.subject}</div>
                      <div className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded bg-surface border border-border/50 ${p.color}`}>
                        {p.statusLabel}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted uppercase tracking-widest">Current</span>
                        <span className="font-mono font-medium text-[14px]">{p.orig_percentage.toFixed(1)}%</span>
                      </div>
                      
                      <div className="text-muted text-[12px]">→</div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted uppercase tracking-widest">Projected</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-mono ${isPositive ? 'text-success' : 'text-danger'}`}>
                            {isPositive ? '+' : ''}{diff}%
                          </span>
                          <span className="font-mono font-bold text-[16px]">{p.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
