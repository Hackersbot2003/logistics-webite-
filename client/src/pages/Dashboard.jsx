import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";

const RoleBadge = ({ role }) => {
  const colors = {
    superadmin: { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
    admin: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
    manager: { bg: "rgba(168,85,247,0.15)", color: "#C084FC" },
    user: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
  };
  const c = colors[role] || colors.user;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: "10px", fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "2px 8px", borderRadius: "4px",
    }}>
      {role}
    </span>
  );
};

const TokenBadge = ({ tokenNo }) => (
  <span style={{
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.2)",
    color: "#FBBF24",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "6px",
    letterSpacing: "0.05em",
  }}>
    {tokenNo}
  </span>
);

const StatCard = ({ label, value, sub, accent = "#F59E0B" }) => (
  <div style={{
    background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px",
    padding: "20px 22px", flex: 1,
  }}>
    <div style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ fontSize: "32px", fontWeight: 800, color: accent, fontFamily: "'Syne', sans-serif", lineHeight: 1.2, marginTop: "6px" }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{sub}</div>}
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { on } = useSocket();

  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenResult, setTokenResult] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchDrivers = useCallback(async (pg = 1, q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/drivers", { params: { page: pg, limit: 15, search: q } });
      setDrivers(data.drivers);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    } catch {
      toast.error("Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers(1, "");
  }, [fetchDrivers]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchDrivers(1, search), 350);
    return () => clearTimeout(t);
  }, [search, fetchDrivers]);

  // Real-time socket updates
  useEffect(() => {
    const unsubs = [
      on("driver:created", ({ driver }) => {
        setDrivers((prev) => [driver, ...prev]);
        setTotal((t) => t + 1);
        toast.success(`New driver: ${driver.tokenNo}`, { icon: "🆕" });
      }),
      on("driver:updated", ({ driver }) => {
        setDrivers((prev) => prev.map((d) => d._id === driver._id ? driver : d));
      }),
      on("driver:deleted", ({ driverId }) => {
        setDrivers((prev) => prev.filter((d) => d._id !== driverId));
        setTotal((t) => Math.max(0, t - 1));
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [on]);

  const handleTokenSearch = async () => {
    if (!tokenSearch.trim()) return;
    setTokenLoading(true);
    setTokenResult(null);
    try {
      const { data } = await api.get(`/drivers/token/${tokenSearch.trim()}`);
      setTokenResult(data.driver);
    } catch {
      toast.error("No driver found for that token");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this driver? This cannot be undone.")) return;
    try {
      await api.delete(`/drivers/${id}`);
      toast.success("Driver deleted");
      setDeleteId(null);
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div style={{ padding: "32px 28px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "30px", color: "#E2E8F0", margin: 0, letterSpacing: "-0.5px" }}>
            Fleet Dashboard
          </h1>
          <p style={{ color: "#475569", fontSize: "14px", marginTop: "4px" }}>
            {total} driver{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        {hasRole("superadmin", "admin", "manager") && (
          <button
            onClick={() => navigate("/drivers/new")}
            style={{
              background: "#F59E0B", color: "#080A0F",
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: "14px", padding: "11px 22px",
              borderRadius: "10px", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              boxShadow: "0 0 20px rgba(245,158,11,0.3)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#FBBF24"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#F59E0B"}
          >
            + Add Driver
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "24px" }}>
        <StatCard label="Total Drivers" value={total} sub="in system" />
        <StatCard label="This Page" value={drivers.length} sub={`of ${total}`} accent="#60A5FA" />
        <StatCard label="Page" value={`${page}/${pages}`} sub="pagination" accent="#C084FC" />
      </div>

      {/* Token Lookup */}
      <div style={{
        background: "#0E1117", border: "1px solid #1E2535",
        borderRadius: "14px", padding: "20px", marginBottom: "20px",
      }}>
        <div style={{ fontSize: "12px", color: "#475569", fontFamily: "'Syne', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
          🔍 Token Lookup
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            value={tokenSearch}
            onChange={(e) => setTokenSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleTokenSearch()}
            placeholder="DRV-XXXXXXXX"
            style={{
              flex: 1, background: "#161B26", border: "1px solid #2A3347",
              borderRadius: "8px", padding: "10px 14px", fontSize: "14px",
              color: "#FBBF24", fontFamily: "'JetBrains Mono', monospace",
              outline: "none", letterSpacing: "0.05em",
            }}
          />
          <button
            onClick={handleTokenSearch}
            disabled={tokenLoading}
            style={{
              background: "#1E2535", border: "1px solid #2A3347",
              color: "#E2E8F0", padding: "10px 20px",
              borderRadius: "8px", cursor: "pointer", fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tokenLoading ? "…" : "Look Up"}
          </button>
        </div>
        {tokenResult && (
          <div style={{
            marginTop: "12px", background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "10px", padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#E2E8F0" }}>{tokenResult.fullName}</div>
              <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
                {tokenResult.phoneNumber} · {tokenResult.licenseNo || "No license"}
              </div>
            </div>
            <button
              onClick={() => navigate(`/drivers/${tokenResult._id}`)}
              style={{
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                color: "#FBBF24", padding: "7px 16px", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              View →
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, token, aadhar…"
          style={{
            width: "100%", background: "#0E1117", border: "1px solid #1E2535",
            borderRadius: "10px", padding: "11px 16px", fontSize: "14px",
            color: "#E2E8F0", outline: "none", fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </div>

      {/* Driver Table */}
      <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "160px 1fr 130px 130px 120px 120px",
          padding: "12px 20px",
          borderBottom: "1px solid #1E2535",
          background: "#080A0F",
        }}>
          {["Token No", "Driver", "Phone", "License No", "Incharge", "Actions"].map((h) => (
            <div key={h} style={{ fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Syne', sans-serif" }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #1E2535", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : drivers.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#2A3347" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🚗</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px" }}>No drivers found</div>
          </div>
        ) : (
          drivers.map((driver, i) => (
            <div
              key={driver._id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 130px 130px 120px 120px",
                padding: "14px 20px",
                borderBottom: i < drivers.length - 1 ? "1px solid #1E2535" : "none",
                alignItems: "center",
                transition: "background 0.15s",
                animation: `fadeUp 0.3s ease ${i * 0.03}s both`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#161B26"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

              <div><TokenBadge tokenNo={driver.tokenNo} /></div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #2A3347, #1E2535)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", flexShrink: 0,
                  border: "1px solid #2A3347",
                  overflow: "hidden",
                }}>
                  {driver.photoUrls?.[0] ? (
                    <img src={driver.photoUrls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span>{driver.fullName?.[0]?.toUpperCase() || "?"}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>{driver.fullName}</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    {formatDistanceToNow(new Date(driver.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "#94A3B8" }}>{driver.phoneNumber || "—"}</div>
              <div style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{driver.licenseNo || "—"}</div>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>{driver.inchargeName || "—"}</div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => navigate(`/drivers/${driver._id}`)}
                  style={{ background: "#1E2535", border: "none", color: "#94A3B8", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                  onMouseEnter={(e) => { e.target.style.color = "#FBBF24"; e.target.style.background = "rgba(245,158,11,0.1)"; }}
                  onMouseLeave={(e) => { e.target.style.color = "#94A3B8"; e.target.style.background = "#1E2535"; }}
                >
                  View
                </button>
                {hasRole("superadmin", "admin", "manager") && (
                  <button
                    onClick={() => navigate(`/drivers/${driver._id}/edit`)}
                    style={{ background: "#1E2535", border: "none", color: "#94A3B8", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                    onMouseEnter={(e) => { e.target.style.color = "#60A5FA"; e.target.style.background = "rgba(59,130,246,0.1)"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#94A3B8"; e.target.style.background = "#1E2535"; }}
                  >
                    Edit
                  </button>
                )}
                {hasRole("superadmin", "admin") && (
                  <button
                    onClick={() => handleDelete(driver._id)}
                    style={{ background: "#1E2535", border: "none", color: "#94A3B8", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                    onMouseEnter={(e) => { e.target.style.color = "#EF4444"; e.target.style.background = "rgba(239,68,68,0.1)"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#94A3B8"; e.target.style.background = "#1E2535"; }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
          <button
            onClick={() => fetchDrivers(page - 1, search)}
            disabled={page === 1}
            style={{ background: "#1E2535", border: "1px solid #2A3347", color: page === 1 ? "#2A3347" : "#94A3B8", padding: "8px 16px", borderRadius: "8px", cursor: page === 1 ? "default" : "pointer", fontSize: "13px" }}
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchDrivers(p, search)}
              style={{
                background: p === page ? "rgba(245,158,11,0.15)" : "#1E2535",
                border: `1px solid ${p === page ? "rgba(245,158,11,0.3)" : "#2A3347"}`,
                color: p === page ? "#FBBF24" : "#94A3B8",
                padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => fetchDrivers(page + 1, search)}
            disabled={page === pages}
            style={{ background: "#1E2535", border: "1px solid #2A3347", color: page === pages ? "#2A3347" : "#94A3B8", padding: "8px 16px", borderRadius: "8px", cursor: page === pages ? "default" : "pointer", fontSize: "13px" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
