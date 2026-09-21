"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetchApi("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      router.push("/login");
    }
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Timetable", href: "/timetable" },
    { name: "Calendar", href: "/calendar" },
    { name: "Health", href: "/health" },
    { name: "Bunk Calc", href: "/bunk-calculator" },
    { name: "Predictor", href: "/predictor" },
    { name: "What-If", href: "/what-if" },
    { name: "Weekly", href: "/weekly" },
    { name: "Today's Plan", href: "/smart-plan" },
  ];

  return (
    <nav className="h-[56px] bg-surface border-b border-border flex items-center px-7 sticky top-0 z-50 gap-8">
      <Link href="/dashboard" className="font-mono text-[13px] font-medium tracking-widest text-accent uppercase no-underline">
        AttendWise
      </Link>
      
      <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar items-center">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium no-underline transition-colors whitespace-nowrap
              ${pathname === link.href ? "text-accent bg-border" : "text-muted hover:text-text hover:bg-border"}
            `}
          >
            {link.name}
          </Link>
        ))}
      </div>

      <button 
        onClick={handleLogout}
        className="text-[13px] text-muted hover:text-danger font-medium whitespace-nowrap transition-colors"
      >
        Logout
      </button>
    </nav>
  );
}
