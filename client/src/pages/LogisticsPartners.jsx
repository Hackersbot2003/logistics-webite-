import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = { bg:"#fff", panel:"#dbdee0", border:"#8c99ab", text:"#1E293B", muted:"#28292a", blue:"#2563EB", red:"#EF4444", green:"#16A34A", yellow:"#D97706" };
const INP = { width:"100%", padding:"9px 12px", border:"1px solid #CBD5E1", borderRadius:7, fontSize:14, color:"#1E293B", outline:"none", boxSizing:"border-box", background:"#F8FAFC", fontFamily:"inherit" };
const BTN = (bg, color="#fff") => ({ padding:"8px 18px", background:bg, border:"none", borderRadius:6, color, cursor:"pointer", fontSize:13, fontWeight:600 });

const Lbl = ({ children }) => <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:4 }}>{children}</label>;
const Fld = ({ label, children }) => <div style={{ marginBottom:12 }}><Lbl>{label}</Lbl>{children}</div>;

// ─── Pagination helper ────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
function usePaginatedSort(items, defaultSort="") {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState(defaultSort);
  const [sortDir, setSortDir] = useState(1);

  const filtered = items.filter(item =>
    Object.values(item).some(v => String(v||"").toLowerCase().includes(search.toLowerCase()))
  );
  const sorted = [...filtered].sort((a,b) => {
    if (!sortField) return 0;
    const va = String(a[sortField]||""); const vb = String(b[sortField]||"");
    return va<vb ? -sortDir : va>vb ? sortDir : 0;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const handleSort = (f) => { if(sortField===f) setSortDir(d=>d===1?-1:1); else{setSortField(f);setSortDir(1);} setPage(1); };
  const SortIcon = ({f}) => sortField===f ? (sortDir===1?"↑":"↓") : <span style={{opacity:0.3}}>⇅</span>;

  useEffect(() => { setPage(1); }, [search]);

  return { paginated, page, setPage, totalPages, search, setSearch, handleSort, SortIcon, total: filtered.length };
}

// ─── Sort/Filter header bar ───────────────────────────────────────────────────
function TableToolbar({ search, onSearch, total, label="records" }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:10 }}>
      <div style={{ fontSize:13, color:C.muted }}>Showing {total} {label}</div>
      <input value={search} onChange={e=>onSearch(e.target.value)} placeholder={`Filter ${label}…`}
        style={{ ...INP, width:200, padding:"7px 12px" }} />
    </div>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
      <button onClick={()=>onPage(page-1)} disabled={page===1} style={{ ...BTN("#F1F5F9", C.muted), padding:"5px 13px" }}>← Prev</button>
      {Array.from({length:Math.min(totalPages,7)},(_,i)=>i+1).map(p=>(
        <button key={p} onClick={()=>onPage(p)} style={{ ...BTN(p===page?C.blue:"#F1F5F9", p===page?"#fff":C.muted), padding:"5px 11px", fontWeight:p===page?700:400 }}>{p}</button>
      ))}
      <button onClick={()=>onPage(page+1)} disabled={page===totalPages} style={{ ...BTN("#F1F5F9", C.muted), padding:"5px 13px" }}>Next →</button>
    </div>
  );
}

// ─── Generic Modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children, width="min(95vw,680px)" }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
      <div style={{ background:"#fff", borderRadius:10, width, margin:"20px auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:`1px solid ${C.border}` }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.muted }}>✕</button>
        </div>
        <div style={{ padding:"20px 22px", overflowY:"auto", maxHeight:"calc(100vh - 130px)" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────
function ConfirmDelete({ msg, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:10, padding:28, width:"min(90vw,420px)", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:10 }}>Confirm Delete</div>
        <div style={{ color:C.muted, fontSize:14, marginBottom:20 }}>{msg}</div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onCancel} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
          <button disabled={busy} onClick={async()=>{ setBusy(true); await onConfirm(); }}
            style={BTN(C.red)}>{busy?"Deleting…":"Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FML — Logistics Data + Model Details + Toll Management
// ═══════════════════════════════════════════════════════════════════════════════

// ─── FML Logistics Form ───────────────────────────────────────────────────────
function FMLForm({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    logisticPartner: item?.logisticPartner || "FML",
    location: item?.location || "",
    consigneeName: item?.consigneeName || "",
    consigneeRegion: item?.consigneeRegion || "",
    consigneeAddress: item?.consigneeAddress || "",
    overallKM: item?.overallKM || "",
    returnFare: item?.returnFare || "",
  });
  const [saving, setSaving] = useState(false);
  const set = useCallback((e) => setForm(p => ({ ...p, [e.target.name]: e.target.value })), []);

  const submit = async () => {
    if (!form.consigneeName.trim()) return toast.error("Consignee Name required");
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/logistics/fml/${item._id}`, form); toast.success("Updated"); }
      else { await api.post("/logistics/fml", form); toast.success("Added"); }
      onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Logistics Partner" : "Add Logistics Partner"} onClose={onClose}>
      <Fld label="Logistic Partner"><input name="logisticPartner" value={form.logisticPartner} onChange={set} style={INP} /></Fld>
      <Fld label="Place Of Delivery"><input name="location" value={form.location} onChange={set} style={INP} /></Fld>
      <Fld label="Consignee Name"><input name="consigneeName" value={form.consigneeName} onChange={set} style={INP} /></Fld>
      <Fld label="Consignee Region"><input name="consigneeRegion" value={form.consigneeRegion} onChange={set} style={INP} /></Fld>
      <Fld label="Consignee Address"><input name="consigneeAddress" value={form.consigneeAddress} onChange={set} style={INP} /></Fld>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Fld label="Overall K M"><input name="overallKM" type="number" value={form.overallKM} onChange={set} style={INP} /></Fld>
        <Fld label="Return Fare"><input name="returnFare" type="number" value={form.returnFare} onChange={set} style={INP} /></Fld>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
        <button onClick={onClose} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
        <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Update":"Add"}</button>
      </div>
    </Modal>
  );
}

// ─── Model Details Form ───────────────────────────────────────────────────────
function ModelForm({ item, partner, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    logisticPartner: item?.logisticPartner || partner || "FML",
    model: item?.model || "",
    average: item?.average || "",
    driverWages: item?.driverWages || "",
    vehicleRate: item?.vehicleRate || "",
    billingCode: item?.billingCode || "",
    modelSpecs: item?.modelSpecs?.length ? item.modelSpecs : [{ modelInfo:"", modelDetails:[""] }],
  });
  const [saving, setSaving] = useState(false);

  const setField = useCallback((e) => setForm(p => ({ ...p, [e.target.name]: e.target.value })), []);

  const addSpec = () => setForm(p => ({ ...p, modelSpecs: [...p.modelSpecs, { modelInfo:"", modelDetails:[""] }] }));
  const removeSpec = (i) => setForm(p => ({ ...p, modelSpecs: p.modelSpecs.filter((_,j)=>j!==i) }));
  const setSpecInfo = (i, v) => setForm(p => { const s=[...p.modelSpecs]; s[i]={...s[i],modelInfo:v}; return {...p,modelSpecs:s}; });
  const addDetail = (i) => setForm(p => { const s=[...p.modelSpecs]; s[i]={...s[i],modelDetails:[...s[i].modelDetails,""]}; return {...p,modelSpecs:s}; });
  const removeDetail = (i,j) => setForm(p => { const s=[...p.modelSpecs]; s[i]={...s[i],modelDetails:s[i].modelDetails.filter((_,k)=>k!==j)}; return {...p,modelSpecs:s}; });
  const setDetail = (i,j,v) => setForm(p => { const s=[...p.modelSpecs]; const d=[...s[i].modelDetails]; d[j]=v; s[i]={...s[i],modelDetails:d}; return {...p,modelSpecs:s}; });

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { ...form, average:Number(form.average)||0, driverWages:Number(form.driverWages)||0, vehicleRate:Number(form.vehicleRate)||0, billingCode:Number(form.billingCode)||0 };
      if (isEdit) { await api.put(`/logistics/models/${item._id}`, payload); toast.success("Updated"); }
      else { await api.post("/logistics/models", payload); toast.success("Added"); }
      onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Model Detail" : "Add Model Detail"} onClose={onClose} width="min(95vw,760px)">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Fld label="Logistic Partner"><input name="logisticPartner" value={form.logisticPartner} onChange={setField} style={INP} /></Fld>
        <Fld label="Model"><input name="model" value={form.model} onChange={setField} style={INP} /></Fld>
        <Fld label="Average"><input name="average" type="number" value={form.average} onChange={setField} style={INP} /></Fld>
        <Fld label="Driver Wages"><input name="driverWages" type="number" value={form.driverWages} onChange={setField} style={INP} /></Fld>
        <Fld label="Vehicle Rate"><input name="vehicleRate" type="number" value={form.vehicleRate} onChange={setField} style={INP} /></Fld>
        <Fld label="Billing Code"><input name="billingCode" type="number" value={form.billingCode} onChange={setField} style={INP} /></Fld>
      </div>

      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginTop:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:700, color:C.text }}>Model Specifications</span>
          <button onClick={addSpec} style={BTN(C.blue,"#fff")}>+ Add Model Info</button>
        </div>
        {form.modelSpecs.map((spec, i) => (
          <div key={i} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:7, padding:12, marginBottom:10 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <Lbl>Model Info</Lbl>
                <input value={spec.modelInfo} onChange={e=>setSpecInfo(i,e.target.value)} style={INP} />
              </div>
              {form.modelSpecs.length > 1 && (
                <button onClick={()=>removeSpec(i)} style={{ background:"none", border:"none", color:C.red, fontSize:18, cursor:"pointer", paddingTop:18 }}>🗑</button>
              )}
            </div>
            <Lbl>Model Details</Lbl>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:6 }}>
              <button onClick={()=>addDetail(i)} style={{ ...BTN(C.green), fontSize:12, padding:"5px 12px" }}>+ Add More Details</button>
            </div>
            {spec.modelDetails.map((d,j) => (
              <div key={j} style={{ display:"flex", gap:6, marginBottom:6 }}>
                <input value={d} onChange={e=>setDetail(i,j,e.target.value)} style={{ ...INP, flex:1 }} />
                <button onClick={()=>removeDetail(i,j)} style={{ background:"none", border:"none", color:C.red, fontSize:16, cursor:"pointer", padding:"0 4px" }}>🗑</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:12 }}>
        <button onClick={onClose} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
        <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Update":"Add"}</button>
      </div>
    </Modal>
  );
}

// ─── Toll Form ────────────────────────────────────────────────────────────────
// ─── Toll Form ────────────────────────────────────────────────────────────────
function TollForm({ item, models = [], locations = [], onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [location, setLocation] = useState(item?.location || "");
  const [customLocation, setCustomLocation] = useState("");
  const [tollData, setTollData] = useState(item?.tollData || {});
  const [saving, setSaving] = useState(false);

  const uniqueModels = [...new Set(models.map(m => m.model))];

  const submit = async () => {
    // Determine the final location value: either the selected one or the custom typed one
    const finalLocation = location === "__custom__" ? customLocation : location;

    if (!finalLocation.trim()) return toast.error("Location required");
    setSaving(true);
    try {
      const payload = { location: finalLocation, tollData };
      if (isEdit) { 
        await api.put(`/logistics/tolls/${item._id}`, payload); 
        toast.success("Updated"); 
      } else { 
        await api.post("/logistics/tolls", payload); 
        toast.success("Added"); 
      }
      onSaved(); 
      onClose();
    } catch(err) { 
      toast.error(err.response?.data?.message || "Failed"); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <Modal title={isEdit ? "Edit Toll Data" : "Add New Toll Data"} onClose={onClose} width="min(95vw,560px)">
      <Fld label="Location *">
        {isEdit ? (
          <input value={location} onChange={e => setLocation(e.target.value)} style={INP} />
        ) : (
          <>
            <select 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              style={{ ...INP, cursor: "pointer" }}
            >
              <option value="">Select location from logistics data</option>
              {locations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
             
            </select>
            
            {location === "__custom__" && (
              <input 
                placeholder="Type location name manually" 
                value={customLocation}
                onChange={e => setCustomLocation(e.target.value)} 
                style={{ ...INP, marginTop: 8 }} 
                autoFocus
              />
            )}
          </>
        )}
      </Fld>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        {uniqueModels.map(m => (
          <Fld key={m} label={m}>
            <input 
              type="number" 
              placeholder="Enter amount" 
              value={tollData[m] || ""} 
              onChange={e => setTollData(p => ({ ...p, [m]: e.target.value }))} 
              style={INP} 
            />
          </Fld>
        ))}
        {uniqueModels.length === 0 && (
          <>
            <Fld label="t1">
              <input type="number" placeholder="Enter amount" value={tollData["t1"] || ""} onChange={e => setTollData(p => ({ ...p, t1: e.target.value }))} style={INP} />
            </Fld>
            <Fld label="r3">
              <input type="number" placeholder="Enter amount" value={tollData["r3"] || ""} onChange={e => setTollData(p => ({ ...p, r3: e.target.value }))} style={INP} />
            </Fld>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
        <button onClick={submit} disabled={saving} style={BTN(C.blue)}>
          {saving ? "Saving…" : "Save Toll Data"}
        </button>
      </div>
    </Modal>
  );
}

// ─── FML Section ──────────────────────────────────────────────────────────────
function FMLSection() {
  const [items, setItems] = useState([]);
  const [models, setModels] = useState([]);
  const [tolls, setTolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showModelAdd, setShowModelAdd] = useState(false);
  const [editModel, setEditModel] = useState(null);
  const [showTollAdd, setShowTollAdd] = useState(false);
  const [editToll, setEditToll] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [delType, setDelType] = useState("");
  const [tollSearch, setTollSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [l, m, t] = await Promise.all([
        api.get("/logistics/fml?partner=FML"), 
        api.get("/logistics/models?partner=FML"), 
        api.get("/logistics/tolls")
      ]);
      setItems(l.data.items);
      setModels(m.data.items);
      setTolls(t.data.tolls);
    } catch { 
      toast.error("Failed to load FML data"); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const itemsTable = usePaginatedSort(items, "consigneeName");
  const modelsTable = usePaginatedSort(models, "model");
  const filteredTolls = tolls.filter(t => t.location.toLowerCase().includes(tollSearch.toLowerCase()));

  // Get unique locations from logistics partner management for the dropdown
  const availableLocations = [...new Set(items.map(item => item.location).filter(Boolean))].sort();

  const doDelete = async () => {
    try {
      if (delType === "logistics") await api.delete(`/logistics/fml/${delItem._id}`);
      else if (delType === "model") await api.delete(`/logistics/models/${delItem._id}`);
      else await api.delete(`/logistics/tolls/${delItem._id}`);
      toast.success("Deleted"); 
      load(); 
      setDelItem(null);
    } catch { 
      toast.error("Delete failed"); 
      setDelItem(null); 
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading FML data…</div>;

  return (
    <div>
      {/* Logistics Partner Table */}
      <Section title="🚛 Logistics Partner Management" onAdd={() => setShowAdd(true)} addLabel="+ Add New Logistics Partner">
        <TableToolbar search={itemsTable.search} onSearch={itemsTable.setSearch} total={itemsTable.total} label="entries" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.panel }}>
              {[["logisticPartner", "Logistic Partner"], ["location", "Location"], ["consigneeName", "Consignee Name"], ["consigneeRegion", "Consignee Region"], ["consigneeAddress", "Consignee Address"], ["overallKM", "Overall KM"], ["returnFare", "Return Fare"]].map(([f, h]) => (
                <th key={f} onClick={() => itemsTable.handleSort(f)} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {h} <itemsTable.SortIcon f={f} />
                </th>
              ))}
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsTable.paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: C.muted }}>No logistics data found.</td></tr>
            ) : itemsTable.paginated.map((d, i) => (
              <tr key={d._id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.panel}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: C.text }}>{d.logisticPartner}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{d.location}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{d.consigneeName}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{d.consigneeRegion}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, maxWidth: 180, color: C.text }}>{d.consigneeAddress?.length > 30 ? d.consigneeAddress.slice(0, 30) + "…" : d.consigneeAddress}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{d.overallKM}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{d.returnFare}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditItem(d)} style={{ ...BTN(C.yellow), padding: "5px 12px" }}>Edit</button>
                    <button onClick={() => { setDelItem(d); setDelType("logistics"); }} style={{ ...BTN(C.red), padding: "5px 12px" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={itemsTable.page} totalPages={itemsTable.totalPages} onPage={itemsTable.setPage} />
      </Section>

      {/* Model Details Table */}
      <Section title="🔧 Model Details Management" onAdd={() => setShowModelAdd(true)} addLabel="+ Add New Model Detail" style={{ marginTop: 24 }}>
        <TableToolbar search={modelsTable.search} onSearch={modelsTable.setSearch} total={modelsTable.total} label="models" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.panel }}>
              {[["logisticPartner", "Logistic Partner"], ["model", "Model"]].map(([f, h]) => (
                <th key={f} onClick={() => modelsTable.handleSort(f)} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                  {h} <modelsTable.SortIcon f={f} />
                </th>
              ))}
              {["Model Specs", "Average", "Driver Wages", "Vehicle Rate", "Billing Code", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelsTable.paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: C.muted }}>No model details found.</td></tr>
            ) : modelsTable.paginated.map(m => (
              <tr key={m._id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.panel}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{m.logisticPartner}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: C.text }}>{m.model}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, maxWidth: 200, color: C.text }}>
                  {m.modelSpecs?.map((s, i) => (
                    <div key={i}><b>{s.modelInfo}</b>{s.modelDetails?.map((d, j) => <div key={j} style={{ paddingLeft: 8, color: C.muted }}>• {d}</div>)}</div>
                  ))}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{m.average}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{m.driverWages}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{m.vehicleRate}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{m.billingCode}</td>
                <td style={{ padding: "10px 12px", color: C.text }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditModel(m)} style={{ ...BTN(C.yellow), padding: "5px 12px" }}>Edit</button>
                    <button onClick={() => { setDelItem(m); setDelType("model"); }} style={{ ...BTN(C.red), padding: "5px 12px" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={modelsTable.page} totalPages={modelsTable.totalPages} onPage={modelsTable.setPage} />
      </Section>

      {/* Toll Management */}
      <Section title="🚦 Toll Management" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input value={tollSearch} onChange={e => setTollSearch(e.target.value)} placeholder="Enter location name..." style={{ ...INP, flex: 1, minWidth: 200 }} />
          <button onClick={() => { setTollSearch(""); load(); }} style={BTN(C.blue)}>Search</button>
          <button onClick={() => setShowTollAdd(true)} style={BTN(C.blue)}>Add Toll Data</button>
          <button onClick={() => setShowModelAdd(true)} style={BTN(C.green)}>Add Model</button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Toll Data Records — Showing {filteredTolls.length} records</div>
        <table style={{ width: "100%", borderCollapse: "collapse", color: C.text }}>
          <thead>
            <tr style={{ background: C.panel }}>
              {["Location", ...[...new Set(models.map(m => m.model))].slice(0, 4), "View All", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTolls.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: C.text }}>No toll data found.</td></tr>
            ) : filteredTolls.map(t => {
              const modelCols = [...new Set(models.map(m => m.model))].slice(0, 4);
              return (
                <tr key={t._id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{t.location}</td>
                  {modelCols.map(m => (
                    <td key={m} style={{ padding: "10px 12px", fontSize: 13, color: C.text }}>{t.tollData?.[m] || "-"}</td>
                  ))}
                  <td style={{ padding: "10px 12px", color: C.text }}>
                    <button onClick={() => setEditToll(t)} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>View Complete Data</button>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.text }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditToll(t)} style={{ ...BTN(C.yellow), padding: "5px 12px" }}>Edit</button>
                      <button onClick={() => { setDelItem(t); setDelType("toll"); }} style={{ ...BTN(C.red), padding: "5px 12px" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Modals */}
      {showAdd && <FMLForm onClose={() => setShowAdd(false)} onSaved={load} />}
      {editItem && <FMLForm item={editItem} onClose={() => setEditItem(null)} onSaved={load} />}
      {showModelAdd && <ModelForm partner="FML" onClose={() => setShowModelAdd(false)} onSaved={load} />}
      {editModel && <ModelForm item={editModel} partner="FML" onClose={() => setEditModel(null)} onSaved={load} />}
      
      {showTollAdd && (
        <TollForm 
          models={models} 
          locations={availableLocations} 
          onClose={() => setShowTollAdd(false)} 
          onSaved={load} 
        />
      )}
      
      {editToll && (
        <TollForm 
          item={editToll} 
          models={models} 
          locations={availableLocations} 
          onClose={() => setEditToll(null)} 
          onSaved={load} 
        />
      )}
      
      {delItem && <ConfirmDelete msg={`Delete this record? This cannot be undone.`} onConfirm={doDelete} onCancel={() => setDelItem(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXP-FML — Port Management
// ═══════════════════════════════════════════════════════════════════════════════
function PortForm({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [ports, setPorts] = useState(item ? [{
    portName: item.portName, overallKm: item.overallKm,
    consignees: item.consignees?.length ? item.consignees : [{ consigneeName:"", consigneeRegion:"", consigneeAddress:"" }]
  }] : [{ portName:"", overallKm:"", consignees:[{ consigneeName:"", consigneeRegion:"", consigneeAddress:"" }] }]);
  const [saving, setSaving] = useState(false);

  const addPort = () => setPorts(p=>[...p,{ portName:"", overallKm:"", consignees:[{consigneeName:"",consigneeRegion:"",consigneeAddress:""}] }]);
  const setPort = (i,k,v) => setPorts(p=>{ const n=[...p]; n[i]={...n[i],[k]:v}; return n; });
  const addConsignee = (i) => setPorts(p=>{ const n=[...p]; n[i]={...n[i],consignees:[...n[i].consignees,{consigneeName:"",consigneeRegion:"",consigneeAddress:""}]}; return n; });
  const removeConsignee = (i,j) => setPorts(p=>{ const n=[...p]; n[i]={...n[i],consignees:n[i].consignees.filter((_,k)=>k!==j)}; return n; });
  const setConsignee = (i,j,k,v) => setPorts(p=>{ const n=[...p]; const c=[...n[i].consignees]; c[j]={...c[j],[k]:v}; n[i]={...n[i],consignees:c}; return n; });

  const submit = async () => {
    setSaving(true);
    try {
      for (const port of ports) {
        if (isEdit) { await api.put(`/logistics/ports/${item._id}`, { ...port, overallKm:Number(port.overallKm)||0 }); }
        else { await api.post("/logistics/ports", { ...port, overallKm:Number(port.overallKm)||0 }); }
      }
      toast.success(isEdit?"Updated":"Saved"); onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.message||"Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit?"Edit Port":"Add Ports"} onClose={onClose} width="min(95vw,720px)">
      {ports.map((port, i) => (
        <div key={i} style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:14 }}>
          <div style={{ fontWeight:700, color:C.text, marginBottom:10 }}>Port {i+1}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <Fld label="Port Name"><input value={port.portName} onChange={e=>setPort(i,"portName",e.target.value)} style={INP} /></Fld>
            <Fld label="Overall KM"><input type="number" value={port.overallKm} onChange={e=>setPort(i,"overallKm",e.target.value)} style={INP} /></Fld>
          </div>
          {port.consignees.map((c,j) => (
            <div key={j} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <input placeholder="Consignee Name" value={c.consigneeName} onChange={e=>setConsignee(i,j,"consigneeName",e.target.value)} style={INP} />
              <input placeholder="Consignee Region" value={c.consigneeRegion} onChange={e=>setConsignee(i,j,"consigneeRegion",e.target.value)} style={INP} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, gridColumn:"1/-1" }}>
                <input placeholder="Consignee Address" value={c.consigneeAddress} onChange={e=>setConsignee(i,j,"consigneeAddress",e.target.value)} style={INP} />
                <button onClick={()=>removeConsignee(i,j)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"0 10px", color:C.red, cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            </div>
          ))}
          <button onClick={()=>addConsignee(i)} style={{ ...BTN(C.green), fontSize:12 }}>+ Add Consignee</button>
        </div>
      ))}
      {!isEdit && <button onClick={addPort} style={{ ...BTN(C.blue), marginBottom:12 }}>+ Add Port</button>}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
        <button onClick={onClose} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
        <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":"Save"}</button>
      </div>
    </Modal>
  );
}

function EXPFMLSection() {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPort, setEditPort] = useState(null);
  const [delPort, setDelPort] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/logistics/ports"); setPorts(data.items); }
    catch { toast.error("Failed to load port data"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const portsTable = usePaginatedSort(ports, "portName");

  const doDelete = async () => {
    try { await api.delete(`/logistics/ports/${delPort._id}`); toast.success("Deleted"); load(); setDelPort(null); }
    catch { toast.error("Failed"); setDelPort(null); }
  };

  return (
    <Section title="🚢 Port Management" onAdd={() => setShowAdd(true)} addLabel="+ Add New Port">
      <TableToolbar search={portsTable.search} onSearch={portsTable.setSearch} total={portsTable.total} label="ports" />
      {loading ? <div style={{ padding:40, textAlign:"center", color:C.muted }}>Loading…</div> : (
        <>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:C.panel }}>
              {[["portName","Port"],["overallKm","Overall KM"]].map(([f,h])=>(
                <th key={f} onClick={()=>portsTable.handleSort(f)} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
                  {h} <portsTable.SortIcon f={f} />
                </th>
              ))}
              {["Consignees","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {portsTable.paginated.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign:"center", padding:40, color:C.muted }}>No port data found.</td></tr>
            ) : portsTable.paginated.map(p => (
              <tr key={p._id} style={{ borderBottom:`1px solid ${C.border}` }}
                onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <td style={{ padding:"10px 12px", fontWeight:600, fontSize:13 }}>{p.portName}</td>
                <td style={{ padding:"10px 12px", fontSize:13 }}>{p.overallKm}</td>
                <td style={{ padding:"10px 12px", fontSize:12, color:C.muted }}>{p.consignees?.map(c=>c.consigneeName).join(", ") || "—"}</td>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>setEditPort(p)} style={{ ...BTN(C.yellow), padding:"5px 12px" }}>Edit</button>
                    <button onClick={()=>setDelPort(p)} style={{ ...BTN(C.red), padding:"5px 12px" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={portsTable.page} totalPages={portsTable.totalPages} onPage={portsTable.setPage} />
        </>
      )}
      {showAdd && <PortForm onClose={()=>setShowAdd(false)} onSaved={load} />}
      {editPort && <PortForm item={editPort} onClose={()=>setEditPort(null)} onSaved={load} />}
      {delPort && <ConfirmDelete msg={`Delete port "${delPort.portName}"?`} onConfirm={doDelete} onCancel={()=>setDelPort(null)} />}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTHERS — OtherLogistics Partners
// ═══════════════════════════════════════════════════════════════════════════════
function OthersForm({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [partner, setPartner] = useState(item?.logisticsPartner || "");
  const [code, setCode] = useState(item?.partnerCode || "");
  const [locs, setLocs] = useState(item?.locations?.length ? item.locations : [{ locationName:"", consignees:[{consigneeName:"",consigneeRegion:"",consigneeAddress:""}] }]);
  const [places, setPlaces] = useState(item?.placesOfCollection?.length ? item.placesOfCollection : [{ placeName:"", consignors:[{consignorName:"",consignorAddress:""}] }]);
  const [saving, setSaving] = useState(false);

  const addLoc = () => setLocs(p=>[...p,{locationName:"",consignees:[{consigneeName:"",consigneeRegion:"",consigneeAddress:""}]}]);
  const removeLoc = (i) => setLocs(p=>p.filter((_,j)=>j!==i));
  const setLocName = (i,v) => setLocs(p=>{ const n=[...p]; n[i]={...n[i],locationName:v}; return n; });
  const addConsignee = (i) => setLocs(p=>{ const n=[...p]; n[i]={...n[i],consignees:[...n[i].consignees,{consigneeName:"",consigneeRegion:"",consigneeAddress:""}]}; return n; });
  const removeConsignee = (i,j) => setLocs(p=>{ const n=[...p]; n[i]={...n[i],consignees:n[i].consignees.filter((_,k)=>k!==j)}; return n; });
  const setConsignee = (i,j,k,v) => setLocs(p=>{ const n=[...p]; const c=[...n[i].consignees]; c[j]={...c[j],[k]:v}; n[i]={...n[i],consignees:c}; return n; });

  const addPlace = () => setPlaces(p=>[...p,{placeName:"",consignors:[{consignorName:"",consignorAddress:""}]}]);
  const removePlace = (i) => setPlaces(p=>p.filter((_,j)=>j!==i));
  const setPlaceName = (i,v) => setPlaces(p=>{ const n=[...p]; n[i]={...n[i],placeName:v}; return n; });
  const addConsignor = (i) => setPlaces(p=>{ const n=[...p]; n[i]={...n[i],consignors:[...n[i].consignors,{consignorName:"",consignorAddress:""}]}; return n; });
  const removeConsignor = (i,j) => setPlaces(p=>{ const n=[...p]; n[i]={...n[i],consignors:n[i].consignors.filter((_,k)=>k!==j)}; return n; });
  const setConsignor = (i,j,k,v) => setPlaces(p=>{ const n=[...p]; const c=[...n[i].consignors]; c[j]={...c[j],[k]:v}; n[i]={...n[i],consignors:c}; return n; });

  const submit = async () => {
    if (!partner.trim() || !code.trim()) return toast.error("Partner and code required");
    setSaving(true);
    try {
      const payload = { logisticsPartner:partner, partnerCode:code, locations:locs, placesOfCollection:places };
      if (isEdit) await api.put(`/logistics/others/${item._id}`, payload);
      else await api.post("/logistics/others", payload);
      toast.success(isEdit?"Updated":"Saved"); onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.message||"Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit?"Edit Logistics Partner":"Add Logistics Partner"} onClose={onClose} width="min(95vw,760px)">
      <Fld label="Logistics Partner *"><input value={partner} onChange={e=>setPartner(e.target.value)} style={INP} /></Fld>
      <Fld label="ChallanNo Code *"><input value={code} onChange={e=>setCode(e.target.value)} style={INP} /></Fld>

      <div style={{ color:C.blue, fontWeight:700, fontSize:14, margin:"14px 0 8px" }}>Locations & Consignees 📦</div>
      {locs.map((loc, i) => (
        <div key={i} style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:10 }}>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input placeholder="Location Name" value={loc.locationName} onChange={e=>setLocName(i,e.target.value)} style={{ ...INP, flex:1 }} />
            <button onClick={()=>removeLoc(i)} style={{ ...BTN(C.red), padding:"6px 12px" }}>Remove</button>
          </div>
          {loc.consignees.map((c,j) => (
            <div key={j} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <input placeholder="Consignee Name" value={c.consigneeName} onChange={e=>setConsignee(i,j,"consigneeName",e.target.value)} style={INP} />
              <input placeholder="Consignee Region" value={c.consigneeRegion} onChange={e=>setConsignee(i,j,"consigneeRegion",e.target.value)} style={INP} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, gridColumn:"1/-1" }}>
                <input placeholder="Consignee Address" value={c.consigneeAddress} onChange={e=>setConsignee(i,j,"consigneeAddress",e.target.value)} style={INP} />
                <button onClick={()=>removeConsignee(i,j)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"0 10px", color:C.red, cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            </div>
          ))}
          <button onClick={()=>addConsignee(i)} style={{ ...BTN(C.green), fontSize:12, width:"100%", marginTop:4 }}>+ Add Consignee</button>
        </div>
      ))}
      <button onClick={addLoc} style={{ ...BTN(C.blue), width:"100%", marginBottom:16 }}>+ Add New Location</button>

      <div style={{ color:C.blue, fontWeight:700, fontSize:14, margin:"8px 0 8px" }}>Places of Collection & Consignors 🚚</div>
      {places.map((pl, i) => (
        <div key={i} style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:10 }}>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input placeholder="Place Name" value={pl.placeName} onChange={e=>setPlaceName(i,e.target.value)} style={{ ...INP, flex:1 }} />
            <button onClick={()=>removePlace(i)} style={{ ...BTN(C.red), padding:"6px 12px" }}>Remove</button>
          </div>
          {pl.consignors.map((c,j) => (
            <div key={j} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, marginBottom:8 }}>
              <input placeholder="Consignor Name" value={c.consignorName} onChange={e=>setConsignor(i,j,"consignorName",e.target.value)} style={INP} />
              <input placeholder="Consignor Address" value={c.consignorAddress} onChange={e=>setConsignor(i,j,"consignorAddress",e.target.value)} style={INP} />
              <button onClick={()=>removeConsignor(i,j)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"0 10px", color:C.red, cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
          ))}
          <button onClick={()=>addConsignor(i)} style={{ ...BTN(C.green), fontSize:12, width:"100%", marginTop:4 }}>+ Add Consignor</button>
        </div>
      ))}
      <button onClick={addPlace} style={{ ...BTN(C.green), width:"100%", marginBottom:14 }}>+ Add New Place of Collection</button>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <button onClick={onClose} style={BTN("#F1F5F9", C.muted)}>Cancel</button>
        <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":"Save Logistics Partner"}</button>
      </div>
    </Modal>
  );
}

function OthersSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/logistics/others"); setItems(data.items); }
    catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tbl = usePaginatedSort(items, "logisticsPartner");

  const doDelete = async () => {
    try { await api.delete(`/logistics/others/${delItem._id}`); toast.success("Deleted"); load(); setDelItem(null); }
    catch { toast.error("Failed"); setDelItem(null); }
  };

  return (
    <Section title="📦 Other Logistics Partner Management" onAdd={() => setShowAdd(true)} addLabel="+ Add New Partner">
      <TableToolbar search={tbl.search} onSearch={tbl.setSearch} total={tbl.total} label="partners" />
      {loading ? <div style={{ padding:40, textAlign:"center", color:C.muted }}>Loading…</div> : (
        <>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:C.panel }}>
              {[["logisticsPartner","Logistic Partner"]].map(([f,h])=>(
                <th key={f} onClick={()=>tbl.handleSort(f)} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
                  {h} <tbl.SortIcon f={f} />
                </th>
              ))}
              {["Locations","Consignees","challanNo code","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tbl.paginated.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:"center", padding:40, color:C.muted }}>No logistics data found.</td></tr>
            ) : tbl.paginated.map(d => (
              <tr key={d._id} style={{ borderBottom:`1px solid ${C.border}` }}
                onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <td style={{ padding:"10px 12px", fontWeight:600, fontSize:13 }}>{d.logisticsPartner}</td>
                <td style={{ padding:"10px 12px", fontSize:12, color:C.muted }}>{d.locations?.map(l=>l.locationName).join(", ") || "—"}</td>
                <td style={{ padding:"10px 12px", fontSize:12, color:C.muted }}>{d.locations?.flatMap(l=>l.consignees?.map(c=>c.consigneeName)||[]).slice(0,2).join(", ") || "—"}</td>
                <td style={{ padding:"10px 12px", fontSize:13 }}>{d.partnerCode}</td>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>setEditItem(d)} style={{ ...BTN(C.yellow), padding:"5px 12px" }}>Edit</button>
                    <button onClick={()=>setDelItem(d)} style={{ ...BTN(C.red), padding:"5px 12px" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={tbl.page} totalPages={tbl.totalPages} onPage={tbl.setPage} />
        </>
      )}
      {showAdd && <OthersForm onClose={()=>setShowAdd(false)} onSaved={load} />}
      {editItem && <OthersForm item={editItem} onClose={()=>setEditItem(null)} onSaved={load} />}
      {delItem && <ConfirmDelete msg={`Delete "${delItem.logisticsPartner}"?`} onConfirm={doDelete} onCancel={()=>setDelItem(null)} />}
    </Section>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, onAdd, addLabel, children, style={} }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.85)", WebkitBackdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.7)", borderRadius:12, padding:20, boxShadow:"0 2px 16px rgba(0,0,0,0.06)", ...style }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:C.text }}>{title}</h3>
        {onAdd && <button onClick={onAdd} style={BTN(C.blue)}>{addLabel}</button>}
      </div>
      <div style={{ overflowX:"auto" }}>{children}</div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TYPES = ["FML","EXP-FML","OTHERS"];

export default function LogisticsPartners() {
  const [type, setType] = useState("FML");

  return (
    <div style={{ padding:"24px 20px", maxWidth:1400, margin:"0 auto", background:"linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 50%, #F0FDF4 100%)", minHeight:"100vh" }}>
      {/* Type selector */}
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
        <span style={{ fontSize:14, fontWeight:600, color:C.text }}>Select Type:</span>
        <select value={type} onChange={e=>setType(e.target.value)}
          style={{ padding:"7px 14px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:14, color:C.text, background:"#fff", cursor:"pointer", fontWeight:600 }}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <span style={{ fontSize:20 }}>👥</span>
        <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:C.text }}>Manage {type} Logistics Partner</h2>
      </div>

      {type === "FML"     && <FMLSection />}
      {type === "EXP-FML" && <EXPFMLSection />}
      {type === "OTHERS"  && <OthersSection />}
    </div>
  );
}