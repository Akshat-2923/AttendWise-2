"use client";

import { useEffect, useState } from "react";
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

export default function Dashboard() {
  const [data, setData] = useState<SubjectAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    fetchApi("/api/attendance")
      .then((res) => {
        setData(res);
        setLastUpdated(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load attendance data.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1200px] mx-auto text-muted">Fetching live data...</div>
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
      y: { min: 0, max: 100, ticks: { color: "#6b7191", font: { size: 11 }, callback: (v: any) => v + "%" }, grid: { color: "#1f2330" } },
    },
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[1200px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Attendance Overview</h1>
          <p className="text-[13px] text-muted mt-1">Live data · {lastUpdated}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2.5">Total Subjects</div>
            <div className="text-[30px] font-bold font-mono leading-none text-accent">{data.length}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2.5">Safe Subjects</div>
            <div className="text-[30px] font-bold font-mono leading-none text-success">{safeCount}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2.5">At Risk</div>
            <div className="text-[30px] font-bold font-mono leading-none text-danger">{riskCount}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-2.5">Avg Attendance</div>
            <div className="text-[30px] font-bold font-mono leading-none text-text">{avgAttendance}%</div>
          </div>
        </div>

        {/* Calendar Card Link */}
        <div className="mb-6">
          <Link href="/calendar" className="block bg-surface border border-border rounded-xl p-6 hover:border-border-hi transition-colors">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold">View Attendance Calendar</span>
                <span className="text-[13px] text-muted">Explore daily class history and filter by subjects</span>
              </div>
              <div className="text-accent text-[20px]">&rarr;</div>
            </div>
          </Link>
        </div>

        {/* Attendance Table */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-5">
          <div className="flex items-center gap-2.5 mb-4 font-semibold text-[14px]">
            Attendance Summary
            <span className="text-[11px] font-medium bg-border text-muted px-2 py-0.5 rounded-full font-mono">{data.length} subjects</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Subject</th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Attendance</th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Progress</th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Bunk Budget</th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Recovery</th>
                  <th className="pb-3 px-3.5 border-b border-border text-[11px] font-semibold tracking-wider uppercase text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const pct = s.percentage;
                  const isSafe = s.status === "Safe";
                  const isBelow = s.status === "Below Threshold";
                  const cls = pct >= 80 ? "text-success bg-success" : pct >= 75 ? "text-warning bg-warning" : "text-danger bg-danger";
                  const pillCls = isSafe ? "text-success bg-success/10" : isBelow ? "text-danger bg-danger/10" : "text-warning bg-warning/10";
                  const pillLabel = isSafe ? "Safe" : isBelow ? "Below 75%" : "Warning";

                  return (
                    <tr key={s.code} className="border-b border-border hover:bg-surface2 transition-colors last:border-b-0">
                      <td className="p-3.5 font-medium text-[13.5px]">
                        <Link href={`/subject/${s.code}`} className="hover:underline">{s.subject}</Link>
                      </td>
                      <td className={`p-3.5 font-mono font-semibold text-[13.5px] ${pct >= 80 ? "text-success" : pct >= 75 ? "text-warning" : "text-danger"}`}>
                        {pct}%
                      </td>
                      <td className="p-3.5">
                        <div className="h-[5px] w-full bg-border rounded-full overflow-hidden flex items-center">
                          <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-success" : pct >= 75 ? "bg-warning" : "bg-danger"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-[13.5px]">{s.bunk_budget}</td>
                      <td className={`p-3.5 font-mono text-[13.5px] ${s.recovery_classes > 0 ? "text-danger" : "text-muted"}`}>{s.recovery_classes}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${pillCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSafe ? "bg-success" : isBelow ? "bg-danger" : "bg-warning"}`} />
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

        {/* Chart Card */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="font-semibold text-[14px] mb-4">Attendance Distribution</div>
          <div className="h-[220px] relative">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
