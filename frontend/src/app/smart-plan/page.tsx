"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import Link from "next/link";

export default function SmartPlanPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to Dashboard where Today's Plan is now integrated
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="p-7 max-w-[800px] mx-auto text-center mt-12">
        <h1 className="text-[20px] font-bold tracking-tight mb-2">Today's Plan has moved</h1>
        <p className="text-[14px] text-muted mb-6">
          Today's Plan is now directly integrated into the main Attendance Dashboard for faster, unified access.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hi transition-colors text-[14px]"
        >
          Go to Dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
