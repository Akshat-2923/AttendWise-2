"use client";

import { useState, useEffect } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";
import { SubjectAttendance } from "../../types/attendance";

interface WhatIfResult {
  current_percentage: number;
  target_percentage: number;
  classes_required: number;
  verdict: string;
  possible: boolean;
}

export default function WhatIfPage() {
  const [subjects, setSubjects] = useState<SubjectAttendance[]>([]);
  const [code, setCode] = useState("");
  const [target, setTarget] = useState("75");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi("/api/attendance")
      .then((res) => {
        setSubjects(res);
        if (res.length > 0) {
          setCode(res[0].code);
        }
      })
      .catch((err) => console.error("Failed to fetch subjects:", err));
  }, []);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError("Please enter a subject code.");
      return;
    }
    
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetchApi("/api/what-if", {
        method: "POST",
        body: JSON.stringify({ 
          code, 
          target: parseInt(target) || 75
        }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate what-if scenario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">What-If Calculator</h1>
          <p className="text-[13px] text-muted mt-1">Find out how many classes you need to attend to reach a target %</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 mb-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCalculate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">Subject</label>
              {subjects.length > 0 ? (
                <select
                  required
                  className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
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
                  value={code}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">Target %</label>
              <input
                type="number"
                min="0"
                max="100"
                required
                className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] font-mono"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-accent-hi text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Calculating..." : "Calculate"}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-4">Required Classes</div>
            
            <div className={`text-[64px] font-bold font-mono leading-none mb-4 ${
              result.possible ? "text-accent" : "text-danger"
            }`}>
              {result.possible ? `+${result.classes_required}` : "Impossible"}
            </div>
            
            <div className="text-[15px] font-medium text-text max-w-md">
              {result.verdict}
            </div>
            
            <div className="flex gap-8 mt-6 pt-6 border-t border-border w-full justify-center">
              <div>
                <div className="text-[11px] text-muted uppercase mb-1">Current</div>
                <div className="font-mono font-bold text-[16px]">{result.current_percentage}%</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase mb-1">Target</div>
                <div className="font-mono font-bold text-[16px]">{result.target_percentage}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
