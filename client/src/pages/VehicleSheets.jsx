import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDoubleConfirm } from "../components/DoubleConfirm";

// ─── Glassmorphism card style ─────────────────────────────────────────────────
const GLASS = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.6)",
  borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const C = {
  blue: "#2563EB", red: "#EF4444", green: "#16A34A",
  text: "#1E293B", muted: "#64748B", border: "#E2E8F0",
};

const INP = {
  padding: "9px 13px", border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 14, color: C.text, outline: "none", background: "#fff",
  width: "100%", boxSizing: "border-box",
};

const BTN = (bg, color = "#fff", extra = {}) => ({
  padding: "9px 18px", background: bg, border: "none", borderRadius: 7,
  color, cursor: "pointer", fontSize: 13, fontWeight: 600, ...extra,
});

const TYPES = ["FML", "FML_EXP", "Others"];

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ sheet, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...GLASS, padding: 32, maxWidth: 420, width: "100%", background: "rgba(255,255,255,0.95)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{step === 1 ? "⚠️" : "🗑️"}</div>
        <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: C.text }}>
          {step === 1 ? "Delete Sheet?" : "Final Confirmation"}
        </h3>
        {step === 1 ? (
          <>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>
              You are about to delete <b style={{ color: C.red }}>{sheet.sheetName}</b> and all its vehicle data. This cannot be undone.
              {sheet.vehicleCount > 0 && <span style={{ color: C.red, display: "block", marginTop: 6 }}>⚠️ {sheet.vehicleCount} vehicle records will be permanently deleted.</span>}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onCancel} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
              <button onClick={() => setStep(2)} style={BTN(C.red)}>Yes, continue →</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 10 }}>Type the sheet name to confirm:</p>
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={sheet.sheetName}
              style={{ ...INP, marginBottom: 16, borderColor: typed === sheet.sheetName ? C.red : C.border }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onCancel} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
              <button disabled={typed !== sheet.sheetName || busy} onClick={async () => { setBusy(true); await onConfirm(); }}
                style={{ ...BTN(C.red), opacity: typed !== sheet.sheetName ? 0.5 : 1 }}>
                {busy ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Petrol Pump Section ──────────────────────────────────────────────────────
function PetrolPumpSection() {
  const { hasRole } = useAuth();
  const [pumps, setPumps] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [added, setAdded] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = hasRole("superadmin", "admin");

  const load = useCallback(async (pg = 1) => {
    try {
      const { data } = await api.get(`/vehicle-sheets/pumps?page=${pg}&limit=10`);
      setPumps(data.pumps);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const addPump = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.post("/vehicle-sheets/pumps", { name: name.trim() });
      setAdded(name.trim());
      setName("");
      load(1);
      setTimeout(() => setAdded(""), 3000);
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };

  const deletePump = async (id) => {
    try { await api.delete(`/vehicle-sheets/pumps/${id}`); load(page); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div style={{ ...GLASS, padding: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
        ⛽ Petrol Pump
      </h3>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ ...GLASS, padding: 24, background: "rgba(255,255,255,0.9)", textAlign: "center" }}>
          <h4 style={{ margin: "0 0 16px", fontWeight: 700, color: C.text }}>Add Petrol Pump</h4>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter petrol pump name"
            onKeyDown={e => e.key === "Enter" && addPump()}
            style={{ ...INP, marginBottom: 10, textAlign: "center" }} />
          <button onClick={addPump} disabled={loading}
            style={{ ...BTN(C.blue), width: "100%", marginBottom: added ? 10 : 0 }}>
            Add Petrol Pump
          </button>
          {added && <div style={{ color: C.green, fontSize: 13, marginTop: 8 }}>✅ Added: {added}</div>}

          {pumps.length > 0 && (
            <div style={{ marginTop: 16, textAlign: "left" }}>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 8, fontSize: 14 }}>Current Petrol Pumps</div>
              {pumps.map(p => (
                <div key={p._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8FAFC", borderRadius: 7, marginBottom: 6, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 14, color: C.text }}>{p.name}</span>
                  {isAdmin && (
                    <button onClick={() => deletePump(p._id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 16 }}>🗑</button>
                  )}
                </div>
              ))}
              {pages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <button onClick={() => load(page - 1)} disabled={page === 1} style={BTN("#F1F5F9", C.muted, { padding: "6px 14px" })}>Prev</button>
                  <span style={{ fontSize: 13, color: C.muted }}>Page {page} of {pages}</span>
                  <button onClick={() => load(page + 1)} disabled={page === pages} style={BTN("#F1F5F9", C.muted, { padding: "6px 14px" })}>Next</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sheet Manager for one type ───────────────────────────────────────────────
function SheetManager({ sheetType }) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("superadmin");
  const isAdmin = hasRole("superadmin", "admin");

  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetName, setSheetName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [delTarget, setDelTarget] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Financial year: April-based
  const now = new Date();
  const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyDisplay = `${yr}-${String(yr + 1).slice(2)}`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/vehicle-sheets?type=${sheetType}`);
      setSheets(data.sheets);
      const active = data.sheets.find(s => s.status === "active");
      if (active) setActiveId(active._id);
    } catch { toast.error("Failed to load sheets"); }
    finally { setLoading(false); }
  }, [sheetType]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const createSheet = async () => {
    if (!sheetName.trim()) return toast.error("Enter sheet name");
    setCreating(true);
    try {
      await api.post("/vehicle-sheets", { sheetName: sheetName.trim(), sheetType, financialYear: fyDisplay });
      setSheetName("");
      load();
      toast.success("Sheet created");
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
    finally { setCreating(false); }
  };

 const setActive = async (id) => {
  try {
    await api.patch(`/vehicle-sheets/set-active/${id}`);
    setActiveId(id);
    load();
  } catch {
    toast.error("Failed to set active");
  }
};

  const toggleLock = async (id) => {
    try { await api.patch(`/vehicle-sheets/${id}/lock`); load(); }
    catch { toast.error("Failed"); }
  };

  const startDelete = async (sheet) => {
    try {
      const { data } = await api.delete(`/vehicle-sheets/${sheet._id}`, { data: { confirmed: false } });
      setDelTarget({ ...sheet, vehicleCount: data.vehicleCount || 0 });
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/vehicle-sheets/${delTarget._id}`, { data: { confirmed: true } });
      toast.success(`Sheet "${delTarget.sheetName}" deleted`);
      setDelTarget(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || "Failed"); setDelTarget(null); }
  };

  // Pagination
  const totalPages = Math.ceil(sheets.length / LIMIT);
  const pageSheets = sheets.slice((page - 1) * LIMIT, page * LIMIT);

  const activeSheet = sheets.find(s => s._id === activeId);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Create New Sheet */}
        <div style={{ ...GLASS, padding: 24 }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: C.blue, fontSize: 16 }}>+</span> Create New Sheet
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input value={sheetName} onChange={e => setSheetName(e.target.value)}
              placeholder="Enter sheet name" onKeyDown={e => e.key === "Enter" && createSheet()}
              style={{ ...INP, flex: 1 }} />
            <div style={{ background: "#F1F5F9", border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: C.muted, whiteSpace: "nowrap" }}>
              {fyDisplay}
            </div>
          </div>
          <button onClick={createSheet} disabled={creating}
            style={{ ...BTN(C.blue), width: "100%" }}>
            {creating ? "Creating…" : "Create Sheet"}
          </button>
        </div>

        {/* Select Active Sheet */}
        <div style={{ ...GLASS, padding: 24 }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            📌 Select Active Sheet
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={activeId} onChange={e => setActive(e.target.value)}
              style={{ ...INP, flex: 1 }}>
              {sheets.map(s => (
                <option key={s._id} value={s._id}>{s.sheetName} {s.status === "active" ? "✅" : ""}</option>
              ))}
            </select>
            <button onClick={() => { const i = sheets.findIndex(s => s._id === activeId); if (i > 0) setActive(sheets[i-1]._id); }}
              style={BTN("#F1F5F9", C.muted, { padding: "9px 14px" })}>Prev</button>
            <button onClick={() => { const i = sheets.findIndex(s => s._id === activeId); if (i < sheets.length-1) setActive(sheets[i+1]._id); }}
              style={BTN("#F1F5F9", C.muted, { padding: "9px 14px" })}>Next</button>
          </div>
        </div>
      </div>

      {/* All Sheets List */}
      <div style={{ ...GLASS, padding: 24 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          📋 All Sheets List
        </div>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: C.muted }}>Loading…</div> : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(241,245,249,0.8)" }}>
                  <th style={TH}>Sheet Name</th>
                  <th style={TH}>Status</th>
                  {/* Lock column only for EXP type (shown in screenshot 2) */}
                  {sheetType === "FML_EXP" && <th style={TH}>Lock</th>}
                  {/* Delete only for superadmin */}
                  {isSuperAdmin && <th style={{ ...TH, textAlign: "center" }}>Delete Sheet</th>}
                </tr>
              </thead>
              <tbody>
                {pageSheets.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: C.muted }}>No sheets found.</td></tr>
                ) : pageSheets.map(s => (
                  <tr key={s._id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={TD}>{s.sheetName}</td>
                    <td style={TD}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
                        color: s.status === "active" ? C.green : C.muted }}>
                        {s.status === "active" ? "Active ✅" : "Inactive"}
                      </span>
                    </td>
                    {sheetType === "FML_EXP" && (
                      <td style={TD}>
                        {isAdmin && (
                          <button onClick={() => toggleLock(s._id)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.isLocked ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${s.isLocked ? "#EF4444" : "#F59E0B"}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: s.isLocked ? C.red : "#D97706" }}>
                            {s.isLocked ? "🔒 Locked" : "🔓 Unlocked"}
                          </button>
                        )}
                        {!isAdmin && (
                          <span style={{ fontSize: 13, color: C.muted }}>{s.isLocked ? "🔒 Locked" : "🔓 Unlocked"}</span>
                        )}
                      </td>
                    )}
                    {isSuperAdmin && (
                      <td style={{ ...TD, textAlign: "center" }}>
                        <button onClick={() => startDelete(s)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 16 }}
                          title="Delete sheet">🗑</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={BTN("#F1F5F9", C.muted, { padding: "6px 16px" })}>Prev</button>
              <span style={{ fontSize: 13, color: C.muted }}>Page {page} of {Math.max(1, totalPages)}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                style={BTN("#F1F5F9", C.muted, { padding: "6px 16px" })}>Next</button>
            </div>
          </>
        )}
      </div>

      {delTarget && (
        <ConfirmModal sheet={delTarget} onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
      )}
    </div>
  );
}

const TH = { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` };
const TD = { padding: "11px 14px", fontSize: 13, color: C.text, verticalAlign: "middle" };

// ─── Main VehicleSheets page ──────────────────────────────────────────────────
export default function VehicleSheets({ lockMode = false }) {
  const navigate = useNavigate();
  const [type, setType] = useState("FML");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 50%, #F0FDF4 100%)", padding: "28px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 20 }}>👥</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Manage Vehicle Sheets</h1>
        </div>

        {/* Type selector */}
        <div style={{ ...GLASS, padding: "12px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Select Type:</span>
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ ...INP, width: "auto", minWidth: 120, fontWeight: 600 }}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Vehicle Sheet Manager section */}
        <div style={{ ...GLASS, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Vehicle Sheet Manager</h2>
          </div>
          <SheetManager sheetType={type} />
        </div>

        {/* Petrol Pump section */}
        <PetrolPumpSection />
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        select option { background: #fff; color: #1E293B; }
      `}</style>
    </div>
  );
}