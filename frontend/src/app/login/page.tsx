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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-muted text-sm">Sign in with your University ERP credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">UID</label>
            <input
              type="text"
              required
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-2.5 text-text focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. 25CSH-114"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onBlur={handleUidBlur}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Password</label>
            <input
              type="password"
              required
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-2.5 text-text focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {captchaUrl && (
            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-medium text-muted">Captcha</label>
              <div className="flex gap-4 mb-2">
                <img
                  src={captchaUrl}
                  alt="Captcha"
                  className="h-[40px] rounded border border-border cursor-pointer bg-white"
                  onClick={() => fetchCaptcha(uid)}
                  title="Click to refresh captcha"
                />
              </div>
              <input
                type="text"
                required
                className="w-full bg-surface2 border border-border rounded-lg px-4 py-2.5 text-text focus:outline-none focus:border-accent transition-colors uppercase"
                placeholder="Enter captcha text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !captchaUrl}
            className="w-full mt-4 bg-accent hover:bg-accent-hi text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
