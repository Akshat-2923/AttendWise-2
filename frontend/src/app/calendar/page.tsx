"use client";

import { useEffect, useState, useMemo } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";

interface CalendarRecord {
  date: string; // YYYY-MM-DD
  time: string;
  course_code: string;
  subject: string;
  type: string;
  section?: string;
  status: "Present" | "Absent" | "Unknown";
}

interface CalendarResponse {
  data: CalendarRecord[];
  last_sync: string;
}

export default function CalendarPage() {
  const [records, setRecords] = useState<CalendarRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<CalendarRecord[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalRecords, setModalRecords] = useState<CalendarRecord[]>([]);

  const fetchHistory = async (force = false) => {
    setLoading(true);
    try {
      const res: CalendarResponse = await fetchApi(`/api/calendar/history?force_refresh=${force}`);
      setRecords(res.data || []);
      setFilteredRecords(res.data || []);
      setFilter("all");
      setLastSync(res.last_sync || "Just now");
    } catch (err: any) {
      setError(err.message || "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilter(val);
    if (val === "all") {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(records.filter((r) => (r.subject || r.course_code) === val));
    }
  };

  const subjects = useMemo(() => {
    const map = new Map<string, {subject: string, course_code: string}>();
    records.forEach((r) => {
      const key = r.course_code || r.subject;
      if (key && !map.has(key)) {
        map.set(key, { subject: r.subject || key, course_code: r.course_code || "" });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [records]);

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startOffset = firstDay.getDay() - 1;
  if (startOffset === -1) startOffset = 6; // Sunday

  const daysInMonth = lastDay.getDate();
  
  const recordMap = useMemo(() => {
    const map: Record<string, CalendarRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [filteredRecords]);

  // Stats for this month
  let mTotal = 0;
  let mPresent = 0;
  let mAbsent = 0;
  
  Object.keys(recordMap).forEach(date => {
    const d = new Date(date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      recordMap[date].forEach(r => {
        mTotal++;
        if (r.status === "Present") mPresent++;
        else if (r.status === "Absent") mAbsent++;
      });
    }
  });

  const perc = mTotal > 0 ? ((mPresent / mTotal) * 100).toFixed(2) : "0.00";

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  
  const handleDayClick = (dStr: string, dayRecords: CalendarRecord[]) => {
    setModalDate(dStr);
    setModalRecords(dayRecords);
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[1200px] mx-auto">
        <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">Attendance Calendar</h1>
            <p className="text-[13px] text-muted mt-1">{loading ? "Loading history..." : `Last synced: ${lastSync}`}</p>
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={filter}
              onChange={handleFilterChange}
              className="bg-surface2 border border-border rounded-lg pl-4 pr-10 py-2.5 text-text focus:outline-none focus:border-accent transition-colors text-[14px] max-w-[250px]"
            >
              <option value="all">All Subjects</option>
              {subjects.map(sub => {
                const val = sub.course_code || sub.subject;
                return (
                  <option key={val} value={val}>
                    {sub.subject} {sub.course_code ? `(${sub.course_code})` : ""}
                  </option>
                );
              })}
            </select>
            <button 
              onClick={() => fetchHistory(true)}
              disabled={loading}
              className="bg-accent hover:bg-accent-hi text-white pl-4 pr-10 py-2.5 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              Sync
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-1">Classes Conducted</div>
            <div className="text-[20px] font-bold font-mono text-text">{mTotal}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-1">Attended</div>
            <div className="text-[20px] font-bold font-mono text-success">{mPresent}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-1">Missed</div>
            <div className="text-[20px] font-bold font-mono text-danger">{mAbsent}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-1">Attendance %</div>
            <div className="text-[20px] font-bold font-mono text-text">{perc}%</div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden relative">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <div className="text-[16px] font-semibold">{monthNames[month]} {year}</div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="px-3 py-1.5 border border-border rounded-lg text-[13px] font-semibold hover:bg-border transition-colors"
              >Prev</button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 border border-border rounded-lg text-[13px] font-semibold hover:bg-border transition-colors"
              >Today</button>
              <button 
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="px-3 py-1.5 border border-border rounded-lg text-[13px] font-semibold hover:bg-border transition-colors"
              >Next</button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 border-b border-border">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="p-3 text-center text-[11px] font-semibold text-muted uppercase border-r border-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-2 border-r border-b border-border last:border-r-0 bg-transparent" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const dayRecords = recordMap[dStr] || [];
              const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
              
              return (
                <div 
                  key={dStr} 
                  onClick={() => handleDayClick(dStr, dayRecords)}
                  className={`min-h-[100px] p-2 border-r border-b border-border last:border-r-0 cursor-pointer hover:bg-surface2 transition-colors relative ${isToday ? "bg-accent/5" : ""}`}
                >
                  <div className={`text-[13px] font-medium mb-2 ${isToday ? "text-accent font-bold" : "text-muted"}`}>
                    {d}
                  </div>
                  {dayRecords.length > 0 && (
                    <>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {dayRecords.map((r, idx) => (
                          <div 
                            key={idx} 
                            className={`w-2 h-2 rounded-full ${
                              r.status === "Present" ? "bg-success" : 
                              r.status === "Absent" ? "bg-danger" : 
                              "bg-gray-500"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] text-muted hidden md:block mt-1">
                        {dayRecords.length} class{dayRecords.length > 1 ? "es" : ""}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            
            {/* Fill remaining empty cells */}
            {Array.from({ length: (7 - ((startOffset + daysInMonth) % 7)) % 7 }).map((_, i) => (
              <div key={`empty-end-${i}`} className="min-h-[100px] p-2 border-r border-b border-border last:border-r-0 bg-transparent" />
            ))}
          </div>

          {loading && (
            <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center text-muted font-medium">
              Fetching attendance history...
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalDate && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalDate(null);
          }}
        >
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-[16px] font-semibold">
                {new Date(modalDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </h2>
              <button 
                onClick={() => setModalDate(null)}
                className="text-muted hover:text-text text-[20px] leading-none"
              >&times;</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {modalRecords.length === 0 ? (
                <div className="text-center p-8 text-muted">
                  No attendance records found for this date.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {modalRecords.sort((a,b) => a.time.localeCompare(b.time)).map((r, i) => (
                    <div key={i} className="p-3 border border-border rounded-lg bg-surface2 flex justify-between items-center">
                      <div className="flex flex-col gap-1">
                        <div className="font-mono text-[11px] text-muted">{r.time || "--:--"}</div>
                        <div className="text-[13px] font-semibold">{r.subject || r.course_code}</div>
                        <div className="text-[11px] text-muted">{r.type || "Lecture"} {r.section ? `· Sec ${r.section}` : ""}</div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                        r.status === "Present" ? "bg-success/15 text-success" : 
                        r.status === "Absent" ? "bg-danger/15 text-danger" : 
                        "bg-gray-500/15 text-gray-500"
                      }`}>
                        {r.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
