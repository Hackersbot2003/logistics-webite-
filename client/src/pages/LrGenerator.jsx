import { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

// ── Design tokens (matches rest of app) ───────────────────────────────────────
const C = {
  bg: "#F1F5F9", white: "#fff", border: "#E2E8F0",
  text: "#1E293B", muted: "#64748B", faint: "#94A3B8",
  blue: "#2563EB", red: "#EF4444", green: "#16A34A",
  yellow: "#D97706", panel: "#F8FAFC",
};

const INP = {
  width: "100%", padding: "9px 12px",
  border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 14, color: C.text, background: C.white,
  outline: "none",
};
const SEL = { ...INP, cursor: "pointer" };
const BTN = (bg, color = "#fff", extra = {}) => ({
  padding: "10px 20px", background: bg, color,
  border: "none", borderRadius: 8, fontWeight: 600,
  fontSize: 14, cursor: "pointer", ...extra,
});

// ── Sub-components defined at MODULE LEVEL to prevent cursor-jump ─────────────
function Spin() {
  return (
    <div style={{
      width: 20, height: 20,
      border: `3px solid ${C.border}`, borderTopColor: C.blue,
      borderRadius: "50%", animation: "bspin 0.7s linear infinite",
      display: "inline-block",
    }} />
  );
}

function Lbl({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function Fld({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Lbl>{label}</Lbl>
      {children}
    </div>
  );
}

// Signature card — defined at module level
function SigCard({ sig, selected, onSelect, onSetDefault, onDelete, canManage }) {
  return (
    <div
      onClick={() => onSelect(sig._id)}
      style={{
        border: `2px solid ${selected ? C.blue : C.border}`,
        borderRadius: 10, padding: 10, cursor: "pointer",
        background: selected ? "#EFF6FF" : C.white,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, position: "relative", transition: "border-color 0.15s",
        minWidth: 130,
      }}
    >
      {/* Default badge */}
      {sig.isDefault && (
        <div style={{
          position: "absolute", top: 6, left: 6,
          background: C.green, color: "#fff", borderRadius: 4,
          fontSize: 10, fontWeight: 700, padding: "1px 6px",
        }}>DEFAULT</div>
      )}

      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: C.blue, color: "#fff", borderRadius: "50%",
          width: 18, height: 18, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11, fontWeight: 700,
        }}>✓</div>
      )}

      {/* Preview image */}
      <img
        src={sig.directUrl}
        alt={sig.label}
        style={{
          width: 100, height: 60, objectFit: "contain",
          border: `1px solid ${C.border}`, borderRadius: 4,
          background: "#fafafa",
        }}
        onError={e => { e.target.style.display = "none"; }}
      />

      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, textAlign: "center" }}>
        {sig.label}
      </div>

      {canManage && (
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          {!sig.isDefault && (
            <button
              onClick={e => { e.stopPropagation(); onSetDefault(sig._id); }}
              style={{ ...BTN(C.green, "#fff"), padding: "3px 8px", fontSize: 11 }}
            >Set Default</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(sig._id); }}
            style={{ ...BTN(C.red, "#fff"), padding: "3px 8px", fontSize: 11 }}
          >Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LrGenerator() {
  const { hasRole } = useAuth();
  const canManage = hasRole("superadmin", "admin", "manager");

  // Sheets
  const [sheets, setSheets]       = useState([]);
  const [sheetName, setSheetName] = useState("");

  // Form
  const [challanNo, setChallanNo]         = useState("");
  const [addSignature, setAddSignature]   = useState(true);
  const [selectedSigId, setSelectedSigId] = useState(null);

  // Signatures
  const [signatures, setSignatures]   = useState([]);
  const [sigLoading, setSigLoading]   = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFile, setUploadFile]   = useState(null);
  const [uploading, setUploading]     = useState(false);
  const fileInputRef = useRef();

  // Generate
  const [generating, setGenerating] = useState(false);

  // ── Load all sheets + signatures on mount ─────────────────────────────────
  useEffect(() => {
    fetchSheets();
    fetchSignatures();
  }, []);

  const fetchSheets = async () => {
    try {
      // Fetch all types in parallel
      const [r1, r2, r3] = await Promise.all([
        api.get("/vehicle-sheets?type=FML"),
        api.get("/vehicle-sheets?type=FML_EXP"),
        api.get("/vehicle-sheets?type=Others"),
      ]);
      const all = [
        ...(r1.data.sheets || []),
        ...(r2.data.sheets || []),
        ...(r3.data.sheets || []),
      ];
      // Sort: active first, then by createdAt desc
      all.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setSheets(all);

      // Default to active sheet
      const active = all.find(s => s.status === "active");
      if (active) setSheetName(active.sheetName);
      else if (all.length) setSheetName(all[0].sheetName);
    } catch {
      toast.error("Failed to load vehicle sheets");
    }
  };

  const fetchSignatures = async () => {
    setSigLoading(true);
    try {
      const { data } = await api.get("/lr/signatures");
      setSignatures(data.signatures || []);
      // Auto-select default
      const def = (data.signatures || []).find(s => s.isDefault);
      if (def) setSelectedSigId(def._id);
    } catch {
      toast.error("Failed to load signatures");
    } finally {
      setSigLoading(false);
    }
  };

  // ── Upload new signature ──────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) return toast.error("Please select an image file");
    if (!uploadLabel.trim()) return toast.error("Please enter a label");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("signature", uploadFile);
      fd.append("label", uploadLabel.trim());
      const { data } = await api.post("/lr/signatures", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Signature uploaded!");
      setSignatures(prev => [data.signature, ...prev]);
      setUploadFile(null);
      setUploadLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Select newly uploaded
      setSelectedSigId(data.signature._id);
    } catch (e) {
      toast.error(e.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Set default signature ─────────────────────────────────────────────────
  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/lr/signatures/${id}/default`);
      setSignatures(prev => prev.map(s => ({ ...s, isDefault: s._id === id })));
      toast.success("Default updated");
    } catch {
      toast.error("Failed to set default");
    }
  };

  // ── Delete signature ──────────────────────────────────────────────────────
  const handleDeleteSig = async (id) => {
    if (!window.confirm("Delete this signature?")) return;
    try {
      await api.delete(`/lr/signatures/${id}`);
      const updated = signatures.filter(s => s._id !== id);
      setSignatures(updated);
      if (selectedSigId === id) {
        const def = updated.find(s => s.isDefault);
        setSelectedSigId(def?._id || null);
      }
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── Generate LR PDF ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!challanNo.trim()) return toast.error("Please enter a challan number");
    setGenerating(true);
    try {
      const params = new URLSearchParams({ challanNo: challanNo.trim() });
      if (addSignature) {
        params.set("addSignature", "true");
        if (selectedSigId) params.set("signatureId", selectedSigId);
      }

      const token = localStorage.getItem("ds_token");
      const response = await fetch(`/api/lr/generate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Generation failed");
      }

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("LR generated!");
    } catch (e) {
      toast.error(e.message || "Failed to generate LR");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", background: C.bg, minHeight: "100vh" }}>
      <style>{`@keyframes bspin{to{transform:rotate(360deg)}}`}</style>

      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
          🚛 LR Challan PDF Generator
        </h1>
        <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>
          Generate Consignment Note cum Checklist (Original + Duplicate + Triplicate)
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Generate form ── */}
        <div style={{ background: C.white, borderRadius: 12, padding: 24, border: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>
            Generate Vehicle PDF
          </h2>

          <Fld label="Sheet Name">
            <select
              value={sheetName}
              onChange={e => setSheetName(e.target.value)}
              style={SEL}
            >
              {sheets.length === 0 && <option value="">No sheets found</option>}
              {sheets.map(s => (
                <option key={s._id} value={s.sheetName}>
                  {s.sheetName}{s.status === "active" ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </Fld>

          <Fld label="Challan Number">
            <input
              type="text"
              value={challanNo}
              onChange={e => setChallanNo(e.target.value)}
              placeholder="e.g. FML94"
              style={INP}
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
            />
          </Fld>

          {/* Signature checkbox */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", fontSize: 14, color: C.text, fontWeight: 500,
            }}>
              <input
                type="checkbox"
                checked={addSignature}
                onChange={e => setAddSignature(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.blue }}
              />
              Add Signature &amp; Stamp
            </label>
            {addSignature && signatures.length === 0 && (
              <div style={{
                marginTop: 8, padding: "8px 12px", background: "#FEF9C3",
                borderRadius: 6, fontSize: 12, color: "#92400E",
              }}>
                ⚠ No signatures uploaded yet. Upload one below or uncheck to generate without.
              </div>
            )}
          </div>

          {/* Selected signature preview */}
          {addSignature && selectedSigId && (() => {
            const sig = signatures.find(s => s._id === selectedSigId);
            return sig ? (
              <div style={{
                marginBottom: 16, padding: 10, background: C.panel,
                borderRadius: 8, border: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <img
                  src={sig.directUrl}
                  alt={sig.label}
                  style={{ height: 40, maxWidth: 80, objectFit: "contain" }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{sig.label}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Will be added to PDF</div>
                </div>
              </div>
            ) : null;
          })()}

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              ...BTN(C.blue), width: "100%", padding: "12px 20px",
              fontSize: 15, opacity: generating ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {generating ? <><Spin /> Generating...</> : "Generate LR Challan"}
          </button>
        </div>

        {/* ── RIGHT: Signature management ── */}
        <div style={{ background: C.white, borderRadius: 12, padding: 24, border: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Signature &amp; Stamp Management
          </h2>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
            Click a signature to select it for PDF generation. Set one as default.
          </div>

          {/* Upload form — admin/manager only */}
          {canManage && (
            <div style={{
              background: C.panel, borderRadius: 10, padding: 16,
              border: `1px solid ${C.border}`, marginBottom: 20,
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 12 }}>
                Upload New Signature / Stamp
              </div>

              <Fld label="Label">
                <input
                  type="text"
                  value={uploadLabel}
                  onChange={e => setUploadLabel(e.target.value)}
                  placeholder='e.g. "Company Stamp 1"'
                  style={INP}
                />
              </Fld>

              <Fld label="Image File (PNG / JPG)">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadFile ? C.blue : C.border}`,
                    borderRadius: 8, padding: "14px 12px",
                    textAlign: "center", cursor: "pointer",
                    background: uploadFile ? "#EFF6FF" : C.white,
                    transition: "all 0.15s",
                  }}
                >
                  {uploadFile ? (
                    <div>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>🖼</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>
                        {uploadFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📁</div>
                      <div style={{ fontSize: 13, color: C.muted }}>
                        Click to select image
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => setUploadFile(e.target.files[0] || null)}
                />
              </Fld>

              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadLabel.trim()}
                style={{
                  ...BTN(C.green), width: "100%",
                  opacity: (uploading || !uploadFile || !uploadLabel.trim()) ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {uploading ? <><Spin /> Uploading...</> : "⬆ Upload Signature"}
              </button>
            </div>
          )}

          {/* Signatures list */}
          {sigLoading ? (
            <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
          ) : signatures.length === 0 ? (
            <div style={{
              textAlign: "center", padding: 32, color: C.muted,
              border: `1px dashed ${C.border}`, borderRadius: 8,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No signatures yet</div>
              <div style={{ fontSize: 12 }}>Upload a signature above to get started</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10 }}>
                {signatures.length} signature{signatures.length !== 1 ? "s" : ""} — click to select
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 12,
              }}>
                {signatures.map(sig => (
                  <SigCard
                    key={sig._id}
                    sig={sig}
                    selected={selectedSigId === sig._id}
                    onSelect={setSelectedSigId}
                    onSetDefault={handleSetDefault}
                    onDelete={handleDeleteSig}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}