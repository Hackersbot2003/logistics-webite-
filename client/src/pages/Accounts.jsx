import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDoubleConfirm } from "../components/DoubleConfirm";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#F1F5F9", white:"#fff", border:"#E2E8F0", text:"#1E293B",
  muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
  green:"#16A34A", yellow:"#D97706", panel:"#F8FAFC",
};
const INP     = { width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:7,fontSize:14,color:C.text,outline:"none",boxSizing:"border-box",background:C.white,fontFamily:"inherit" };
const INP_RO  = { ...INP, background:"#F1F5F9",color:C.muted,cursor:"default",pointerEvents:"none" };
const INP_CALC= { ...INP, background:"#EFF6FF",color:C.blue,fontWeight:700,cursor:"default",border:"1px solid #BFDBFE",pointerEvents:"none" };
const INP_SUM = { ...INP, background:"#F0FDF4",color:C.green,fontWeight:700,cursor:"default",border:"1px solid #BBF7D0",pointerEvents:"none" };
const INP_RED = { ...INP, background:"#FEF2F2",color:C.red,fontWeight:700,cursor:"default",border:"1px solid #FECACA",pointerEvents:"none" };
const SEL = { ...INP, cursor:"pointer" };
const BTN = (bg,color="#fff",extra={})=>({padding:"8px 16px",background:bg,border:"none",borderRadius:7,color,cursor:"pointer",fontSize:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,...extra});

// ─── Calculations helper ──────────────────────────────────────────────────────
const n   = v => parseFloat(v)||0;
const int = v => Math.floor(n(v));  // integer (floor) as specified

// ─── Module-level sub-components (outside modal = no cursor-jump) ─────────────
const Row2 = ({children}) => (
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:14}}>
    {children}
  </div>
);
const FI = ({label,children}) => (
  <div>
    <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    {children}
  </div>
);
const AccSection = ({title,children,blue}) => (
  <div style={{background:C.white,borderRadius:10,padding:18,marginBottom:12,border:`1px solid ${blue?"#BFDBFE":C.border}`,background:blue?"#EFF6FF":C.white}}>
    <div style={{fontWeight:700,fontSize:13,color:blue?C.blue:C.text,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${blue?"#BFDBFE":C.border}`,paddingBottom:8}}>{title}</div>
    {children}
  </div>
);

// ─── Spinner / Overlay ────────────────────────────────────────────────────────
function Spin(){return <div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTopColor:C.blue,borderRadius:"50%",animation:"accspin 0.8s linear infinite",margin:"0 auto"}} />;}
function Overlay({msg}){return(
  <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
    <div style={{width:48,height:48,border:"4px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"accspin 0.8s linear infinite"}} />
    <div style={{color:"#fff",fontSize:16,fontWeight:600}}>{msg}</div>
  </div>
);}

// ─── Vehicle detail read-only view (Step 1) ───────────────────────────────────
function VehicleDetailsView({vehicle}){
  const F = ({label,value}) => (
    <div>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</div>
      <div style={{...INP_RO,fontSize:13}}>{value||"—"}</div>
    </div>
  );
  const Sec = ({title,fields}) => (
    <div style={{background:C.white,borderRadius:10,padding:18,marginBottom:12,border:`1px solid ${C.border}`}}>
      <div style={{fontWeight:700,fontSize:13,color:C.blue,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        {fields.map(([lbl,val])=><F key={lbl} label={lbl} value={val} />)}
      </div>
    </div>
  );
  return(<>
    <Sec title="Invoice & Logistics" fields={[["Challan No",vehicle.challanNo],["Logistics Partner",vehicle.logisticsPartner],["Invoice Date",vehicle.invoiceDate],["Invoice No",vehicle.invoiceNo],["Place Of Collection",vehicle.placeOfCollection],["Place Of Delivery",vehicle.placeOfDelivery],["Overall KM",vehicle.overallKm],["Date Of Collection",vehicle.dateOfCollection],["Dispatch Date",vehicle.dispatchDate]]} />
    <Sec title="Consignee & Consignor" fields={[["Consignee Name",vehicle.consigneeName],["Consignee Region",vehicle.consigneeRegion],["Consignee Address",vehicle.consigneeAddress],["Consignor Name",vehicle.consignorName],["Consignor Address",vehicle.consignorAddress]]} />
    <Sec title="Vehicle Model" fields={[["Model",vehicle.model],["Model Info",vehicle.modelInfo],["Chassis No",vehicle.chassisNo],["Engine No",vehicle.engineNo],["Temp Reg No",vehicle.tempRegNo]]} />
    <Sec title="Driver Details" fields={[["Token No",vehicle.tokenNo],["Driver Name",vehicle.driverName],["Phone No",vehicle.phoneNo],["License No",vehicle.drivingLicenseNo],["Incharge",vehicle.inchargeName],["Current Incharge",vehicle.currentIncharge]]} />
    <Sec title="Tracking" fields={[["Vehicle Status",vehicle.vehicleStatus],["Delivery Date",vehicle.deliveryDate],["PDI Status",vehicle.pdiStatus],["Vehicle Location",vehicle.vehicleLocation],["Notes",vehicle.notes]]} />
  </>);
}

// ─── Financial form — FML ─────────────────────────────────────────────────────
// dieselQty = overallKm / average (integer floor)
// dieselAmt = dieselQty * dieselRate
// driverWages = overallKm * driverWagesPerKm (from model details)
// returnFare = from logistics fixed data
// total = dieselAmt + driverWages + returnFare
// totalBorder = border + taxPaymentReceipt total
// grandTotal = total + toll + totalBorder (NOT fourLtrDiesel per spec)
// ptpAmount = gatePass + pettyCash
// hpclCardDiesel = sum of otpProviders
// remaining = grandTotal - ptpAmount - ptpDiesel - secondPumpDiesel - hpclCardDiesel - onroutePayment - onsiteReceiving - miscExpenses
function FMLFinancials({vehicle, fin, setF, pumps, userName, avgMileage, returnFareRef, driverWagesRef, loadingData, isUserOnly}){
  // Fields user role can fill: overallKm (read from fixed data), toll, tax payments, gate pass, petty cash, ptp diesel, 2nd pump diesel, onroute payment, onsite receiving
  const canEdit = (field) => !isUserOnly || ["toll","gatePass","pettyCash","ptpDiesel","secondPumpDiesel","onroutePayment","onsiteReceivingstatus","taxPaymentReceipt","petrolPumpUsage","otpProvider"].includes(field);
  const km          = n(vehicle.overallKm);
  // dieselQty = km * average (floor integer)
  const dieselQty   = (avgMileage>0) ? int(n(km) / n(avgMileage)) : 0;
  const dieselAmt   = int(dieselQty * n(fin.dieselRate));
  const driverWages = int(km * n(driverWagesRef));
  // For user role: diesel rate, diesel qty, driver wages, return fare are READ-ONLY (auto-calculated)
  const taxTotal    = (fin.taxPaymentReceipt||[]).reduce((s,t)=>s+n(t.amount),0);
  const totalBorder = int(n(fin.border)+taxTotal);
  const total       = int(dieselAmt + driverWages + n(returnFareRef));
  const grandTotal  = int(total + n(fin.toll) + totalBorder + n(fin.fourLtrDiesel));
  const ptpAmt      = int(n(fin.gatePass)+n(fin.pettyCash));
  const pumpTotal   = (fin.petrolPumpUsage||[]).reduce((s,p)=>s+n(p.amount),0);
  const otpTotal    = (fin.otpProvider||[]).reduce((s,o)=>s+n(o.amount),0);
  const remaining   = int(grandTotal - ptpAmt - n(fin.ptpDiesel) - pumpTotal - otpTotal - n(fin.onroutePayment) - n(fin.onsiteReceivingstatus) - n(fin.miscellaneousExpenses));

  // save helper — returns computed values for parent to persist
  fin._computed = { dieselQty, dieselAmt, driverWages, returnFare:returnFareRef, total, totalBorder, grandTotal, ptpAmount:ptpAmt, hpclCardDiesel:otpTotal, remaining };

  // helpers for arrays
  const addTax=()=>setF("taxPaymentReceipt",[...(fin.taxPaymentReceipt||[]),{name:"",amount:""}]);
  const removeTax=i=>setF("taxPaymentReceipt",(fin.taxPaymentReceipt||[]).filter((_,j)=>j!==i));
  const setTax=(i,k,v)=>{const r=[...(fin.taxPaymentReceipt||[])];r[i]={...r[i],[k]:v};setF("taxPaymentReceipt",r);};
  const usedPumps=(idx)=>{const used=(fin.petrolPumpUsage||[]).map((p,j)=>j!==idx?p.pumpName:"");return pumps.filter(p=>!used.includes(p.name));};
  const addPump=()=>setF("petrolPumpUsage",[...(fin.petrolPumpUsage||[]),{pumpName:"",amount:""}]);
  const removePump=i=>setF("petrolPumpUsage",(fin.petrolPumpUsage||[]).filter((_,j)=>j!==i));
  const setPump=(i,k,v)=>{const r=[...(fin.petrolPumpUsage||[])];r[i]={...r[i],[k]:v};setF("petrolPumpUsage",r);};
  const addOtp=()=>setF("otpProvider",[...(fin.otpProvider||[]),{name:userName,amount:""}]);
  const removeOtp=i=>setF("otpProvider",(fin.otpProvider||[]).filter((_,j)=>j!==i));
  const setOtp=(i,k,v)=>{const r=[...(fin.otpProvider||[])];r[i]={...r[i],[k]:v};setF("otpProvider",r);};

  if(loadingData) return <div style={{padding:"30px 0",textAlign:"center"}}><Spin/><div style={{marginTop:8,fontSize:13,color:C.muted}}>Loading model data…</div></div>;

  return(<>
    {/* Financial Overview */}
    {/* Financial Overview — hidden for user role, they only see overallKm */}
    {!isUserOnly ? (
      <AccSection title="Financial Overview" blue>
        <Row2>
          <FI label="Overall KM (from vehicle)"><div style={INP_RO}>{vehicle.overallKm||"0"}</div></FI>
          <FI label="Avg Mileage km/l (fixed data)"><div style={INP_RO}>{avgMileage?avgMileage.toFixed(2):"—"}</div></FI>
          <FI label="Diesel Quantity (auto: km÷avg)"><div style={INP_CALC}>{dieselQty} L</div></FI>
          <FI label="Diesel Rate (enter ₹/L)">
            <input value={fin.dieselRate} onChange={e=>setF("dieselRate",e.target.value)} style={INP} type="number" placeholder="Enter rate" />
          </FI>
          <FI label="Diesel Amount (auto)"><div style={INP_CALC}>₹{dieselAmt}</div></FI>
          <FI label="Driver Wages (auto: km×rate)"><div style={INP_CALC}>₹{driverWages}<div style={{fontSize:10,marginTop:2}}>₹{driverWagesRef}/km × {km}km</div></div></FI>
          <FI label="Return Fare (fixed data)"><div style={INP_RO}>{returnFareRef||"—"}</div></FI>
          <FI label="Total (auto)"><div style={INP_SUM}>₹{total}</div></FI>
        </Row2>
      </AccSection>
    ) : (
      <AccSection title="Vehicle Info" blue>
        <Row2>
          <FI label="Overall KM"><div style={INP_RO}>{vehicle.overallKm||"0"}</div></FI>
        </Row2>
      </AccSection>
    )}

    {/* Expenses & Payments */}
    <AccSection title="Expenses & Payments">
      <Row2>
        <FI label="Toll (enter)"><input value={fin.toll} onChange={e=>setF("toll",e.target.value)} style={INP} type="number" placeholder="₹" /></FI>
        <div />
      </Row2>
      {/* Tax Payment Receipts */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Tax Payment Receipts</div>
        {(fin.taxPaymentReceipt||[]).map((r,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={r.name} onChange={e=>setTax(i,"name",e.target.value)} placeholder="Receipt Name" style={INP} />
            <input value={r.amount} onChange={e=>setTax(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeTax(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <button onClick={addTax} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add Receipt</button>
      </div>
      <Row2>
        {!isUserOnly && <>
          <FI label="Border">
            <input value={fin.border} onChange={e=>setF("border",e.target.value)} style={INP} type="number" placeholder="₹" />
          </FI>
          <FI label="Total Border (auto: border+tax)"><div style={INP_CALC}>₹{totalBorder}</div></FI>
          <FI label="4 Ltr Diesel">
            <input value={fin.fourLtrDiesel} onChange={e=>setF("fourLtrDiesel",e.target.value)} style={INP} type="number" placeholder="₹" />
          </FI>
          <FI label="Grand Total (auto)"><div style={INP_SUM}>₹{grandTotal}</div></FI>
        </>}
      </Row2>
    </AccSection>

    {/* Fuel & Other */}
    <AccSection title="Fuel & Other Payments">
      <Row2>
        <FI label="Gate Pass (enter)"><input value={fin.gatePass} onChange={e=>setF("gatePass",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Petty Cash (enter)"><input value={fin.pettyCash} onChange={e=>setF("pettyCash",e.target.value)} style={INP} type="number" /></FI>
        <FI label="PTP Amount (auto: gate+petty)"><div style={INP_CALC}>₹{ptpAmt}</div></FI>
        <FI label="PTP Diesel (enter)"><input value={fin.ptpDiesel} onChange={e=>setF("ptpDiesel",e.target.value)} style={INP} type="number" /></FI>
      </Row2>
      {/* Second Pump Diesel — petrol pump dropdowns */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Second Pump Diesel</div>
        {(fin.petrolPumpUsage||[]).map((p,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <select value={p.pumpName} onChange={e=>setPump(i,"pumpName",e.target.value)} style={SEL}>
              <option value="">Select pump</option>
              {usedPumps(i).map(pp=><option key={pp._id} value={pp.name}>{pp.name}</option>)}
              {p.pumpName&&!usedPumps(i).find(pp=>pp.name===p.pumpName)&&<option value={p.pumpName}>{p.pumpName}</option>}
            </select>
            <input value={p.amount} onChange={e=>setPump(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removePump(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={addPump} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add petrol pump</button>
          {(fin.petrolPumpUsage||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Total: ₹{pumpTotal}</span>}
        </div>
      </div>
      {/* OTP Providers → HPCL */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>OTP Providers (HPCL Card)</div>
        {(fin.otpProvider||[]).map((o,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={o.name} onChange={e=>setOtp(i,"name",e.target.value)} placeholder="Provider name" style={INP} />
            <input value={o.amount} onChange={e=>setOtp(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeOtp(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={addOtp} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add OTP as {userName}</button>
          {(fin.otpProvider||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Entries: {(fin.otpProvider||[]).length}</span>}
        </div>
      </div>
      <Row2>
        <FI label="HPCL Card Diesel (sum of OTP)"><div style={INP_CALC}>₹{otpTotal}</div></FI>
        <div/>
      </Row2>
    </AccSection>

    {/* Route & Site Status */}
    <AccSection title="Route & Site Status">
      <Row2>
        <FI label="Onroute Payment (enter)"><input value={fin.onroutePayment} onChange={e=>setF("onroutePayment",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Onsite Receiving (enter)"><input value={fin.onsiteReceivingstatus} onChange={e=>setF("onsiteReceivingstatus",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Misc Expenses (enter)"><input value={fin.miscellaneousExpenses} onChange={e=>setF("miscellaneousExpenses",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Remaining Balance (auto)">
          <div style={remaining<0?INP_RED:INP_SUM}>₹{remaining}</div>
        </FI>
      </Row2>
      <div style={{textAlign:"center",padding:"12px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
        <span style={{fontSize:18,fontWeight:800,color:remaining<0?C.red:C.green}}>Remaining Balance: ₹{remaining}</span>
      </div>
    </AccSection>
  </>);
}

// ─── Financial form — EXP-FML ─────────────────────────────────────────────────
// overallKm & driverWages from fixed data (port entry), average from model details
// returnFare user entered
// remaining = grandTotal - ptpAmount - ptpDiesel - secondPumpDiesel - hpclCardDiesel - onroute - onsite - misc
function EXPFinancials({vehicle, fin, setF, pumps, userName, avgMileage, driverWagesRef, loadingData, isUserOnly}){
  const canEdit = (field) => !isUserOnly || ["toll","gatePass","pettyCash","ptpDiesel","secondPumpDiesel","onroutePayment","onsiteReceivingstatus","taxPaymentReceipt","petrolPumpUsage","otpProvider"].includes(field);
  const km          = n(vehicle.overallKm);
  const dieselQty   = (avgMileage>0) ? int(n(km) / n(avgMileage)) : 0;
  const dieselAmt   = int(dieselQty * n(fin.dieselRate));
  const driverWages = int(km * n(driverWagesRef));
  // For user role: diesel rate, diesel qty, driver wages, return fare are READ-ONLY (auto-calculated)
  const taxTotal    = (fin.taxPaymentReceipt||[]).reduce((s,t)=>s+n(t.amount),0);
  const totalBorder = int(n(fin.border)+taxTotal);
  const total       = int(dieselAmt + driverWages + n(fin.returnFare));
  const grandTotal  = int(total + n(fin.toll) + totalBorder + n(fin.fourLtrDiesel));
  const ptpAmt      = int(n(fin.gatePass)+n(fin.pettyCash));
  const pumpTotal   = (fin.petrolPumpUsage||[]).reduce((s,p)=>s+n(p.amount),0);
  const otpTotal    = (fin.otpProvider||[]).reduce((s,o)=>s+n(o.amount),0);
  const remaining   = int(grandTotal - ptpAmt - n(fin.ptpDiesel) - pumpTotal - otpTotal - n(fin.onroutePayment) - n(fin.onsiteReceivingstatus) - n(fin.miscellaneousExpenses));

  fin._computed = { dieselQty, dieselAmt, driverWages, total, totalBorder, grandTotal, ptpAmount:ptpAmt, hpclCardDiesel:otpTotal, remaining };

  const addTax=()=>setF("taxPaymentReceipt",[...(fin.taxPaymentReceipt||[]),{name:"",amount:""}]);
  const removeTax=i=>setF("taxPaymentReceipt",(fin.taxPaymentReceipt||[]).filter((_,j)=>j!==i));
  const setTax=(i,k,v)=>{const r=[...(fin.taxPaymentReceipt||[])];r[i]={...r[i],[k]:v};setF("taxPaymentReceipt",r);};
  const usedPumps=(idx)=>{const used=(fin.petrolPumpUsage||[]).map((p,j)=>j!==idx?p.pumpName:"");return pumps.filter(p=>!used.includes(p.name));};
  const addPump=()=>setF("petrolPumpUsage",[...(fin.petrolPumpUsage||[]),{pumpName:"",amount:""}]);
  const removePump=i=>setF("petrolPumpUsage",(fin.petrolPumpUsage||[]).filter((_,j)=>j!==i));
  const setPump=(i,k,v)=>{const r=[...(fin.petrolPumpUsage||[])];r[i]={...r[i],[k]:v};setF("petrolPumpUsage",r);};
  const addOtp=()=>setF("otpProvider",[...(fin.otpProvider||[]),{name:userName,amount:""}]);
  const removeOtp=i=>setF("otpProvider",(fin.otpProvider||[]).filter((_,j)=>j!==i));
  const setOtp=(i,k,v)=>{const r=[...(fin.otpProvider||[])];r[i]={...r[i],[k]:v};setF("otpProvider",r);};

  if(loadingData) return <div style={{padding:"30px 0",textAlign:"center"}}><Spin/><div style={{marginTop:8,fontSize:13,color:C.muted}}>Loading model data…</div></div>;

  return(<>
    <AccSection title="Financial Overview" blue>
      <Row2>
        <FI label="Overall KM (from vehicle)"><div style={INP_RO}>{vehicle.overallKm||"0"}</div></FI>
        <FI label="Avg Mileage km/l (fixed data)"><div style={INP_RO}>{avgMileage?avgMileage.toFixed(2):"—"}</div></FI>
        <FI label="Diesel Quantity (km÷avg, auto)"><div style={INP_CALC}>{dieselQty} L</div></FI>
        <FI label="Diesel Rate (enter ₹/L)"><input value={fin.dieselRate} onChange={e=>setF("dieselRate",e.target.value)} style={INP} type="number" placeholder="Enter rate" /></FI>
        <FI label="Diesel Amount (auto)"><div style={INP_CALC}>₹{dieselAmt}</div></FI>
        <FI label="Driver Wages (auto: km×rate)"><div style={INP_CALC}>₹{driverWages}<div style={{fontSize:10,marginTop:2}}>₹{driverWagesRef}/km × {km}km</div></div></FI>
        <FI label="Return Fare (enter)"><input value={fin.returnFare} onChange={e=>setF("returnFare",e.target.value)} style={INP} type="number" placeholder="Enter ₹" /></FI>
        <FI label="Total (auto)"><div style={INP_SUM}>₹{total}</div></FI>
      </Row2>
    </AccSection>
    <AccSection title="Expenses & Payments">
      <Row2>
        <FI label="Toll (enter)"><input value={fin.toll} onChange={e=>setF("toll",e.target.value)} style={INP} type="number" /></FI>
        <div/>
      </Row2>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Tax Payment Receipts</div>
        {(fin.taxPaymentReceipt||[]).map((r,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={r.name} onChange={e=>setTax(i,"name",e.target.value)} placeholder="Receipt Name" style={INP} />
            <input value={r.amount} onChange={e=>setTax(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeTax(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <button onClick={addTax} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add Receipt</button>
      </div>
      <Row2>
        <FI label="Border (enter)"><input value={fin.border} onChange={e=>setF("border",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Total Border (auto)"><div style={INP_CALC}>₹{totalBorder}</div></FI>
        <FI label="4 Ltr Diesel (enter)"><input value={fin.fourLtrDiesel} onChange={e=>setF("fourLtrDiesel",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Grand Total (auto)"><div style={INP_SUM}>₹{grandTotal}</div></FI>
      </Row2>
    </AccSection>
    <AccSection title="Fuel & Other Payments">
      <Row2>
        <FI label="Gate Pass"><input value={fin.gatePass} onChange={e=>setF("gatePass",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Petty Cash"><input value={fin.pettyCash} onChange={e=>setF("pettyCash",e.target.value)} style={INP} type="number" /></FI>
        <FI label="PTP Amount (auto)"><div style={INP_CALC}>₹{ptpAmt}</div></FI>
        <FI label="PTP Diesel"><input value={fin.ptpDiesel} onChange={e=>setF("ptpDiesel",e.target.value)} style={INP} type="number" /></FI>
      </Row2>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Second Pump Diesel</div>
        {(fin.petrolPumpUsage||[]).map((p,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <select value={p.pumpName} onChange={e=>setPump(i,"pumpName",e.target.value)} style={SEL}>
              <option value="">Select pump</option>
              {usedPumps(i).map(pp=><option key={pp._id} value={pp.name}>{pp.name}</option>)}
              {p.pumpName&&!usedPumps(i).find(pp=>pp.name===p.pumpName)&&<option value={p.pumpName}>{p.pumpName}</option>}
            </select>
            <input value={p.amount} onChange={e=>setPump(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removePump(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <button onClick={addPump} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add petrol pump</button>
          {(fin.petrolPumpUsage||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Total: ₹{pumpTotal}</span>}
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>OTP Providers (HPCL Card)</div>
        {(fin.otpProvider||[]).map((o,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={o.name} onChange={e=>setOtp(i,"name",e.target.value)} placeholder="Provider name" style={INP} />
            <input value={o.amount} onChange={e=>setOtp(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeOtp(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <button onClick={addOtp} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add OTP as {userName}</button>
          {(fin.otpProvider||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Entries: {(fin.otpProvider||[]).length}</span>}
        </div>
      </div>
      <Row2><FI label="HPCL Card Diesel (sum of OTP)"><div style={INP_CALC}>₹{otpTotal}</div></FI><div/></Row2>
    </AccSection>
    <AccSection title="Route & Site Status">
      <Row2>
        <FI label="Onroute Payment"><input value={fin.onroutePayment} onChange={e=>setF("onroutePayment",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Onsite Receiving"><input value={fin.onsiteReceivingstatus} onChange={e=>setF("onsiteReceivingstatus",e.target.value)} style={INP} type="number" /></FI>
        {!isUserOnly && <FI label="Misc Expenses">
            <input value={fin.miscellaneousExpenses} onChange={e=>setF("miscellaneousExpenses",e.target.value)} style={INP} type="number" />
          </FI>}
        <FI label="Remaining Balance (auto)"><div style={remaining<0?INP_RED:INP_SUM}>₹{remaining}</div></FI>
      </Row2>
      <div style={{textAlign:"center",padding:"12px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
        <span style={{fontSize:18,fontWeight:800,color:remaining<0?C.red:C.green}}>Remaining Balance: ₹{remaining}</span>
      </div>
    </AccSection>
  </>);
}

// ─── Financial form — Others ──────────────────────────────────────────────────
// overallKm from vehicle, dieselQty/rate/returnFare user entered
// driverWages from model details, auto fields: dieselAmt, total, totalBorder, grandTotal, ptpAmount, hpcl, remaining
function OthersFinancials({vehicle, fin, setF, pumps, userName}){
  // Others: user enters dieselQty and driverWages directly
  const dieselAmt   = int(n(fin.dieselQuantity) * n(fin.dieselRate));
  const taxTotal    = (fin.taxPaymentReceipt||[]).reduce((s,t)=>s+n(t.amount),0);
  const totalBorder = int(n(fin.border)+taxTotal);
  const total       = int(dieselAmt + n(fin.driverWages) + n(fin.returnFare));
  const grandTotal  = int(total + n(fin.toll) + totalBorder + n(fin.fourLtrDiesel));
  const ptpAmt      = int(n(fin.gatePass)+n(fin.pettyCash));
  const pumpTotal   = (fin.petrolPumpUsage||[]).reduce((s,p)=>s+n(p.amount),0);
  const otpTotal    = (fin.otpProvider||[]).reduce((s,o)=>s+n(o.amount),0);
  const remaining   = int(grandTotal - ptpAmt - n(fin.ptpDiesel) - pumpTotal - otpTotal - n(fin.onroutePayment) - n(fin.onsiteReceivingstatus) - n(fin.miscellaneousExpenses));

  fin._computed = { dieselQty:n(fin.dieselQuantity), dieselAmt, driverWages:n(fin.driverWages), total, totalBorder, grandTotal, ptpAmount:ptpAmt, hpclCardDiesel:otpTotal, remaining };

  const addTax=()=>setF("taxPaymentReceipt",[...(fin.taxPaymentReceipt||[]),{name:"",amount:""}]);
  const removeTax=i=>setF("taxPaymentReceipt",(fin.taxPaymentReceipt||[]).filter((_,j)=>j!==i));
  const setTax=(i,k,v)=>{const r=[...(fin.taxPaymentReceipt||[])];r[i]={...r[i],[k]:v};setF("taxPaymentReceipt",r);};
  const usedPumps=(idx)=>{const used=(fin.petrolPumpUsage||[]).map((p,j)=>j!==idx?p.pumpName:"");return pumps.filter(p=>!used.includes(p.name));};
  const addPump=()=>setF("petrolPumpUsage",[...(fin.petrolPumpUsage||[]),{pumpName:"",amount:""}]);
  const removePump=i=>setF("petrolPumpUsage",(fin.petrolPumpUsage||[]).filter((_,j)=>j!==i));
  const setPump=(i,k,v)=>{const r=[...(fin.petrolPumpUsage||[])];r[i]={...r[i],[k]:v};setF("petrolPumpUsage",r);};
  const addOtp=()=>setF("otpProvider",[...(fin.otpProvider||[]),{name:userName,amount:""}]);
  const removeOtp=i=>setF("otpProvider",(fin.otpProvider||[]).filter((_,j)=>j!==i));
  const setOtp=(i,k,v)=>{const r=[...(fin.otpProvider||[])];r[i]={...r[i],[k]:v};setF("otpProvider",r);};

  return(<>
    <AccSection title="Financial Overview" blue>
      <Row2>
        <FI label="Overall KM (from vehicle)"><div style={INP_RO}>{vehicle.overallKm||"0"}</div></FI>
        <FI label="Diesel Quantity (enter L)"><input value={fin.dieselQuantity} onChange={e=>setF("dieselQuantity",e.target.value)} style={INP} type="number" placeholder="Enter litres" /></FI>
        <FI label="Diesel Rate (enter ₹/L)"><input value={fin.dieselRate} onChange={e=>setF("dieselRate",e.target.value)} style={INP} type="number" placeholder="Enter rate" /></FI>
        <FI label="Diesel Amount (auto)"><div style={INP_CALC}>₹{dieselAmt}</div></FI>
        <FI label="Driver Wages (enter ₹)"><input value={fin.driverWages} onChange={e=>setF("driverWages",e.target.value)} style={INP} type="number" placeholder="Enter ₹" /></FI>
        <FI label="Return Fare (enter ₹)"><input value={fin.returnFare} onChange={e=>setF("returnFare",e.target.value)} style={INP} type="number" placeholder="Enter ₹" /></FI>
        <FI label="Total (diesel+wages+returnfare)"><div style={INP_SUM}>₹{total}</div></FI>
      </Row2>
    </AccSection>
    <AccSection title="Expenses & Payments">
      <Row2>
        <FI label="Toll (enter)"><input value={fin.toll} onChange={e=>setF("toll",e.target.value)} style={INP} type="number" /></FI>
        <div/>
      </Row2>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Tax Payment Receipts</div>
        {(fin.taxPaymentReceipt||[]).map((r,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={r.name} onChange={e=>setTax(i,"name",e.target.value)} placeholder="Receipt Name" style={INP} />
            <input value={r.amount} onChange={e=>setTax(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeTax(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <button onClick={addTax} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add Receipt</button>
      </div>
      <Row2>
        <FI label="Border (enter)"><input value={fin.border} onChange={e=>setF("border",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Total Border (auto)"><div style={INP_CALC}>₹{totalBorder}</div></FI>
        <FI label="4 Ltr Diesel (enter)"><input value={fin.fourLtrDiesel} onChange={e=>setF("fourLtrDiesel",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Grand Total (auto)"><div style={INP_SUM}>₹{grandTotal}</div></FI>
      </Row2>
    </AccSection>
    <AccSection title="Fuel & Other Payments">
      <Row2>
        <FI label="Gate Pass"><input value={fin.gatePass} onChange={e=>setF("gatePass",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Petty Cash"><input value={fin.pettyCash} onChange={e=>setF("pettyCash",e.target.value)} style={INP} type="number" /></FI>
        <FI label="PTP Amount (auto)"><div style={INP_CALC}>₹{ptpAmt}</div></FI>
        <FI label="PTP Diesel"><input value={fin.ptpDiesel} onChange={e=>setF("ptpDiesel",e.target.value)} style={INP} type="number" /></FI>
      </Row2>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Second Pump Diesel</div>
        {(fin.petrolPumpUsage||[]).map((p,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <select value={p.pumpName} onChange={e=>setPump(i,"pumpName",e.target.value)} style={SEL}>
              <option value="">Select pump</option>
              {usedPumps(i).map(pp=><option key={pp._id} value={pp.name}>{pp.name}</option>)}
              {p.pumpName&&!usedPumps(i).find(pp=>pp.name===p.pumpName)&&<option value={p.pumpName}>{p.pumpName}</option>}
            </select>
            <input value={p.amount} onChange={e=>setPump(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removePump(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <button onClick={addPump} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add petrol pump</button>
          {(fin.petrolPumpUsage||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Total: ₹{pumpTotal}</span>}
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>OTP Providers (HPCL Card)</div>
        {(fin.otpProvider||[]).map((o,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:8}}>
            <input value={o.name} onChange={e=>setOtp(i,"name",e.target.value)} placeholder="Provider name" style={INP} />
            <input value={o.amount} onChange={e=>setOtp(i,"amount",e.target.value)} placeholder="Amount ₹" type="number" style={INP} />
            <button onClick={()=>removeOtp(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",cursor:"pointer",color:C.red,fontSize:14}}>✕</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <button onClick={addOtp} style={{fontSize:13,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add OTP as {userName}</button>
          {(fin.otpProvider||[]).length>0&&<span style={{fontSize:12,fontWeight:700}}>Entries: {(fin.otpProvider||[]).length}</span>}
        </div>
      </div>
      <Row2><FI label="HPCL Card Diesel (sum of OTP)"><div style={INP_CALC}>₹{otpTotal}</div></FI><div/></Row2>
    </AccSection>
    <AccSection title="Route & Site Status">
      <Row2>
        <FI label="Onroute Payment"><input value={fin.onroutePayment} onChange={e=>setF("onroutePayment",e.target.value)} style={INP} type="number" /></FI>
        <FI label="Onsite Receiving"><input value={fin.onsiteReceivingstatus} onChange={e=>setF("onsiteReceivingstatus",e.target.value)} style={INP} type="number" /></FI>
        {!isUserOnly && <FI label="Misc Expenses">
            <input value={fin.miscellaneousExpenses} onChange={e=>setF("miscellaneousExpenses",e.target.value)} style={INP} type="number" />
          </FI>}
        <FI label="Remaining Balance (auto)"><div style={remaining<0?INP_RED:INP_SUM}>₹{remaining}</div></FI>
      </Row2>
      <div style={{textAlign:"center",padding:"12px 0",borderTop:`1px solid ${C.border}`,marginTop:4}}>
        <span style={{fontSize:18,fontWeight:800,color:remaining<0?C.red:C.green}}>Remaining Balance: ₹{remaining}</span>
      </div>
    </AccSection>
  </>);
}

// ─── Main Edit Modal ──────────────────────────────────────────────────────────
function AccountsEditModal({ vehicle, sheetType, onClose, onSaved }) {
  const { user, hasRole } = useAuth();
  const isUserOnly = hasRole("user") && !hasRole("admin","manager","superadmin");
  // Fields editable by user role only:
  const USER_EDITABLE_FIELDS = ["overallKm","toll","gatePass","pettyCash","ptpDiesel","secondPumpDiesel","onroutePayment","onsiteReceivingstatus","taxPaymentReceipt"];
  const [step,setStep] = useState(2);
  const [saving,setSaving] = useState(false);
  const [loadingData,setLoadingData] = useState(true);
  const [pumps,setPumps] = useState([]);
  const [avgMileage,setAvgMileage] = useState(0);
  const [returnFareRef,setReturnFareRef] = useState(0);
  const [driverWagesRef,setDriverWagesRef] = useState(0);

  const [fin,setFin] = useState({
    dieselRate:            vehicle.dieselRate||"",
    dieselQuantity:        vehicle.dieselQuantity||"",  // editable for Others
    driverWages:           vehicle.driverWages||"",     // editable for Others
    returnFare:            vehicle.returnFare||"",
    toll:                  vehicle.toll||"",
    border:                vehicle.border||"",
    fourLtrDiesel:         vehicle.fourLtrDiesel||"",
    gatePass:              vehicle.gatePass||"",
    pettyCash:             vehicle.pettyCash||"",
    ptpDiesel:             vehicle.ptpDiesel||"",
    miscellaneousExpenses: vehicle.miscellaneousExpenses||"",
    onroutePayment:        vehicle.onroutePayment||"",
    onsiteReceivingstatus: vehicle.onsiteReceivingstatus||"",
    taxPaymentReceipt: vehicle.taxPaymentReceipt?.length ? [...vehicle.taxPaymentReceipt] : [],
    petrolPumpUsage:   vehicle.petrolPumpUsage?.length   ? [...vehicle.petrolPumpUsage]   : [],
    otpProvider:       vehicle.otpProvider?.length        ? [...vehicle.otpProvider]       : [],
  });

  const setF = useCallback((k,v) => setFin(p=>({...p,[k]:v})), []);

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const lp = vehicle.logisticsPartner || "FML";
        const [modRes, logRes, pumpsRes] = await Promise.allSettled([
          api.get("/logistics/models/search", {params:{logisticPartner:lp, model:vehicle.model}}),
          api.get("/logistics/search", {params:{logisticPartner:lp, location:vehicle.placeOfDelivery, consigneeName:vehicle.consigneeName}}),
          api.get("/vehicle-sheets/pumps?page=1&limit=100"),
        ]);
        if (modRes.status==="fulfilled") {
          const items = Array.isArray(modRes.value.data) ? modRes.value.data : [];
          if (items.length) {
            const avg = items.reduce((s,i)=>s+(i.average||0),0)/items.length;
            setAvgMileage(avg||0);
            setDriverWagesRef(items[0].driverWages||0);
          }
        }
        if (logRes.status==="fulfilled") setReturnFareRef(logRes.value.data?.returnFare||0);
        if (pumpsRes.status==="fulfilled") setPumps(pumpsRes.value.data?.pumps||[]);
      } catch(_) {}
      finally { setLoadingData(false); }
    };
    load();
  }, [vehicle]);

  const userName = user?.name || "User";

  const save = async () => {
    const computed = fin._computed || {};
    setSaving(true);
    try {
      await api.put(`/vehicles/${vehicle._id}`, {
        ...fin,
        dieselQuantity:   String(computed.dieselQty||0),
        dieselAmount:     String(computed.dieselAmt||0),
        driverWages:      String(computed.driverWages||0),
        returnFare:       sheetType==="FML" ? String(returnFareRef) : fin.returnFare,
        total:            String(computed.total||0),
        totalBorder:      String(computed.totalBorder||0),
        grandTotal:       String(computed.grandTotal||0),
        ptpAmount:        String(computed.ptpAmount||0),
        hpclCardDiesel:   String(computed.hpclCardDiesel||0),
        remainingBalance: String(computed.remaining||0),
      });
      toast.success("Accounts saved");
      onSaved(); onClose();
    } catch(err) { toast.error(err.response?.data?.message||"Save failed"); }
    finally { setSaving(false); }
  };

  // Compute remaining for footer display
  const getRemaining = () => {
    if (!fin._computed) return 0;
    return fin._computed.remaining || 0;
  };

  return (
    <>
      {saving && <Overlay msg="Saving accounts data…" />}
      <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0"}}>
        <div style={{background:"#F3F4F6",width:"min(95vw,820px)",margin:"20px auto",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>

          {/* Blue header */}
          <div style={{background:"#2563EB",borderRadius:"12px 12px 0 0",padding:"16px 24px"}}>
            <h2 style={{margin:"0 0 12px",fontSize:17,fontWeight:800,color:"#fff"}}>Edit Vehicle Information</h2>
            <div style={{display:"flex",alignItems:"center",gap:0}}>
              <button onClick={()=>setStep(1)} style={{flex:1,padding:"6px 0 8px",background:"none",border:"none",cursor:"pointer",textAlign:"left",color:step===1?"#fff":"rgba(255,255,255,0.6)",fontSize:13,fontWeight:step===1?700:400,borderBottom:step===1?"2px solid #fff":"2px solid transparent"}}>
                Step 1: Vehicle Details
              </button>
              <div style={{width:40,height:1,background:"rgba(255,255,255,0.3)"}} />
              <button onClick={()=>setStep(2)} style={{flex:1,padding:"6px 0 8px",background:"none",border:"none",cursor:"pointer",textAlign:"right",color:step===2?"#fff":"rgba(255,255,255,0.6)",fontSize:13,fontWeight:step===2?700:400,borderBottom:step===2?"2px solid #fff":"2px solid transparent"}}>
                Step 2: Financial Details
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{padding:16,overflowY:"auto",maxHeight:"calc(100vh - 200px)"}}>
            {step===1 ? <VehicleDetailsView vehicle={vehicle} /> : (
              sheetType==="FML"
                ? <FMLFinancials vehicle={vehicle} fin={fin} setF={setF} pumps={pumps} userName={userName} avgMileage={avgMileage} returnFareRef={returnFareRef} driverWagesRef={driverWagesRef} loadingData={loadingData} isUserOnly={isUserOnly} />
                : sheetType==="FML_EXP"
                  ? <EXPFinancials vehicle={vehicle} fin={fin} setF={setF} pumps={pumps} userName={userName} avgMileage={avgMileage} driverWagesRef={driverWagesRef} loadingData={loadingData} isUserOnly={isUserOnly} />
                  : <OthersFinancials vehicle={vehicle} fin={fin} setF={setF} pumps={pumps} userName={userName} />
            )}
            {/* Last edited by line */}
            {vehicle.lastEditedBy && (
              <div style={{fontSize:12,color:C.faint,textAlign:"right",padding:"4px 0"}}>Last edited by: <b>{vehicle.lastEditedBy}</b></div>
            )}
          </div>

          {/* Footer */}
          <div style={{padding:"12px 20px",background:"#fff",borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:14,fontWeight:700,color:getRemaining()<0?C.red:C.green}}>
              {step===2 ? `Remaining: ₹${getRemaining()}` : `Challan: ${vehicle.challanNo}`}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={onClose} style={{...BTN("#fff",C.text,{border:`1px solid ${C.border}`})}}>Cancel</button>
              {step===2 && <button onClick={()=>setStep(1)} style={{...BTN("#fff",C.text,{border:`1px solid ${C.border}`})}}>Back</button>}
              {step===1
                ? <button onClick={()=>setStep(2)} style={BTN(C.blue)}>Financial Details →</button>
                : <button onClick={save} disabled={saving} style={BTN(C.blue)}>{saving?"Saving…":"Save Changes"}</button>
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Accounts Table ───────────────────────────────────────────────────────────
function AccountsTable({ sheetType }) {
  const { hasRole } = useAuth();
  const isUser = hasRole("user") && !hasRole("admin","manager","superadmin");
  const [sheets,setSheets]   = useState([]);
  const [selSheet,setSelSheet] = useState("");
  const [vehicles,setVehicles] = useState([]);
  const [total,setTotal]     = useState(0);
  const [page,setPage]       = useState(1);
  const [pages,setPages]     = useState(1);
  const [search,setSearch]   = useState("");
  const [loading,setLoading] = useState(false);
  const [editVehicle,setEditVehicle] = useState(null);
  const [viewVehicle,setViewVehicle] = useState(null);
  // Filters
  const [fStatus,setFStatus] = useState("Delivered"); // default: only delivered
  const [fPDI,setFPDI]       = useState("");
  const [fModel,setFModel]   = useState("");
  const [fChallan,setFChallan] = useState("");
  const [fDriver,setFDriver]   = useState("");
  const [fLocation,setFLocation] = useState("");
  const [fOtherLoc,setFOtherLoc] = useState("");
  const [fChassis,setFChassis]   = useState("");
  const [fTempReg,setFTempReg]   = useState("");
  const [fModelInfo,setFModelInfo] = useState("");
  const [fBilled,setFBilled]     = useState(""); // "" = all, "unbilled" = unbilled, "billed" = specific billno
  const [fBilledNo,setFBilledNo] = useState(""); // specific bill number

  const loadSheets = useCallback(async () => {
    try {
      const {data} = await api.get(`/vehicle-sheets?type=${sheetType}`);
      setSheets(data.sheets);
      const active = data.sheets.find(s=>s.status==="active");
      if (active) setSelSheet(active.sheetName);
    } catch(_) {}
  }, [sheetType]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  const fetchVehicles = useCallback(async (pg=1,q="") => {
    if (!selSheet) return;
    setLoading(true);
    try {
      const {data} = await api.get("/vehicles", {params:{sheetName:selSheet, page:pg, limit:100, search:q||undefined}});
      setVehicles(data.vehicles);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    } catch(_) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [selSheet]);

  useEffect(() => { fetchVehicles(1,""); }, [fetchVehicles]);
  useEffect(() => { const t=setTimeout(()=>fetchVehicles(1,search),350); return()=>clearTimeout(t); }, [search,fetchVehicles]);

  const models    = [...new Set(vehicles.map(v=>v.model).filter(Boolean))];
  const locations = [...new Set(vehicles.map(v=>v.placeOfDelivery).filter(Boolean))];
  const otherLocs = [...new Set(vehicles.map(v=>v.otherLocationDelivery).filter(Boolean))];
  const billedNos = [...new Set(vehicles.map(v=>v.billed).filter(Boolean))].sort();
  
  const hasFilters = fStatus!=="Delivered"||fPDI||fModel||fChallan||fDriver||fLocation||fOtherLoc||fChassis||fTempReg||fModelInfo||fBilled;
  const clearFilters = () => { setFStatus("Delivered"); setFPDI(""); setFModel(""); setFChallan(""); setFDriver(""); setFLocation(""); setFOtherLoc(""); setFChassis(""); setFTempReg(""); setFModelInfo(""); setFBilled(""); setFBilledNo(""); };
  
  const filtered = vehicles.filter(v => {
    if (fStatus && v.vehicleStatus!==fStatus) return false;
    if (fPDI && v.pdiStatus!==fPDI) return false;
    if (fModel && v.model!==fModel) return false;
    if (fChallan && !(v.challanNo||"").toLowerCase().includes(fChallan.toLowerCase())) return false;
    if (fDriver && !(v.driverName||"").toLowerCase().includes(fDriver.toLowerCase())) return false;
    if (fLocation && v.placeOfDelivery!==fLocation) return false;
    if (fOtherLoc && v.otherLocationDelivery!==fOtherLoc) return false;
    if (fChassis && !(v.chassisNo||"").toLowerCase().includes(fChassis.toLowerCase())) return false;
    if (fTempReg && !(v.tempRegNo||"").toLowerCase().includes(fTempReg.toLowerCase())) return false;
    if (fModelInfo && !(v.modelInfo||"").toLowerCase().includes(fModelInfo.toLowerCase())) return false;
    if (fBilled === "unbilled" && v.billed) return false;
    if (fBilled === "billed" && !v.billed) return false;
    if (fBilled === "specific" && fBilledNo && v.billed !== fBilledNo) return false;
    return true;
  });
  const stStyle = s => s==="Delivered"?{bg:"rgba(34,197,94,0.12)",color:C.green}:s==="In-Transit"?{bg:"rgba(37,99,235,0.12)",color:C.blue}:{bg:"#F1F5F9",color:C.muted};

  return (
    <div>
      {/* Sheet + Search */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:14,padding:16,background:C.panel,borderRadius:10,border:`1px solid ${C.border}`}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:7}}>Vehicle Sheet</div>
          <select value={selSheet} onChange={e=>setSelSheet(e.target.value)} style={SEL}>
            <option value="">— Select Sheet —</option>
            {sheets.map(s=><option key={s._id} value={s.sheetName}>{s.sheetName}{s.status==="active"?" ✓":""}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:7}}>Search Vehicles</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={INP} />
        </div>
      </div>

      {/* Filters */}
      <div style={{padding:14,background:C.panel,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,alignItems:"flex-end"}}>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Status</div>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={SEL}>
              <option value="">All</option>{["In-Transit","Accidental","Delivered"].map(s=><option key={s}>{s}</option>)}
            </select></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>PDI Status</div>
            <select value={fPDI} onChange={e=>setFPDI(e.target.value)} style={SEL}>
              <option value="">All PDI</option>{["Received","Not Received","3rd Party Received"].map(s=><option key={s}>{s}</option>)}
            </select></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Model</div>
            <select value={fModel} onChange={e=>setFModel(e.target.value)} style={SEL}>
              <option value="">All Models</option>{models.map(m=><option key={m}>{m}</option>)}
            </select></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Location</div>
            <select value={fLocation} onChange={e=>setFLocation(e.target.value)} style={SEL}>
              <option value="">All Locations</option>{locations.map(l=><option key={l}>{l}</option>)}
            </select></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Challan No</div>
            <input value={fChallan} onChange={e=>setFChallan(e.target.value)} placeholder="Filter…" style={INP} /></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Driver Name</div>
            <input value={fDriver} onChange={e=>setFDriver(e.target.value)} placeholder="Filter…" style={INP} /></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Chassis No</div>
            <input value={fChassis} onChange={e=>setFChassis(e.target.value)} placeholder="Filter…" style={INP} /></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Temp Reg No</div>
            <input value={fTempReg} onChange={e=>setFTempReg(e.target.value)} placeholder="Filter…" style={INP} /></div>
          <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Billed Filter</div>
            <select value={fBilled} onChange={e=>{setFBilled(e.target.value);setFBilledNo("");}} style={SEL}>
              <option value="">All</option>
              <option value="unbilled">Unbilled Only</option>
              <option value="billed">Billed Only</option>
              <option value="specific">Specific Bill No</option>
            </select></div>
          {fBilled==="specific" && (
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Bill No</div>
              <select value={fBilledNo} onChange={e=>setFBilledNo(e.target.value)} style={SEL}>
                <option value="">Select Bill</option>
                {billedNos.map(b=><option key={b} value={b}>{b}</option>)}
              </select></div>
          )}
          {hasFilters && <button onClick={clearFilters} style={{...BTN("#FEF2F2",C.red,{border:`1px solid ${C.red}`,padding:"9px 14px",alignSelf:"flex-end"}),whiteSpace:"nowrap"}}>✕ Clear All</button>}
        </div>
      </div>

      {/* Table */}
      <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:C.white,minWidth:900}}>
          <thead>
            <tr style={{background:C.panel}}>
              {["CHALLAN NO","DRIVER","DELIVERY","MODEL","STATUS","KM","DIESEL AMT","WAGES","TOTAL","GRAND TOTAL","BALANCE","BILLED","ACTIONS"].map(h=>(
                <th key={h} style={{padding:"11px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{textAlign:"center",padding:50,color:C.faint}}><Spin/><div style={{marginTop:8,fontSize:13}}>Loading…</div></td></tr>
            ) : filtered.length===0 ? (
              <tr><td colSpan={13} style={{textAlign:"center",padding:50,color:C.faint}}>No vehicles found</td></tr>
            ) : filtered.map(v => {
              const st = stStyle(v.vehicleStatus);
              const hasFinancials = v.grandTotal;
              return (
                <tr key={v._id} style={{borderBottom:`1px solid #F8FAFC`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                  onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                  <td style={{padding:"10px 12px",fontWeight:700,color:C.text,fontSize:13}}>{v.challanNo||"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13}}>{v.driverName||"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:12,color:"#475569",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.placeOfDelivery||"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,color:"#475569"}}>{v.model||"—"}</td>
                  <td style={{padding:"10px 12px"}}>{v.vehicleStatus?<span style={{background:st.bg,color:st.color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{v.vehicleStatus}</span>:"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,color:C.muted}}>{v.overallKm||"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontFamily:"monospace"}}>{v.dieselAmount?`₹${v.dieselAmount}`:"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontFamily:"monospace"}}>{v.driverWages?`₹${v.driverWages}`:"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontFamily:"monospace"}}>{v.total?`₹${v.total}`:"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontWeight:700,color:C.green,fontFamily:"monospace"}}>{v.grandTotal?`₹${v.grandTotal}`:"—"}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontWeight:600,fontFamily:"monospace",color:n(v.remainingBalance)<0?C.red:C.green}}>{v.remainingBalance?`₹${v.remainingBalance}`:"—"}</td>
                  <td style={{padding:"10px 12px"}}>
                    {v.billed
                      ? <span style={{background:"rgba(234,179,8,0.12)",color:"#B45309",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,fontFamily:"monospace",whiteSpace:"nowrap"}}>{v.billed}</span>
                      : <span style={{color:C.faint,fontSize:12}}>—</span>
                    }
                  </td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>setViewVehicle(v)}
                      style={{...BTN("#F8FAFC",C.blue,{padding:"5px 10px",fontSize:11,border:`1px solid ${C.border}`})}}>
                      👁 View
                    </button>
                    <button onClick={()=>setEditVehicle(v)}
                      style={BTN(hasFinancials?"#F1F5F9":C.blue,hasFinancials?C.muted:"#fff",{padding:"6px 14px",fontSize:12,border:hasFinancials?`1px solid ${C.border}`:"none"})}>
                      {hasFinancials?"Edit":"Fill Details"}
                    </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages>1 && (
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:14,flexWrap:"wrap"}}>
          <button onClick={()=>fetchVehicles(page-1,search)} disabled={page===1} style={{padding:"7px 14px",background:page===1?C.panel:C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===1?"default":"pointer",color:page===1?C.faint:C.muted,fontSize:13}}>← Prev</button>
          {Array.from({length:Math.min(pages,7)},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>fetchVehicles(p,search)} style={{padding:"7px 12px",background:p===page?C.blue:C.white,border:`1px solid ${p===page?C.blue:C.border}`,borderRadius:7,cursor:"pointer",color:p===page?"#fff":C.muted,fontSize:13,fontWeight:p===page?700:400}}>{p}</button>
          ))}
          <button onClick={()=>fetchVehicles(page+1,search)} disabled={page===pages} style={{padding:"7px 14px",background:page===pages?C.panel:C.white,border:`1px solid ${C.border}`,borderRadius:7,cursor:page===pages?"default":"pointer",color:page===pages?C.faint:C.muted,fontSize:13}}>Next →</button>
        </div>
      )}

      {viewVehicle && (
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:"min(95vw,700px)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontSize:16,fontWeight:800,color:"#1E293B"}}>Vehicle Details — {viewVehicle.challanNo}</span>
              <button onClick={()=>setViewVehicle(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#94A3B8"}}>✕</button>
            </div>
            {[
              ["Challan No",viewVehicle.challanNo],["Model",viewVehicle.model],["Model Info",viewVehicle.modelInfo],
              ["Chassis No",viewVehicle.chassisNo],["Engine No",viewVehicle.engineNo],["Temp Reg No",viewVehicle.tempRegNo],
              ["Driver Name",viewVehicle.driverName],["Phone No",viewVehicle.phoneNo],
              ["Place of Delivery",viewVehicle.placeOfDelivery],["Other Location",viewVehicle.otherLocationDelivery],
              ["Date of Collection",viewVehicle.dateOfCollection],["Dispatch Date",viewVehicle.dispatchDate],
              ["Vehicle Status",viewVehicle.vehicleStatus],["PDI Status",viewVehicle.pdiStatus],
              ["Overall KM",viewVehicle.overallKm],["4 Ltr Diesel",viewVehicle.fourLtrDiesel],
              ["Total Border",viewVehicle.totalBorder],["Grand Total",viewVehicle.grandTotal],
              ["Remaining Balance",viewVehicle.remainingBalance],
              ["Billed",viewVehicle.billed||"Not Billed"],
            ].map(([label,value])=>value?(
              <div key={label} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid #F1F5F9"}}>
                <span style={{minWidth:160,fontSize:12,fontWeight:600,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</span>
                <span style={{fontSize:13,color:"#1E293B",fontWeight:label==="Billed"?700:400,color:label==="Billed"&&viewVehicle.billed?"#B45309":"#1E293B"}}>{value||"—"}</span>
              </div>
            ):null)}
            <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>{setEditVehicle(viewVehicle);setViewVehicle(null);}} style={{...BTN("#2563EB","#fff",{padding:"8px 20px"})}}>Edit Accounts</button>
            </div>
          </div>
        </div>
      )}
      {editVehicle && <AccountsEditModal vehicle={editVehicle} sheetType={sheetType} onClose={()=>setEditVehicle(null)} onSaved={()=>fetchVehicles(page,search)} />}
    </div>
  );
}

// ─── Main Accounts Page ───────────────────────────────────────────────────────
const TYPES  = ["FML","FML_EXP","Others"];
const LABELS = { FML:"🚛 FML Vehicle Accounts", FML_EXP:"🚢 EXP-FML Vehicle Accounts", Others:"📦 Other Vehicle Accounts" };

export default function Accounts() {
  const [type,setType] = useState("FML");
  return (
    <div style={{background:C.bg,minHeight:"100vh",padding:"0 0 40px"}}>
      <div style={{padding:"20px 28px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <span style={{fontSize:22}}>💰</span>
          <span style={{fontSize:18,fontWeight:700,color:C.text}}>Accounts Page</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:14,fontWeight:600,color:C.text}}>Select Type:</span>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{padding:"8px 14px",border:`1px solid ${C.border}`,borderRadius:7,fontSize:14,color:C.text,background:C.white,cursor:"pointer",fontWeight:600}}>
            {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{padding:"0 28px"}}>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:800,color:C.text}}>{LABELS[type]}</h2>
          </div>
          <AccountsTable key={type} sheetType={type} />
        </div>
      </div>
      <style>{`@keyframes accspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}