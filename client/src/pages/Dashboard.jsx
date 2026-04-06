import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ── Design tokens (matches full project light theme) ─────────────────────────
const C = {
  bg:"#F1F5F9", white:"#fff", border:"#E2E8F0", text:"#1E293B",
  muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
  green:"#16A34A", yellow:"#D97706", panel:"#F8FAFC", orange:"#EA580C",
};
const BTN = (bg,color="#fff",extra={})=>({
  padding:"9px 18px",background:bg,border:"none",borderRadius:7,color,
  cursor:"pointer",fontSize:13,fontWeight:600,display:"inline-flex",
  alignItems:"center",gap:6,...extra
});

function Spin(){
  return(
    <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.blue,
      borderRadius:"50%",animation:"dbspin 0.8s linear infinite",margin:"0 auto"}}/>
  );
}

// ── Stat Card (matches screenshots) ──────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,
      padding:"20px 22px",flex:1,minWidth:160,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",
          letterSpacing:"0.07em"}}>{label}</div>
        <div style={{width:38,height:38,borderRadius:10,
          background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
          {icon}
        </div>
      </div>
      <div style={{fontSize:36,fontWeight:800,color:color,lineHeight:1}}>{value ?? "—"}</div>
      {sub && <div style={{fontSize:12,color:C.faint,marginTop:6}}>{sub}</div>}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Delivered:  { bg:"rgba(22,163,74,0.12)",  color:C.green },
    "In-Transit":{ bg:"rgba(37,99,235,0.12)", color:C.blue  },
    Accidental: { bg:"rgba(239,68,68,0.12)",  color:C.red   },
  };
  const s = map[status] || { bg:"#F1F5F9", color:C.muted };
  return (
    <span style={{background:s.bg,color:s.color,fontSize:11,fontWeight:700,
      padding:"2px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{status||"—"}</span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [fy, setFy]         = useState(""); // selected financial year
  const [allFYs, setAllFYs] = useState([]);

  const load = useCallback(async (financialYear) => {
    setLoading(true);
    try {
      const { data } = await api.get("/vehicles/stats/dashboard",
        financialYear ? { params: { financialYear } } : {}
      );
      setStats(data);
      setAllFYs(data.allFYs || []);
      if (!fy) setFy(data.financialYear);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFYChange = (newFY) => {
    setFy(newFY);
    load(newFY);
  };

  const stStyle = (s) =>
    s==="Delivered" ? {bg:"rgba(22,163,74,0.12)",color:C.green}
    : s==="In-Transit" ? {bg:"rgba(37,99,235,0.12)",color:C.blue}
    : {bg:"rgba(239,68,68,0.12)",color:C.red};

  return (
    <div style={{background:C.bg,minHeight:"100vh",padding:"0 0 40px"}}>

      {/* Page header */}
      <div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.border}`,
        background:C.white,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <span style={{fontSize:22}}>📊</span>
            <h1 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>
              Logistics Management Dashboard
            </h1>
          </div>
          <p style={{margin:0,fontSize:13,color:C.muted}}>Overview of drivers and vehicle operations</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,color:C.muted}}>FY:</span>
          <select value={fy} onChange={e=>handleFYChange(e.target.value)}
            style={{padding:"7px 12px",border:`1px solid ${C.border}`,borderRadius:7,
              fontSize:13,fontWeight:700,color:C.text,background:C.white,cursor:"pointer",outline:"none"}}>
            {allFYs.map(f=><option key={f} value={f}>{f}</option>)}
            {allFYs.length===0 && fy && <option value={fy}>{fy}</option>}
          </select>
        </div>
      </div>

      <div style={{padding:"20px 28px"}}>

        {loading && !stats ? (
          <div style={{padding:60,textAlign:"center"}}><Spin/></div>
        ) : (
          <>
            {/* ── Vehicle Operations ─────────────────────────────────────── */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h2 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>Vehicle Operations</h2>
              <span style={{fontSize:12,color:C.faint}}>FY: {stats?.financialYear}</span>
            </div>

            <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
              <StatCard label="Total Delivered" value={stats?.vehicle?.delivered}
                icon="✅" color={C.green} sub="vehicles delivered" />
              <StatCard label="In Transit" value={stats?.vehicle?.inTransit}
                icon="🚚" color={C.blue} sub="currently in transit" />
              <StatCard label="Accidental" value={stats?.vehicle?.accidental}
                icon="⚠️" color={C.red} sub="accident cases" />
            </div>

            {/* ── Two column layout ──────────────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:20,alignItems:"start"}}>

              {/* LEFT: Recently Delivered */}
              <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:C.green,fontSize:16}}>✅</span>
                  <span style={{fontWeight:700,fontSize:14,color:C.text}}>
                    Recently Delivered Vehicles ({stats?.vehicle?.delivered})
                  </span>
                </div>

                {/* Scrollable list */}
                <div style={{maxHeight:420,overflowY:"auto"}}>
                  {(!stats?.recentVehicles || stats.recentVehicles.length === 0) ? (
                    <div style={{padding:40,textAlign:"center",color:C.faint,fontSize:13}}>
                      No vehicles found for this financial year
                    </div>
                  ) : (
                    stats.recentVehicles.map((v, i) => {
                      const st = stStyle(v.vehicleStatus);
                      return (
                        <div key={v._id} style={{
                          padding:"13px 18px",
                          borderBottom: i < stats.recentVehicles.length-1 ? `1px solid #F8FAFC` : "none",
                          display:"flex",justifyContent:"space-between",alignItems:"center",
                          transition:"background 0.1s",cursor:"pointer"
                        }}
                          onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                          onMouseLeave={e=>e.currentTarget.style.background=C.white}
                          onClick={()=>navigate("/vehicles")}>
                          <div>
                            <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:2}}>
                              Challan: {v.challanNo || "—"}
                            </div>
                            <div style={{fontSize:12,color:C.muted}}>
                              Driver: {v.driverName || "—"}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                              <span style={{fontSize:11,color:C.faint}}>📍</span>
                              <span style={{fontSize:12,color:C.muted}}>{v.placeOfDelivery || "—"}</span>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <span style={{background:st.bg,color:st.color,fontSize:11,fontWeight:700,
                              padding:"2px 10px",borderRadius:20}}>{v.vehicleStatus}</span>
                            <div style={{fontSize:11,color:C.faint,marginTop:4}}>
                              {v.deliveryDate || (v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-IN") : "—")}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {(stats?.recentVehicles?.length > 0) && (
                  <div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`,textAlign:"center"}}>
                    <button onClick={()=>navigate("/vehicles")}
                      style={BTN("#F1F5F9",C.blue,{fontSize:13,padding:"7px 20px",border:`1px solid ${C.border}`})}>
                      Show All ({stats?.vehicle?.total})
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT column: In Transit + Accidental + Driver stats */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>

                {/* In Transit */}
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                    display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:C.blue,fontSize:14}}>🕐</span>
                    <span style={{fontWeight:700,fontSize:13,color:C.text}}>
                      In Transit ({stats?.vehicle?.inTransit})
                    </span>
                  </div>
                  <div style={{padding:"18px 16px",textAlign:"center",color:C.faint,fontSize:13}}>
                    {stats?.vehicle?.inTransit === 0 ? (
                      <>
                        <div style={{fontSize:32,marginBottom:8}}>🚚</div>
                        No vehicles in transit
                      </>
                    ) : (
                      <button onClick={()=>navigate("/vehicles")}
                        style={BTN(C.blue,"#fff",{fontSize:12,padding:"7px 16px"})}>
                        View {stats.vehicle.inTransit} vehicle{stats.vehicle.inTransit!==1?"s":""}
                      </button>
                    )}
                  </div>
                </div>

                {/* Accidental */}
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                    display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:C.red,fontSize:14}}>⚠️</span>
                    <span style={{fontWeight:700,fontSize:13,color:C.text}}>
                      Accidental Cases ({stats?.vehicle?.accidental})
                    </span>
                  </div>
                  <div style={{padding:"18px 16px",textAlign:"center",color:C.faint,fontSize:13}}>
                    {stats?.vehicle?.accidental === 0 ? (
                      <>
                        <div style={{fontSize:32,marginBottom:8}}>✅</div>
                        No accidental cases
                      </>
                    ) : (
                      <button onClick={()=>navigate("/vehicles")}
                        style={BTN(C.red,"#fff",{fontSize:12,padding:"7px 16px"})}>
                        View {stats.vehicle.accidental} case{stats.vehicle.accidental!==1?"s":""}
                      </button>
                    )}
                  </div>
                </div>

                {/* Driver Management */}
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14}}>👤</span>
                      <span style={{fontWeight:700,fontSize:13,color:C.text}}>Driver Management</span>
                    </div>
                    <span style={{fontSize:11,color:C.faint}}>
                      {stats?.driver?.total} total
                    </span>
                  </div>
                  <div style={{padding:16,display:"flex",gap:12}}>
                    <div style={{flex:1,background:"rgba(37,99,235,0.06)",border:"1px solid #BFDBFE",
                      borderRadius:9,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:28,fontWeight:800,color:C.blue}}>
                        {stats?.driver?.total}
                      </div>
                      <div style={{fontSize:11,color:C.blue,fontWeight:600,marginTop:2}}>Total Drivers</div>
                    </div>
                    <div style={{flex:1,background:"rgba(234,179,8,0.08)",border:"1px solid #FDE68A",
                      borderRadius:9,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:28,fontWeight:800,color:C.yellow}}>
                        {stats?.driver?.expiringSoon}
                      </div>
                      <div style={{fontSize:11,color:C.yellow,fontWeight:600,marginTop:2}}>
                        Expiring Soon
                      </div>
                    </div>
                    <div style={{flex:1,background:"rgba(239,68,68,0.07)",border:"1px solid #FECACA",
                      borderRadius:9,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:28,fontWeight:800,color:C.red}}>
                        {stats?.driver?.expired}
                      </div>
                      <div style={{fontSize:11,color:C.red,fontWeight:600,marginTop:2}}>
                        Expired
                      </div>
                    </div>
                  </div>
                  <div style={{padding:"0 16px 14px"}}>
                    <button onClick={()=>navigate("/drivers")}
                      style={BTN("#F1F5F9",C.muted,{width:"100%",justifyContent:"center",
                        fontSize:12,border:`1px solid ${C.border}`})}>
                      Manage Drivers →
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes dbspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
