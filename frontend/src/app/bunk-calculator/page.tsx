"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";

interface BunkSubject {
  code: string;
  subject: string;
  attended: number;
  conducted: number;
  percentage: number;
  bunk_budget: number;
  recovery_classes: number;
  priority: string;
  status: string;
}

export default function BunkCalculatorPage() {
  const [data, setData] = useState<BunkSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi("/api/bunk-calculator")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load bunk calculator.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1000px] mx-auto text-muted">Loading bunk calculator...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1000px] mx-auto text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[1000px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Smart Bunk Plan</h1>
          <p className="text-[13px] text-muted mt-1">Prioritized list of subjects you can safely skip</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((sub, i) => {
            const isMustAttend = sub.priority === "Must Attend";
            const isCareful = sub.priority === "Attend Carefully";
            const isBunkable = sub.priority === "Bunkable";
            
            let borderCls = "border-border";
            let bgCls = "bg-surface";
            let badgeCls = "bg-surface2 text-muted";
            
            if (isMustAttend) {
              borderCls = "border-danger/40 hover:border-danger/60";
              badgeCls = "bg-danger/10 text-danger";
            } else if (isCareful) {
              borderCls = "border-warning/40 hover:border-warning/60";
              badgeCls = "bg-warning/10 text-warning";
            } else if (isBunkable) {
              borderCls = "border-success/40 hover:border-success/60";
              bgCls = "bg-success/[0.02]";
              badgeCls = "bg-success/10 text-success";
            }

            return (
              <div key={i} className={`${bgCls} border ${borderCls} rounded-xl p-5 flex flex-col h-full transition-colors`}>
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeCls}`}>
                    {sub.priority}
                  </div>
                  <div className={`font-mono text-[16px] font-bold ${sub.percentage >= 75 ? "text-success" : "text-danger"}`}>
                    {sub.percentage}%
                  </div>
                </div>
                
                <h3 className="font-semibold text-[14px] leading-snug mb-4 flex-1 line-clamp-2" title={sub.subject}>
                  {sub.subject}
                </h3>
                
                <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/50">
                  {sub.bunk_budget > 0 ? (
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-muted">Available Skips</span>
                      <span className="font-bold font-mono text-success">+{sub.bunk_budget}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-muted">Classes to Recover</span>
                      <span className="font-bold font-mono text-danger">-{sub.recovery_classes}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-muted">Attended / Conducted</span>
                    <span className="font-mono text-text">{sub.attended} / {sub.conducted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
