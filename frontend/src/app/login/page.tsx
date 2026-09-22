"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    fetchApi("/api/auth/status")
      .then((res: any) => {
        if (res.logged_in) {
          router.push("/dashboard");
        }
      })
      .catch(() => {}); // Ignore errors
  }, [router]);

  const fetchCaptcha = (uidValue: string) => {
    if (!uidValue) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    setCaptchaUrl(`${API_URL}/api/auth/captcha?uid=${encodeURIComponent(uidValue)}&t=${Date.now()}`);
    setError("");
  };

  const handleUidBlur = () => {
    if (uid && uid.length > 3) {
      fetchCaptcha(uid);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !password || !captcha) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ uid, password, captcha }),
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
      // Refresh captcha on failure
      fetchCaptcha(uid);
      setCaptcha("");
    } finally {
      setLoading(false);
    }
  };

  // Base64 encoded SVG for the subtle brick pattern
  const brickPattern = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSJ0cmFuc3BhcmVudCIgLz48cGF0aCBkPSJNMiwxNSBINjAgTTMyLDAgVjE1IE0yLDE1IFYzMCBNNjIsMTUgVjMwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIgLz48L3N2Zz4=`;

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#030614]"
      style={{
        backgroundImage: `url('${brickPattern}')`,
        backgroundSize: "60px 30px"
      }}
    >
      {/* Cool deep-blue surroundings overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030614]/50 via-[#030614]/80 to-[#030614] z-0 pointer-events-none"></div>

      {/* Warm wall lamp effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(255,200,100,0.18)_0%,rgba(0,30,80,0.1)_40%,rgba(0,0,0,0)_70%)] -mt-[100px] pointer-events-none mix-blend-screen z-0"></div>

      {/* Main Container */}
      <div className="w-full max-w-[420px] px-6 relative z-10">
        
        {/* Glassmorphism Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Login</h1>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* UID Field */}
            <div className="relative">
              <input
                type="text"
                required
                className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-4 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/40 pr-14 shadow-inner"
                placeholder="UID (e.g. 25CSH-114)"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                onBlur={handleUidBlur}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40">
                {/* User Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            </div>

            {/* Password Field */}
            <div className="relative">
              <input
                type="password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-4 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/40 pr-14 shadow-inner"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40">
                {/* Lock Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
            </div>

            {/* Captcha Field (Appears after UID is typed) */}
            {captchaUrl && (
              <div className="relative flex flex-col items-center space-y-3 animate-in fade-in zoom-in duration-300">
                <div 
                  className="bg-white p-1 rounded-xl w-full flex justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => fetchCaptcha(uid)}
                  title="Click to refresh captcha"
                >
                  <img
                    src={captchaUrl}
                    alt="Captcha"
                    className="h-[48px] rounded-lg object-contain"
                  />
                </div>
                <input
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-4 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/40 text-center tracking-widest shadow-inner"
                  placeholder="Enter Captcha"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                />
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm text-white/50 px-2 mt-2">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white/80 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-white accent-white/40 cursor-pointer" 
                />
                <span>Remember me</span>
              </label>
              <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || (!captchaUrl && uid.length > 3)}
              className="w-full mt-4 bg-white hover:bg-gray-100 text-[#030614] font-bold text-lg py-4 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          {/* Registration / Help Text */}
          <div className="mt-8 text-center text-sm text-white/50">
            Sign in with your University ERP credentials
          </div>
        </div>
      </div>
    </div>
  );
}
