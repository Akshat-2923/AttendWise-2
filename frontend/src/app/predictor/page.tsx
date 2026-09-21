"use client";

import { useState, useEffect } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";
import { SubjectAttendance } from "../../types/attendance";

interface PredictorResult {
  current_percentage: number;
  new_percentage: number;
  status: string;
  verdict: string;
}

export default function PredictorPage() {
  const [subjects, setSubjects] = useState<SubjectAttendance[]>([]);
  const [code, setCode] = useState("");
  const [attend, setAttend] = useState("0");
  const [miss, setMiss] = useState("0");
  const [result, setResult] = useState<PredictorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi("/api/attendance")
      .then((res) => {
        setSubjects(res);
        if (res.length > 0) {
          setCode(res[0].code); // Default to first subject
        }
      })
      .catch((err) => console.error("Failed to fetch subjects:", err));
  }, []);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError("Please enter a subject code.");
      return;
    }
    
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetchApi("/api/predictor", {
        method: "POST",
        body: JSON.stringify({ 
          code, 
          attend: parseInt(attend) || 0, 
          miss: parseInt(miss) || 0 
        }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to calculate prediction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Attendance Predictor</h1>
          <p className="text-[13px] text-muted mt-1">Predict your future attendance based on planned classes</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 mb-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handlePredict} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">Attend</label>
              <input
                type="number"
                min="0"
                className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] font-mono"
                value={attend}
                onChange={(e) => setAttend(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-muted uppercase tracking-wider">Miss</label>
              <input
                type="number"
                min="0"
                className="w-full bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] font-mono"
                value={miss}
                onChange={(e) => setMiss(e.target.value)}
              />
            </div>
            <div className="md:col-span-4 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-accent-hi text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Calculating..." : "Predict"}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5 text-center flex flex-col justify-center">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">Current %</div>
              <div className="text-[28px] font-bold font-mono text-muted">{result.current_percentage}%</div>
            </div>
            <div className="bg-surface border border-accent/40 rounded-xl p-5 text-center flex flex-col justify-center bg-accent/5">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-accent mb-2">Predicted %</div>
              <div className="text-[32px] font-bold font-mono text-accent">{result.new_percentage.toFixed(1)}%</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5 text-center flex flex-col justify-center">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">Verdict</div>
              <div className={`text-[16px] font-bold mt-1 ${
                result.status === "Safe" ? "text-success" : result.status === "Warning" ? "text-warning" : "text-danger"
              }`}>
                {result.verdict}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
