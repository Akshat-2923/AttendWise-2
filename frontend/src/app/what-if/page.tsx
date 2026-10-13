"use client";

import { useState, useEffect, useMemo } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";
import { SubjectAttendance } from "../../types/attendance";

interface WhatIfResult {
  current_percentage: number;
  target_percentage: number;
  classes_required: number;
  verdict: string;
  possible: boolean;
  predicted_date?: string | null;
  days_away?: number | null;
}

export default function WhatIfPage() {
  const [subjects, setSubjects] = useState<SubjectAttendance[]>([]);
  
  // Left Column: What-If Target Calculator state
  const [calcCode, setCalcCode] = useState("");
  const [calcTarget, setCalcTarget] = useState("75");
  const [calcResult, setCalcResult] = useState<WhatIfResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  // Right Column: Interactive Attendance Simulator state
  const [simCode, setSimCode] = useState("");
  const [simTarget, setSimTarget] = useState("75");
  const [attendCount, setAttendCount] = useState<number>(0);
  const [skipCount, setSkipCount] = useState<number>(0);

  useEffect(() => {
    fetchApi("/api/attendance")
      .then((res: SubjectAttendance[]) => {
        setSubjects(res);
        if (res.length > 0) {
          setCalcCode(res[0].code);
          setSimCode(res[0].code);
        }
      })
      .catch((err) => console.error("Failed to fetch subjects:", err));
  }, []);

  // Handler for Target Calculator
  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcCode) {
      setCalcError("Please select a subject.");
      return;
    }
    
    setCalcLoading(true);
    setCalcError("");
    setCalcResult(null);

    try {
      const res = await fetchApi("/api/what-if", {
        method: "POST",
        body: JSON.stringify({ 
          code: calcCode, 
          target: parseFloat(calcTarget) || 75.0,
        }),
      });
      setCalcResult(res);
    } catch (err: any) {
      setCalcError(err.message || "Failed to calculate what-if scenario.");
    } finally {
      setCalcLoading(false);
    }
  };

  // Selected subject for Simulator
  const simSubject = useMemo(() => {
    return subjects.find((s) => s.code === simCode) || subjects[0] || null;
  }, [subjects, simCode]);

  // Simulator calculations
  const simStats = useMemo(() => {
    if (!simSubject) {
      return {
        currentAttended: 0,
        currentConducted: 0,
        currentPct: 0,
        projAttended: 0,
        projConducted: 0,
        projPct: 0,
        delta: 0,
        targetNum: 75,
        targetMet: true,
        bunkBudget: 0,
        recoveryNeeded: 0,
        isImpossible: false,
      };
    }

    const P = simSubject.attended;
    const T = simSubject.conducted;
    const currentPct = T > 0 ? (P / T) * 100 : 0;

    const A = Math.max(0, attendCount);
    const S = Math.max(0, skipCount);

    const projAttended = P + A;
    const projConducted = T + A + S;
    const projPct = projConducted > 0 ? (projAttended / projConducted) * 100 : 0;
    const delta = projPct - currentPct;

    const targetNum = Math.min(100, Math.max(1, parseFloat(simTarget) || 75));
    const t = targetNum / 100.0;
    const targetMet = projPct >= targetNum;

    let bunkBudget = 0;
    let recoveryNeeded = 0;
    let isImpossible = false;

    if (targetMet) {
      if (t > 0 && projConducted > 0) {
        bunkBudget = Math.max(0, Math.floor((projAttended - t * projConducted) / t));
      }
    } else {
      if (t >= 1.0) {
        isImpossible = projAttended < projConducted;
      } else {
        const raw = Math.ceil((t * projConducted - projAttended) / (1 - t));
        recoveryNeeded = Math.max(0, raw);
      }
    }

    return {
      currentAttended: P,
      currentConducted: T,
      currentPct,
      projAttended,
      projConducted,
      projPct,
      delta,
      targetNum,
      targetMet,
      bunkBudget,
      recoveryNeeded,
      isImpossible,
    };
  }, [simSubject, attendCount, skipCount, simTarget]);

  // Reset simulator inputs
  const handleResetSimulator = () => {
    setAttendCount(0);
    setSkipCount(0);
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-[1440px] px-4 sm:px-6 lg:px-8 py-7 mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight">What-If Analysis & Attendance Simulator</h1>
          <p className="text-[13px] text-muted mt-1">
            Calculate classes required to reach a target benchmark and simulate future attendance outcomes in real-time.
          </p>
        </div>

        {/* Two-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: WHAT-IF TARGET CALCULATOR                    */}
          {/* ========================================================= */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-mono">
                Target Calculator
              </div>
              <h2 className="text-[18px] font-bold text-text mt-0.5">Calculate Classes Needed</h2>
              <p className="text-[13px] text-muted mt-0.5">
                Find out how many consecutive classes you need to attend to hit your target %.
              </p>
            </div>

            {calcError && (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                {calcError}
              </div>
            )}

            <form onSubmit={handleCalculate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                  Subject
                </label>
                {subjects.length > 0 ? (
                  <select
                    required
                    className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px]"
                    value={calcCode}
                    onChange={(e) => setCalcCode(e.target.value)}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.subject} ({sub.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] opacity-50 cursor-not-allowed"
                    placeholder="Loading subjects..."
                    disabled
                    value={calcCode}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                  Target %
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-4 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] font-mono"
                  value={calcTarget}
                  onChange={(e) => setCalcTarget(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={calcLoading}
                  className="w-full bg-accent hover:bg-accent-hi text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {calcLoading ? "Calculating..." : "Calculate Required Classes"}
                </button>
              </div>
            </form>

            {/* Target Calculator Result Panel */}
            {calcResult ? (
              <div className="bg-surface2/40 border border-border rounded-xl p-6 text-center flex flex-col items-center">
                <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-3">
                  Required Consecutive Classes
                </div>
                
                <div className={`text-[56px] font-bold font-mono leading-none mb-3 ${
                  calcResult.possible ? "text-accent" : "text-danger"
                }`}>
                  {calcResult.possible
                    ? (calcResult.classes_required === 0 ? "Target Met" : `+${calcResult.classes_required}`)
                    : "Impossible"}
                </div>
                
                <div className="text-[14px] font-medium text-text max-w-md">
                  {calcResult.verdict}
                </div>

                {calcResult.predicted_date && calcResult.possible && calcResult.classes_required > 0 && (
                  <div className="mt-4 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-[12.5px] font-medium inline-flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>
                      Estimated Target Date: <strong>{calcResult.predicted_date}</strong>
                      {calcResult.days_away !== null && calcResult.days_away !== undefined
                        ? ` (${calcResult.days_away} ${calcResult.days_away === 1 ? 'day' : 'days'} away)`
                        : ''}
                    </span>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-border w-full text-center">
                  <div>
                    <div className="text-[11px] text-muted uppercase mb-1">Current</div>
                    <div className="font-mono font-bold text-[15px]">{calcResult.current_percentage}%</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted uppercase mb-1">Target</div>
                    <div className="font-mono font-bold text-[15px]">{calcResult.target_percentage}%</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted uppercase mb-1">Target Date</div>
                    <div className="font-mono font-bold text-[13px] text-accent truncate">
                      {calcResult.predicted_date || (calcResult.classes_required === 0 ? "Target Met" : "—")}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-border/80 border-dashed rounded-xl text-center bg-surface2/20 text-muted text-[13.5px]">
                Select a subject and enter your target % above to calculate how many classes you must attend.
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: INTERACTIVE ATTENDANCE SIMULATOR            */}
          {/* ========================================================= */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-success font-mono">
                  Interactive Simulator
                </div>
                <h2 className="text-[18px] font-bold text-text mt-0.5">Attendance Simulator</h2>
                <p className="text-[13px] text-muted mt-0.5">
                  Simulate future attend and skip counts to test your projected attendance.
                </p>
              </div>
              {(attendCount > 0 || skipCount > 0) && (
                <button
                  onClick={handleResetSimulator}
                  className="px-2.5 py-1.5 rounded-md border border-border text-[12px] text-muted hover:text-text hover:bg-border transition-colors font-medium"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Subject Selector & Target % for Simulator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                  Subject
                </label>
                {subjects.length > 0 ? (
                  <select
                    className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px]"
                    value={simCode}
                    onChange={(e) => {
                      setSimCode(e.target.value);
                      handleResetSimulator();
                    }}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.subject} ({sub.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text opacity-50 cursor-not-allowed text-[14px]"
                    placeholder="Loading subjects..."
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                  Target Benchmark %
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-4 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] font-mono"
                  value={simTarget}
                  onChange={(e) => setSimTarget(e.target.value)}
                />
              </div>
            </div>

            {/* Current Attendance Snapshot */}
            {simSubject && (
              <div className="p-3.5 bg-surface2/50 border border-border rounded-lg flex items-center justify-between text-[13px]">
                <span className="text-muted">
                  Actual Recorded Attendance:
                </span>
                <span className="font-mono font-medium text-text">
                  <strong>{simSubject.attended}</strong> / {simSubject.conducted} classes ({simSubject.percentage.toFixed(1)}%)
                </span>
              </div>
            )}

            {/* Increment / Decrement Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Classes to Attend */}
              <div className="p-4 bg-surface2/30 border border-border rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-success">
                    Classes to Attend (+A)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAttendCount((c) => c + 1)}
                      className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-muted hover:text-text hover:bg-border"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendCount((c) => c + 3)}
                      className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-muted hover:text-text hover:bg-border"
                    >
                      +3
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={attendCount <= 0}
                    onClick={() => setAttendCount((c) => Math.max(0, c - 1))}
                    className="w-10 h-10 rounded-lg bg-surface border border-border hover:bg-border text-text font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={attendCount}
                    onChange={(e) => setAttendCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 h-10 text-center font-mono font-bold text-[16px] bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-success transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setAttendCount((c) => c + 1)}
                    className="w-10 h-10 rounded-lg bg-surface border border-border hover:bg-border text-text font-bold text-lg flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Classes to Skip */}
              <div className="p-4 bg-surface2/30 border border-border rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-danger">
                    Classes to Skip (+S)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setSkipCount((c) => c + 1)}
                      className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-muted hover:text-text hover:bg-border"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkipCount((c) => c + 3)}
                      className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-muted hover:text-text hover:bg-border"
                    >
                      +3
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={skipCount <= 0}
                    onClick={() => setSkipCount((c) => Math.max(0, c - 1))}
                    className="w-10 h-10 rounded-lg bg-surface border border-border hover:bg-border text-text font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={skipCount}
                    onChange={(e) => setSkipCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 h-10 text-center font-mono font-bold text-[16px] bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-danger transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setSkipCount((c) => c + 1)}
                    className="w-10 h-10 rounded-lg bg-surface border border-border hover:bg-border text-text font-bold text-lg flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Live Projected Simulation Panel */}
            <div className="bg-surface2/40 border border-border rounded-xl p-6 text-center flex flex-col items-center">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">
                Projected Attendance
              </div>

              {/* Big Projected % */}
              <div className="flex items-baseline justify-center gap-3 mb-2">
                <span
                  className={`text-[56px] font-bold font-mono leading-none ${
                    simStats.projPct >= simStats.targetNum
                      ? "text-success"
                      : simStats.projPct >= 75
                      ? "text-warning"
                      : "text-danger"
                  }`}
                >
                  {simStats.projPct.toFixed(1)}%
                </span>
                {simStats.delta !== 0 && (
                  <span
                    className={`text-[14px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      simStats.delta > 0
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger"
                    }`}
                  >
                    {simStats.delta > 0 ? `+${simStats.delta.toFixed(1)}%` : `${simStats.delta.toFixed(1)}%`}
                  </span>
                )}
              </div>

              {/* Status Pill */}
              <div className="mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold ${
                    simStats.targetMet
                      ? "bg-success/10 text-success border border-success/30"
                      : "bg-danger/10 text-danger border border-danger/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      simStats.targetMet ? "bg-success" : "bg-danger"
                    }`}
                  />
                  {simStats.targetMet
                    ? `Target Met (≥ ${simStats.targetNum}%)`
                    : `Below Target (< ${simStats.targetNum}%)`}
                </span>
              </div>

              {/* Simulation Guidance Message */}
              <div className="text-[13.5px] font-medium text-text max-w-md">
                {simStats.targetMet ? (
                  <span>
                    Under this scenario, you can safely skip{" "}
                    <strong className="text-success">{simStats.bunkBudget}</strong> more classes
                    while maintaining your {simStats.targetNum}% threshold.
                  </span>
                ) : simStats.isImpossible ? (
                  <span className="text-danger">
                    A target of {simStats.targetNum}% is mathematically impossible to reach.
                  </span>
                ) : (
                  <span>
                    Under this scenario, you would need to attend{" "}
                    <strong className="text-danger">+{simStats.recoveryNeeded}</strong> consecutive
                    classes to recover back to {simStats.targetNum}%.
                  </span>
                )}
              </div>

              {/* 3-Column Stats Footer */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-border w-full text-center">
                <div>
                  <div className="text-[11px] text-muted uppercase mb-1">Current</div>
                  <div className="font-mono font-bold text-[15px]">{simStats.currentPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted uppercase mb-1">Projected</div>
                  <div className="font-mono font-bold text-[15px]">{simStats.projPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted uppercase mb-1">Simulated Ratio</div>
                  <div className="font-mono font-bold text-[13px] text-accent truncate">
                    {simStats.projAttended} / {simStats.projConducted}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
