"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";

interface DailyClass {
  code: string;
  subject: string;
  time: string;
  type: string;
  room: string;
  faculty: string;
  status: string;
  percent: number;
  bunk_budget: number;
}

interface SmartPlanData {
  day: string;
  classes: DailyClass[];
  daily_verdict: {
    status: string;
    reason: string;
  };
}

export default function SmartPlanPage() {
  const [data, setData] = useState<SmartPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi("/api/smart-plan")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load smart plan.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[800px] mx-auto text-muted">Analyzing today's classes...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[800px] mx-auto text-danger">{error || "No data"}</div>
      </div>
    );
  }

  const vd = data.daily_verdict.status;
  let headColor = "text-text";
  let headBg = "bg-surface";
  
  if (vd === "BUNK ALL") { headColor = "text-success"; headBg = "bg-success/10 border-success/30"; }
  else if (vd === "ATTEND ALL") { headColor = "text-danger"; headBg = "bg-danger/10 border-danger/30"; }
  else if (vd === "SELECTIVE BUNK") { headColor = "text-warning"; headBg = "bg-warning/10 border-warning/30"; }
  else if (vd === "NO CLASSES") { headColor = "text-muted"; headBg = "bg-surface2"; }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Today's Smart Plan</h1>
          <p className="text-[13px] text-muted mt-1">{data.day}</p>
        </div>

        <div className={`p-6 border rounded-xl mb-8 flex flex-col gap-2 ${headBg}`}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Daily Verdict</div>
          <div className={`text-[24px] font-bold ${headColor}`}>{vd}</div>
          <div className="text-[14px] text-text mt-1">{data.daily_verdict.reason}</div>
        </div>

        <h2 className="text-[16px] font-semibold mb-4">Class Schedule</h2>
        
        {data.classes.length === 0 ? (
          <div className="p-8 border border-border rounded-xl text-center bg-surface text-muted">
            No classes scheduled for today.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.classes.map((cls, i) => {
              const isAttend = cls.status === "ATTEND";
              const isBunk = cls.status === "BUNK";
              const isRisky = cls.status === "RISKY";
              
              let clr = "text-muted";
              let bg = "bg-surface2";
              let brd = "border-border";
              
              if (isAttend) { clr = "text-danger"; bg = "bg-danger/10"; brd = "border-danger/30"; }
              else if (isBunk) { clr = "text-success"; bg = "bg-success/10"; brd = "border-success/30"; }
              else if (isRisky) { clr = "text-warning"; bg = "bg-warning/10"; brd = "border-warning/30"; }

              return (
                <div key={i} className="bg-surface border border-border rounded-xl p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-accent font-semibold text-[13px]">{cls.time}</span>
                      <span className="px-2 py-0.5 bg-surface2 text-muted text-[10px] font-medium rounded uppercase">{cls.type}</span>
                    </div>
                    <div className="font-semibold text-[15px] leading-tight">{cls.subject}</div>
                    <div className="text-[12px] text-muted flex gap-3">
                      <span>Room: {cls.room}</span>
                      <span>•</span>
                      <span className="truncate">{cls.faculty}</span>
                    </div>
                  </div>
                  
                  <div className={`flex flex-col items-end gap-2 border rounded-lg p-3 w-full md:w-[200px] ${bg} ${brd}`}>
                    <div className={`text-[12px] font-bold tracking-widest uppercase ${clr}`}>
                      {cls.status}
                    </div>
                    <div className="w-full flex justify-between items-center text-[12px]">
                      <span className="text-muted">Current:</span>
                      <span className="font-mono font-medium">{cls.percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full flex justify-between items-center text-[12px]">
                      <span className="text-muted">Budget:</span>
                      <span className="font-mono font-medium">{cls.bunk_budget} skips</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
