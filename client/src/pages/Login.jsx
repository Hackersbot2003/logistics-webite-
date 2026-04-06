import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080A0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(#1E2535 1px, transparent 1px), linear-gradient(90deg, #1E2535 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        opacity: 0.3,
      }} />
      {/* Amber glow */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "400px",
        background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        width: "100%", maxWidth: "420px",
        animation: "fadeUp 0.5s ease forwards",
      }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: "36px",
            color: "#FBBF24",
            letterSpacing: "-1px",
            lineHeight: 1,
          }}>
            DriveSafe
          </div>
          <div style={{ fontSize: "13px", color: "#475569", marginTop: "6px", fontFamily: "'JetBrains Mono', monospace" }}>
            FLEET MANAGEMENT SYSTEM
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#0E1117",
          border: "1px solid #1E2535",
          borderRadius: "20px",
          padding: "36px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, color: "#E2E8F0", marginBottom: "4px" }}>
            Sign in
          </h2>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "28px" }}>
            Access your fleet dashboard
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@drivesafe.com"
                required
                style={{
                  width: "100%", background: "#161B26", border: "1px solid #2A3347",
                  borderRadius: "10px", padding: "11px 14px", fontSize: "14px",
                  color: "#E2E8F0", outline: "none", transition: "border-color 0.2s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </div>

            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", background: "#161B26", border: "1px solid #2A3347",
                  borderRadius: "10px", padding: "11px 14px", fontSize: "14px",
                  color: "#E2E8F0", outline: "none", transition: "border-color 0.2s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#92400E" : "#F59E0B",
                color: "#080A0F",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                padding: "13px",
                borderRadius: "10px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.02em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#080A0F", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Signing in…
                </>
              ) : "Sign In →"}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        <div style={{textAlign:"center",marginTop:16}}>
          <a href="/home" style={{color:"#64748B",fontSize:13,textDecoration:"none"}}>← Back to Home</a>
        </div>
        </div>
      </div>
    </div>
  );
}
