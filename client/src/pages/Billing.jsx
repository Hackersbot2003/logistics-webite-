import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDoubleConfirm } from "../components/DoubleConfirm";

const C = {
  bg:"#F4F6FA", white:"#fff", border:"#E2E8F0", text:"#1E293B",
  muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
  green:"#16A34A", yellow:"#D97706", panel:"#F8FAFC", darkBg:"#2D3748",
};
const INP = { width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:6,
  fontSize:14,color:C.text,outline:"none",boxSizing:"border-box",background:C.white,fontFamily:"inherit" };
const SEL = { ...INP, cursor:"pointer" };
const BTN = (bg,color="#fff",extra={})=>({padding:"8px 16px",background:bg,border:"none",
  borderRadius:7,color,cursor:"pointer",fontSize:13,fontWeight:600,
  display:"inline-flex",alignItems:"center",gap:5,...extra});
const Label = ({children,sm})=><div style={{fontSize:sm?11:13,fontWeight:600,color:C.text,marginBottom:5,textTransform:sm?"uppercase":"none",letterSpacing:sm?"0.05em":"normal"}}>{children}</div>;
const Fld = ({label,children,style={}})=><div style={{marginBottom:14,...style}}><Label>{label}</Label>{children}</div>;
function Spin({dark,sm}){
  const s=sm?14:18;
  return<div style={{width:s,height:s,border:`2px solid ${dark?"rgba(0,0,0,0.1)":"rgba(255,255,255,0.3)"}`,borderTopColor:dark?C.blue:"#fff",borderRadius:"50%",animation:"bspin 0.7s linear infinite",display:"inline-block"}} />;
}

// Open PDF — window opened synchronously (avoids popup blocker), then HTML written in
function openPDF(path) {
  const token = localStorage.getItem("ds_token");
  // Open blank window synchronously from click event — won't be blocked
  const w = window.open("", "_blank");
  if (!w) { toast.error("Popup blocked — please allow popups for this site"); return; }
  // Show loading page while we fetch
  w.document.write(`<!DOCTYPE html><html><head><title>Loading…</title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;
    justify-content:center;min-height:100vh;margin:0;background:#F8FAFC;}
    .spinner{width:40px;height:40px;border:4px solid #E2E8F0;border-top-color:#2563EB;
    border-radius:50%;animation:spin 0.8s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}</style></head>
    <body><div style="text-align:center"><div class="spinner"></div>
    <p style="color:#64748B;margin-top:16px">Loading PDF…</p></div></body></html>`);
  w.document.close();
  // Fetch HTML with auth token
  api.get(path, { responseType: "text" })
    .then(({ data }) => {
      w.document.open();
      w.document.write(data);
      w.document.close();
    })
    .catch(err => {
      const msg = typeof err?.response?.data === "string"
        ? "PDF generation failed"
        : err?.response?.data?.message || "Failed to open PDF";
      w.document.open();
      w.document.write(`<html><body style="font-family:Arial;padding:40px;color:#EF4444">
        <h2>Error</h2><p>${msg}</p></body></html>`);
      w.document.close();
      toast.error(msg);
    });
}

// ─── Inline Bills Table (no modal) ───────────────────────────────────────────
function BillsTable({ sheetName, refreshKey }) {
  const { hasRole } = useAuth();
  const { ask: askDelete, modal: deleteModal } = useDoubleConfirm();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const LIMIT = 10;

  const load = useCallback(async () => {
    if (!sheetName) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/billing/sheets/${sheetName}/records?page=${page}&limit=${LIMIT}`);
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch(_){}
    finally { setLoading(false); }
  }, [sheetName, page]);

  useEffect(() => { setPage(1); }, [sheetName]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const deleteBill = (r) => {
    askDelete(
      `Delete bill ${r.billNoPair}?\n\n• Clears "Billed" field on all ${r.vehicleUniqueIds?.length||0} vehicles\n• Removes rows from billing spreadsheet\n• Permanently deletes this record`,
      async () => {
        try {
          await api.delete(`/billing/records/${r._id}`);
          toast.success(`Bill ${r.billNoPair} deleted`);
          load();
        } catch(e) { toast.error(e.response?.data?.message || "Delete failed"); }
      }
    );
  };

  if (!sheetName) return (
    <div style={{padding:"30px 20px",textAlign:"center",color:C.faint,fontSize:13}}>
      Select a billing sheet above to view bills
    </div>
  );

  return (
    <div>
      {deleteModal}
      {loading ? (
        <div style={{padding:30,textAlign:"center"}}><Spin dark/></div>
      ) : records.length === 0 ? (
        <div style={{padding:"30px 20px",textAlign:"center",color:C.faint,fontSize:13}}>No bills generated yet in this sheet</div>
      ) : (
        <>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
              <thead>
                <tr style={{background:C.panel}}>
                  {["BILL #","TOLL #","PAIR","DATE","LOCATION","CONSIGNEE","MODELS","VEHICLES","TAX TOTAL","TOLL TOTAL","ACTIONS"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id} style={{borderBottom:`1px solid #F8FAFC`}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                    onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                    <td style={{padding:"8px 10px",fontWeight:700,color:C.blue}}>{r.invoiceNo}</td>
                    <td style={{padding:"8px 10px",color:C.muted}}>{r.tollBillNo}</td>
                    <td style={{padding:"8px 10px",fontWeight:700,fontSize:12}}>{r.billNoPair}</td>
                    <td style={{padding:"8px 10px",fontSize:12}}>{r.invoiceDate}</td>
                    <td style={{padding:"8px 10px",fontSize:12,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.location}</td>
                    <td style={{padding:"8px 10px",fontSize:12,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.consigneeName}</td>
                    <td style={{padding:"8px 10px",fontSize:11,color:C.muted}}>{r.models?.join(", ")}</td>
                    <td style={{padding:"8px 10px",textAlign:"center"}}>{r.vehicleUniqueIds?.length||0}</td>
                    <td style={{padding:"8px 10px",fontFamily:"monospace",color:C.green,fontWeight:600,fontSize:12}}>₹{(r.taxInvoiceTotal||0).toFixed(0)}</td>
                    <td style={{padding:"8px 10px",fontFamily:"monospace",color:C.yellow,fontWeight:600,fontSize:12}}>₹{(r.tollBillTotal||0).toFixed(0)}</td>
                    <td style={{padding:"8px 10px"}}>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>openPDF(`/billing/pdf/${r._id}`)} title="View Tax Invoice" style={BTN(C.blue,"#fff",{padding:"4px 9px",fontSize:11})}>📄</button>
                        {hasRole("superadmin","admin") && (
                          <button onClick={()=>deleteBill(r)}
                            title="Delete Bill" style={BTN("#FEF2F2",C.red,{padding:"4px 9px",fontSize:11,border:"1px solid #FECACA"})}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pages > 1 && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 4px",marginTop:8}}>
              <span style={{fontSize:12,color:C.muted}}>Showing {(page-1)*LIMIT+1}–{Math.min(page*LIMIT,total)} of {total} bills</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{...BTN("#F1F5F9",C.muted,{padding:"5px 12px",fontSize:12}),opacity:page===1?0.4:1}}>← Prev</button>
                {Array.from({length:pages},(_, i)=>i+1).filter(p=>p===1||p===pages||Math.abs(p-page)<=1).reduce((acc,p,i,arr)=>{
                  if(i>0&&p-arr[i-1]>1) acc.push(<span key={`e${p}`} style={{padding:"5px 4px",color:C.faint,fontSize:12}}>…</span>);
                  acc.push(<button key={p} onClick={()=>setPage(p)}
                    style={{...BTN(p===page?C.blue:"#F1F5F9",p===page?"#fff":C.muted,{padding:"5px 10px",fontSize:12}),minWidth:32}}>{p}</button>);
                  return acc;
                },[])}
                <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}
                  style={{...BTN("#F1F5F9",C.muted,{padding:"5px 12px",fontSize:12}),opacity:page===pages?0.4:1}}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Inline Billing Sheets Manager ───────────────────────────────────────────
function BillingSheetsManager({ type, activeBillingSheet, onSheetSelect, selectedSheetName, onRefresh }) {
  const { hasRole }  = useAuth();
  const [sheets, setSheets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/billing/sheets?sheetType=${type}`);
      setSheets(data.sheets || []);
    } catch(_){}
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return toast.error("Enter sheet name");
    setCreating(true);
    try {
      const { data } = await api.post("/billing/sheets", { sheetName: newName.trim(), sheetType: type });
      toast.success("Billing sheet created");
      setNewName(""); setShowForm(false);
      load();
      onRefresh?.();
    } catch(e) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setCreating(false); }
  };

  const setActive = async (sheet) => {
    try {
      await Promise.all(sheets.map(s =>
        api.put(`/billing/sheets/${s._id}/status`, { status: s._id === sheet._id ? "active" : "inactive" })
      ));
      toast.success(`"${sheet.sheetName}" is now active`);
      load(); onRefresh?.();
    } catch(_) { toast.error("Failed"); }
  };

  const toggleLock = async (s) => {
    try {
      await api.put(`/billing/sheets/${s._id}/lock`, { isLocked: s.isLocked });
      toast.success(s.isLocked ? "Unlocked" : "Locked");
      load(); onRefresh?.();
    } catch(_) { toast.error("Failed"); }
  };

  const { ask: askSheetDelete, modal: sheetDeleteModal } = useDoubleConfirm();
  const del = (s) => {
    const msg = `Delete billing sheet "${s.sheetName}"?\n\n• Clears billed status on ALL vehicles in this sheet\n• Permanently removes all bill records\n${s.isLocked ? "⚠️ This sheet is LOCKED — deleting anyway." : ""}`;
    askSheetDelete(msg, async () => {
      try {
        await api.delete(`/billing/sheets/${s._id}`);
        toast.success("Deleted and vehicles cleared");
        if (selectedSheetName === s.sheetName) onSheetSelect?.("");
        load(); onRefresh?.();
      } catch(_) { toast.error("Failed"); }
    });
  };

  return (
    <div>
      {sheetDeleteModal}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:13,color:C.text}}>{type} Billing Sheets</span>
        {hasRole("superadmin","admin","manager") && (
          <button onClick={()=>setShowForm(p=>!p)}
            style={BTN(C.blue,"#fff",{padding:"6px 14px",fontSize:12})}>
            {showForm?"Cancel":"+ New Sheet"}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:12,padding:"12px 14px",background:"#EFF6FF",borderRadius:8,border:"1px solid #BFDBFE",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:180}}>
            <Label>Sheet Name</Label>
            <input value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&create()} placeholder="e.g. APR2025-26" style={INP} />
          </div>
          <button onClick={create} disabled={creating} style={BTN(C.blue,"#fff",{padding:"9px 16px"})}>
            {creating?<><Spin/> Creating…</>:"Create"}
          </button>
        </div>
      )}

      {loading ? <div style={{padding:20,textAlign:"center"}}><Spin dark sm/></div>
      : sheets.length === 0 ? <div style={{padding:16,textAlign:"center",color:C.faint,fontSize:12}}>No billing sheets yet</div>
      : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:C.panel}}>
              {["Sheet Name","Status","Bills","Created","Actions"].map(h=>(
                <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sheets.map(s => {
                const isActive = s.status === "active";
                const isSelected = selectedSheetName === s.sheetName;
                return (
                  <tr key={s._id}
                    onClick={()=>onSheetSelect?.(s.sheetName)}
                    style={{borderBottom:`1px solid #F8FAFC`,cursor:"pointer",
                      background:isSelected?"#EFF6FF":undefined}}
                    onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=C.panel; }}
                    onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background=C.white; }}>
                    <td style={{padding:"8px 10px",fontWeight:700,color:isSelected?C.blue:C.text,fontSize:13}}>
                      {s.sheetName}
                      {isActive && <span style={{marginLeft:8,background:"rgba(34,197,94,0.1)",color:C.green,fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20}}>ACTIVE</span>}
                    </td>
                    <td style={{padding:"8px 10px"}}>
                      {s.isLocked
                        ? <span style={{background:"#FEF2F2",color:C.red,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:20}}>🔒 Locked</span>
                        : isActive
                          ? <span style={{background:"rgba(34,197,94,0.1)",color:C.green,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:20}}>Active</span>
                          : <span style={{background:C.panel,color:C.faint,fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:20}}>Inactive</span>
                      }
                    </td>
                    <td style={{padding:"8px 10px",fontWeight:700,color:C.blue,textAlign:"center"}}>{s.billCounter||0}</td>
                    <td style={{padding:"8px 10px",fontSize:11,color:C.muted}}>{new Date(s.createdAt).toLocaleDateString("en-IN")}</td>
                    <td style={{padding:"8px 10px"}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {!isActive && !s.isLocked && hasRole("superadmin","admin","manager") && (
                          <button onClick={()=>setActive(s)} style={BTN(C.green,"#fff",{padding:"3px 8px",fontSize:11})}>Set Active</button>
                        )}
                        {hasRole("admin") && (
                          <button onClick={()=>toggleLock(s)}
                            style={BTN(s.isLocked?"#FEF2F2":"#FFFBEB",s.isLocked?C.red:C.yellow,
                              {padding:"3px 8px",fontSize:11,border:`1px solid ${s.isLocked?"#FECACA":"#FDE68A"}`})}>
                            {s.isLocked?"🔓":"🔒"}
                          </button>
                        )}
                        {hasRole("superadmin","admin") && (
                          <button onClick={()=>del(s)} style={BTN("#FEF2F2",C.red,{padding:"3px 8px",fontSize:11,border:"1px solid #c44444"})}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ preview, failures, onClose, onGenerate, generating }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.5)",display:"flex",
      alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0"}}>
      <div style={{background:C.white,width:"min(95vw,720px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.text}}>Preview — Eligible Vehicles</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.faint}}>✕</button>
        </div>
        <div style={{padding:16,maxHeight:"62vh",overflowY:"auto"}}>
          {failures.length > 0 && (
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:14,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,color:C.red,marginBottom:6}}>⚠️ Issues Found</div>
              {failures.map((f,i)=><div key={i} style={{fontSize:13,color:C.red,marginBottom:3}}>• {f}</div>)}
            </div>
          )}
          {preview?.vehicles?.length > 0 ? (
            <>
              <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:13,color:C.text}}>{preview.vehicles.length} vehicles eligible</span>
                {Object.entries(preview.summary?.byModel||{}).map(([m,cnt])=>(
                  <span key={m} style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,color:C.blue}}>{m}: {cnt}</span>
                ))}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                <thead><tr style={{background:C.panel}}>
                  {["Challan No","Model","Chassis No","Consignee","Status"].map(h=>(
                    <th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:700,color:C.muted,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {preview.vehicles.map(v=>(
                    <tr key={v._id} style={{borderBottom:`1px solid #F8FAFC`}}>
                      <td style={{padding:"7px 10px",fontWeight:700,color:C.blue}}>{v.challanNo}</td>
                      <td style={{padding:"7px 10px"}}>{v.model}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",fontSize:11}}>{v.chassisNo}</td>
                      <td style={{padding:"7px 10px",fontSize:11}}>{v.consigneeName}</td>
                      <td style={{padding:"7px 10px"}}>
                        <span style={{background:"rgba(34,197,94,0.12)",color:C.green,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{v.vehicleStatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : !failures.length && <div style={{textAlign:"center",padding:30,color:C.faint}}>No eligible vehicles found</div>}
        </div>
        <div style={{padding:"12px 18px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
          {preview?.vehicles?.length > 0 && (
            <button onClick={onGenerate} disabled={generating} style={BTN(C.green)}>
              {generating?<><Spin/> Generating…</>:`✓ Generate Bill (${preview.vehicles.length} vehicles)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Billing Page ────────────────────────────────────────────────────────
export default function Billing() {
  const { hasRole } = useAuth();
  const [type, setType] = useState("FML");

  // Billing form
  const [vehicleSheet, setVehicleSheet]   = useState("");
  const [vehicleSheets, setVehicleSheets] = useState([]);
  const [location, setLocation]           = useState("");
  const [locations, setLocations]         = useState([]);
  const [consignee, setConsignee]         = useState("");
  const [consignees, setConsignees]       = useState([]);
  const [allModels, setAllModels]         = useState([]);
  const [selModels, setSelModels]         = useState([]);
  const [urbania, setUrbania]             = useState(false);
  const [urbaniaInc, setUrbaniaInc]       = useState(1000);
  // Invoice details
  const [eAckNo, setEAckNo]               = useState("");
  const [eAckDate, setEAckDate]           = useState("");
  const [invoiceDate, setInvoiceDate]     = useState("");
  const [miscRate, setMiscRate]           = useState(500);
  const [cgst, setCgst]                   = useState(9);
  const [sgst, setSgst]                   = useState(9);
  const [deliveryLoc, setDeliveryLoc]     = useState("");
  // Billing sheets
  const [billingSheets, setBillingSheets] = useState([]);
  const activeBilling = billingSheets.find(s => s.status === "active");
  // Selected billing sheet to view bills for
  const [selectedBillingSheet, setSelectedBillingSheet] = useState("");
  // PDF generators
  const [annexSheetName, setAnnexSheetName] = useState("");
  const [annexBillNo, setAnnexBillNo]       = useState("");
  const [tollSheetName, setTollSheetName]   = useState("");
  const [tollBillNo, setTollBillNo]         = useState("");
  // UI
  const [previewing, setPreviewing]   = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [preview, setPreview]         = useState(null);
  const [failures, setFailures]       = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [billsRefreshKey, setBillsRefreshKey] = useState(0);

  const loadAll = useCallback(async () => {
    try {
      const [vs, bs] = await Promise.all([
        api.get(`/vehicle-sheets?type=${type}`),
        api.get(`/billing/sheets?sheetType=${type}`),
      ]);
      const sheets = vs.data.sheets || [];
      setVehicleSheets(sheets);
      const active = sheets.find(s => s.status === "active") || sheets[0];
      if (active) {
        setVehicleSheet(active.sheetName);
        setAnnexSheetName(active.sheetName);
        setTollSheetName(active.sheetName);
      }
      const bSheets = bs.data.sheets || [];
      setBillingSheets(bSheets);
      // Auto-select active billing sheet for bills view
      const actB = bSheets.find(s => s.status === "active") || bSheets[0];
      if (actB && !selectedBillingSheet) setSelectedBillingSheet(actB.sheetName);
    } catch(_) {}
  }, [type]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const lp = type === "FML" ? "FML" : "EXP-FML";
    api.get("/logistics/fml", { params: { partner: lp } })
      .then(r => setLocations([...new Set((r.data.items||[]).map(i=>i.location).filter(Boolean))]))
      .catch(()=>{});
    api.get("/logistics/models", { params: { partner: lp } })
      .then(r => setAllModels(r.data.items||[]))
      .catch(()=>{});
    setLocation(""); setConsignee(""); setSelModels([]); setDeliveryLoc("");
  }, [type]);

  useEffect(() => {
    if (!location) { setConsignees([]); setConsignee(""); setDeliveryLoc(""); return; }
    const lp = type === "FML" ? "FML" : "EXP-FML";
    api.get("/logistics/fml", { params: { partner: lp } })
      .then(r => {
        const cs = [...new Set((r.data.items||[]).filter(i=>i.location===location).map(i=>i.consigneeName).filter(Boolean))];
        setConsignees(cs); setConsignee(""); setDeliveryLoc(location);
      }).catch(()=>{});
  }, [location, type]);

  const toggleModel = m => setSelModels(p => p.includes(m) ? p.filter(x=>x!==m) : [...p,m]);

  const doPreview = async () => {
    if (!vehicleSheet) return toast.error("Select a vehicle sheet");
    if (!location)     return toast.error("Select a location");
    if (!consignee)    return toast.error("Select a consignee");
    if (!activeBilling) return toast.error("No active billing sheet — create and activate one in the sheets section");
    setPreviewing(true);
    try {
      const { data } = await api.get("/billing/preview", {
        params: { vehicleSheetName: vehicleSheet, location, consigneeName: consignee, models: selModels.join(",") }
      });
      setPreview(data); setFailures(data.failures||[]); setShowPreview(true);
    } catch(e) { toast.error(e.response?.data?.message || "Preview failed"); }
    finally { setPreviewing(false); }
  };

  const doGenerate = async () => {
    if (!activeBilling) return toast.error("No active billing sheet");
    setGenerating(true);
    try {
      const { data } = await api.post("/billing/generate", {
        billingSheetName: activeBilling.sheetName,
        sheetType: type, vehicleSheetName: vehicleSheet,
        location, consigneeName: consignee,
        models: selModels.join(","),
        invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
        eAckNumber: eAckNo, eAckDate, miscRate,
        cgstRate: cgst, sgstRate: sgst,
        urbania, urbaniaIncentive: urbaniaInc,
        vehicleIds: preview?.vehicles?.map(v => v._id),
      });
      setShowPreview(false);
      toast.success(`✅ Bill #${data.billNoPair} generated for ${data.vehicles?.length} vehicles!`);
      // Open PDF using auth fetch
      openPDF(`/billing/pdf/${data.record._id}`);
      // Select this billing sheet in the bills view
      setSelectedBillingSheet(activeBilling.sheetName);
      setBillsRefreshKey(k => k + 1);
      loadAll();
    } catch(e) { toast.error(e.response?.data?.message || "Failed to generate bill"); }
    finally { setGenerating(false); }
  };

  const INP_SM = { ...INP, padding: "8px 10px", fontSize: 13 };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:50}}>

      {/* Type tabs */}
      <div style={{display:"flex",justifyContent:"center",padding:"16px 0 0"}}>
        <div style={{display:"flex",background:"#E2E8F0",borderRadius:8,overflow:"hidden"}}>
          {[["FML","FML Billing"],["FML_EXP","EXPFML Billing"]].map(([t,label])=>(
            <button key={t} onClick={()=>setType(t)}
              style={{padding:"10px 28px",border:"none",cursor:"pointer",fontSize:14,fontWeight:700,
                background:type===t?C.blue:"transparent",color:type===t?"#fff":C.muted,transition:"all 0.15s"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1300,margin:"0 auto",padding:"14px 20px 0"}}>

        {/* ═══ BILLING GENERATION PORTAL ═══════════════════════════════════ */}
        <div style={{background:C.darkBg,borderRadius:"10px 10px 0 0",padding:"16px 24px",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{margin:0,fontSize:16,fontWeight:800,color:"#fff"}}>Billing Generation Portal</h2>
            <p style={{margin:"3px 0 0",fontSize:12,color:"#94A3B8"}}>Generate comprehensive billing reports and invoices</p>
          </div>
          <span style={{background:"rgba(37,99,235,0.7)",color:"#fff",padding:"5px 14px",borderRadius:6,fontSize:13,fontWeight:700}}>{type}</span>
        </div>

        <div style={{background:C.white,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:24,marginBottom:16}}>
          {/* Active sheet indicator */}
          <div style={{padding:"8px 14px",borderRadius:8,marginBottom:16,
            background:activeBilling?"rgba(34,197,94,0.07)":"#FEF2F2",
            border:`1px solid ${activeBilling?"#BBF7D0":"#FECACA"}`}}>
            <span style={{fontSize:13,fontWeight:600,color:activeBilling?C.green:C.red}}>
              {activeBilling
                ? `✓ Bills stored in: ${activeBilling.sheetName} — next bill: ${activeBilling.billCounter*2+1}&${activeBilling.billCounter*2+2}`
                : "⚠️ No active billing sheet — create and activate one below"}
            </span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:26}}>
            {/* LEFT */}
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>Billing Parameters</div>

              <Fld label="Select Sheet">
                <select value={vehicleSheet} onChange={e=>setVehicleSheet(e.target.value)} style={{...SEL,border:`2px solid ${C.blue}`}}>
                  <option value="">Select a sheet</option>
                  {vehicleSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}{s.status==="active"?" (active)":""}</option>)}
                </select>
              </Fld>

              <Fld label="Select Location">
                <select value={location} onChange={e=>setLocation(e.target.value)} style={SEL}>
                  <option value="">Select a location</option>
                  {locations.map(l=><option key={l}>{l}</option>)}
                </select>
              </Fld>

              <Fld label="Consignee Name">
                <select value={consignee} onChange={e=>setConsignee(e.target.value)} style={SEL} disabled={!location}>
                  <option value="">Select Consignee</option>
                  {consignees.map(c=><option key={c}>{c}</option>)}
                </select>
              </Fld>

              <div style={{marginBottom:14}}>
                <Label>Select Models</Label>
                <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                  {allModels.map(md=>(
                    <label key={md._id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                      <input type="checkbox" checked={selModels.includes(md.model)} onChange={()=>toggleModel(md.model)}
                        style={{width:15,height:15,cursor:"pointer",accentColor:C.blue}} />
                      <span style={{fontSize:14,fontWeight:600,color:C.text}}>{md.model}</span>
                    </label>
                  ))}
                </div>
                <p style={{margin:"5px 0 0",fontSize:11,color:C.faint}}>Leave unchecked to include all models</p>
              </div>

              <div style={{border:`1px dashed ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:urbania?10:0}}>
                  <input type="checkbox" checked={urbania} onChange={e=>setUrbania(e.target.checked)}
                    style={{width:16,height:16,cursor:"pointer",accentColor:C.blue}} />
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>Billing for Urbania</span>
                </label>
                {urbania && (
                  <div>
                    <Label>Special Incentive (₹ per vehicle)</Label>
                    <input value={urbaniaInc} onChange={e=>setUrbaniaInc(e.target.value)} style={{...INP,width:200}} type="number" />
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Invoice Details */}
            <div>
              <div style={{background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
                <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>Invoice Details</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><Label>E-Ack Number</Label><input value={eAckNo} onChange={e=>setEAckNo(e.target.value)} style={INP_SM}/></div>
                  <div><Label>E-Ack Date</Label><input type="date" value={eAckDate} onChange={e=>setEAckDate(e.target.value)} style={INP_SM}/></div>
                </div>
                <div style={{marginBottom:10}}><Label>Invoice Date</Label><input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} style={INP_SM}/></div>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:10}}>
                  <Label>Misc Charges (₹/vehicle)</Label>
                  <input value={miscRate} onChange={e=>setMiscRate(e.target.value)} style={INP_SM} type="number"/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                  <div><Label>CGST (%)</Label><input value={cgst} onChange={e=>setCgst(e.target.value)} style={INP_SM} type="number"/></div>
                  <div><Label>SGST (%)</Label><input value={sgst} onChange={e=>setSgst(e.target.value)} style={INP_SM} type="number"/></div>
                </div>
                <div style={{marginTop:10}}>
                  <Label>Delivery Location</Label>
                  <input value={deliveryLoc} readOnly style={{...INP_SM,background:"#F1F5F9",color:C.muted}}/>
                </div>
              </div>
              <button onClick={doPreview}
                disabled={previewing||!vehicleSheet||!location||!consignee}
                style={{...BTN(C.blue,"#fff",{marginTop:12,padding:"11px 0",fontSize:14,width:"100%",justifyContent:"center"}),
                  opacity:(!vehicleSheet||!location||!consignee)?0.4:1}}>
                {previewing?<><Spin/> Loading…</>:"Generate Billing Report"}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ BILLING PDF GENERATORS ═══════════════════════════════════════ */}
        <div style={{background:C.darkBg,borderRadius:"10px 10px 0 0",padding:"12px 22px"}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:700,color:"#fff"}}>Billing PDF Generators</h3>
        </div>
        <div style={{background:"#F4F6FA",border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:16,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {/* Annexure */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
              <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>Annexure PDF Generator</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div style={{flex:1,minWidth:140}}>
                  <Label>Vehicle Sheet</Label>
                  <select value={annexSheetName} onChange={e=>setAnnexSheetName(e.target.value)} style={{...SEL,padding:"8px 10px",fontSize:13}}>
                    <option value="">Select Sheet</option>
                    {vehicleSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}</option>)}
                  </select>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <Label>Bill No</Label>
                  <input value={annexBillNo} onChange={e=>setAnnexBillNo(e.target.value.replace(/[^0-9]/g,""))}
                    placeholder="e.g. 1 or 2" style={{...INP,padding:"8px 10px",fontSize:13}}/>
                </div>
                <button onClick={()=>{
                  if(!annexSheetName) return toast.error("Select a sheet");
                  if(!annexBillNo.trim()) return toast.error("Enter a bill number");
                  openPDF(`/billing/annexure?vehicleSheetName=${encodeURIComponent(annexSheetName)}&billNo=${annexBillNo.trim()}`);
                }} style={BTN(C.blue,"#fff",{padding:"9px 18px",whiteSpace:"nowrap"})}>
                  Open Annexure PDF
                </button>
              </div>
            </div>
            {/* Toll */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
              <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>Expense Reimbursement (Toll &amp; Tax)</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div style={{flex:1,minWidth:140}}>
                  <Label>Vehicle Sheet</Label>
                  <select value={tollSheetName} onChange={e=>setTollSheetName(e.target.value)} style={{...SEL,padding:"8px 10px",fontSize:13}}>
                    <option value="">Select Sheet</option>
                    {vehicleSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}</option>)}
                  </select>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <Label>Bill No</Label>
                  <input value={tollBillNo} onChange={e=>setTollBillNo(e.target.value.replace(/[^0-9]/g,""))}
                    placeholder="e.g. 1 or 2" style={{...INP,padding:"8px 10px",fontSize:13}}/>
                </div>
                <button onClick={()=>{
                  if(!tollSheetName) return toast.error("Select a sheet");
                  if(!tollBillNo.trim()) return toast.error("Enter a bill number");
                  openPDF(`/billing/toll-pdf?vehicleSheetName=${encodeURIComponent(tollSheetName)}&billNo=${tollBillNo.trim()}`);
                }} style={BTN(C.green,"#fff",{padding:"9px 18px",whiteSpace:"nowrap"})}>
                  Open Toll PDF
                </button>
              </div>
            </div>
          </div>
        </div>

       <div style={{display:"flex",flexDirection:"column",gap:16}}>

  {/* TOP: Bills Table */}
  <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:13,color:C.text}}>
        Bills {selectedBillingSheet ? `— ${selectedBillingSheet}` : ""}
      </div>
      {selectedBillingSheet && (
        <select
          value={selectedBillingSheet}
          onChange={e=>setSelectedBillingSheet(e.target.value)}
          style={{...SEL,width:"auto",padding:"5px 10px",fontSize:12}}
        >
          {billingSheets.map(s=>(
            <option key={s._id} value={s.sheetName}>{s.sheetName}</option>
          ))}
        </select>
      )}
    </div>

    <BillsTable
      sheetName={selectedBillingSheet}
      refreshKey={billsRefreshKey}
    />
  </div>

  {/* BOTTOM: Billing Sheets Manager */}
  <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
    <BillingSheetsManager
      type={type}
      activeBillingSheet={activeBilling}
      selectedSheetName={selectedBillingSheet}
      onSheetSelect={setSelectedBillingSheet}
      onRefresh={() => {
        loadAll();
        setBillsRefreshKey(k=>k+1);
      }}
    />
  </div>

</div>

      </div>

      {showPreview && (
        <PreviewModal
          preview={preview} failures={failures}
          onClose={()=>setShowPreview(false)}
          onGenerate={doGenerate}
          generating={generating}
        />
      )}

      <style>{`@keyframes bspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}