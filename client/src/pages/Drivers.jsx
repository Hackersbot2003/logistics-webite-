import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDoubleConfirm } from "../components/DoubleConfirm";
import { useSocket } from "../context/SocketContext";

// ─── Shared Design Tokens (matching Vehicles.jsx) ─────────────────────────────
const C = {
  bg:"#F1F5F9", white:"#fff", border:"#E2E8F0", text:"#1E293B",
  muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
  green:"#16A34A", yellow:"#D97706",
};
const INP = { width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:7, fontSize:14, color:C.text, outline:"none", boxSizing:"border-box", background:"#F8FAFC", fontFamily:"inherit" };
const INP_RO = { ...INP, background:"#F1F5F9", color:C.muted, cursor:"default" };
const SEL = { ...INP, cursor:"pointer" };
const BTN = (bg, color="#fff", extra={}) => ({ padding:"9px 18px", background:bg, border:"none", borderRadius:7, color, cursor:"pointer", fontSize:13, fontWeight:600, display:"inline-flex", alignItems:"center", gap:6, ...extra });

const Lbl = ({ children, req }) => (
  <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>
    {children}{req && <span style={{ color:C.red }}> *</span>}
  </label>
);
const Fld = ({ label, req, style={}, children }) => <div style={{ marginBottom:14, ...style }}><Lbl req={req}>{label}</Lbl>{children}</div>;
const SecHdr = ({ icon, title }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 18px", borderBottom:`1px solid ${C.border}`, background:"#F8FAFC" }}>
    <span>{icon}</span>
    <span style={{ fontWeight:700, fontSize:14, color:C.text }}>{title}</span>
  </div>
);
const Card = ({ children, style={} }) => <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:14, overflow:"hidden", ...style }}>{children}</div>;
const CardBody = ({ children }) => <div style={{ padding:18 }}>{children}</div>;
const G3 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>{children}</div>;

// ─── SVG Icons (matching Vehicles.jsx) ────────────────────────────────────────
const IconEye  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconDel  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLicenseStatus = (validity) => {
  if (!validity) return { label: "Unknown", color: "#64748B", bg: "rgba(100,116,139,0.2)" };
  const exp = new Date(validity);
  const now = new Date();
  const diffDays = Math.ceil((exp - now) / 86400000);
  if (diffDays < 0)  return { label: "Expired",  color: C.red,    bg: "rgba(239,68,68,0.15)" };
  if (diffDays <= 30) return { label: "Expiring", color: C.yellow, bg: "rgba(245,158,11,0.15)" };
  return { label: "Valid", color: C.green, bg: "rgba(34,197,94,0.15)" };
};

const fmt = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN"); } catch { return d; }
};

// ─── Camera Modal ─────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment");

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { toast.error("Camera unavailable"); onClose(); }
  }, [onClose]);

  useEffect(() => { startCamera(facingMode); return () => streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const flip = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const c = document.createElement("canvas");
    c.width = videoRef.current.videoWidth;
    c.height = videoRef.current.videoHeight;
    c.getContext("2d").drawImage(videoRef.current, 0, 0);
    c.toBlob(blob => {
      const f = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(f);
      onClose();
    }, "image/jpeg", 0.9);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:"min(90vw,480px)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ color:C.text, fontWeight:700, fontSize:16 }}>📸 Take Photo</span>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); onClose(); }}
            style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        <video ref={videoRef} autoPlay playsInline
          style={{ width:"100%", borderRadius:10, background:C.bg, maxHeight:300, objectFit:"cover", display:"block" }} />
        <div style={{ display:"flex", gap:10, marginTop:16 }}>
          <button onClick={flip}
            style={{ flex:1, padding:"10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontSize:13 }}>
            🔄 Flip
          </button>
          <button onClick={capture}
            style={{ flex:2, padding:"10px", background:C.blue, border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontWeight:700, fontSize:14 }}>
            📷 Capture
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Upload Card ──────────────────────────────────────────────────────────
// Props are all stable references — no state inside this component
function DocCard({ label, files, existingUrls, existingIds, onAdd, onRemoveNew, onRemoveExisting }) {
  const fileRef = useRef();
  const [camOpen, setCamOpen] = useState(false);

  const handleFiles = (e) => {
    Array.from(e.target.files).forEach(f => onAdd(f));
    e.target.value = "";
  };

  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:16 }}>
      <div style={{ fontWeight:600, color:C.text, marginBottom:10, fontSize:14 }}>{label}</div>

      {existingUrls?.map((url, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"6px 8px", background:"rgba(34,197,94,0.08)", borderRadius:6 }}>
          <span style={{ fontSize:11, color:C.green, flex:1 }}>✔ Existing {i+1}</span>
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.blue }}>View</a>
          <button onClick={() => onRemoveExisting(existingIds[i])}
            style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13, fontWeight:700, padding:"0 4px" }}>✕</button>
        </div>
      ))}

      {files?.map((f, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"6px 8px", background:`rgba(37,99,235,0.08)`, borderRadius:6 }}>
          <span style={{ fontSize:11, color:C.blue, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📎 {f.name}</span>
          <button onClick={() => onRemoveNew(i)}
            style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13, fontWeight:700, padding:"0 4px" }}>✕</button>
        </div>
      ))}

      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleFiles} />
        <button type="button" onClick={() => fileRef.current.click()}
          style={{ flex:1, padding:"8px 4px", background:"#6D28D9", border:"none", borderRadius:7, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>
          Add from Files
        </button>
        <button type="button" onClick={() => setCamOpen(true)}
          style={{ flex:1, padding:"8px 4px", background:"#059669", border:"none", borderRadius:7, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>
          📷 Capture
        </button>
      </div>
      {camOpen && <CameraModal onCapture={(f) => onAdd(f)} onClose={() => setCamOpen(false)} />}
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function ViewModal({ driver, onClose }) {
  const status = getLicenseStatus(driver.licenseValidity);
  const Row = ({ label, value }) => (
    <div>
      <div style={{ fontSize:11, color:C.faint, fontWeight:600, textTransform:"uppercase", marginBottom:4, letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 12px", fontSize:14, color:C.text }}>{value || "—"}</div>
    </div>
  );
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, width:"min(95vw,700px)", margin:"20px auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 24px", borderBottom:`1px solid ${C.border}` }}>
          <div><h2 style={{ margin:0, fontSize:18, fontWeight:800, color:C.text }}>Driver Details</h2>
            <p style={{ margin:"2px 0 0", fontSize:13, color:C.muted }}>Complete information for the driver record</p></div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.faint }}>✕</button>
        </div>
        <div style={{ padding:22, overflowY:"auto", maxHeight:"calc(100vh - 140px)" }}>
          <Card><SecHdr icon="👤" title="Personal Information" /><CardBody><G3>
            <Row label="Full Name" value={driver.fullName} />
            <Row label="Father's Name" value={driver.fatherName} />
            <Row label="Phone Number" value={driver.phoneNumber} />
            <Row label="Date of Birth" value={fmt(driver.dateOfBirth)} />
            <Row label="Marital Status" value={driver.maritalStatus} />
            <div style={{ gridColumn:"1/-1" }}><Row label="Temporary Address" value={driver.temporaryAddress} /></div>
            <div style={{ gridColumn:"1/-1" }}><Row label="Permanent Address" value={driver.permanentAddress} /></div>
          </G3></CardBody></Card>
          
          <Card><SecHdr icon="📞" title="Emergency Contact" /><CardBody><G3>
            <Row label="Relation" value={driver.emergencyRelation} />
            <Row label="Contact Person" value={driver.emergencyPerson} />
            <Row label="Contact Number" value={driver.emergencyContact} />
          </G3></CardBody></Card>
          
          <Card><SecHdr icon="🆔" title="Identification" /><CardBody><G3>
            <Row label="Aadhar Number" value={driver.aadharNo} />
            <Row label="License Number" value={driver.licenseNo} />
            <div>
              <div style={{ fontSize:11, color:C.faint, fontWeight:600, textTransform:"uppercase", marginBottom:4, letterSpacing:"0.06em" }}>License Validity</div>
              <div style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 12px", fontSize:14, color:C.text, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                {fmt(driver.licenseValidity)}
                <span style={{ background:status.bg, color:status.color, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>{status.label}</span>
              </div>
            </div>
          </G3></CardBody></Card>
          
          <Card><SecHdr icon="📋" title="Reference" /><CardBody><G3>
            <Row label="Sender Name" value={driver.senderName} />
            <Row label="Sender Contact" value={driver.senderContact} />
            <Row label="Incharge Name" value={driver.inchargeName} />
            <Row label="Token No" value={driver.tokenNo} />
          </G3></CardBody></Card>
          
          {(driver.photoUrls?.length > 0 || driver.aadharUrls?.length > 0 || driver.licenseUrls?.length > 0 || driver.pdfUrl) && (
            <Card><SecHdr icon="📄" title="Documents" /><CardBody>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {driver.photoUrls?.map((url,i) => <DocLink key={i} label={`Photo ${i+1}`} url={url} />)}
                {driver.aadharUrls?.map((url,i) => <DocLink key={i} label={`Aadhar Card ${i+1}`} url={url} />)}
                {driver.licenseUrls?.map((url,i) => <DocLink key={i} label={`License ${i+1}`} url={url} />)}
                 {driver.tokenUrls?.map((url,i) => <DocLink key={i} label={`Token ${i+1}`} url={url} />)}

                {driver.pdfUrl && (
                  <div style={{ gridColumn:"1/-1", background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
                    <div style={{ fontSize:12, color:C.faint, marginBottom:6 }}>Combined PDF:</div>
                    <a href={driver.pdfUrl} target="_blank" rel="noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#059669", color:"#fff", padding:"6px 14px", borderRadius:6, fontSize:13, textDecoration:"none", fontWeight:600 }}>
                      ⬇️ Download
                    </a>
                  </div>
                )}
              </div>
            </CardBody></Card>
          )}
        </div>
        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Close</button>
        </div>
      </div>
    </div>
  );
}

const DocLink = ({ label, url }) => (
  <div style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
    <div style={{ fontSize:12, color:C.faint, marginBottom:6 }}>{label}:</div>
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue, color:"#fff", padding:"6px 14px", borderRadius:6, fontSize:13, textDecoration:"none", fontWeight:600 }}>
      🔗 View Document
    </a>
  </div>
);

// ─── Delete Confirm Modal (double confirm — must type DELETE) ─────────────────
function DeleteModal({ driver, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDel = typed === "DELETE";
  const doDelete = async () => {
    if (!canDel) return;
    setDeleting(true);
    try {
      await api.delete(`/drivers/${driver._id}`);
      toast.success("Driver deleted");
      onDeleted();
      onClose();
    } catch { toast.error("Delete failed"); setDeleting(false); }
  };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:28, width:"min(90vw,460px)", boxShadow:"0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
        <div style={{ fontWeight:800, fontSize:17, color:C.text, marginBottom:8 }}>Delete Driver?</div>
        <div style={{ color:C.muted, fontSize:14, marginBottom:16 }}>
          Delete <b>{driver.fullName}</b> ({driver.tokenNo})? This will also delete all uploaded documents from Google Drive. This cannot be undone.
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:8 }}>
          Type <span style={{ fontFamily:"monospace", background:"#FEF2F2", padding:"1px 6px", borderRadius:4, color:C.red }}>DELETE</span> to confirm:
        </div>
        <input autoFocus value={typed} onChange={e=>setTyped(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&doDelete()}
          placeholder="Type DELETE" style={{ width:"100%",padding:"10px 12px",border:"2px solid #E2E8F0",borderRadius:7,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:16 }} />
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
          <button onClick={doDelete} disabled={!canDel||deleting}
            style={{ ...BTN(canDel?C.red:"#FCA5A5","#fff"), cursor:canDel?"pointer":"not-allowed" }}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Saving Overlay (blocks all interaction) ──────────────────────────────────
function SavingOverlay({ message }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9998, background:"rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:48, height:48, border:"4px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", borderRadius:"50%", animation:"vspin 0.8s linear infinite" }} />
      <div style={{ color:"#fff", fontSize:16, fontWeight:600 }}>{message}</div>
      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
const FldWithLabel = ({ label, req, error, children }) => (
  <div>
    <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
      {label}{req && <span style={{ color:C.red }}> *</span>}
    </label>
    {children}
    {error && <div style={{ color:C.red, fontSize:11, marginTop:3 }}>{error}</div>}
  </div>
);

// ─── INITIAL FORM STATE ───────────────────────────────────────────────────────
const INIT = {
  fullName:"", fatherName:"", phoneNumber:"", dateOfBirth:"",
  temporaryAddress:"", permanentAddress:"", maritalStatus:"",
  emergencyRelation:"", emergencyPerson:"", emergencyContact:"",
  aadharNo:"", licenseNo:"", licenseValidity:"",
  senderName:"", senderContact:"", inchargeName:"",
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
// KEY FIX: All state is at this top level. No sub-components with their own state
// that re-create on every render. Input onChange just calls setForm — stable.
function DriverFormModal({ driver, onClose, onSaved }) {
  const isEdit = Boolean(driver);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [sameAddr, setSameAddr] = useState(false);

  // All form fields in ONE state object — prevents cursor jump
  const [form, setForm] = useState(() => isEdit ? {
    fullName: driver.fullName || "",
    fatherName: driver.fatherName || "",
    phoneNumber: driver.phoneNumber || "",
    dateOfBirth: driver.dateOfBirth ? driver.dateOfBirth.slice(0,10) : "",
    temporaryAddress: driver.temporaryAddress || "",
    permanentAddress: driver.permanentAddress || "",
    maritalStatus: driver.maritalStatus || "",
    emergencyRelation: driver.emergencyRelation || "",
    emergencyPerson: driver.emergencyPerson || "",
    emergencyContact: driver.emergencyContact || "",
    aadharNo: driver.aadharNo || "",
    licenseNo: driver.licenseNo || "",
    licenseValidity: driver.licenseValidity ? driver.licenseValidity.slice(0,10) : "",
    senderName: driver.senderName || "",
    senderContact: driver.senderContact || "",
    inchargeName: driver.inchargeName || "",
  } : { ...INIT });

  // Docs state — kept flat at this level
  const [photos, setPhotos]         = useState([]);
  const [aadharDocs, setAadharDocs] = useState([]);
  const [licenseDocs, setLicenseDocs] = useState([]);
  const [extraDocs, setExtraDocs]   = useState([]);
  const [exPhotos,  setExPhotos]    = useState({ urls: driver?.photoUrls||[], ids: driver?.photoDriveIds||[] });
  const [exAadhar,  setExAadhar]    = useState({ urls: driver?.aadharUrls||[], ids: driver?.aadharDriveIds||[] });
  const [exLicense, setExLicense]   = useState({ urls: driver?.licenseUrls||[], ids: driver?.licenseDriveIds||[] });
  const [rmPhotos,  setRmPhotos]    = useState([]);
  const [rmAadhar,  setRmAadhar]    = useState([]);
  const [rmLicense, setRmLicense]   = useState([]);

  // KEY: stable onChange — uses functional update, doesn't recreate on every render
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: name === "fullName" ? value.toUpperCase() : value };
      if (name === "temporaryAddress" && sameAddr) next.permanentAddress = value;
      return next;
    });
    setErrors(prev => prev[name] ? { ...prev, [name]: "" } : prev);
  }, [sameAddr]);

  const toggleSameAddr = useCallback(() => {
    setSameAddr(v => {
      if (!v) setForm(p => ({ ...p, permanentAddress: p.temporaryAddress }));
      return !v;
    });
  }, []);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim())        e.fullName = "Required";
    if (!form.fatherName.trim())      e.fatherName = "Required";
    if (!form.phoneNumber.trim())     e.phoneNumber = "Required";
    else if (!/^\d{10}$/.test(form.phoneNumber)) e.phoneNumber = "Must be 10 digits";
    if (!form.dateOfBirth)            e.dateOfBirth = "Required";
    if (!form.temporaryAddress.trim()) e.temporaryAddress = "Required";
    if (!form.permanentAddress.trim()) e.permanentAddress = "Required";
    if (!form.maritalStatus)          e.maritalStatus = "Required";
    if (!form.emergencyRelation)      e.emergencyRelation = "Required";
    if (!form.emergencyPerson.trim()) e.emergencyPerson = "Required";
    if (!form.emergencyContact.trim()) e.emergencyContact = "Required";
    else if (!/^\d{10}$/.test(form.emergencyContact)) e.emergencyContact = "Must be 10 digits";
    if (!form.aadharNo.trim())        e.aadharNo = "Required";
    else if (!/^\d{12}$/.test(form.aadharNo)) e.aadharNo = "Must be 12 digits";
    if (!form.licenseNo.trim())       e.licenseNo = "Required";
    if (!form.licenseValidity)        e.licenseValidity = "Required";
    if (!form.senderName.trim()) e.senderName = "Required";

if (!form.senderContact.trim()) e.senderContact = "Required";
else if (!/^\d{10}$/.test(form.senderContact))
    e.senderContact = "Must be 10 digits";

if (!form.inchargeName.trim()) e.inchargeName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) setStep(2); else toast.error("Please fill all required fields"); };

  const removeEx = (setter, rmSetter) => (id) => {
    setter(p => ({ urls: p.urls.filter((_,i) => p.ids[i]!==id), ids: p.ids.filter(x=>x!==id) }));
    rmSetter(p => [...p, id]);
  };

  const validateDocuments = () => {
  if ((photos.length + exPhotos.urls.length - rmPhotos.length) === 0) {
    toast.error("At least 1 Photo is required");
    return false;
  }

  if ((aadharDocs.length + exAadhar.urls.length - rmAadhar.length) === 0) {
    toast.error("At least 1 Aadhar document is required");
    return false;
  }

  if ((licenseDocs.length + exLicense.urls.length - rmLicense.length) === 0) {
    toast.error("At least 1 License document is required");
    return false;
  }

  // ✅ NEW (Extra Docs compulsory)
  if (extraDocs.length === 0) {
    toast.error("At least 1 Extra Document (Token) is required");
    return false;
  }

  return true;
};

  const handleSubmit = async () => {
     if (!validateDocuments()) return; 
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k, v || ""));
      photos.forEach(f => fd.append("photos", f));
      aadharDocs.forEach(f => fd.append("aadhar", f));
      licenseDocs.forEach(f => fd.append("license", f));
      extraDocs.forEach(f => fd.append("token", f));
      if (isEdit) {
        fd.append("removePhotos", JSON.stringify(rmPhotos));
        fd.append("removeAadhar", JSON.stringify(rmAadhar));
        fd.append("removeLicense", JSON.stringify(rmLicense));
        fd.append("removeToken", JSON.stringify([]));
        await api.put(`/drivers/${driver._id}`, fd);
        toast.success("Driver updated successfully");
        onSaved();
      } else {
        const { data } = await api.post("/drivers", fd);
        toast.success(`✅ Driver created! Token: ${data.driver.tokenNo}`, { duration: 7000 });
        onSaved(data.driver.tokenNo);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save driver");
    } finally {
      setSaving(false);
    }
  };

  // Stable border helper
  const bord = (field) => ({ ...INP, borderColor: errors[field] ? C.red : C.border });

  return (
    <>
      {saving && <SavingOverlay message={isEdit ? "Updating driver…" : "Creating driver & uploading documents…"} />}
      <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
        <div style={{ background:C.bg, width:"min(95vw,760px)", margin:"20px auto", borderRadius:12, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
          <div style={{ background:C.white, borderRadius:"12px 12px 0 0", padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>{isEdit ? "Edit Driver Information" : "Add New Driver"}</h2>
              <p style={{ margin:"4px 0 0", fontSize:13, color:C.muted }}>{isEdit ? "Modify the driver details below" : "Fill in the details below to add a new driver record"}</p></div>
            <button onClick={onClose} disabled={saving} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.faint, marginLeft:12 }}>✕</button>
          </div>
          <div style={{ padding:18, overflowY:"auto", maxHeight:"calc(100vh - 140px)" }}>
            {step === 1 ? (
              <>
                {/* Personal Info */}
                <Card><SecHdr icon="👤" title="Personal Information" /><CardBody>
                  <G3>
                    <FldWithLabel label="Full Name" req error={errors.fullName}>
                      <input name="fullName" value={form.fullName} onChange={handleChange} style={bord("fullName")} placeholder="AUTO-UPPERCASE" autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Father's Name" req error={errors.fatherName}>
                      <input name="fatherName" value={form.fatherName} onChange={handleChange} style={bord("fatherName")} autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Phone Number" req error={errors.phoneNumber}>
                      <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} style={bord("phoneNumber")} maxLength={10} placeholder="10 digits" autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Date of Birth" req error={errors.dateOfBirth}>
                      <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} style={bord("dateOfBirth")} />
                    </FldWithLabel>
                    <div style={{ gridColumn:"1/-1" }}>
                      <FldWithLabel label="Temporary Address" req error={errors.temporaryAddress}>
                        <textarea name="temporaryAddress" value={form.temporaryAddress} onChange={handleChange} rows={2} style={{ ...bord("temporaryAddress"), resize:"vertical" }} />
                      </FldWithLabel>
                    </div>
                    <div style={{ gridColumn:"1/-1" }}>
                      <FldWithLabel label="Permanent Address" req error={errors.permanentAddress}>
                        <textarea name="permanentAddress" value={form.permanentAddress} onChange={handleChange} rows={2} style={{ ...bord("permanentAddress"), resize:"vertical" }} />
                      </FldWithLabel>
                      <label style={{ display:"flex", alignItems:"center", gap:7, marginTop:8, cursor:"pointer", fontSize:13, color:C.muted }}>
                        <input type="checkbox" checked={sameAddr} onChange={toggleSameAddr} style={{ width:14, height:14, accentColor:C.blue }} />
                        Same as Temporary Address
                      </label>
                    </div>
                    <FldWithLabel label="Marital Status" req error={errors.maritalStatus}>
                      <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange} style={SEL}>
                        <option value="">Select</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </FldWithLabel>
                  </G3>
                </CardBody></Card>

                {/* Emergency Contact */}
                <Card><SecHdr icon="📞" title="Emergency Contact" /><CardBody>
                  <G3>
                    <FldWithLabel label="Relation" req error={errors.emergencyRelation}>
                      <select name="emergencyRelation" value={form.emergencyRelation} onChange={handleChange} style={SEL}>
                        <option value="">Select Relation</option>
                        <option value="Mother/Father">Mother/Father</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    </FldWithLabel>
                    <FldWithLabel label="Contact Person" req error={errors.emergencyPerson}>
                      <input name="emergencyPerson" value={form.emergencyPerson} onChange={handleChange} style={bord("emergencyPerson")} autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Contact Number" req error={errors.emergencyContact}>
                      <input name="emergencyContact" value={form.emergencyContact} onChange={handleChange} style={bord("emergencyContact")} maxLength={10} placeholder="10 digits" autoComplete="off" />
                    </FldWithLabel>
                  </G3>
                </CardBody></Card>

                {/* Identification */}
                <Card><SecHdr icon="🆔" title="Identification" /><CardBody>
                  <G3>
                    <FldWithLabel label="Aadhar Number" req error={errors.aadharNo}>
                      <input name="aadharNo" value={form.aadharNo} onChange={handleChange} style={bord("aadharNo")} maxLength={12} placeholder="12 digits" autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="License Number" req error={errors.licenseNo}>
                      <input name="licenseNo" value={form.licenseNo} onChange={handleChange} style={bord("licenseNo")} autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="License Validity" req error={errors.licenseValidity}>
                      <input name="licenseValidity" type="date" value={form.licenseValidity} onChange={handleChange} style={bord("licenseValidity")} />
                    </FldWithLabel>
                  </G3>
                </CardBody></Card>

                {/* Reference */}
                <Card><SecHdr icon="📋" title="Reference" /><CardBody>
                  <G3>
                    <FldWithLabel label="Sender Name">
                      <input name="senderName" value={form.senderName} onChange={handleChange} style={INP} autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Sender Contact">
                      <input name="senderContact" value={form.senderContact} onChange={handleChange} style={INP} autoComplete="off" />
                    </FldWithLabel>
                    <FldWithLabel label="Incharge Name">
                      <input name="inchargeName" value={form.inchargeName} onChange={handleChange} style={INP} autoComplete="off" />
                    </FldWithLabel>
                  </G3>
                </CardBody></Card>
              </>
            ) : (
              /* Step 2 */
              <Card><SecHdr icon="📄" title="Upload Documents" /><CardBody>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <DocCard label="Photo"
                    files={photos} existingUrls={exPhotos.urls} existingIds={exPhotos.ids}
                    onAdd={f => setPhotos(p=>[...p,f])}
                    onRemoveNew={i => setPhotos(p=>p.filter((_,j)=>j!==i))}
                    onRemoveExisting={removeEx(setExPhotos, setRmPhotos)} />
                  <DocCard label="Aadhar"
                    files={aadharDocs} existingUrls={exAadhar.urls} existingIds={exAadhar.ids}
                    onAdd={f => setAadharDocs(p=>[...p,f])}
                    onRemoveNew={i => setAadharDocs(p=>p.filter((_,j)=>j!==i))}
                    onRemoveExisting={removeEx(setExAadhar, setRmAadhar)} />
                  <DocCard label="License"
                    files={licenseDocs} existingUrls={exLicense.urls} existingIds={exLicense.ids}
                    onAdd={f => setLicenseDocs(p=>[...p,f])}
                    onRemoveNew={i => setLicenseDocs(p=>p.filter((_,j)=>j!==i))}
                    onRemoveExisting={removeEx(setExLicense, setRmLicense)} />
                  <DocCard label="Extra Documents"
                    files={extraDocs} existingUrls={[]} existingIds={[]}
                    onAdd={f => setExtraDocs(p=>[...p,f])}
                    onRemoveNew={i => setExtraDocs(p=>p.filter((_,j)=>j!==i))}
                    onRemoveExisting={()=>{}} />
                </div>
              </CardBody></Card>
            )}
          </div>
          <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, background:C.white, borderRadius:"0 0 12px 12px", display:"flex", justifyContent:"flex-end", gap:10 }}>
            <div>
              {step===2 && (
                <button onClick={() => setStep(1)} disabled={saving}
                  style={{ padding:"9px 20px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:14, color:C.muted }}>← Back to Details</button>
              )}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
              {step===1 ? (
                <button onClick={handleNext} style={BTN(C.blue)}>Next: Upload Documents →</button>
              ) : (
                <button onClick={handleSubmit} disabled={saving} style={BTN(C.blue)}>
                  {saving ? (isEdit?"Updating…":"Creating…") : isEdit?"Save Changes":"Submit Driver"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Action Button Component ──────────────────────────────────────────────────
function ActionBtn({ title, color, hoverBg, onClick, children }) {
  return (
    <button title={title} onClick={onClick}
      style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
      onMouseEnter={e=>{e.currentTarget.style.background=hoverBg;e.currentTarget.style.color=color;e.currentTarget.style.borderColor=color+"60";}}
      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>
      {children}
    </button>
  );
}

// ─── Main Drivers Page ────────────────────────────────────────────────────────
export default function Drivers() {
  const { hasRole } = useAuth();
  const { on } = useSocket();
  const [drivers, setDrivers]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [viewDriver, setViewDriver] = useState(null);
  const [delDriver, setDelDriver]   = useState(null);
  const [sortField, setSortField]   = useState("tokenNo");
  const [sortDir, setSortDir]       = useState(1);
  const LIMIT = 10;

  const fetch = useCallback(async (pg=1, q="") => {
    setLoading(true);
    try {
      const { data } = await api.get("/drivers", { params: { page:pg, limit:LIMIT, search:q } });
      setDrivers(data.drivers);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    } catch { toast.error("Failed to load drivers"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(1,""); }, [fetch]);
  useEffect(() => {
    const t = setTimeout(() => fetch(1, search), 350);
    return () => clearTimeout(t);
  }, [search, fetch]);

  useEffect(() => {
    const unsubs = [
      on("driver:created", () => fetch(1, search)),
      on("driver:updated", ({ driver }) => setDrivers(p => p.map(d => d._id===driver._id?driver:d))),
      on("driver:deleted", ({ driverId }) => setDrivers(p => p.filter(d => d._id!==driverId))),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [on, fetch, search]);

  const handleSort = (f) => { if (sortField===f) setSortDir(d=>d===1?-1:1); else { setSortField(f); setSortDir(1); } };
  const sorted = [...drivers].sort((a,b) => { const va=a[sortField]||""; const vb=b[sortField]||""; return va<vb?-sortDir:va>vb?sortDir:0; });

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"0 0 40px" }}>
      {/* Header */}
      <div style={{ padding:"20px 28px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:22 }}>👤</span>
          <span style={{ fontSize:18, fontWeight:700, color:C.text }}>Drivers Page</span>
        </div>
      </div>

      <div style={{ padding:"0 28px" }}>
        {/* Add Driver Button */}
        {(
          <button onClick={() => setShowAdd(true)} style={{ ...BTN(C.blue), marginBottom:16, boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
            + Add New Driver
          </button>
        )}

        {/* Main card */}
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:22 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
            <span style={{ fontSize:20 }}>👤</span>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text }}>Driver Management</h2>
          </div>

          {/* Search */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:14, marginBottom:14, padding:16, background:"#F8FAFC", borderRadius:10, border:`1px solid ${C.border}` }}>
            <div><div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:7 }}>Search Drivers</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by any field..." style={INP} /></div>
          </div>

          {/* Table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:`1px solid ${C.border}` }}>
                  {["TOKEN NO", "FULL NAME", "PHONE NUMBER", "LICENSE NO", "INCHARGE NAME", "LICENSE VALIDITY", "ACTIONS"].map(h=>(
                    <th key={h} style={{ padding:"11px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:"center", padding:60, color:C.faint }}>
                    <div style={{ width:32, height:32, border:`3px solid ${C.border}`, borderTopColor:C.blue, borderRadius:"50%", animation:"vspin 0.8s linear infinite", margin:"0 auto 10px" }} />Loading…
                  </td></tr>
                ) : sorted.length===0 ? (
                  <tr><td colSpan={7} style={{ textAlign:"center", padding:60, color:C.faint }}><div style={{ fontSize:36, marginBottom:8 }}>👤</div>No drivers found</td></tr>
                ) : sorted.map((d) => {
                  const st = getLicenseStatus(d.licenseValidity);
                  return (
                    <tr key={d._id} style={{ borderBottom:`1px solid #F8FAFC`, transition:"background 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                      onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                      <td style={{ padding:"11px 12px", fontWeight:700, color:C.text, fontSize:13 }}>{d.tokenNo}</td>
                      <td style={{ padding:"11px 12px", fontSize:13, color:C.text }}>{d.fullName}</td>
                      <td style={{ padding:"11px 12px", fontSize:13, color:C.muted }}>{d.phoneNumber||"—"}</td>
                      <td style={{ padding:"11px 12px", fontSize:12, color:C.muted, fontFamily:"monospace" }}>{d.licenseNo||"—"}</td>
                      <td style={{ padding:"11px 12px", fontSize:13, color:C.muted }}>{d.inchargeName||"—"}</td>
                      <td style={{ padding:"11px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, color:C.muted }}>{fmt(d.licenseValidity)}</span>
                          <span style={{ background:st.bg, color:st.color, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{st.label}</span>
                        </div>
                      </td>
                      <td style={{ padding:"11px 12px" }}>
                        <div style={{ display:"flex", gap:5 }}>
                          <ActionBtn title="View" color="#2563EB" hoverBg="#EFF6FF" onClick={() => setViewDriver(d)}>
                            <IconEye />
                          </ActionBtn>
                          {(
                            <ActionBtn title="Edit" color="#16A34A" hoverBg="#F0FDF4" onClick={() => {setEditDriver(d);setShowAdd(true);}}>
                              <IconEdit />
                            </ActionBtn>
                          )}
                          {(
                            <ActionBtn title="Delete" color="#EF4444" hoverBg="#FEF2F2" onClick={() => setDelDriver(d)}>
                              <IconDel />
                            </ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
              <button onClick={() => fetch(page-1, search)} disabled={page===1} style={{ padding:"7px 14px", background:page===1?"#F8FAFC":C.white, border:`1px solid ${C.border}`, borderRadius:7, cursor:page===1?"default":"pointer", color:page===1?"#CBD5E1":C.muted, fontSize:13 }}>← Prev</button>
              {Array.from({ length:Math.min(pages,7) }, (_,i)=>i+1).map(p => (
                <button key={p} onClick={() => fetch(p, search)} style={{ padding:"7px 12px", background:p===page?C.blue:C.white, border:`1px solid ${p===page?C.blue:C.border}`, borderRadius:7, cursor:"pointer", color:p===page?"#fff":C.muted, fontSize:13, fontWeight:p===page?700:400 }}>{p}</button>
              ))}
              <button onClick={() => fetch(page+1, search)} disabled={page===pages} style={{ padding:"7px 14px", background:page===pages?"#F8FAFC":C.white, border:`1px solid ${C.border}`, borderRadius:7, cursor:page===pages?"default":"pointer", color:page===pages?"#CBD5E1":C.muted, fontSize:13 }}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAdd && !editDriver && <DriverFormModal onClose={() => {setShowAdd(false);setEditDriver(null);}} onSaved={() => fetch(1, search)} />}
      {editDriver && <DriverFormModal driver={editDriver} onClose={() => {setShowAdd(false);setEditDriver(null);}} onSaved={() => {fetch(page, search);}} />}
      {viewDriver && <ViewModal driver={viewDriver} onClose={() => setViewDriver(null)} />}
      {delDriver && <DeleteModal driver={delDriver} onClose={() => setDelDriver(null)} onDeleted={() => fetch(page, search)} />}

      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
