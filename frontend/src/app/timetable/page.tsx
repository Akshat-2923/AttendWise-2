"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { fetchApi } from "../../lib/api";

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

export default function TimetablePage() {
  const [data, setData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => {
    fetchApi("/api/timetable")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load timetable.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="p-7 max-w-[1200px] mx-auto text-muted">Fetching timetable...</div>
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
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Weekly Timetable</h1>
          <p className="text-[13px] text-muted mt-1">Your registered class schedule</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {days.map((day) => {
            const slots = data?.[day] || [];
            const hasClasses = slots.length > 0;

            return (
              <div key={day} className="bg-surface border border-border rounded-xl flex flex-col h-full overflow-hidden">
                <div className={`p-3 font-semibold text-center text-[13px] uppercase tracking-widest border-b border-border ${hasClasses ? 'bg-accent/10 text-accent' : 'bg-surface2 text-muted'}`}>
                  {day}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-3">
                  {!hasClasses ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <div className="text-[12px] font-medium text-muted">No classes</div>
                      <div className="text-[11px] text-muted/60 mt-1">Enjoy your day</div>
                    </div>
                  ) : (
                    slots.map((slot, idx) => (
                      <div key={idx} className="bg-surface2 rounded-lg p-3 border border-border/50 text-[12px]">
                        <div className="font-mono text-accent text-[11px] mb-1 font-semibold">{slot.time}</div>
                        <div className="font-bold mb-0.5 line-clamp-2 leading-snug">{slot.subject_name || slot.subject_code}</div>
                        
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="bg-border text-text px-1.5 py-0.5 rounded text-[10px] font-medium">{slot.room}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${slot.type === 'P' ? 'bg-warning/20 text-warning' : 'bg-accent/20 text-accent'}`}>
                            {slot.type === 'P' ? 'Lab' : 'Lecture'}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted mt-2 truncate" title={slot.faculty}>{slot.faculty}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
