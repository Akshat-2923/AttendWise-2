"use client";

import { useEffect, useState } from "react";
import Nav from "../../../components/Nav";
import { fetchApi } from "../../../lib/api";
import { useParams } from "next/navigation";
import { SubjectAttendance } from "../../../types/attendance";
import Link from "next/link";

export default function SubjectPage() {
  const { code } = useParams();
  const [data, setData] = useState<SubjectAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    
    fetchApi(`/api/subject/${code}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load subject details.");
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[800px] mx-auto text-muted">Loading subject details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[800px] mx-auto text-danger">{error || "Subject not found"}</div>
      </div>
    );
  }

  const isSafe = data.status === "Safe";
  const isBelow = data.status === "Below Threshold";
  
  let headerBg = "bg-warning/10 border-warning/30";
  let headerColor = "text-warning";
  if (isSafe) { headerBg = "bg-success/10 border-success/30"; headerColor = "text-success"; }
  else if (isBelow) { headerBg = "bg-danger/10 border-danger/30"; headerColor = "text-danger"; }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-accent text-[13px] hover:underline">&larr; Back to Dashboard</Link>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[24px] font-bold tracking-tight">{data.subject}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${headerBg} ${headerColor}`}>
              {data.status}
            </span>
          </div>
          <p className="text-[14px] text-muted font-mono">{data.code}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">Current %</div>
            <div className={`text-[36px] font-bold font-mono ${headerColor}`}>
              {data.percentage}%
            </div>
          </div>
          
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-center">
            {data.bunk_budget > 0 ? (
              <>
                <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">Available Skips</div>
                <div className="text-[28px] font-bold font-mono text-success">+{data.bunk_budget} classes</div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2">Recovery Needed</div>
                <div className="text-[28px] font-bold font-mono text-danger">-{data.recovery_classes} classes</div>
              </>
            )}
          </div>
        </div>

        <h2 className="text-[16px] font-semibold mb-4">Detailed Stats</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex justify-between p-4 border-b border-border bg-surface2">
            <span className="text-muted text-[14px]">Conducted</span>
            <span className="font-mono font-semibold">{data.conducted}</span>
          </div>
          <div className="flex justify-between p-4 border-b border-border">
            <span className="text-muted text-[14px]">Attended</span>
            <span className="font-mono font-semibold text-success">{data.attended}</span>
          </div>
          <div className="flex justify-between p-4 border-b border-border bg-surface2">
            <span className="text-muted text-[14px]">Missed</span>
            <span className="font-mono font-semibold text-danger">{data.conducted - data.attended}</span>
          </div>
          <div className="flex justify-between p-4 border-b border-border">
            <span className="text-muted text-[14px]">Medical Leave</span>
            <span className="font-mono font-semibold">{data.medical_leave || 0}</span>
          </div>
          <div className="flex justify-between p-4">
            <span className="text-muted text-[14px]">Duty Leave</span>
            <span className="font-mono font-semibold">{data.duty_leave || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
