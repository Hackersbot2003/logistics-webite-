import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { format, formatDistanceToNow } from "date-fns";

const ROLES = ["superadmin", "admin", "manager", "user"];
const ROLE_COLORS = {
  superadmin: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "rgba(245,158,11,0.25)" },
  admin: { bg: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "rgba(59,130,246,0.25)" },
  manager: { bg: "rgba(168,85,247,0.12)", color: "#C084FC", border: "rgba(168,85,247,0.25)" },
  user: { bg: "rgba(100,116,139,0.12)", color: "#94A3B8", border: "rgba(100,116,139,0.25)" },
};

const RolePill = ({ role }) => {
  const c = ROLE_COLORS[role] || ROLE_COLORS.user;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: "6px" }}>
      {role}
    </span>
  );
};

const inputStyle = {
  width: "100%", background: "#0E1117", border: "1px solid #2A3347",
  borderRadius: "8px", padding: "10px 13px", fontSize: "14px",
  color: "#E2E8F0", outline: "none", fontFamily: "'DM Sans', sans-serif",
};

// ── Queue Monitor Component ───────────────────────────────────────────────────
const OpBadge = ({ op }) => {
  const colors = {
    append: { bg: "rgba(34,197,94,0.12)", color: "#4ADE80", border: "rgba(34,197,94,0.25)" },
    update: { bg: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "rgba(59,130,246,0.25)" },
    delete: { bg: "rgba(239,68,68,0.12)", color: "#F87171", border: "rgba(239,68,68,0.25)" },
  };
  const c = colors[op] || colors.update;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: "4px" }}>
      {op}
    </span>
  );
};

function QueueMonitor() {
  const [stats, setStats] = useState(null);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [failedJobs, setFailedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/auth/queue-stats");
      setStats(data.stats);
      setPendingJobs(data.pendingJobs || []);
      setFailedJobs(data.recentFailed || []);
    } catch {
      // silently fail — queue monitor is non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return null;

  const allClear = stats?.pending === 0 && stats?.failed === 0;

  return (
    <div style={{
      background: "#0E1117",
      border: `1px solid ${allClear ? "#1E2535" : stats?.failed > 0 ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
      borderRadius: "14px",
      marginBottom: "24px",
      overflow: "hidden",
    }}>
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Status dot */}
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: allClear ? "#22C55E" : stats?.failed > 0 ? "#EF4444" : "#F59E0B",
            boxShadow: `0 0 8px ${allClear ? "#22C55E80" : stats?.failed > 0 ? "#EF444480" : "#F59E0B80"}`,
          }} />
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>
              Google Sheets Sync Queue
            </div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "1px" }}>
              MongoDB-backed retry queue · auto-refreshes every 30s
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Stat pills */}
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", padding: "3px 10px", borderRadius: "6px" }}>
              {stats?.pending ?? 0} pending
            </span>
            {stats?.failed > 0 && (
              <span style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", padding: "3px 10px", borderRadius: "6px" }}>
                {stats.failed} failed
              </span>
            )}
            {allClear && (
              <span style={{ background: "rgba(34,197,94,0.1)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.2)", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", padding: "3px 10px", borderRadius: "6px" }}>
                ✓ all synced
              </span>
            )}
          </div>
          <span style={{ color: "#475569", fontSize: "12px" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #1E2535", padding: "20px" }}>
          {/* How it works note */}
          <div style={{
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#64748B", lineHeight: 1.6,
          }}>
            <span style={{ color: "#60A5FA", fontWeight: 600 }}>How this works: </span>
            When a Google Sheets sync fails (e.g. API limit hit), the failed operation is saved here in MongoDB. A background worker retries every 2 minutes with exponential backoff. Once it succeeds, the record is automatically deleted. No data is ever lost.
          </div>

          {pendingJobs.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "'Syne', sans-serif" }}>
                Pending Retries ({pendingJobs.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {pendingJobs.map((job, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "80px 1fr 1fr auto",
                    alignItems: "center", gap: "12px",
                    background: "#161B26", border: "1px solid #1E2535",
                    borderRadius: "8px", padding: "10px 14px",
                  }}>
                    <OpBadge op={job.operation} />
                    <div style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {String(job.driverId || "snapshot").slice(-8)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      Attempt {job.attempts} · retries {job.retryAfter ? formatDistanceToNow(new Date(job.retryAfter), { addSuffix: true }) : "soon"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#EF4444", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.lastError}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedJobs.length > 0 && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "'Syne', sans-serif" }}>
                Permanently Failed — Needs Manual Attention ({failedJobs.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {failedJobs.map((job, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "80px 1fr 1fr auto",
                    alignItems: "center", gap: "12px",
                    background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)",
                    borderRadius: "8px", padding: "10px 14px",
                  }}>
                    <OpBadge op={job.operation} />
                    <div style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                      {String(job.driverId || job.driverSnapshot?.tokenNo || "unknown").slice(-12)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      {job.attempts} attempts · {job.updatedAt ? formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true }) : ""}
                    </div>
                    <div style={{ fontSize: "11px", color: "#EF4444", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.lastError}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allClear && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#2A3347", fontSize: "14px" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
              All Google Sheets operations are in sync
            </div>
          )}

          <div style={{ textAlign: "right", marginTop: "12px" }}>
            <button
              onClick={fetchStats}
              style={{ background: "none", border: "1px solid #1E2535", color: "#475569", fontSize: "12px", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Challan Reset Section ─────────────────────────────────────────────────────
function ChallanResetSection() {
  const { hasRole } = useAuth();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/vehicles/challan-settings");
      setSettings(data.settings);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const update = (i, key, val) => {
    setSettings(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  };

  const reset = async (s) => {
    setSaving(s.sheetType);
    try {
      await api.post("/vehicles/challan-reset", {
        sheetType: s.sheetType,
        resetDate: s.manualReset ? new Date() : undefined,
        autoResetDate: s.autoResetDate,
      });
      toast.success(`${s.sheetType} challan counter reset`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || "Reset failed"); }
    finally { setSaving(""); }
  };

  const save = async (s) => {
    setSaving(s.sheetType + "_save");
    try {
      await api.post("/vehicles/challan-reset", { sheetType: s.sheetType, autoResetDate: s.autoResetDate });
      toast.success(`${s.sheetType} settings saved`);
    } catch (err) { toast.error("Save failed"); }
    finally { setSaving(""); }
  };

  const TYPE_LABELS = { FML: "FML", FML_EXP: "EXP-FML", Others: "Others" };

  return (
    <div style={{ marginTop: 32, background: "#0E1117", border: "1px solid #1E2535", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E2535", background: "#080A0F", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔢</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#E2E8F0" }}>Challan Number Settings</span>
        <span style={{ fontSize: 12, color: "#475569", marginLeft: 4 }}>Reset challan counters per logistics type. Auto-resets on April 1 each year.</span>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading…</div>
      ) : (
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {settings.map((s, i) => (
            <div key={s.sheetType} style={{ background: "#161B26", border: "1px solid #1E2535", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#FBBF24", marginBottom: 12 }}>
                {TYPE_LABELS[s.sheetType] || s.sheetType}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Current Counter</label>
                <div style={{ background: "#0E1117", border: "1px solid #2A3347", borderRadius: 7, padding: "8px 12px", fontSize: 14, color: "#E2E8F0", fontFamily: "monospace" }}>
                  {s.prefix}{String(s.counter).padStart(2, "0")} (next: {s.prefix}{String(s.counter + 1).padStart(2, "0")})
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Auto-Reset Date (MM-DD)</label>
                <input value={s.autoResetDate || "04-01"} onChange={e => update(i, "autoResetDate", e.target.value)}
                  placeholder="04-01" style={{ width: "100%", background: "#0E1117", border: "1px solid #2A3347", borderRadius: 7, padding: "8px 12px", fontSize: 14, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Default: 04-01 (April 1)</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Last Reset</label>
                <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
                  {s.resetDate ? new Date(s.resetDate).toLocaleDateString("en-IN") : "Never"}
                </div>
              </div>
              {hasRole("superadmin") && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => save(s)} disabled={!!saving}
                    style={{ flex: 1, padding: "7px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 7, color: "#60A5FA", fontSize: 12, cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>
                    {saving === s.sheetType + "_save" ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => reset({ ...s, manualReset: true })} disabled={!!saving}
                    style={{ flex: 1, padding: "7px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#F87171", fontSize: 12, cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>
                    {saving === s.sheetType ? "Resetting…" : "Reset Now"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const { user: me, hasRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auth/users");
      setUsers(data.users);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/register", form);
      toast.success(`User ${form.email} registered`);
      setForm({ name: "", email: "", password: "", role: "user" });
      setShowForm(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (userId, isActive) => {
    try {
      await api.patch(`/auth/users/${userId}/toggle`);
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  // Superadmin can create any role below superadmin; admin creates manager/user
  const allowedRoles = hasRole("superadmin") ? ["superadmin", "admin", "manager", "user"] : ["manager", "user"];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "28px", color: "#E2E8F0", margin: 0 }}>
            User Management
          </h1>
          <p style={{ color: "#475569", fontSize: "14px", marginTop: "4px" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          style={{
            background: showForm ? "#1E2535" : "#F59E0B",
            color: showForm ? "#94A3B8" : "#080A0F",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: "14px", padding: "10px 20px",
            borderRadius: "10px", border: showForm ? "1px solid #2A3347" : "none",
            cursor: "pointer", transition: "all 0.2s",
            display: hasRole("superadmin") ? "block" : "none",
          }}
        >
          {showForm ? "Cancel" : "+ Register User"}
        </button>
      </div>

      {/* Sheets Sync Queue Monitor — visible to superadmin and admin */}
      {hasRole("superadmin", "admin") && <QueueMonitor />}

      {/* Register Form */}
      {showForm && (
        <div style={{
          background: "#0E1117", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "16px", padding: "28px", marginBottom: "24px",
          animation: "slideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}`}</style>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, color: "#E2E8F0", marginTop: 0, marginBottom: "20px" }}>
            Register New User
          </h3>
          <form onSubmit={handleRegister}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>Email</label>
                <input
                  type="email" value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>Password</label>
                <input
                  type="password" value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required minLength={6} style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                >
                  {allowedRoles.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#F59E0B", color: "#080A0F",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700,
                  fontSize: "14px", padding: "10px 24px",
                  borderRadius: "9px", border: "none", cursor: saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: "8px",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#080A0F", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Registering…
                  </>
                ) : "Register →"}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 180px 100px 120px 80px",
          padding: "12px 20px", borderBottom: "1px solid #1E2535",
          background: "#080A0F",
        }}>
          {["User", "Email", "Role", "Joined", "Status"].map((h) => (
            <div key={h} style={{ fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Syne', sans-serif" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: "3px solid #1E2535", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          </div>
        ) : (
          users.map((u, i) => (
            <div
              key={u._id}
              style={{
                display: "grid", gridTemplateColumns: "1fr 180px 100px 120px 80px",
                padding: "14px 20px",
                borderBottom: i < users.length - 1 ? "1px solid #1E2535" : "none",
                alignItems: "center",
                opacity: u.isActive ? 1 : 0.45,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#161B26"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>{u.name}</div>
                {u._id === me._id && (
                  <div style={{ fontSize: "11px", color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>you</div>
                )}
              </div>
              <div style={{ fontSize: "13px", color: "#64748B" }}>{u.email}</div>
              <div><RolePill role={u.role} /></div>
              <div style={{ fontSize: "12px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
                {format(new Date(u.createdAt), "MMM d, yyyy")}
              </div>
              <div>
                {u.role !== "superadmin" && u._id !== me._id && hasRole("superadmin") ? (
                  <button
                    onClick={() => handleToggle(u._id, u.isActive)}
                    style={{
                      background: u.isActive ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                      border: `1px solid ${u.isActive ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                      color: u.isActive ? "#EF4444" : "#22C55E",
                      fontSize: "11px", fontWeight: 600,
                      padding: "4px 12px", borderRadius: "6px",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                ) : (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "11px",
                    color: u.isActive ? "#22C55E" : "#EF4444",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: u.isActive ? "#22C55E" : "#EF4444",
                    }} />
                    {u.isActive ? "Active" : "Off"}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <ChallanResetSection />
    </div>
  );
}