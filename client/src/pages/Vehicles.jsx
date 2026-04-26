import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDoubleConfirm } from "../components/DoubleConfirm";
import { useSocket } from "../context/SocketContext";

// ─── Shared Design Tokens ─────────────────────────────────────────────────────
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

// Financial-year-aware date: today
const TODAY_STR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
};
// Convert dd-mm-yyyy ↔ yyyy-mm-dd for <input type="date">
const toISO = (s) => { if(!s) return ""; const p=s.split(/[-/]/); if(p.length!==3) return s; if(p[0].length===4) return s; return `${p[2]}-${p[1]}-${p[0]}`; };
const fromISO = (s) => { if(!s) return ""; const p=s.split("-"); if(p.length!==3) return s; if(p[0].length===4) return `${p[2]}-${p[1]}-${p[0]}`; return s; };

const TYPES = ["FML","FML_EXP","Others"];
const VEHICLE_STATUSES = ["In-Transit","Accidental","Delivered","Other Location Deliverd"];
const PDI_STATUSES = ["Received","Not Received","3rd Party Received"];

// ─── SVG Icons (matching screenshots) ────────────────────────────────────────
const IconEye  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconPin  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconDel  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;

// ─── Date input with calendar picker ─────────────────────────────────────────
function DateInput({ value, onChange, readOnly, placeholder }) {
  const ref = useRef();
  const isoVal = toISO(value);
  return (
    <div style={{ position:"relative" }}>
      <input type="date" value={isoVal} readOnly={readOnly}
        onChange={e => onChange(fromISO(e.target.value))}
        placeholder={placeholder||"dd-mm-yyyy"}
        style={{ ...readOnly?INP_RO:INP, paddingRight:36 }} />
    </div>
  );
}

// ─── Saving overlay ───────────────────────────────────────────────────────────
function Overlay({ msg }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
      <div style={{ width:48,height:48,border:"4px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"vspin 0.8s linear infinite" }} />
      <div style={{ color:"#fff",fontSize:16,fontWeight:600 }}>{msg}</div>
      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Confirm delete ───────────────────────────────────────────────────────────
function ConfirmDel({ v, onConfirm, onCancel }) {
  const [busy,setBusy]=useState(false);
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:C.white,borderRadius:12,padding:28,width:"min(90vw,440px)",boxShadow:"0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:32,marginBottom:10 }}>⚠️</div>
        <div style={{ fontWeight:800,fontSize:17,color:C.text,marginBottom:8 }}>Delete Vehicle?</div>
        <div style={{ color:C.muted,fontSize:14,marginBottom:20 }}>Delete <b>{v.challanNo||v.uniqueId}</b>? This cannot be undone.</div>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
          <button onClick={onCancel} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
          <button disabled={busy} onClick={async()=>{setBusy(true);await onConfirm();}}
            style={BTN(C.red)}>{busy?"Deleting…":"Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function ViewModal({ v, onClose, onEditTracking, onEditFull }) {
  // Show billed info prominently 
  const F = ({label,value}) => (
    <div><div style={{ fontSize:11,color:C.faint,fontWeight:600,textTransform:"uppercase",marginBottom:4,letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:14,color:C.text,minHeight:36 }}>{value||"—"}</div>
    </div>
  );
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
      <div style={{ background:C.white,borderRadius:12,width:"min(95vw,780px)",margin:"20px auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:`1px solid ${C.border}` }}>
          <div><h2 style={{ margin:0,fontSize:18,fontWeight:800,color:C.text }}>Vehicle Details</h2>
            <p style={{ margin:"2px 0 0",fontSize:13,color:C.muted }}>Complete information for the vehicle record</p></div>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{v.challanNo||"—"}</b></span>
            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
          </div>
        </div>
        <div style={{ padding:22,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
          <Card><SecHdr icon="📋" title="Invoice & Logistics Info" /><CardBody><G3>
            <F label="Logistics Partner" value={v.logisticsPartner} />
            <F label="Place Of Delivery" value={v.placeOfDelivery} />
            <F label="Challan No" value={v.challanNo} />
            <F label="Invoice Date" value={v.invoiceDate} />
            <F label="Invoice No" value={v.invoiceNo} />
          </G3></CardBody></Card>
          <Card><SecHdr icon="🏢" title="Consignee & Consignor Info" /><CardBody><G3>
            <F label="Consignee Name" value={v.consigneeName} />
            <F label="Consignee Region" value={v.consigneeRegion} />
            <F label="Consignee Address" value={v.consigneeAddress} />
            <F label="Consignor Name" value={v.consignorName} />
            <F label="Consignor Address" value={v.consignorAddress} />
          </G3></CardBody></Card>
          <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
            <F label="Model" value={v.model} /> <F label="Model Info" value={v.modelInfo} />
            <F label="Model Details" value={v.modelDetails} />
            <F label="Chassis No" value={v.chassisNo} /> <F label="Engine No" value={v.engineNo} />
            <F label="Temp Reg No" value={v.tempRegNo} />
          </G3></CardBody></Card>
          <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
            <F label="Token No" value={v.tokenNo} /> <F label="Driver Name" value={v.driverName} />
            <F label="Phone No" value={v.phoneNo} /> <F label="Driving License No" value={v.drivingLicenseNo} />
            <F label="Incharge Name" value={v.inchargeName} /> <F label="Current Incharge" value={v.currentIncharge} />
          </G3></CardBody></Card>
          <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
            <F label="Date" value={v.date} /> <F label="Time" value={v.time} />
            <F label="Vehicle Location" value={v.vehicleLocation} />
            <F label="Vehicle Status" value={v.vehicleStatus} /> <F label="Delivery Date" value={v.deliveryDate} />
            <F label="Pdi Status" value={v.pdiStatus} /> <F label="Pdi Date" value={v.pdiDate} />
            <div>
              <div style={{ fontSize:11,color:C.faint,fontWeight:600,textTransform:"uppercase",marginBottom:4,letterSpacing:"0.06em" }}>Tax Payment Receipt</div>
              <div style={{ background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:14,color:C.text }}>
                {v.taxPaymentReceipt?.length ? v.taxPaymentReceipt.map((t,i)=><div key={i}>• Name: {t.name}, Amount: {t.amount}</div>) : "—"}
              </div>
            </div>
            <F label="Toll" value={v.toll||"Not specified"} />
            <div style={{ gridColumn:"1/-1" }}><F label="Notes" value={v.notes} /></div>
          </G3></CardBody></Card>
        </div>
        <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
          <button onClick={onEditTracking} style={BTN(C.blue)}>Edit Tracking</button>
          <button onClick={onEditFull} style={BTN("#F1F5F9",C.muted)}>Edit Full</button>
          <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Tracking Modal ──────────────────────────────────────────────────────
function TrackingModal({ v, onClose, onSaved }) {
  const [form,setForm]=useState({ date:v.date||TODAY_STR(), time:v.time||"", vehicleLocation:v.vehicleLocation||"", vehicleStatus:v.vehicleStatus||"", deliveryDate:v.deliveryDate||"", pdiStatus:v.pdiStatus||"", pdiDate:v.pdiDate||"", notes:v.notes||"" });
  const [saving,setSaving]=useState(false);
  const set=useCallback((k,val)=>setForm(p=>{ const n={...p,[k]:val}; if(k==="vehicleStatus"&&val==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);
  const stColor = form.vehicleStatus==="Delivered"?"#22C55E":form.vehicleStatus==="In-Transit"?"#2563EB":form.vehicleStatus==="Accidental"?"#EF4444":null;
  const save=async()=>{ setSaving(true); try{ await api.put(`/vehicles/${v._id}`,form); toast.success("Tracking updated"); onSaved(); onClose(); }catch(e){toast.error(e.response?.data?.message||"Failed");}finally{setSaving(false);} };
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:C.white,borderRadius:12,width:"min(95vw,780px)",boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:`1px solid ${C.border}` }}>
          <div><h2 style={{ margin:0,fontSize:17,fontWeight:800,color:C.text }}>Edit Tracking Information</h2>
            <p style={{ margin:"2px 0 0",fontSize:12,color:C.muted }}>Update tracking-related information only</p></div>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{v.challanNo}</b></span>
            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
          </div>
        </div>
        <div style={{ padding:20 }}>
          <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody>
            <G3>
              <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
              <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                  <Lbl>Vehicle Status</Lbl>
                  {stColor && <span style={{ fontSize:11,fontWeight:700,color:stColor,background:stColor+"20",padding:"1px 8px",borderRadius:20 }}>{form.vehicleStatus}</span>}
                </div>
                <select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}>
                  <option value="">Select Vehicle Status</option>
                  {VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <Fld label="Delivery Date">
  <DateInput
    value={form.deliveryDate}
    onChange={v => set("deliveryDate", v)}
  />
</Fld> <Fld label="Pdi Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
              <Fld label="Pdi Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="Notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
            </G3>
          </CardBody></Card>
        </div>
        <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
          <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
          <button onClick={save} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":"Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── FML Add/Edit Form ────────────────────────────────────────────────────────
function FMLForm({ sheets, vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle);
  const [logisticsItems,setLogisticsItems]=useState([]);
  const [modelsList,setModelsList]=useState([]);
  const [selLocation,setSelLocation]=useState(vehicle?.placeOfDelivery||"");
  const [selModel,setSelModel]=useState(vehicle?.model||"");
  const [selModelInfo,setSelModelInfo]=useState(vehicle?.modelInfo||"");
  const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
  const [driverInfo,setDriverInfo]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ api.get("/logistics/fml?partner=FML").then(r=>setLogisticsItems(r.data.items)).catch(()=>{}); api.get("/logistics/models?partner=FML").then(r=>setModelsList(r.data.items)).catch(()=>{}); },[]);

  const locations=[...new Set(logisticsItems.map(i=>i.location).filter(Boolean))];
  const consigneesForLoc=logisticsItems.filter(i=>i.location===selLocation);
  const uniqueModels=[...new Set(modelsList.map(m=>m.model))];
  const modelSpecs = modelsList
  .filter(
    m => m.model?.trim().toLowerCase() === selModel?.trim().toLowerCase()
  )
  .flatMap(m => m.modelSpecs || []);
  const modelInfoOpts=modelSpecs.map(s=>s.modelInfo);
  const modelDetailsOpts=modelSpecs.find(s=>s.modelInfo===selModelInfo)?.modelDetails||[];
  const typeSheets=sheets.filter(s=>s.sheetType==="FML"&&s.status==="active");

  const INIT = { sheetName:typeSheets[0]?.sheetName||"", logisticsPartner:"FML", invoiceDate:TODAY_STR(), invoiceNo:"", dateOfCollection:"", dispatchDate:"", actualDispatchDate:"", placeOfCollection:"PITHUMPUR, M.P.", placeOfDelivery:"", otherLocationDelivery:"", overallKm:"", consigneeName:"", consigneeRegion:"", consigneeAddress:"", consignorName:"FORCE MOTOR LIMITED", consignorAddress:"PITHUMPUR, M.P.", model:"", modelInfo:"", modelDetails:"", chassisNo:"", engineNo:"", tempRegNo:"", insuranceCompany:"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:"OG-24-2001-9930-00000022-", fasTagNo:"", tokenNo:"", driverName:"", phoneNo:"", drivingLicenseNo:"", inchargeName:"", currentIncharge:"", date:TODAY_STR(), time:"", vehicleLocation:"", vehicleStatus:"", deliveryDate:"", expecteddeliveryDate:"", pdiStatus:"", pdiDate:"", notes:"" };

  const [form,setForm]=useState(()=>isEdit?{...INIT,...vehicle}:INIT);
  const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

  const handleDelivery=useCallback((loc)=>{ setSelLocation(loc); set("placeOfDelivery",loc); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("overallKm",""); },[set]);
  const handleConsignee=useCallback((name)=>{ set("consigneeName",name); const f=consigneesForLoc.find(c=>c.consigneeName===name); if(f){ set("consigneeRegion",f.consigneeRegion||""); set("consigneeAddress",f.consigneeAddress||""); set("overallKm",String(f.accountsoverallKM||"")); } },[consigneesForLoc,set]);
  const handleModel=useCallback((m)=>{ setSelModel(m); setSelModelInfo(""); set("model",m); set("modelInfo",""); set("modelDetails",""); },[set]);
  const handleModelInfo=useCallback((mi)=>{ setSelModelInfo(mi); set("modelInfo",mi); set("modelDetails",""); },[set]);

  useEffect(()=>{
    const t=setTimeout(async()=>{
      if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
      try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
      catch(_){ setDriverInfo(null); }
    },400);
    return()=>clearTimeout(t);
  },[tokenInput]);

  const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
  const ls=licSt();

  const submit=async()=>{
    const req = [
    "invoiceDate",
    "invoiceNo",
    "dateOfCollection",
    "dispatchDate",
    "actualDispatchDate",

    "placeOfCollection",
    "placeOfDelivery",
    "consigneeName",
    "overallKm",
    "consigneeRegion",
    "consigneeAddress",
    "consignorName",
    "consignorAddress",

    "model",
    "modelInfo",
    "modelDetails",
    "chassisNo",
    "engineNo",
    "tempRegNo",

    "insuranceCompany",
    "insuranceNo",
    "fasTagNo",

    // "tokenNo",
    // "driverName",
    // "phoneNo",
    // "drivingLicenseNo",
    // "inchargeName",
    // "currentIncharge",

    "date",
    "time",
    "vehicleLocation",
    "vehicleStatus"
  ];

  for (const key of req) {
    if (!form[key] || !form[key].toString().trim()) {
      toast.error(`${key.replace(/([A-Z])/g, ' $1')} is required`);
      return;
    }
  } setSaving(true);
    try{
      if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
      else{ const {data}=await api.post("/vehicles",{...form,sheetType:"FML"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
      onSaved(); onClose();
    }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒",duration:5000}); else toast.error(d?.message||"Failed"); }
    finally{setSaving(false);}
  };

  return (
    <>
      {saving&&<Overlay msg={isEdit?"Updating…":"Creating & syncing to Google Sheets…"} />}
      <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
        <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
          <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit Vehicle Details":"Add New Vehicle"}</h2>
              <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{isEdit?"Modify the vehicle details below":"Fill in the details below to add a new vehicle record"}</p></div>
            {isEdit&&<span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{vehicle.challanNo}</b></span>}
            <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint,marginLeft:12 }}>✕</button>
          </div>
          <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
            <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
              <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
                {typeSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
              </select></Fld></CardBody></Card>
            <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
              <div style={{ display:"inline-block",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"8px 16px",fontSize:14,fontWeight:700,color:C.blue }}>FML</div>
            </CardBody></Card>
            <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
              <Fld label="Invoice Date" req><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} /></Fld>
              <Fld label="Invoice No" req><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} style={INP} placeholder="Enter Invoice No" /></Fld>
              <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
              <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
              <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
            </G3></CardBody></Card>
            <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
              <Fld label="Place Of Collection"><input value={form.placeOfCollection} onChange={e=>set("placeOfCollection",e.target.value)} style={INP} /></Fld>
              <Fld label="Place Of Delivery" req>
                <select value={form.placeOfDelivery} onChange={e=>handleDelivery(e.target.value)} style={SEL}>
                  <option value="">Select Place Of Delivery</option>
                  {locations.map(l=><option key={l}>{l}</option>)}
                </select>
              </Fld>
              <Fld label="Consignee Name" req>
                <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL}>
                  <option value="">Select Consignee Name</option>
                  {consigneesForLoc.map(c=><option key={c._id}>{c.consigneeName}</option>)}
                </select>
              </Fld>
              <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} placeholder="Enter Other Location Delivery" /></Fld>
              <Fld label="Overall KM"><input value={form.overallKm} readOnly style={INP_RO} /></Fld>
              <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
              <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
              <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
            </G3></CardBody></Card>
            <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
              <Fld label="Model" req>
                <select value={form.model} onChange={e=>handleModel(e.target.value)} style={SEL}>
                  <option value="">Select Model</option>
                  {uniqueModels.map(m=><option key={m}>{m}</option>)}
                </select>
              </Fld>
              <Fld label="Model Info">
                <select value={form.modelInfo} onChange={e=>handleModelInfo(e.target.value)} style={SEL} disabled={!form.model}>
                  <option value="">Select Model Info</option>
                  {modelInfoOpts.map(mi=><option key={mi}>{mi}</option>)}
                </select>
              </Fld>
              <Fld label="Model Details">
                <select value={form.modelDetails} onChange={e=>set("modelDetails",e.target.value)} style={SEL} disabled={!form.modelInfo}>
                  <option value="">Select Model Details</option>
                  {modelDetailsOpts.map(md=><option key={md}>{md}</option>)}
                </select>
              </Fld>
              <Fld label="Chassis No" req><input value={form.chassisNo} onChange={e=>set("chassisNo",e.target.value)} style={INP} placeholder="Enter Chassis No" /></Fld>
              <Fld label="Engine No" req><input value={form.engineNo} onChange={e=>set("engineNo",e.target.value)} style={INP} placeholder="Enter Engine No" /></Fld>
              <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
            </G3></CardBody></Card>
            <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
              <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
              <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
              <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} placeholder="Enter FasTag No" /></Fld>
            </G3></CardBody></Card>
            <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
              <Fld label="TokenNo" req><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
              <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
              <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                  <Lbl>Driving License No</Lbl>
                  {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
                </div>
                <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
                {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
              </div>
              <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
              <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} placeholder="Enter Current Incharge" /></Fld>
            </G3></CardBody></Card>
            <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
              <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
              <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} placeholder="Enter Vehicle Location" /></Fld>
              <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
             <Fld label="Delivery Date">
  <DateInput
    value={form.deliveryDate}
    onChange={v => set("deliveryDate", v)}
  />
</Fld> <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
              <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
              <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
            </G3></CardBody></Card>
            {isEdit && (
              <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
                <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
                        placeholder="Not yet billed" />
                      {form.billed
                        ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
                        : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
                      }
                    </div>
                    <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
                  </div>
                </div>
              </CardBody></Card>
            )}
          </div>
          <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
            <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
            <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── EXP-FML Add/Edit Form ────────────────────────────────────────────────────
function EXPForm({ sheets, vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle);
  const [challanSearch,setChallanSearch]=useState("");
  const [fmlVehicle,setFmlVehicle]=useState(null);
  const [searching,setSearching]=useState(false);
  const [logisticsItems,setLogisticsItems]=useState([]);
  const [modelsList,setModelsList]=useState([]);
  const [saving,setSaving]=useState(false);
  const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
  const [driverInfo,setDriverInfo]=useState(null);

  useEffect(()=>{ api.get("/logistics/fml?partner=FML").then(r=>setLogisticsItems(r.data.items)).catch(()=>{}); api.get("/logistics/models?partner=FML").then(r=>setModelsList(r.data.items)).catch(()=>{}); },[]);

  const expSheets=sheets.filter(s=>s.sheetType==="FML_EXP"&&s.status==="active");

  // Place of delivery for EXP = comes from EXP logistics partners (ports)
  const [ports,setPorts]=useState([]);
  useEffect(()=>{ api.get("/logistics/ports").then(r=>setPorts(r.data.items)).catch(()=>{}); },[]);

  const [form,setForm]=useState(()=>({
    sheetName:expSheets[0]?.sheetName||"", logisticsPartner:"FML",
    invoiceDate:vehicle?.invoiceDate||TODAY_STR(), invoiceNo:vehicle?.invoiceNo||"",
    dateOfCollection:vehicle?.dateOfCollection||"", dispatchDate:vehicle?.dispatchDate||"", actualDispatchDate:vehicle?.actualDispatchDate||"",
    placeOfCollection:vehicle?.placeOfDelivery||"", // EXP: place of collection = FML place of delivery
    placeOfDelivery:vehicle?.placeOfDelivery||"", otherLocationDelivery:vehicle?.otherLocationDelivery||"",
    overallKm:vehicle?.overallKm||"", consigneeName:vehicle?.consigneeName||"", consigneeRegion:vehicle?.consigneeRegion||"", consigneeAddress:vehicle?.consigneeAddress||"",
    consignorName:vehicle?.consignorName||"FORCE MOTOR LIMITED", consignorAddress:vehicle?.consignorAddress||"PITHUMPUR, M.P.",
    model:vehicle?.model||"", modelInfo:vehicle?.modelInfo||"", modelDetails:vehicle?.modelDetails||"",
    chassisNo:vehicle?.chassisNo||"", engineNo:vehicle?.engineNo||"", tempRegNo:vehicle?.tempRegNo||"",
    insuranceCompany:vehicle?.insuranceCompany||"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:vehicle?.insuranceNo||"OG-24-2001-9930-00000022-", fasTagNo:vehicle?.fasTagNo||"",
    tokenNo:vehicle?.tokenNo||"", driverName:vehicle?.driverName||"", phoneNo:vehicle?.phoneNo||"", drivingLicenseNo:vehicle?.drivingLicenseNo||"", inchargeName:vehicle?.inchargeName||"", currentIncharge:vehicle?.currentIncharge||"",
    date:vehicle?.date||TODAY_STR(), time:vehicle?.time||"", vehicleLocation:vehicle?.vehicleLocation||"", vehicleStatus:vehicle?.vehicleStatus||"", deliveryDate:vehicle?.deliveryDate||"", expecteddeliveryDate:vehicle?.expecteddeliveryDate||"", pdiStatus:vehicle?.pdiStatus||"", pdiDate:vehicle?.pdiDate||"", notes:vehicle?.notes||"",
  }));
  const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

  // Lookup FML challan
  const searchFML=async()=>{
    if(!challanSearch.trim())return;
    setSearching(true);
    try{
      const {data}=await api.get(`/vehicles/challan/${challanSearch.trim().toUpperCase()}`);
      const fv=data.vehicle;
      setFmlVehicle(fv);
      // Auto-fill from FML vehicle
      set("invoiceDate",fv.invoiceDate||""); set("invoiceNo",fv.invoiceNo||"");
      set("dateOfCollection",fv.dateOfCollection||""); set("dispatchDate",fv.dispatchDate||""); set("actualDispatchDate",fv.actualDispatchDate||"");
      set("placeOfCollection",fv.placeOfDelivery||""); // EXP collection = FML delivery
      set("model",fv.model||""); set("modelInfo",fv.modelInfo||""); set("modelDetails",fv.modelDetails||"");
      set("chassisNo",fv.chassisNo||""); set("engineNo",fv.engineNo||"");
      set("insuranceCompany",fv.insuranceCompany||"BAJAJ ALLIANZ INSURANCE CO LTD");
      set("insuranceNo",fv.insuranceNo||"OG-24-2001-9930-00000022-"); set("fasTagNo",fv.fasTagNo||"");
      set("consignorName",fv.consignorName||"FORCE MOTOR LIMITED"); set("consignorAddress",fv.consignorAddress||"PITHUMPUR, M.P.");
      toast.success(`FML vehicle found: ${fv.challanNo}`);
    }catch(_){ toast.error("FML vehicle not found"); }
    finally{setSearching(false);}
  };

  // Ports-based delivery options
  const portNames=ports.map(p=>p.portName);
  const consigneesForPort=ports.find(p=>p.portName===form.placeOfDelivery)?.consignees||[];

  const handleDelivery=useCallback((loc)=>{ set("placeOfDelivery",loc); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("overallKm",""); },[set]);
  const handleConsignee=useCallback((name)=>{ set("consigneeName",name); const f=consigneesForPort.find(c=>c.consigneeName===name); if(f){ set("consigneeRegion",f.consigneeRegion||""); set("consigneeAddress",f.consigneeAddress||""); } const portKm=ports.find(p=>p.portName===form.placeOfDelivery)?.accountsoverallKM; if(portKm) set("overallKm",String(portKm)); },[consigneesForPort,form.placeOfDelivery,ports,set]);

  useEffect(()=>{
    const t=setTimeout(async()=>{
      if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
      try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
      catch(_){setDriverInfo(null);}
    },400);
    return()=>clearTimeout(t);
  },[tokenInput]);

  const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
  const ls=licSt();

  const submit=async()=>{
    setSaving(true);
    try{
      if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
      else{ const {data}=await api.post("/vehicles",{...form,sheetType:"FML_EXP"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
      onSaved(); onClose();
    }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒"}); else toast.error(d?.message||"Failed"); }
    finally{setSaving(false);}
  };

  return (
    <>
      {saving&&<Overlay msg="Saving…" />}
      <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
        <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
          <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit EXP-FML Vehicle":"Add New EXP-FML Vehicle"}</h2>
              <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>Search FML challan to auto-fill details</p></div>
            <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
          </div>
          <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
            {/* Sheet selector */}
            <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
              <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
                {expSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
              </select></Fld></CardBody></Card>

            {/* FML Challan Search */}
            {!isEdit&&(
              <Card><SecHdr icon="🔍" title="Search FML Vehicle" /><CardBody>
                <div style={{ display:"flex",gap:10 }}>
                  <input value={challanSearch} onChange={e=>setChallanSearch(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&searchFML()} placeholder="Enter FML Challan No (e.g. FML01)" style={{ ...INP,flex:1 }} />
                  <button onClick={searchFML} disabled={searching} style={BTN(C.blue)}>{searching?"Searching…":"Search"}</button>
                </div>
                {fmlVehicle&&<div style={{ marginTop:10,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 14px",fontSize:13,color:C.blue }}>✅ Found: {fmlVehicle.challanNo} — {fmlVehicle.consigneeName} — {fmlVehicle.model}</div>}
              </CardBody></Card>
            )}

            {/* Logistics partner fixed */}
            <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
              <div style={{ display:"inline-block",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"8px 16px",fontSize:14,fontWeight:700,color:C.blue }}>FML (Fixed)</div>
            </CardBody></Card>

            {/* Invoice & Dates — from FML (read-only unless editing) */}
            <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
              <Fld label="Invoice Date"><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} readOnly={!isEdit&&!!fmlVehicle} /></Fld>
              <Fld label="Invoice No"><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} readOnly={!isEdit&&!!fmlVehicle} style={(!isEdit&&!!fmlVehicle)?INP_RO:INP} /></Fld>
              <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
              <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
              <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
            </G3></CardBody></Card>

            {/* Location */}
            <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
              <Fld label="Place Of Collection (from FML)"><input value={form.placeOfCollection} onChange={e=>set("placeOfCollection",e.target.value)} style={INP} /></Fld>
              <Fld label="Place Of Delivery" req>
                <select value={form.placeOfDelivery} onChange={e=>handleDelivery(e.target.value)} style={SEL}>
                  <option value="">Select Place Of Delivery</option>
                  {portNames.map(l=><option key={l}>{l}</option>)}
                </select>
              </Fld>
              <Fld label="Consignee Name">
                <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL}>
                  <option value="">Select Consignee Name</option>
                  {consigneesForPort.map(c=><option key={c._id||c.consigneeName}>{c.consigneeName}</option>)}
                </select>
              </Fld>
              <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} /></Fld>
              <Fld label="Overall KM"><input value={form.overallKm} readOnly style={INP_RO} /></Fld>
              <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
              <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
              <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
            </G3></CardBody></Card>

            {/* Model from FML */}
            <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
              <Fld label="Model"><input value={form.model} readOnly style={INP_RO} /></Fld>
              <Fld label="Model Info"><input value={form.modelInfo} readOnly style={INP_RO} /></Fld>
              <Fld label="Model Details"><input value={form.modelDetails} readOnly style={INP_RO} /></Fld>
              <Fld label="Chassis No"><input value={form.chassisNo} readOnly style={INP_RO} /></Fld>
              <Fld label="Engine No"><input value={form.engineNo} readOnly style={INP_RO} /></Fld>
              <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
            </G3></CardBody></Card>

            <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
              <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
              <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
              <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} placeholder="Enter FasTag No" /></Fld>
            </G3></CardBody></Card>

            <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
              <Fld label="TokenNo"><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
              <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
              <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                  <Lbl>Driving License No</Lbl>
                  {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
                </div>
                <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
                {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
              </div>
              <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
              <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} placeholder="Enter Current Incharge" /></Fld>
            </G3></CardBody></Card>

            <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
              <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
              <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
             <Fld label="Delivery Date">
  <DateInput
    value={form.deliveryDate}
    onChange={v => set("deliveryDate", v)}
  />
</Fld>  <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
              <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
              <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
            </G3></CardBody></Card>
          </div>
          {isEdit && (
            <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
              <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
                      placeholder="Not yet billed" />
                    {form.billed
                      ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
                      : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
                    }
                  </div>
                  <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
                </div>
              </div>
            </CardBody></Card>
          )}
          <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
            <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
            <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Others Add/Edit Form ─────────────────────────────────────────────────────
function OthersForm({ sheets, vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle);
  const [partners,setPartners]=useState([]);
  const [selPartner,setSelPartner]=useState(null);
  const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
  const [driverInfo,setDriverInfo]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ api.get("/logistics/others").then(r=>setPartners(r.data.items||[])).catch(()=>{}); },[]);

  const othersSheets=sheets.filter(s=>s.sheetType==="Others"&&s.status==="active");

  const INIT={
    sheetName:othersSheets[0]?.sheetName||"", logisticsPartner:"",
    invoiceDate:TODAY_STR(), invoiceNo:"", dateOfCollection:"", dispatchDate:"", actualDispatchDate:"",
    placeOfCollection:"", placeOfDelivery:"", otherLocationDelivery:"", overallKm:"",
    consigneeName:"", consigneeRegion:"", consigneeAddress:"",
    consignorName:"", consignorAddress:"",
    model:"", modelInfo:"", modelDetails:"", chassisNo:"", engineNo:"", tempRegNo:"",
    insuranceCompany:"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:"OG-24-2001-9930-00000022-", fasTagNo:"",
    tokenNo:"", driverName:"", phoneNo:"", drivingLicenseNo:"", inchargeName:"", currentIncharge:"",
    date:TODAY_STR(), time:"", vehicleLocation:"", vehicleStatus:"", deliveryDate:"", expecteddeliveryDate:"",
    pdiStatus:"", pdiDate:"", notes:"",
  };
  const [form,setForm]=useState(()=>isEdit?{...INIT,...vehicle}:INIT);
  const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

  // When logistics partner selected, set partner code and defaults
  const handlePartner=(partnerName)=>{
    const p=partners.find(x=>x.logisticsPartner===partnerName);
    setSelPartner(p||null);
    set("logisticsPartner",partnerName);
    // reset location-dependent fields
    set("placeOfCollection",""); set("placeOfDelivery",""); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("consignorName",""); set("consignorAddress","");
  };

  // Places of collection (consignors) and locations (consignees) from selected partner
  const placesOfCollection = selPartner?.placesOfCollection||[];
  const locations = selPartner?.locations||[];

  const handleCollection=(place)=>{
    set("placeOfCollection",place);
    const p=placesOfCollection.find(x=>x.placeName===place);
    if(p?.consignors?.length){ set("consignorName",p.consignors[0].consignorName||""); set("consignorAddress",p.consignors[0].consignorAddress||""); }
  };
  const handleLocation=(loc)=>{
    set("placeOfDelivery",loc);
    set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress","");
  };
  const consigneesForLoc=(locations.find(l=>l.locationName===form.placeOfDelivery)?.consignees)||[];
  const handleConsignee=(name)=>{
    set("consigneeName",name);
    const c=consigneesForLoc.find(x=>x.consigneeName===name);
    if(c){ set("consigneeRegion",c.consigneeRegion||""); set("consigneeAddress",c.consigneeAddress||""); }
  };

  // Driver token lookup
  useEffect(()=>{
    const t=setTimeout(async()=>{
      if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
      try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
      catch(_){ setDriverInfo(null); }
    },400);
    return()=>clearTimeout(t);
  },[tokenInput]);

  const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
  const ls=licSt();

  const submit=async()=>{
    if(!form.logisticsPartner) return toast.error("Select a Logistics Partner");
    if(!form.placeOfDelivery) return toast.error("Select Place of Delivery");
    setSaving(true);
    try{
      if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
      else{ const {data}=await api.post("/vehicles",{...form,sheetType:"Others"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
      onSaved(); onClose();
    }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒"}); else toast.error(d?.message||"Failed"); }
    finally{setSaving(false);}
  };

  return (
    <>
      {saving&&<Overlay msg="Saving…" />}
      <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
        <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
          <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit Others Vehicle":"Add New Others Vehicle"}</h2>
              <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>Fill in the details for an Others logistics vehicle</p></div>
            <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
          </div>
          <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
            {/* Sheet */}
            <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
              <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
                {othersSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
              </select>
            </Fld></CardBody></Card>

            {/* Logistics Partner */}
            <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
              <Fld label="Logistics Partner" req>
                <select value={form.logisticsPartner} onChange={e=>handlePartner(e.target.value)} style={SEL}>
                  <option value="">Select Logistics Partner</option>
                  {partners.map(p=><option key={p._id}>{p.logisticsPartner}</option>)}
                </select>
              </Fld>
              {selPartner && <div style={{ fontSize:12,color:C.muted,marginTop:-8 }}>Partner Code: <b>{selPartner.partnerCode}</b></div>}
            </CardBody></Card>

            {/* Invoice */}
            <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
              <Fld label="Invoice Date" req><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} /></Fld>
              <Fld label="Invoice No" req><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} style={INP} placeholder="Enter Invoice No" /></Fld>
              <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
              <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
              <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
            </G3></CardBody></Card>

            {/* Location */}
            <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
              <Fld label="Place Of Collection">
                <select value={form.placeOfCollection} onChange={e=>handleCollection(e.target.value)} style={SEL} disabled={!selPartner}>
                  <option value="">Select Place Of Collection</option>
                  {placesOfCollection.map(p=><option key={p._id||p.placeName}>{p.placeName}</option>)}
                </select>
              </Fld>
              <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
              <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
              <Fld label="Place Of Delivery" req>
                <select value={form.placeOfDelivery} onChange={e=>handleLocation(e.target.value)} style={SEL} disabled={!selPartner}>
                  <option value="">Select Place Of Delivery</option>
                  {locations.map(l=><option key={l._id||l.locationName}>{l.locationName}</option>)}
                </select>
              </Fld>
              <Fld label="Consignee Name">
                <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL} disabled={!form.placeOfDelivery}>
                  <option value="">Select Consignee Name</option>
                  {consigneesForLoc.map(c=><option key={c._id||c.consigneeName}>{c.consigneeName}</option>)}
                </select>
              </Fld>
              <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
              <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} /></Fld>
              <Fld label="Overall KM"><input value={form.overallKm} onChange={e=>set("overallKm",e.target.value)} style={INP} placeholder="Enter Overall KM" /></Fld>
            </G3></CardBody></Card>

            {/* Model */}
            <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
              <Fld label="Model" req><input value={form.model} onChange={e=>set("model",e.target.value)} style={INP} placeholder="Enter Model" /></Fld>
              <Fld label="Model Info"><input value={form.modelInfo} onChange={e=>set("modelInfo",e.target.value)} style={INP} placeholder="Enter Model Info" /></Fld>
              <Fld label="Model Details"><input value={form.modelDetails} onChange={e=>set("modelDetails",e.target.value)} style={INP} placeholder="Enter Model Details" /></Fld>
              <Fld label="Chassis No"><input value={form.chassisNo} onChange={e=>set("chassisNo",e.target.value)} style={INP} placeholder="Enter Chassis No" /></Fld>
              <Fld label="Engine No"><input value={form.engineNo} onChange={e=>set("engineNo",e.target.value)} style={INP} placeholder="Enter Engine No" /></Fld>
              <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
            </G3></CardBody></Card>

            {/* Insurance */}
            <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
              <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
              <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
              <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} /></Fld>
            </G3></CardBody></Card>

            {/* Driver */}
            <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
              <Fld label="TokenNo"><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
              <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
              <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                  <Lbl>Driving License No</Lbl>
                  {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
                </div>
                <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
                {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
              </div>
              <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
              <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} /></Fld>
            </G3></CardBody></Card>

            {/* Tracking */}
            <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
              <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
              <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
              <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
             <Fld label="Delivery Date">
  <DateInput
    value={form.deliveryDate}
    onChange={v => set("deliveryDate", v)}
  />
</Fld> <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
              <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
              <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
              <div style={{ gridColumn:"1/-1" }}><Fld label="Notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
            </G3></CardBody></Card>
          </div>
          {isEdit && (
            <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
              <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
                      placeholder="Not yet billed" />
                    {form.billed
                      ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
                      : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
                    }
                  </div>
                  <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
                </div>
              </div>
            </CardBody></Card>
          )}
          <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
            <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
            <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Vehicles Page ───────────────────────────────────────────────────────
export default function Vehicles() {
  const { hasRole } = useAuth();
  const { ask: askDelete, modal: deleteModal } = useDoubleConfirm();
  const { on } = useSocket();
  const [sheetType,setSheetType]=useState("FML");
  const [sheets,setSheets]=useState([]);
  const [selectedSheet,setSelectedSheet]=useState("");
  const [vehicles,setVehicles]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editVehicle,setEditVehicle]=useState(null);
  const [viewVehicle,setViewVehicle]=useState(null);
  const [trackVehicle,setTrackVehicle]=useState(null);
  const [delVehicle,setDelVehicle]=useState(null);
  const [filterStatus,setFilterStatus]=useState("");
  const [filterPDI,setFilterPDI]=useState("");
  const [filterLocation,setFilterLocation]=useState("");
  const [filterModel,setFilterModel]=useState("");

  const loadSheets=useCallback(async()=>{
    try{ const {data}=await api.get(`/vehicle-sheets?type=${sheetType}`); setSheets(data.sheets); const active=data.sheets.find(s=>s.status==="active"); if(active) setSelectedSheet(active.sheetName); }
    catch{}
  },[sheetType]);

  useEffect(()=>{ setSelectedSheet(""); loadSheets(); },[loadSheets]);

  // ─── CHANGE 1: filters are sent to backend so they work across all pages ───
  const fetchVehicles=useCallback(async(pg=1,q="")=>{
    if(!selectedSheet)return;
    setLoading(true);
    try{
      const {data}=await api.get("/vehicles",{
        params:{
          sheetName:selectedSheet,
          page:pg,
          limit:10,
          search:q||undefined,
          status:filterStatus||undefined,
          pdiStatus:filterPDI||undefined,
          placeOfDelivery:filterLocation||undefined,
          model:filterModel||undefined,
        }
      });
      setVehicles(data.vehicles);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    }
    catch{toast.error("Failed to load");}
    finally{setLoading(false);}
  // ─── CHANGE 2: filter states added as dependencies ────────────────────────
  },[selectedSheet,filterStatus,filterPDI,filterLocation,filterModel]);

  useEffect(()=>{fetchVehicles(1,"");},[fetchVehicles]);
  useEffect(()=>{const t=setTimeout(()=>fetchVehicles(1,search),350);return()=>clearTimeout(t);},[search,fetchVehicles]);

  // ─── CHANGE 3: re-fetch from page 1 whenever any filter changes ───────────
  useEffect(()=>{fetchVehicles(1,search);},[filterStatus,filterPDI,filterLocation,filterModel]);

  useEffect(()=>{
    const u=[
      on("vehicle:created",({vehicle})=>{if(vehicle.sheetName===selectedSheet){setVehicles(p=>[vehicle,...p]);setTotal(t=>t+1);}}),
      on("vehicle:updated",({vehicle})=>setVehicles(p=>p.map(v=>v._id===vehicle._id?vehicle:v))),
      on("vehicle:deleted",({vehicleId})=>{setVehicles(p=>p.filter(v=>v._id!==vehicleId));setTotal(t=>Math.max(0,t-1));}),
    ];
    return()=>u.forEach(fn=>fn?.());
  },[on,selectedSheet]);

  const doDelete = (v) => {
    askDelete(
      `Delete vehicle ${v.challanNo || v.uniqueId}?

This will permanently remove the vehicle and all its data. This cannot be undone.`,
      async () => {
        try { await api.delete(`/vehicles/${v._id}`); toast.success("Vehicle deleted"); fetchVehicles(page, search); }
        catch(e) { toast.error(e.response?.data?.message || "Delete failed"); }
      }
    );
  };

  const hasFilters=filterStatus||filterPDI||filterLocation||filterModel;

  // ─── CHANGE 4: clearFilters no longer needs to re-filter locally;
  //     resetting state triggers the useEffect above automatically ───────────
  const clearFilters=()=>{
    setFilterStatus("");
    setFilterPDI("");
    setFilterLocation("");
    setFilterModel("");
  };

  // ─── CHANGE 5: location/model dropdowns still built from current page
  //     vehicles (for UX convenience — full list comes from backend filters) ──
  const locations=[...new Set(vehicles.map(v=>v.placeOfDelivery).filter(Boolean))];
  const models=[...new Set(vehicles.map(v=>v.model).filter(Boolean))];

  const currentSheet=sheets.find(s=>s.sheetName===selectedSheet);
  const isLocked=currentSheet?.isLocked;

  const stStyle=(s)=>s==="Delivered"?{bg:"rgba(34,197,94,0.12)",color:"#16A34A"}:s==="In-Transit"?{bg:"rgba(37,99,235,0.12)",color:"#2563EB"}:s==="Accidental"?{bg:"rgba(239,68,68,0.12)",color:"#EF4444"}:{bg:"#F1F5F9",color:C.muted};

  return (
    <div style={{ background:C.bg,minHeight:"100vh",padding:"0 0 40px" }}>
      {/* Header */}
      <div style={{ padding:"20px 28px 14px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
          <span style={{ fontSize:22 }}>🚌</span>
          <span style={{ fontSize:18,fontWeight:700,color:C.text }}>Vehicles Page</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:14,fontWeight:600,color:C.text }}>Select Type:</span>
          <select value={sheetType} onChange={e=>setSheetType(e.target.value)} style={{ ...SEL,width:"auto",minWidth:120 }}>
            {TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:"0 28px" }}>
        {/* Add Vehicle Button */}
        {!isLocked&&(
          <button onClick={()=>{setEditVehicle(null);setShowForm(true);}} style={{ ...BTN(C.blue),marginBottom:16,boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
            + Add New Vehicle
          </button>
        )}

        {/* Main card */}
        <div style={{ background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:22 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:18 }}>
            <span style={{ fontSize:20 }}>🚌</span>
            <h2 style={{ margin:0,fontSize:16,fontWeight:800,color:C.text }}>Vehicle Management</h2>
          </div>

          {/* Sheet + Search */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14,padding:16,background:"#F8FAFC",borderRadius:10,border:`1px solid ${C.border}` }}>
            <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Vehicle Sheet</div>
              <select value={selectedSheet} onChange={e=>setSelectedSheet(e.target.value)} style={SEL}>
                <option value="">— Select Sheet —</option>
                {sheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}{s.status==="active"?" ✓":""}</option>)}
              </select></div>
            <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Search Vehicles</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by any field..." style={INP} /></div>
          </div>

          {/* Filters */}
          <div style={{ padding:14,background:"#F8FAFC",borderRadius:10,border:`1px solid ${C.border}`,marginBottom:16 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:12,alignItems:"flex-end" }}>
              <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Vehicle Status</div>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={SEL}><option value="">All Statuses</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>PDI Status</div>
                <select value={filterPDI} onChange={e=>setFilterPDI(e.target.value)} style={SEL}><option value="">All PDI Statuses</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Location</div>
                <select value={filterLocation} onChange={e=>setFilterLocation(e.target.value)} style={SEL}><option value="">All Locations</option>{locations.map(l=><option key={l}>{l}</option>)}</select></div>
              <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Model</div>
                <select value={filterModel} onChange={e=>setFilterModel(e.target.value)} style={SEL}><option value="">All Models</option>{models.map(m=><option key={m}>{m}</option>)}</select></div>
              {hasFilters&&(
                <button onClick={clearFilters} style={{ ...BTN("#F1F5F9",C.red,{padding:"9px 14px",border:`1px solid ${C.red}`}),whiteSpace:"nowrap" }}>✕ Clear Filters</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC",borderBottom:`1px solid ${C.border}` }}>
                  {["CHALLAN NO","UNIQUE ID","PLACE OF DELIVERY","DRIVER NAME","PHONE NO","CURRENT INCHARGE","VEHICLE STATUS","BILLED","ACTIONS"].map(h=>(
                    <th key={h} style={{ padding:"11px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading?(
                  <tr><td colSpan={9} style={{ textAlign:"center",padding:60,color:C.faint }}>
                    <div style={{ width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.blue,borderRadius:"50%",animation:"vspin 0.8s linear infinite",margin:"0 auto 10px" }} />Loading…
                  </td></tr>
                // ─── CHANGE 6: `filtered` removed — render `vehicles` directly ──
                ):vehicles.length===0?(
                  <tr><td colSpan={9} style={{ textAlign:"center",padding:60,color:C.faint }}><div style={{ fontSize:36,marginBottom:8 }}>🚗</div>No vehicles found</td></tr>
                ):vehicles.map((v)=>{
                  const st=stStyle(v.vehicleStatus);
                  return(
                    <tr key={v._id} style={{ borderBottom:`1px solid #F8FAFC`,transition:"background 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                      onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                      <td style={{ padding:"11px 12px",fontWeight:700,color:C.text,fontSize:13 }}>{v.challanNo||"—"}</td>
                      <td style={{ padding:"11px 12px",fontSize:12,color:C.muted,fontFamily:"monospace" }}>{v.uniqueId}</td>
                      <td style={{ padding:"11px 12px",fontSize:13,color:"#475569" }}>{v.placeOfDelivery||"—"}</td>
                      <td style={{ padding:"11px 12px",fontSize:13,color:C.text }}>{v.driverName||"—"}</td>
                      <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.phoneNo||"—"}</td>
                      <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.currentIncharge||v.inchargeName||"—"}</td>
                      <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.vehicleLocation||"—"}</td>
                      <td style={{ padding:"11px 12px" }}>
                        {v.vehicleStatus?<span style={{ background:st.bg,color:st.color,fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20 }}>{v.vehicleStatus}</span>:"—"}
                      </td>
                      <td style={{ padding:"11px 12px" }}>
                        {v.billed
                          ? <span style={{ background:"rgba(234,179,8,0.12)",color:"#B45309",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,fontFamily:"monospace" }}>{v.billed}</span>
                          : <span style={{ color:C.faint,fontSize:12 }}>—</span>
                        }
                      </td>
                      <td style={{ padding:"11px 12px" }}>
                        <div style={{ display:"flex",gap:5 }}>
                          <ActionBtn title="View" color="#2563EB" hoverBg="#EFF6FF" onClick={()=>setViewVehicle(v)}><IconEye /></ActionBtn>
                          {!isLocked&&(<>
                            <ActionBtn title="Edit Tracking" color="#D97706" hoverBg="#FFFBEB" onClick={()=>setTrackVehicle(v)}><IconPin /></ActionBtn>
                            <ActionBtn title="Edit Full" color="#16A34A" hoverBg="#F0FDF4" onClick={()=>{setEditVehicle(v);setShowForm(true);}}><IconEdit /></ActionBtn>
                          </>)}
                          {!isLocked&&(
                            <ActionBtn title="Delete" color="#EF4444" hoverBg="#FEF2F2" onClick={()=>doDelete(v)}><IconDel /></ActionBtn>
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
          {pages>1&&(
            <div style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}` }}>
              <button onClick={()=>fetchVehicles(page-1,search)} disabled={page===1} style={{ padding:"7px 14px",background:page===1?"#F8FAFC":C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===1?"default":"pointer",color:page===1?"#CBD5E1":C.muted,fontSize:13 }}>← Prev</button>
              {Array.from({length:Math.min(pages,7)},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>fetchVehicles(p,search)} style={{ padding:"7px 12px",background:p===page?C.blue:C.white,border:`1px solid ${p===page?C.blue:C.border}`,borderRadius:7,cursor:"pointer",color:p===page?"#fff":C.muted,fontSize:13,fontWeight:p===page?700:400 }}>{p}</button>
              ))}
              <button onClick={()=>fetchVehicles(page+1,search)} disabled={page===pages} style={{ padding:"7px 14px",background:page===pages?"#F8FAFC":C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===pages?"default":"pointer",color:page===pages?"#CBD5E1":C.muted,fontSize:13 }}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showForm&&sheetType==="FML"&&<FMLForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
      {showForm&&sheetType==="FML_EXP"&&<EXPForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
      {showForm&&sheetType==="Others"&&<OthersForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
      {viewVehicle&&<ViewModal v={viewVehicle} onClose={()=>setViewVehicle(null)} onEditTracking={()=>{setTrackVehicle(viewVehicle);setViewVehicle(null);}} onEditFull={()=>{setEditVehicle(viewVehicle);setShowForm(true);setViewVehicle(null);}} />}
      {trackVehicle&&<TrackingModal v={trackVehicle} onClose={()=>setTrackVehicle(null)} onSaved={()=>fetchVehicles(page,search)} />}
      {deleteModal}

      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ActionBtn({title,color,hoverBg,onClick,children}){
  return(
    <button title={title} onClick={onClick}
      style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}
      onMouseEnter={e=>{e.currentTarget.style.background=hoverBg;e.currentTarget.style.color=color;e.currentTarget.style.borderColor=color+"60";}}
      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>
      {children}
    </button>
  );
}


// import { useState, useEffect, useCallback, useRef } from "react";
// import toast from "react-hot-toast";
// import api from "../api/axios";
// import { useAuth } from "../context/AuthContext";
// import { useDoubleConfirm } from "../components/DoubleConfirm";
// import { useSocket } from "../context/SocketContext";

// // ─── Shared Design Tokens ─────────────────────────────────────────────────────
// const C = {
//   bg:"#F1F5F9", white:"#fff", border:"#E2E8F0", text:"#1E293B",
//   muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
//   green:"#16A34A", yellow:"#D97706",
// };

// const INP = { width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:7, fontSize:14, color:C.text, outline:"none", boxSizing:"border-box", background:"#F8FAFC", fontFamily:"inherit" };
// const INP_RO = { ...INP, background:"#F1F5F9", color:C.muted, cursor:"default" };
// const SEL = { ...INP, cursor:"pointer" };
// const BTN = (bg, color="#fff", extra={}) => ({ padding:"9px 18px", background:bg, border:"none", borderRadius:7, color, cursor:"pointer", fontSize:13, fontWeight:600, display:"inline-flex", alignItems:"center", gap:6, ...extra });

// const Lbl = ({ children, req }) => (
//   <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>
//     {children}{req && <span style={{ color:C.red }}> *</span>}
//   </label>
// );
// const Fld = ({ label, req, style={}, children }) => <div style={{ marginBottom:14, ...style }}><Lbl req={req}>{label}</Lbl>{children}</div>;
// const SecHdr = ({ icon, title }) => (
//   <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 18px", borderBottom:`1px solid ${C.border}`, background:"#F8FAFC" }}>
//     <span>{icon}</span>
//     <span style={{ fontWeight:700, fontSize:14, color:C.text }}>{title}</span>
//   </div>
// );
// const Card = ({ children, style={} }) => <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:14, overflow:"hidden", ...style }}>{children}</div>;
// const CardBody = ({ children }) => <div style={{ padding:18 }}>{children}</div>;
// const G3 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>{children}</div>;

// // Financial-year-aware date: today
// const TODAY_STR = () => {
//   const d = new Date();
//   return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
// };
// // Convert dd-mm-yyyy ↔ yyyy-mm-dd for <input type="date">
// const toISO = (s) => { if(!s) return ""; const p=s.split(/[-/]/); if(p.length!==3) return s; if(p[0].length===4) return s; return `${p[2]}-${p[1]}-${p[0]}`; };
// const fromISO = (s) => { if(!s) return ""; const p=s.split("-"); if(p.length!==3) return s; if(p[0].length===4) return `${p[2]}-${p[1]}-${p[0]}`; return s; };

// const TYPES = ["FML","FML_EXP","Others"];
// const VEHICLE_STATUSES = ["In-Transit","Accidental","Delivered"];
// const PDI_STATUSES = ["Received","Not Received","3rd Party Received"];

// // ─── SVG Icons (matching screenshots) ────────────────────────────────────────
// const IconEye  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
// const IconPin  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
// const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
// const IconDel  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;

// // ─── Date input with calendar picker ─────────────────────────────────────────
// function DateInput({ value, onChange, readOnly, placeholder }) {
//   const ref = useRef();
//   const isoVal = toISO(value);
//   return (
//     <div style={{ position:"relative" }}>
//       <input type="date" value={isoVal} readOnly={readOnly}
//         onChange={e => onChange(fromISO(e.target.value))}
//         placeholder={placeholder||"dd-mm-yyyy"}
//         style={{ ...readOnly?INP_RO:INP, paddingRight:36 }} />
//     </div>
//   );
// }

// // ─── Saving overlay ───────────────────────────────────────────────────────────
// function Overlay({ msg }) {
//   return (
//     <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
//       <div style={{ width:48,height:48,border:"4px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"vspin 0.8s linear infinite" }} />
//       <div style={{ color:"#fff",fontSize:16,fontWeight:600 }}>{msg}</div>
//       <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
// }

// // ─── Confirm delete ───────────────────────────────────────────────────────────
// function ConfirmDel({ v, onConfirm, onCancel }) {
//   const [busy,setBusy]=useState(false);
//   return (
//     <div style={{ position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
//       <div style={{ background:C.white,borderRadius:12,padding:28,width:"min(90vw,440px)",boxShadow:"0 20px 50px rgba(0,0,0,0.2)" }}>
//         <div style={{ fontSize:32,marginBottom:10 }}>⚠️</div>
//         <div style={{ fontWeight:800,fontSize:17,color:C.text,marginBottom:8 }}>Delete Vehicle?</div>
//         <div style={{ color:C.muted,fontSize:14,marginBottom:20 }}>Delete <b>{v.challanNo||v.uniqueId}</b>? This cannot be undone.</div>
//         <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
//           <button onClick={onCancel} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
//           <button disabled={busy} onClick={async()=>{setBusy(true);await onConfirm();}}
//             style={BTN(C.red)}>{busy?"Deleting…":"Delete"}</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── View Modal ───────────────────────────────────────────────────────────────
// function ViewModal({ v, onClose, onEditTracking, onEditFull }) {
//   // Show billed info prominently 
//   const F = ({label,value}) => (
//     <div><div style={{ fontSize:11,color:C.faint,fontWeight:600,textTransform:"uppercase",marginBottom:4,letterSpacing:"0.06em" }}>{label}</div>
//       <div style={{ background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:14,color:C.text,minHeight:36 }}>{value||"—"}</div>
//     </div>
//   );
//   return (
//     <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
//       <div style={{ background:C.white,borderRadius:12,width:"min(95vw,780px)",margin:"20px auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
//         <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:`1px solid ${C.border}` }}>
//           <div><h2 style={{ margin:0,fontSize:18,fontWeight:800,color:C.text }}>Vehicle Details</h2>
//             <p style={{ margin:"2px 0 0",fontSize:13,color:C.muted }}>Complete information for the vehicle record</p></div>
//           <div style={{ display:"flex",alignItems:"center",gap:14 }}>
//             <span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{v.challanNo||"—"}</b></span>
//             <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
//           </div>
//         </div>
//         <div style={{ padding:22,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
//           <Card><SecHdr icon="📋" title="Invoice & Logistics Info" /><CardBody><G3>
//             <F label="Logistics Partner" value={v.logisticsPartner} />
//             <F label="Place Of Delivery" value={v.placeOfDelivery} />
//             <F label="Challan No" value={v.challanNo} />
//             <F label="Invoice Date" value={v.invoiceDate} />
//             <F label="Invoice No" value={v.invoiceNo} />
//           </G3></CardBody></Card>
//           <Card><SecHdr icon="🏢" title="Consignee & Consignor Info" /><CardBody><G3>
//             <F label="Consignee Name" value={v.consigneeName} />
//             <F label="Consignee Region" value={v.consigneeRegion} />
//             <F label="Consignee Address" value={v.consigneeAddress} />
//             <F label="Consignor Name" value={v.consignorName} />
//             <F label="Consignor Address" value={v.consignorAddress} />
//           </G3></CardBody></Card>
//           <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
//             <F label="Model" value={v.model} /> <F label="Model Info" value={v.modelInfo} />
//             <F label="Model Details" value={v.modelDetails} />
//             <F label="Chassis No" value={v.chassisNo} /> <F label="Engine No" value={v.engineNo} />
//             <F label="Temp Reg No" value={v.tempRegNo} />
//           </G3></CardBody></Card>
//           <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
//             <F label="Token No" value={v.tokenNo} /> <F label="Driver Name" value={v.driverName} />
//             <F label="Phone No" value={v.phoneNo} /> <F label="Driving License No" value={v.drivingLicenseNo} />
//             <F label="Incharge Name" value={v.inchargeName} /> <F label="Current Incharge" value={v.currentIncharge} />
//           </G3></CardBody></Card>
//           <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
//             <F label="Date" value={v.date} /> <F label="Time" value={v.time} />
//             <F label="Vehicle Location" value={v.vehicleLocation} />
//             <F label="Vehicle Status" value={v.vehicleStatus} /> <F label="Delivery Date" value={v.deliveryDate} />
//             <F label="Pdi Status" value={v.pdiStatus} /> <F label="Pdi Date" value={v.pdiDate} />
//             <div>
//               <div style={{ fontSize:11,color:C.faint,fontWeight:600,textTransform:"uppercase",marginBottom:4,letterSpacing:"0.06em" }}>Tax Payment Receipt</div>
//               <div style={{ background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:14,color:C.text }}>
//                 {v.taxPaymentReceipt?.length ? v.taxPaymentReceipt.map((t,i)=><div key={i}>• Name: {t.name}, Amount: {t.amount}</div>) : "—"}
//               </div>
//             </div>
//             <F label="Toll" value={v.toll||"Not specified"} />
//             <div style={{ gridColumn:"1/-1" }}><F label="Notes" value={v.notes} /></div>
//           </G3></CardBody></Card>
//         </div>
//         <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
//           <button onClick={onEditTracking} style={BTN(C.blue)}>Edit Tracking</button>
//           <button onClick={onEditFull} style={BTN("#F1F5F9",C.muted)}>Edit Full</button>
//           <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Close</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Edit Tracking Modal ──────────────────────────────────────────────────────
// function TrackingModal({ v, onClose, onSaved }) {
//   const [form,setForm]=useState({ date:v.date||TODAY_STR(), time:v.time||"", vehicleLocation:v.vehicleLocation||"", vehicleStatus:v.vehicleStatus||"", deliveryDate:v.deliveryDate||"", pdiStatus:v.pdiStatus||"", pdiDate:v.pdiDate||"", notes:v.notes||"" });
//   const [saving,setSaving]=useState(false);
//   const set=useCallback((k,val)=>setForm(p=>{ const n={...p,[k]:val}; if(k==="vehicleStatus"&&val==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);
//   const stColor = form.vehicleStatus==="Delivered"?"#22C55E":form.vehicleStatus==="In-Transit"?"#2563EB":form.vehicleStatus==="Accidental"?"#EF4444":null;
//   const save=async()=>{ setSaving(true); try{ await api.put(`/vehicles/${v._id}`,form); toast.success("Tracking updated"); onSaved(); onClose(); }catch(e){toast.error(e.response?.data?.message||"Failed");}finally{setSaving(false);} };
//   return (
//     <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
//       <div style={{ background:C.white,borderRadius:12,width:"min(95vw,780px)",boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
//         <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:`1px solid ${C.border}` }}>
//           <div><h2 style={{ margin:0,fontSize:17,fontWeight:800,color:C.text }}>Edit Tracking Information</h2>
//             <p style={{ margin:"2px 0 0",fontSize:12,color:C.muted }}>Update tracking-related information only</p></div>
//           <div style={{ display:"flex",alignItems:"center",gap:14 }}>
//             <span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{v.challanNo}</b></span>
//             <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
//           </div>
//         </div>
//         <div style={{ padding:20 }}>
//           <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody>
//             <G3>
//               <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
//               <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
//               <div>
//                 <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
//                   <Lbl>Vehicle Status</Lbl>
//                   {stColor && <span style={{ fontSize:11,fontWeight:700,color:stColor,background:stColor+"20",padding:"1px 8px",borderRadius:20 }}>{form.vehicleStatus}</span>}
//                 </div>
//                 <select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}>
//                   <option value="">Select Vehicle Status</option>
//                   {VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}
//                 </select>
//               </div>
//               <Fld label="Delivery Date"><input value={form.deliveryDate} readOnly={form.vehicleStatus==="Delivered"} onChange={e=>set("deliveryDate",e.target.value)} style={form.vehicleStatus==="Delivered"?INP_RO:INP} /></Fld>
//               <Fld label="Pdi Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="Pdi Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="Notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
//             </G3>
//           </CardBody></Card>
//         </div>
//         <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
//           <button onClick={onClose} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
//           <button onClick={save} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":"Save Changes"}</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── FML Add/Edit Form ────────────────────────────────────────────────────────
// function FMLForm({ sheets, vehicle, onClose, onSaved }) {
//   const isEdit = Boolean(vehicle);
//   const [logisticsItems,setLogisticsItems]=useState([]);
//   const [modelsList,setModelsList]=useState([]);
//   const [selLocation,setSelLocation]=useState(vehicle?.placeOfDelivery||"");
//   const [selModel,setSelModel]=useState(vehicle?.model||"");
//   const [selModelInfo,setSelModelInfo]=useState(vehicle?.modelInfo||"");
//   const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
//   const [driverInfo,setDriverInfo]=useState(null);
//   const [saving,setSaving]=useState(false);

//   useEffect(()=>{ api.get("/logistics/fml?partner=FML").then(r=>setLogisticsItems(r.data.items)).catch(()=>{}); api.get("/logistics/models?partner=FML").then(r=>setModelsList(r.data.items)).catch(()=>{}); },[]);

//   const locations=[...new Set(logisticsItems.map(i=>i.location).filter(Boolean))];
//   const consigneesForLoc=logisticsItems.filter(i=>i.location===selLocation);
//   const uniqueModels=[...new Set(modelsList.map(m=>m.model))];
//   const modelSpecs = modelsList
//   .filter(
//     m => m.model?.trim().toLowerCase() === selModel?.trim().toLowerCase()
//   )
//   .flatMap(m => m.modelSpecs || []);
//   const modelInfoOpts=modelSpecs.map(s=>s.modelInfo);
//   const modelDetailsOpts=modelSpecs.find(s=>s.modelInfo===selModelInfo)?.modelDetails||[];
//   const typeSheets=sheets.filter(s=>s.sheetType==="FML"&&s.status==="active");

//   const INIT = { sheetName:typeSheets[0]?.sheetName||"", logisticsPartner:"FML", invoiceDate:TODAY_STR(), invoiceNo:"", dateOfCollection:"", dispatchDate:"", actualDispatchDate:"", placeOfCollection:"PITHUMPUR, M.P.", placeOfDelivery:"", otherLocationDelivery:"", overallKm:"", consigneeName:"", consigneeRegion:"", consigneeAddress:"", consignorName:"FORCE MOTOR LIMITED", consignorAddress:"PITHUMPUR, M.P.", model:"", modelInfo:"", modelDetails:"", chassisNo:"", engineNo:"", tempRegNo:"", insuranceCompany:"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:"OG-24-2001-9930-00000022-", fasTagNo:"", tokenNo:"", driverName:"", phoneNo:"", drivingLicenseNo:"", inchargeName:"", currentIncharge:"", date:TODAY_STR(), time:"", vehicleLocation:"", vehicleStatus:"", deliveryDate:"", expecteddeliveryDate:"", pdiStatus:"", pdiDate:"", notes:"" };

//   const [form,setForm]=useState(()=>isEdit?{...INIT,...vehicle}:INIT);
//   const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

//   const handleDelivery=useCallback((loc)=>{ setSelLocation(loc); set("placeOfDelivery",loc); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("overallKm",""); },[set]);
//   const handleConsignee=useCallback((name)=>{ set("consigneeName",name); const f=consigneesForLoc.find(c=>c.consigneeName===name); if(f){ set("consigneeRegion",f.consigneeRegion||""); set("consigneeAddress",f.consigneeAddress||""); set("overallKm",String(f.overallKM||"")); } },[consigneesForLoc,set]);
//   const handleModel=useCallback((m)=>{ setSelModel(m); setSelModelInfo(""); set("model",m); set("modelInfo",""); set("modelDetails",""); },[set]);
//   const handleModelInfo=useCallback((mi)=>{ setSelModelInfo(mi); set("modelInfo",mi); set("modelDetails",""); },[set]);

//   useEffect(()=>{
//     const t=setTimeout(async()=>{
//       if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
//       try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
//       catch(_){ setDriverInfo(null); }
//     },400);
//     return()=>clearTimeout(t);
//   },[tokenInput]);

//   const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
//   const ls=licSt();

//   const submit=async()=>{
//     const req = [
//     "invoiceDate",
//     "invoiceNo",
//     "dateOfCollection",
//     "dispatchDate",
//     "actualDispatchDate",

//     "placeOfCollection",
//     "placeOfDelivery",
//     "consigneeName",
//     "overallKm",
//     "consigneeRegion",
//     "consigneeAddress",
//     "consignorName",
//     "consignorAddress",

//     "model",
//     "modelInfo",
//     "modelDetails",
//     "chassisNo",
//     "engineNo",
//     "tempRegNo",

//     "insuranceCompany",
//     "insuranceNo",
//     "fasTagNo",

//     "tokenNo",
//     "driverName",
//     "phoneNo",
//     "drivingLicenseNo",
//     "inchargeName",
//     "currentIncharge",

//     "date",
//     "time",
//     "vehicleLocation",
//     "vehicleStatus"
//   ];

//   // ✅ ADD THIS HERE
//   for (const key of req) {
//     if (!form[key] || !form[key].toString().trim()) {
//       toast.error(`${key.replace(/([A-Z])/g, ' $1')} is required`);
//       return;
//     }
//   } setSaving(true);
//     try{
//       if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
//       else{ const {data}=await api.post("/vehicles",{...form,sheetType:"FML"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
//       onSaved(); onClose();
//     }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒",duration:5000}); else toast.error(d?.message||"Failed"); }
//     finally{setSaving(false);}
//   };

//   return (
//     <>
//       {saving&&<Overlay msg={isEdit?"Updating…":"Creating & syncing to Google Sheets…"} />}
//       <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
//         <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
//           <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
//             <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit Vehicle Details":"Add New Vehicle"}</h2>
//               <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{isEdit?"Modify the vehicle details below":"Fill in the details below to add a new vehicle record"}</p></div>
//             {isEdit&&<span style={{ fontSize:13,color:C.muted }}>Challan No: <b style={{ color:C.blue }}>{vehicle.challanNo}</b></span>}
//             <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint,marginLeft:12 }}>✕</button>
//           </div>
//           <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
//             <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
//               <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
//                 {typeSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
//               </select></Fld></CardBody></Card>
//             <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
//               <div style={{ display:"inline-block",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"8px 16px",fontSize:14,fontWeight:700,color:C.blue }}>FML</div>
//             </CardBody></Card>
//             <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
//               <Fld label="Invoice Date" req><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} /></Fld>
//               <Fld label="Invoice No" req><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} style={INP} placeholder="Enter Invoice No" /></Fld>
//               <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
//               <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
//               <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
//             </G3></CardBody></Card>
//             <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
//               <Fld label="Place Of Collection"><input value={form.placeOfCollection} onChange={e=>set("placeOfCollection",e.target.value)} style={INP} /></Fld>
//               <Fld label="Place Of Delivery" req>
//                 <select value={form.placeOfDelivery} onChange={e=>handleDelivery(e.target.value)} style={SEL}>
//                   <option value="">Select Place Of Delivery</option>
//                   {locations.map(l=><option key={l}>{l}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Consignee Name" req>
//                 <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL}>
//                   <option value="">Select Consignee Name</option>
//                   {consigneesForLoc.map(c=><option key={c._id}>{c.consigneeName}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} placeholder="Enter Other Location Delivery" /></Fld>
//               <Fld label="Overall KM"><input value={form.overallKm} readOnly style={INP_RO} /></Fld>
//               <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
//               <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
//               <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
//             </G3></CardBody></Card>
//             <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
//               <Fld label="Model" req>
//                 <select value={form.model} onChange={e=>handleModel(e.target.value)} style={SEL}>
//                   <option value="">Select Model</option>
//                   {uniqueModels.map(m=><option key={m}>{m}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Model Info">
//                 <select value={form.modelInfo} onChange={e=>handleModelInfo(e.target.value)} style={SEL} disabled={!form.model}>
//                   <option value="">Select Model Info</option>
//                   {modelInfoOpts.map(mi=><option key={mi}>{mi}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Model Details">
//                 <select value={form.modelDetails} onChange={e=>set("modelDetails",e.target.value)} style={SEL} disabled={!form.modelInfo}>
//                   <option value="">Select Model Details</option>
//                   {modelDetailsOpts.map(md=><option key={md}>{md}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Chassis No" req><input value={form.chassisNo} onChange={e=>set("chassisNo",e.target.value)} style={INP} placeholder="Enter Chassis No" /></Fld>
//               <Fld label="Engine No" req><input value={form.engineNo} onChange={e=>set("engineNo",e.target.value)} style={INP} placeholder="Enter Engine No" /></Fld>
//               <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
//             </G3></CardBody></Card>
//             <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
//               <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
//               <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
//               <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} placeholder="Enter FasTag No" /></Fld>
//             </G3></CardBody></Card>
//             <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
//               <Fld label="TokenNo" req><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
//               <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
//               <div>
//                 <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
//                   <Lbl>Driving License No</Lbl>
//                   {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
//                 </div>
//                 <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
//                 {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
//               </div>
//               <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} placeholder="Enter Current Incharge" /></Fld>
//             </G3></CardBody></Card>
//             <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
//               <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
//               <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} placeholder="Enter Vehicle Location" /></Fld>
//               <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="Delivery Date"><input value={form.deliveryDate} readOnly={form.vehicleStatus==="Delivered"} onChange={e=>set("deliveryDate",e.target.value)} style={form.vehicleStatus==="Delivered"?INP_RO:INP} /></Fld>
//               <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
//               <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
//             </G3></CardBody></Card>
//             {isEdit && (
//               <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
//                 <div style={{ display:"flex",alignItems:"center",gap:16 }}>
//                   <div style={{ flex:1 }}>
//                     <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
//                     <div style={{ display:"flex",alignItems:"center",gap:10 }}>
//                       <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
//                         placeholder="Not yet billed" />
//                       {form.billed
//                         ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
//                         : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
//                       }
//                     </div>
//                     <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
//                   </div>
//                 </div>
//               </CardBody></Card>
//             )}
//           </div>
//           <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
//             <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
//             <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── EXP-FML Add/Edit Form ────────────────────────────────────────────────────
// function EXPForm({ sheets, vehicle, onClose, onSaved }) {
//   const isEdit = Boolean(vehicle);
//   const [challanSearch,setChallanSearch]=useState("");
//   const [fmlVehicle,setFmlVehicle]=useState(null);
//   const [searching,setSearching]=useState(false);
//   const [logisticsItems,setLogisticsItems]=useState([]);
//   const [modelsList,setModelsList]=useState([]);
//   const [saving,setSaving]=useState(false);
//   const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
//   const [driverInfo,setDriverInfo]=useState(null);

//   useEffect(()=>{ api.get("/logistics/fml?partner=FML").then(r=>setLogisticsItems(r.data.items)).catch(()=>{}); api.get("/logistics/models?partner=FML").then(r=>setModelsList(r.data.items)).catch(()=>{}); },[]);

//   const expSheets=sheets.filter(s=>s.sheetType==="FML_EXP"&&s.status==="active");

//   // Place of delivery for EXP = comes from EXP logistics partners (ports)
//   const [ports,setPorts]=useState([]);
//   useEffect(()=>{ api.get("/logistics/ports").then(r=>setPorts(r.data.items)).catch(()=>{}); },[]);

//   const [form,setForm]=useState(()=>({
//     sheetName:expSheets[0]?.sheetName||"", logisticsPartner:"FML",
//     invoiceDate:vehicle?.invoiceDate||TODAY_STR(), invoiceNo:vehicle?.invoiceNo||"",
//     dateOfCollection:vehicle?.dateOfCollection||"", dispatchDate:vehicle?.dispatchDate||"", actualDispatchDate:vehicle?.actualDispatchDate||"",
//     placeOfCollection:vehicle?.placeOfDelivery||"", // EXP: place of collection = FML place of delivery
//     placeOfDelivery:vehicle?.placeOfDelivery||"", otherLocationDelivery:vehicle?.otherLocationDelivery||"",
//     overallKm:vehicle?.overallKm||"", consigneeName:vehicle?.consigneeName||"", consigneeRegion:vehicle?.consigneeRegion||"", consigneeAddress:vehicle?.consigneeAddress||"",
//     consignorName:vehicle?.consignorName||"FORCE MOTOR LIMITED", consignorAddress:vehicle?.consignorAddress||"PITHUMPUR, M.P.",
//     model:vehicle?.model||"", modelInfo:vehicle?.modelInfo||"", modelDetails:vehicle?.modelDetails||"",
//     chassisNo:vehicle?.chassisNo||"", engineNo:vehicle?.engineNo||"", tempRegNo:vehicle?.tempRegNo||"",
//     insuranceCompany:vehicle?.insuranceCompany||"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:vehicle?.insuranceNo||"OG-24-2001-9930-00000022-", fasTagNo:vehicle?.fasTagNo||"",
//     tokenNo:vehicle?.tokenNo||"", driverName:vehicle?.driverName||"", phoneNo:vehicle?.phoneNo||"", drivingLicenseNo:vehicle?.drivingLicenseNo||"", inchargeName:vehicle?.inchargeName||"", currentIncharge:vehicle?.currentIncharge||"",
//     date:vehicle?.date||TODAY_STR(), time:vehicle?.time||"", vehicleLocation:vehicle?.vehicleLocation||"", vehicleStatus:vehicle?.vehicleStatus||"", deliveryDate:vehicle?.deliveryDate||"", expecteddeliveryDate:vehicle?.expecteddeliveryDate||"", pdiStatus:vehicle?.pdiStatus||"", pdiDate:vehicle?.pdiDate||"", notes:vehicle?.notes||"",
//   }));
//   const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

//   // Lookup FML challan
//   const searchFML=async()=>{
//     if(!challanSearch.trim())return;
//     setSearching(true);
//     try{
//       const {data}=await api.get(`/vehicles/challan/${challanSearch.trim().toUpperCase()}`);
//       const fv=data.vehicle;
//       setFmlVehicle(fv);
//       // Auto-fill from FML vehicle
//       set("invoiceDate",fv.invoiceDate||""); set("invoiceNo",fv.invoiceNo||"");
//       set("dateOfCollection",fv.dateOfCollection||""); set("dispatchDate",fv.dispatchDate||""); set("actualDispatchDate",fv.actualDispatchDate||"");
//       set("placeOfCollection",fv.placeOfDelivery||""); // EXP collection = FML delivery
//       set("model",fv.model||""); set("modelInfo",fv.modelInfo||""); set("modelDetails",fv.modelDetails||"");
//       set("chassisNo",fv.chassisNo||""); set("engineNo",fv.engineNo||"");
//       set("insuranceCompany",fv.insuranceCompany||"BAJAJ ALLIANZ INSURANCE CO LTD");
//       set("insuranceNo",fv.insuranceNo||"OG-24-2001-9930-00000022-"); set("fasTagNo",fv.fasTagNo||"");
//       set("consignorName",fv.consignorName||"FORCE MOTOR LIMITED"); set("consignorAddress",fv.consignorAddress||"PITHUMPUR, M.P.");
//       toast.success(`FML vehicle found: ${fv.challanNo}`);
//     }catch(_){ toast.error("FML vehicle not found"); }
//     finally{setSearching(false);}
//   };

//   // Ports-based delivery options
//   const portNames=ports.map(p=>p.portName);
//   const consigneesForPort=ports.find(p=>p.portName===form.placeOfDelivery)?.consignees||[];

//   const handleDelivery=useCallback((loc)=>{ set("placeOfDelivery",loc); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("overallKm",""); },[set]);
//   const handleConsignee=useCallback((name)=>{ set("consigneeName",name); const f=consigneesForPort.find(c=>c.consigneeName===name); if(f){ set("consigneeRegion",f.consigneeRegion||""); set("consigneeAddress",f.consigneeAddress||""); } const portKm=ports.find(p=>p.portName===form.placeOfDelivery)?.overallKm; if(portKm) set("overallKm",String(portKm)); },[consigneesForPort,form.placeOfDelivery,ports,set]);

//   useEffect(()=>{
//     const t=setTimeout(async()=>{
//       if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
//       try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
//       catch(_){setDriverInfo(null);}
//     },400);
//     return()=>clearTimeout(t);
//   },[tokenInput]);

//   const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
//   const ls=licSt();

//   const submit=async()=>{
//     setSaving(true);
//     try{
//       if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
//       else{ const {data}=await api.post("/vehicles",{...form,sheetType:"FML_EXP"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
//       onSaved(); onClose();
//     }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒"}); else toast.error(d?.message||"Failed"); }
//     finally{setSaving(false);}
//   };

//   return (
//     <>
//       {saving&&<Overlay msg="Saving…" />}
//       <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
//         <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
//           <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
//             <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit EXP-FML Vehicle":"Add New EXP-FML Vehicle"}</h2>
//               <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>Search FML challan to auto-fill details</p></div>
//             <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
//           </div>
//           <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
//             {/* Sheet selector */}
//             <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
//               <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
//                 {expSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
//               </select></Fld></CardBody></Card>

//             {/* FML Challan Search */}
//             {!isEdit&&(
//               <Card><SecHdr icon="🔍" title="Search FML Vehicle" /><CardBody>
//                 <div style={{ display:"flex",gap:10 }}>
//                   <input value={challanSearch} onChange={e=>setChallanSearch(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&searchFML()} placeholder="Enter FML Challan No (e.g. FML01)" style={{ ...INP,flex:1 }} />
//                   <button onClick={searchFML} disabled={searching} style={BTN(C.blue)}>{searching?"Searching…":"Search"}</button>
//                 </div>
//                 {fmlVehicle&&<div style={{ marginTop:10,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 14px",fontSize:13,color:C.blue }}>✅ Found: {fmlVehicle.challanNo} — {fmlVehicle.consigneeName} — {fmlVehicle.model}</div>}
//               </CardBody></Card>
//             )}

//             {/* Logistics partner fixed */}
//             <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
//               <div style={{ display:"inline-block",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"8px 16px",fontSize:14,fontWeight:700,color:C.blue }}>FML (Fixed)</div>
//             </CardBody></Card>

//             {/* Invoice & Dates — from FML (read-only unless editing) */}
//             <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
//               <Fld label="Invoice Date"><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} readOnly={!isEdit&&!!fmlVehicle} /></Fld>
//               <Fld label="Invoice No"><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} readOnly={!isEdit&&!!fmlVehicle} style={(!isEdit&&!!fmlVehicle)?INP_RO:INP} /></Fld>
//               <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
//               <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
//               <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
//             </G3></CardBody></Card>

//             {/* Location */}
//             <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
//               <Fld label="Place Of Collection (from FML)"><input value={form.placeOfCollection} onChange={e=>set("placeOfCollection",e.target.value)} style={INP} /></Fld>
//               <Fld label="Place Of Delivery" req>
//                 <select value={form.placeOfDelivery} onChange={e=>handleDelivery(e.target.value)} style={SEL}>
//                   <option value="">Select Place Of Delivery</option>
//                   {portNames.map(l=><option key={l}>{l}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Consignee Name">
//                 <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL}>
//                   <option value="">Select Consignee Name</option>
//                   {consigneesForPort.map(c=><option key={c._id||c.consigneeName}>{c.consigneeName}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} /></Fld>
//               <Fld label="Overall KM"><input value={form.overallKm} readOnly style={INP_RO} /></Fld>
//               <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
//               <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
//               <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
//             </G3></CardBody></Card>

//             {/* Model from FML */}
//             <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
//               <Fld label="Model"><input value={form.model} readOnly style={INP_RO} /></Fld>
//               <Fld label="Model Info"><input value={form.modelInfo} readOnly style={INP_RO} /></Fld>
//               <Fld label="Model Details"><input value={form.modelDetails} readOnly style={INP_RO} /></Fld>
//               <Fld label="Chassis No"><input value={form.chassisNo} readOnly style={INP_RO} /></Fld>
//               <Fld label="Engine No"><input value={form.engineNo} readOnly style={INP_RO} /></Fld>
//               <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
//             </G3></CardBody></Card>

//             <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
//               <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
//               <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
//               <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} placeholder="Enter FasTag No" /></Fld>
//             </G3></CardBody></Card>

//             <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
//               <Fld label="TokenNo"><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
//               <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
//               <div>
//                 <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
//                   <Lbl>Driving License No</Lbl>
//                   {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
//                 </div>
//                 <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
//                 {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
//               </div>
//               <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} placeholder="Enter Current Incharge" /></Fld>
//             </G3></CardBody></Card>

//             <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
//               <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
//               <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="Delivery Date"><input value={form.deliveryDate} readOnly={form.vehicleStatus==="Delivered"} onChange={e=>set("deliveryDate",e.target.value)} style={form.vehicleStatus==="Delivered"?INP_RO:INP} /></Fld>
//               <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
//               <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
//             </G3></CardBody></Card>
//           </div>
//           {isEdit && (
//             <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
//               <div style={{ display:"flex",alignItems:"center",gap:16 }}>
//                 <div style={{ flex:1 }}>
//                   <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
//                   <div style={{ display:"flex",alignItems:"center",gap:10 }}>
//                     <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
//                       placeholder="Not yet billed" />
//                     {form.billed
//                       ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
//                       : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
//                     }
//                   </div>
//                   <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
//                 </div>
//               </div>
//             </CardBody></Card>
//           )}
//           <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
//             <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
//             <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Others Add/Edit Form ─────────────────────────────────────────────────────
// function OthersForm({ sheets, vehicle, onClose, onSaved }) {
//   const isEdit = Boolean(vehicle);
//   const [partners,setPartners]=useState([]);
//   const [selPartner,setSelPartner]=useState(null);
//   const [tokenInput,setTokenInput]=useState(vehicle?.tokenNo||"");
//   const [driverInfo,setDriverInfo]=useState(null);
//   const [saving,setSaving]=useState(false);

//   useEffect(()=>{ api.get("/logistics/others").then(r=>setPartners(r.data.items||[])).catch(()=>{}); },[]);

//   const othersSheets=sheets.filter(s=>s.sheetType==="Others"&&s.status==="active");

//   const INIT={
//     sheetName:othersSheets[0]?.sheetName||"", logisticsPartner:"",
//     invoiceDate:TODAY_STR(), invoiceNo:"", dateOfCollection:"", dispatchDate:"", actualDispatchDate:"",
//     placeOfCollection:"", placeOfDelivery:"", otherLocationDelivery:"", overallKm:"",
//     consigneeName:"", consigneeRegion:"", consigneeAddress:"",
//     consignorName:"", consignorAddress:"",
//     model:"", modelInfo:"", modelDetails:"", chassisNo:"", engineNo:"", tempRegNo:"",
//     insuranceCompany:"BAJAJ ALLIANZ INSURANCE CO LTD", insuranceNo:"OG-24-2001-9930-00000022-", fasTagNo:"",
//     tokenNo:"", driverName:"", phoneNo:"", drivingLicenseNo:"", inchargeName:"", currentIncharge:"",
//     date:TODAY_STR(), time:"", vehicleLocation:"", vehicleStatus:"", deliveryDate:"", expecteddeliveryDate:"",
//     pdiStatus:"", pdiDate:"", notes:"",
//   };
//   const [form,setForm]=useState(()=>isEdit?{...INIT,...vehicle}:INIT);
//   const set=useCallback((k,v)=>setForm(p=>{ const n={...p,[k]:v}; if(k==="vehicleStatus"&&v==="Delivered") n.deliveryDate=TODAY_STR(); return n; }),[]);

//   // When logistics partner selected, set partner code and defaults
//   const handlePartner=(partnerName)=>{
//     const p=partners.find(x=>x.logisticsPartner===partnerName);
//     setSelPartner(p||null);
//     set("logisticsPartner",partnerName);
//     // reset location-dependent fields
//     set("placeOfCollection",""); set("placeOfDelivery",""); set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress",""); set("consignorName",""); set("consignorAddress","");
//   };

//   // Places of collection (consignors) and locations (consignees) from selected partner
//   const placesOfCollection = selPartner?.placesOfCollection||[];
//   const locations = selPartner?.locations||[];

//   const handleCollection=(place)=>{
//     set("placeOfCollection",place);
//     const p=placesOfCollection.find(x=>x.placeName===place);
//     if(p?.consignors?.length){ set("consignorName",p.consignors[0].consignorName||""); set("consignorAddress",p.consignors[0].consignorAddress||""); }
//   };
//   const handleLocation=(loc)=>{
//     set("placeOfDelivery",loc);
//     set("consigneeName",""); set("consigneeRegion",""); set("consigneeAddress","");
//   };
//   const consigneesForLoc=(locations.find(l=>l.locationName===form.placeOfDelivery)?.consignees)||[];
//   const handleConsignee=(name)=>{
//     set("consigneeName",name);
//     const c=consigneesForLoc.find(x=>x.consigneeName===name);
//     if(c){ set("consigneeRegion",c.consigneeRegion||""); set("consigneeAddress",c.consigneeAddress||""); }
//   };

//   // Driver token lookup
//   useEffect(()=>{
//     const t=setTimeout(async()=>{
//       if(!tokenInput.trim()){setDriverInfo(null);set("tokenNo","");set("driverName","");set("phoneNo","");set("drivingLicenseNo","");set("inchargeName","");return;}
//       try{ const {data}=await api.get(`/drivers/token/${tokenInput.trim().toUpperCase()}`); const d=data.driver; setDriverInfo(d); set("tokenNo",d.tokenNo); set("driverName",d.fullName||""); set("phoneNo",d.phoneNumber||""); set("drivingLicenseNo",d.licenseNo||""); set("inchargeName",d.inchargeName||""); }
//       catch(_){ setDriverInfo(null); }
//     },400);
//     return()=>clearTimeout(t);
//   },[tokenInput]);

//   const licSt=()=>{ if(!driverInfo?.licenseValidity)return null; const exp=new Date(driverInfo.licenseValidity); const diff=Math.ceil((exp-new Date())/86400000); if(diff<0)return{label:"Expired",color:C.red}; if(diff<=30)return{label:"Expiring",color:C.yellow}; return{label:"Valid",color:C.green}; };
//   const ls=licSt();

//   const submit=async()=>{
//     if(!form.logisticsPartner) return toast.error("Select a Logistics Partner");
//     if(!form.placeOfDelivery) return toast.error("Select Place of Delivery");
//     setSaving(true);
//     try{
//       if(isEdit){ await api.put(`/vehicles/${vehicle._id}`,form); toast.success("Vehicle updated"); }
//       else{ const {data}=await api.post("/vehicles",{...form,sheetType:"Others"}); toast.success(`Created: ${data.vehicle.challanNo}`); }
//       onSaved(); onClose();
//     }catch(e){ const d=e.response?.data; if(d?.locked)toast.error(d.message,{icon:"🔒"}); else toast.error(d?.message||"Failed"); }
//     finally{setSaving(false);}
//   };

//   return (
//     <>
//       {saving&&<Overlay msg="Saving…" />}
//       <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0" }}>
//         <div style={{ background:C.bg,width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
//           <div style={{ background:C.white,borderRadius:"12px 12px 0 0",padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
//             <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>{isEdit?"Edit Others Vehicle":"Add New Others Vehicle"}</h2>
//               <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>Fill in the details for an Others logistics vehicle</p></div>
//             <button onClick={onClose} disabled={saving} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.faint }}>✕</button>
//           </div>
//           <div style={{ padding:18,overflowY:"auto",maxHeight:"calc(100vh-140px)" }}>
//             {/* Sheet */}
//             <Card><CardBody><Fld label="Select Vehicle Sheet:" req>
//               <select value={form.sheetName} onChange={e=>set("sheetName",e.target.value)} style={SEL}>
//                 {othersSheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName} (Active)</option>)}
//               </select>
//             </Fld></CardBody></Card>

//             {/* Logistics Partner */}
//             <Card><SecHdr icon="📋" title="Vehicle & Sheet Info" /><CardBody>
//               <Fld label="Logistics Partner" req>
//                 <select value={form.logisticsPartner} onChange={e=>handlePartner(e.target.value)} style={SEL}>
//                   <option value="">Select Logistics Partner</option>
//                   {partners.map(p=><option key={p._id}>{p.logisticsPartner}</option>)}
//                 </select>
//               </Fld>
//               {selPartner && <div style={{ fontSize:12,color:C.muted,marginTop:-8 }}>Partner Code: <b>{selPartner.partnerCode}</b></div>}
//             </CardBody></Card>

//             {/* Invoice */}
//             <Card><SecHdr icon="📅" title="Invoice & Dispatch Dates" /><CardBody><G3>
//               <Fld label="Invoice Date" req><DateInput value={form.invoiceDate} onChange={v=>set("invoiceDate",v)} /></Fld>
//               <Fld label="Invoice No" req><input value={form.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} style={INP} placeholder="Enter Invoice No" /></Fld>
//               <Fld label="Date Of Collection"><DateInput value={form.dateOfCollection} onChange={v=>set("dateOfCollection",v)} /></Fld>
//               <Fld label="Dispatch Date"><DateInput value={form.dispatchDate} onChange={v=>set("dispatchDate",v)} /></Fld>
//               <Fld label="Actual Dispatch Date"><DateInput value={form.actualDispatchDate} onChange={v=>set("actualDispatchDate",v)} /></Fld>
//             </G3></CardBody></Card>

//             {/* Location */}
//             <Card><SecHdr icon="📍" title="Location & Consignee/Consignor Info" /><CardBody><G3>
//               <Fld label="Place Of Collection">
//                 <select value={form.placeOfCollection} onChange={e=>handleCollection(e.target.value)} style={SEL} disabled={!selPartner}>
//                   <option value="">Select Place Of Collection</option>
//                   {placesOfCollection.map(p=><option key={p._id||p.placeName}>{p.placeName}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Consignor Name"><input value={form.consignorName} onChange={e=>set("consignorName",e.target.value)} style={INP} /></Fld>
//               <Fld label="Consignor Address"><input value={form.consignorAddress} onChange={e=>set("consignorAddress",e.target.value)} style={INP} /></Fld>
//               <Fld label="Place Of Delivery" req>
//                 <select value={form.placeOfDelivery} onChange={e=>handleLocation(e.target.value)} style={SEL} disabled={!selPartner}>
//                   <option value="">Select Place Of Delivery</option>
//                   {locations.map(l=><option key={l._id||l.locationName}>{l.locationName}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Consignee Name">
//                 <select value={form.consigneeName} onChange={e=>handleConsignee(e.target.value)} style={SEL} disabled={!form.placeOfDelivery}>
//                   <option value="">Select Consignee Name</option>
//                   {consigneesForLoc.map(c=><option key={c._id||c.consigneeName}>{c.consigneeName}</option>)}
//                 </select>
//               </Fld>
//               <Fld label="Consignee Region"><input value={form.consigneeRegion} readOnly style={INP_RO} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="Consignee Address"><input value={form.consigneeAddress} readOnly style={INP_RO} /></Fld></div>
//               <Fld label="Other Location Delivery"><input value={form.otherLocationDelivery} onChange={e=>set("otherLocationDelivery",e.target.value)} style={INP} /></Fld>
//               <Fld label="Overall KM"><input value={form.overallKm} onChange={e=>set("overallKm",e.target.value)} style={INP} placeholder="Enter Overall KM" /></Fld>
//             </G3></CardBody></Card>

//             {/* Model */}
//             <Card><SecHdr icon="🚌" title="Vehicle Model Details" /><CardBody><G3>
//               <Fld label="Model" req><input value={form.model} onChange={e=>set("model",e.target.value)} style={INP} placeholder="Enter Model" /></Fld>
//               <Fld label="Model Info"><input value={form.modelInfo} onChange={e=>set("modelInfo",e.target.value)} style={INP} placeholder="Enter Model Info" /></Fld>
//               <Fld label="Model Details"><input value={form.modelDetails} onChange={e=>set("modelDetails",e.target.value)} style={INP} placeholder="Enter Model Details" /></Fld>
//               <Fld label="Chassis No"><input value={form.chassisNo} onChange={e=>set("chassisNo",e.target.value)} style={INP} placeholder="Enter Chassis No" /></Fld>
//               <Fld label="Engine No"><input value={form.engineNo} onChange={e=>set("engineNo",e.target.value)} style={INP} placeholder="Enter Engine No" /></Fld>
//               <Fld label="Temp Reg No"><input value={form.tempRegNo} onChange={e=>set("tempRegNo",e.target.value)} style={INP} placeholder="Enter Temp Reg No" /></Fld>
//             </G3></CardBody></Card>

//             {/* Insurance */}
//             <Card><SecHdr icon="🛡️" title="Insurance & FasTag" /><CardBody><G3>
//               <Fld label="Insurance Company"><input value={form.insuranceCompany} onChange={e=>set("insuranceCompany",e.target.value)} style={INP} /></Fld>
//               <Fld label="Insurance No"><input value={form.insuranceNo} onChange={e=>set("insuranceNo",e.target.value)} style={INP} /></Fld>
//               <Fld label="FasTag No"><input value={form.fasTagNo} onChange={e=>set("fasTagNo",e.target.value)} style={INP} /></Fld>
//             </G3></CardBody></Card>

//             {/* Driver */}
//             <Card><SecHdr icon="👤" title="Driver Details" /><CardBody><G3>
//               <Fld label="TokenNo"><input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} style={INP} placeholder="e.g. SAL01" /></Fld>
//               <Fld label="Driver Name"><input value={form.driverName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Phone No"><input value={form.phoneNo} readOnly style={INP_RO} /></Fld>
//               <div>
//                 <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
//                   <Lbl>Driving License No</Lbl>
//                   {ls&&<span style={{ fontSize:11,fontWeight:700,color:ls.color,background:ls.color+"20",padding:"1px 8px",borderRadius:20 }}>{ls.label}</span>}
//                 </div>
//                 <input value={form.drivingLicenseNo} readOnly style={INP_RO} />
//                 {driverInfo?.licenseValidity&&<div style={{ fontSize:11,color:C.muted,marginTop:3 }}>Expiry Date: {new Date(driverInfo.licenseValidity).toLocaleDateString("en-IN")}</div>}
//               </div>
//               <Fld label="Incharge Name"><input value={form.inchargeName} readOnly style={INP_RO} /></Fld>
//               <Fld label="Current Incharge"><input value={form.currentIncharge} onChange={e=>set("currentIncharge",e.target.value)} style={INP} /></Fld>
//             </G3></CardBody></Card>

//             {/* Tracking */}
//             <Card><SecHdr icon="📍" title="Tracking Info" /><CardBody><G3>
//               <Fld label="Date"><DateInput value={form.date} onChange={v=>set("date",v)} /></Fld>
//               <Fld label="Time"><input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Location"><input value={form.vehicleLocation} onChange={e=>set("vehicleLocation",e.target.value)} style={INP} /></Fld>
//               <Fld label="Vehicle Status"><select value={form.vehicleStatus} onChange={e=>set("vehicleStatus",e.target.value)} style={SEL}><option value="">Select Vehicle Status</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="Delivery Date"><input value={form.deliveryDate} readOnly={form.vehicleStatus==="Delivered"} onChange={e=>set("deliveryDate",e.target.value)} style={form.vehicleStatus==="Delivered"?INP_RO:INP} /></Fld>
//               <Fld label="Expected Delivery Date"><DateInput value={form.expecteddeliveryDate} onChange={v=>set("expecteddeliveryDate",v)} /></Fld>
//               <Fld label="PDI Status"><select value={form.pdiStatus} onChange={e=>set("pdiStatus",e.target.value)} style={SEL}><option value="">Select PDI Status</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Fld>
//               <Fld label="PDI Date"><DateInput value={form.pdiDate} onChange={v=>set("pdiDate",v)} /></Fld>
//               <div style={{ gridColumn:"1/-1" }}><Fld label="Notes"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{ ...INP,resize:"vertical" }} /></Fld></div>
//             </G3></CardBody></Card>
//           </div>
//           {isEdit && (
//             <Card><SecHdr icon="🧾" title="Billing Info" /><CardBody>
//               <div style={{ display:"flex",alignItems:"center",gap:16 }}>
//                 <div style={{ flex:1 }}>
//                   <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Bill No</div>
//                   <div style={{ display:"flex",alignItems:"center",gap:10 }}>
//                     <input value={form.billed||""} readOnly style={{ ...INP_RO,flex:1,fontWeight:700,color:form.billed?C.green:C.faint,fontSize:15 }}
//                       placeholder="Not yet billed" />
//                     {form.billed
//                       ? <span style={{ background:"rgba(22,163,74,0.1)",color:C.green,border:"1px solid rgba(22,163,74,0.3)",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>✓ Billed</span>
//                       : <span style={{ background:"rgba(100,116,139,0.08)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,whiteSpace:"nowrap" }}>Unbilled</span>
//                     }
//                   </div>
//                   <div style={{ fontSize:11,color:C.faint,marginTop:4 }}>Auto-filled when a bill is generated. Cannot be edited manually.</div>
//                 </div>
//               </div>
//             </CardBody></Card>
//           )}
//           <div style={{ padding:"14px 24px",borderTop:`1px solid ${C.border}`,background:C.white,borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end",gap:10 }}>
//             <button onClick={onClose} disabled={saving} style={BTN("#F1F5F9",C.muted)}>Cancel</button>
//             <button onClick={submit} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":isEdit?"Save Changes":"Submit Vehicle"}</button>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Main Vehicles Page ───────────────────────────────────────────────────────
// export default function Vehicles() {
//   const { hasRole } = useAuth();
//   const { ask: askDelete, modal: deleteModal } = useDoubleConfirm();
//   const { on } = useSocket();
//   const [sheetType,setSheetType]=useState("FML");
//   const [sheets,setSheets]=useState([]);
//   const [selectedSheet,setSelectedSheet]=useState("");
//   const [vehicles,setVehicles]=useState([]);
//   const [total,setTotal]=useState(0);
//   const [page,setPage]=useState(1);
//   const [pages,setPages]=useState(1);
//   const [search,setSearch]=useState("");
//   const [loading,setLoading]=useState(false);
//   const [showForm,setShowForm]=useState(false);
//   const [editVehicle,setEditVehicle]=useState(null);
//   const [viewVehicle,setViewVehicle]=useState(null);
//   const [trackVehicle,setTrackVehicle]=useState(null);
//   const [delVehicle,setDelVehicle]=useState(null);
//   const [filterStatus,setFilterStatus]=useState("");
//   const [filterPDI,setFilterPDI]=useState("");
//   const [filterLocation,setFilterLocation]=useState("");
//   const [filterModel,setFilterModel]=useState("");

//   const loadSheets=useCallback(async()=>{
//     try{ const {data}=await api.get(`/vehicle-sheets?type=${sheetType}`); setSheets(data.sheets); const active=data.sheets.find(s=>s.status==="active"); if(active) setSelectedSheet(active.sheetName); }
//     catch{}
//   },[sheetType]);

//   useEffect(()=>{ setSelectedSheet(""); loadSheets(); },[loadSheets]);

//   const fetchVehicles=useCallback(async(pg=1,q="")=>{
//     if(!selectedSheet)return;
//     setLoading(true);
//     try{ const {data}=await api.get("/vehicles",{params:{sheetName:selectedSheet,page:pg,limit:10,search:q||undefined}}); setVehicles(data.vehicles); setTotal(data.total); setPages(data.pages); setPage(pg); }
//     catch{toast.error("Failed to load");}
//     finally{setLoading(false);}
//   },[selectedSheet]);

//   useEffect(()=>{fetchVehicles(1,"");},[fetchVehicles]);
//   useEffect(()=>{const t=setTimeout(()=>fetchVehicles(1,search),350);return()=>clearTimeout(t);},[search,fetchVehicles]);

//   useEffect(()=>{
//     const u=[
//       on("vehicle:created",({vehicle})=>{if(vehicle.sheetName===selectedSheet){setVehicles(p=>[vehicle,...p]);setTotal(t=>t+1);}}),
//       on("vehicle:updated",({vehicle})=>setVehicles(p=>p.map(v=>v._id===vehicle._id?vehicle:v))),
//       on("vehicle:deleted",({vehicleId})=>{setVehicles(p=>p.filter(v=>v._id!==vehicleId));setTotal(t=>Math.max(0,t-1));}),
//     ];
//     return()=>u.forEach(fn=>fn?.());
//   },[on,selectedSheet]);

//   const doDelete = (v) => {
//     askDelete(
//       `Delete vehicle ${v.challanNo || v.uniqueId}?

// This will permanently remove the vehicle and all its data. This cannot be undone.`,
//       async () => {
//         try { await api.delete(`/vehicles/${v._id}`); toast.success("Vehicle deleted"); fetchVehicles(page, search); }
//         catch(e) { toast.error(e.response?.data?.message || "Delete failed"); }
//       }
//     );
//   };

//   const filtered=vehicles.filter(v=>{
//     if(filterStatus&&v.vehicleStatus!==filterStatus)return false;
//     if(filterPDI&&v.pdiStatus!==filterPDI)return false;
//     if(filterLocation&&v.placeOfDelivery!==filterLocation)return false;
//     if(filterModel&&v.model!==filterModel)return false;
//     return true;
//   });

//   const hasFilters=filterStatus||filterPDI||filterLocation||filterModel;
//   const clearFilters=()=>{setFilterStatus("");setFilterPDI("");setFilterLocation("");setFilterModel("");};

//   const locations=[...new Set(vehicles.map(v=>v.placeOfDelivery).filter(Boolean))];
//   const models=[...new Set(vehicles.map(v=>v.model).filter(Boolean))];
//   const currentSheet=sheets.find(s=>s.sheetName===selectedSheet);
//   const isLocked=currentSheet?.isLocked;

//   const stStyle=(s)=>s==="Delivered"?{bg:"rgba(34,197,94,0.12)",color:"#16A34A"}:s==="In-Transit"?{bg:"rgba(37,99,235,0.12)",color:"#2563EB"}:s==="Accidental"?{bg:"rgba(239,68,68,0.12)",color:"#EF4444"}:{bg:"#F1F5F9",color:C.muted};

//   return (
//     <div style={{ background:C.bg,minHeight:"100vh",padding:"0 0 40px" }}>
//       {/* Header */}
//       <div style={{ padding:"20px 28px 14px" }}>
//         <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
//           <span style={{ fontSize:22 }}>🚌</span>
//           <span style={{ fontSize:18,fontWeight:700,color:C.text }}>Vehicles Page</span>
//         </div>
//         <div style={{ display:"flex",alignItems:"center",gap:12 }}>
//           <span style={{ fontSize:14,fontWeight:600,color:C.text }}>Select Type:</span>
//           <select value={sheetType} onChange={e=>setSheetType(e.target.value)} style={{ ...SEL,width:"auto",minWidth:120 }}>
//             {TYPES.map(t=><option key={t}>{t}</option>)}
//           </select>
//         </div>
//       </div>

//       <div style={{ padding:"0 28px" }}>
//         {/* Add Vehicle Button */}
//         {!isLocked&&(
//           <button onClick={()=>{setEditVehicle(null);setShowForm(true);}} style={{ ...BTN(C.blue),marginBottom:16,boxShadow:"0 2px 8px rgba(37,99,235,0.3)" }}>
//             + Add New Vehicle
//           </button>
//         )}

//         {/* Main card */}
//         <div style={{ background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:22 }}>
//           <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:18 }}>
//             <span style={{ fontSize:20 }}>🚌</span>
//             <h2 style={{ margin:0,fontSize:16,fontWeight:800,color:C.text }}>Vehicle Management</h2>
//           </div>

//           {/* Sheet + Search */}
//           <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14,padding:16,background:"#F8FAFC",borderRadius:10,border:`1px solid ${C.border}` }}>
//             <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Vehicle Sheet</div>
//               <select value={selectedSheet} onChange={e=>setSelectedSheet(e.target.value)} style={SEL}>
//                 <option value="">— Select Sheet —</option>
//                 {sheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}{s.status==="active"?" ✓":""}</option>)}
//               </select></div>
//             <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Search Vehicles</div>
//               <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by any field..." style={INP} /></div>
//           </div>

//           {/* Filters */}
//           <div style={{ padding:14,background:"#F8FAFC",borderRadius:10,border:`1px solid ${C.border}`,marginBottom:16 }}>
//             <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:12,alignItems:"flex-end" }}>
//               <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Vehicle Status</div>
//                 <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={SEL}><option value="">All Statuses</option>{VEHICLE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
//               <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>PDI Status</div>
//                 <select value={filterPDI} onChange={e=>setFilterPDI(e.target.value)} style={SEL}><option value="">All PDI Statuses</option>{PDI_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
//               <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Location</div>
//                 <select value={filterLocation} onChange={e=>setFilterLocation(e.target.value)} style={SEL}><option value="">All Locations</option>{locations.map(l=><option key={l}>{l}</option>)}</select></div>
//               <div><div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:7 }}>Model</div>
//                 <select value={filterModel} onChange={e=>setFilterModel(e.target.value)} style={SEL}><option value="">All Models</option>{models.map(m=><option key={m}>{m}</option>)}</select></div>
//               {hasFilters&&(
//                 <button onClick={clearFilters} style={{ ...BTN("#F1F5F9",C.red,{padding:"9px 14px",border:`1px solid ${C.red}`}),whiteSpace:"nowrap" }}>✕ Clear Filters</button>
//               )}
//             </div>
//           </div>

//           {/* Table */}
//           <div style={{ overflowX:"auto" }}>
//             <table style={{ width:"100%",borderCollapse:"collapse" }}>
//               <thead>
//                 <tr style={{ background:"#F8FAFC",borderBottom:`1px solid ${C.border}` }}>
//                   {["CHALLAN NO","UNIQUE ID","PLACE OF DELIVERY","DRIVER NAME","PHONE NO","CURRENT INCHARGE","VEHICLE STATUS","BILLED","ACTIONS"].map(h=>(
//                     <th key={h} style={{ padding:"11px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading?(
//                   <tr><td colSpan={9} style={{ textAlign:"center",padding:60,color:C.faint }}>
//                     <div style={{ width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.blue,borderRadius:"50%",animation:"vspin 0.8s linear infinite",margin:"0 auto 10px" }} />Loading…
//                   </td></tr>
//                 ):filtered.length===0?(
//                   <tr><td colSpan={9} style={{ textAlign:"center",padding:60,color:C.faint }}><div style={{ fontSize:36,marginBottom:8 }}>🚗</div>No vehicles found</td></tr>
//                 ):filtered.map((v)=>{
//                   const st=stStyle(v.vehicleStatus);
//                   return(
//                     <tr key={v._id} style={{ borderBottom:`1px solid #F8FAFC`,transition:"background 0.1s" }}
//                       onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
//                       onMouseLeave={e=>e.currentTarget.style.background=C.white}>
//                       <td style={{ padding:"11px 12px",fontWeight:700,color:C.text,fontSize:13 }}>{v.challanNo||"—"}</td>
//                       <td style={{ padding:"11px 12px",fontSize:12,color:C.muted,fontFamily:"monospace" }}>{v.uniqueId}</td>
//                       <td style={{ padding:"11px 12px",fontSize:13,color:"#475569" }}>{v.placeOfDelivery||"—"}</td>
//                       <td style={{ padding:"11px 12px",fontSize:13,color:C.text }}>{v.driverName||"—"}</td>
//                       <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.phoneNo||"—"}</td>
//                       <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.currentIncharge||v.inchargeName||"—"}</td>
//                       <td style={{ padding:"11px 12px",fontSize:13,color:C.muted }}>{v.vehicleLocation||"—"}</td>
//                       <td style={{ padding:"11px 12px" }}>
//                         {v.vehicleStatus?<span style={{ background:st.bg,color:st.color,fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20 }}>{v.vehicleStatus}</span>:"—"}
//                       </td>
//                       <td style={{ padding:"11px 12px" }}>
//                         {v.billed
//                           ? <span style={{ background:"rgba(234,179,8,0.12)",color:"#B45309",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,fontFamily:"monospace" }}>{v.billed}</span>
//                           : <span style={{ color:C.faint,fontSize:12 }}>—</span>
//                         }
//                       </td>
//                       <td style={{ padding:"11px 12px" }}>
//                         <div style={{ display:"flex",gap:5 }}>
//                           <ActionBtn title="View" color="#2563EB" hoverBg="#EFF6FF" onClick={()=>setViewVehicle(v)}><IconEye /></ActionBtn>
//                           {!isLocked&&(<>
//                             <ActionBtn title="Edit Tracking" color="#D97706" hoverBg="#FFFBEB" onClick={()=>setTrackVehicle(v)}><IconPin /></ActionBtn>
//                             <ActionBtn title="Edit Full" color="#16A34A" hoverBg="#F0FDF4" onClick={()=>{setEditVehicle(v);setShowForm(true);}}><IconEdit /></ActionBtn>
//                           </>)}
//                           {!isLocked&&(
//                             <ActionBtn title="Delete" color="#EF4444" hoverBg="#FEF2F2" onClick={()=>doDelete(v)}><IconDel /></ActionBtn>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>

//           {/* Pagination */}
//           {pages>1&&(
//             <div style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}` }}>
//               <button onClick={()=>fetchVehicles(page-1,search)} disabled={page===1} style={{ padding:"7px 14px",background:page===1?"#F8FAFC":C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===1?"default":"pointer",color:page===1?"#CBD5E1":C.muted,fontSize:13 }}>← Prev</button>
//               {Array.from({length:Math.min(pages,7)},(_,i)=>i+1).map(p=>(
//                 <button key={p} onClick={()=>fetchVehicles(p,search)} style={{ padding:"7px 12px",background:p===page?C.blue:C.white,border:`1px solid ${p===page?C.blue:C.border}`,borderRadius:7,cursor:"pointer",color:p===page?"#fff":C.muted,fontSize:13,fontWeight:p===page?700:400 }}>{p}</button>
//               ))}
//               <button onClick={()=>fetchVehicles(page+1,search)} disabled={page===pages} style={{ padding:"7px 14px",background:page===pages?"#F8FAFC":C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===pages?"default":"pointer",color:page===pages?"#CBD5E1":C.muted,fontSize:13 }}>Next →</button>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Modals */}
//       {showForm&&sheetType==="FML"&&<FMLForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
//       {showForm&&sheetType==="FML_EXP"&&<EXPForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
//       {showForm&&sheetType==="Others"&&<OthersForm sheets={sheets} vehicle={editVehicle} onClose={()=>{setShowForm(false);setEditVehicle(null);}} onSaved={()=>fetchVehicles(page,search)} />}
//       {viewVehicle&&<ViewModal v={viewVehicle} onClose={()=>setViewVehicle(null)} onEditTracking={()=>{setTrackVehicle(viewVehicle);setViewVehicle(null);}} onEditFull={()=>{setEditVehicle(viewVehicle);setShowForm(true);setViewVehicle(null);}} />}
//       {trackVehicle&&<TrackingModal v={trackVehicle} onClose={()=>setTrackVehicle(null)} onSaved={()=>fetchVehicles(page,search)} />}
//       {deleteModal}

//       <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
// }

// function ActionBtn({title,color,hoverBg,onClick,children}){
//   return(
//     <button title={title} onClick={onClick}
//       style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}
//       onMouseEnter={e=>{e.currentTarget.style.background=hoverBg;e.currentTarget.style.color=color;e.currentTarget.style.borderColor=color+"60";}}
//       onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>
//       {children}
//     </button>
//   );
// }