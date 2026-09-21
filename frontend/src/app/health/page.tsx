"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";

interface HealthData {
  score: number;
  grade: string;
  label: string;
  color: string;
  breakdown: Record<string, any>;
  stats: Record<string, any>;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi("/api/health")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load health score.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1200px] mx-auto text-muted">Loading health data...</div>
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

  if (!data) return null;

  const score = data.score;
  const status = data.label;
  const color = 
    score >= 85 ? "text-success" : 
    score >= 70 ? "text-[#84cc16]" : 
    score >= 55 ? "text-warning" : 
    score >= 40 ? "text-orange-500" : "text-danger";

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto">
        <h1 className="text-[20px] font-bold tracking-tight mb-6">Health Score Card</h1>

        <div className={`p-8 border rounded-xl mb-6 flex flex-col items-center justify-center text-center ${color.replace('text', 'border')}/20 bg-surface`}>
          <div className={`text-[64px] font-bold font-mono leading-none mb-2 ${color}`}>
            {score.toFixed(0)}
          </div>
          <div className={`text-[18px] font-semibold tracking-wide uppercase ${color}`}>
            {status}
          </div>
        </div>

        <h2 className="text-[14px] font-bold tracking-tight text-muted uppercase mb-4 mt-8">Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(data.breakdown || {}).map(([key, item]) => (
            <div key={key} className="bg-surface border border-border p-4 rounded-xl flex flex-col justify-between">
              <div className="text-[11px] font-semibold tracking-wider text-muted uppercase mb-1">{item.label}</div>
              <div className="flex justify-between items-end mt-2">
                <div className="text-[20px] font-bold">{item.value}</div>
                <div className="text-[14px] font-mono font-medium text-muted">{item.score.toFixed(1)} / {item.max} pts</div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-[14px] font-bold tracking-tight text-muted uppercase mb-4 mt-8">Stats Overview</h2>
        <div className="bg-surface border border-border p-4 rounded-xl flex flex-wrap gap-6">
          {Object.entries(data.stats || {}).map(([key, val]) => (
            <div key={key} className="flex-1 min-w-[100px]">
              <div className="text-[11px] font-semibold tracking-wider text-muted uppercase mb-1">{key.replace(/_/g, ' ')}</div>
              <div className="text-[18px] font-bold">{String(val)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
