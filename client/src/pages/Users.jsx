import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ── Design tokens (matches full project light theme) ─────────────────────────
const C = {
  bg:"#F1F5F9", white:"#fff", border:"#E2E8F0", text:"#1E293B",
  muted:"#64748B", faint:"#94A3B8", blue:"#2563EB", red:"#EF4444",
  green:"#16A34A", yellow:"#D97706", panel:"#F8FAFC",
};
const INP = {
  width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:7,
  fontSize:14,color:C.text,outline:"none",boxSizing:"border-box",
  background:C.white,fontFamily:"inherit"
};
const BTN = (bg,color="#fff",extra={})=>({
  padding:"9px 18px",background:bg,border:"none",borderRadius:7,color,
  cursor:"pointer",fontSize:13,fontWeight:600,display:"inline-flex",
  alignItems:"center",gap:6,...extra
});

const ROLES = ["superadmin","admin","manager","user"];

const ROLE_COLORS = {
  superadmin: { bg:"rgba(245,158,11,0.12)", color:"#D97706", border:"rgba(245,158,11,0.3)" },
  admin:      { bg:"rgba(37,99,235,0.12)",  color:"#2563EB", border:"rgba(37,99,235,0.3)"  },
  manager:    { bg:"rgba(168,85,247,0.12)", color:"#9333EA", border:"rgba(168,85,247,0.3)" },
  user:       { bg:"rgba(100,116,139,0.1)", color:"#64748B", border:"rgba(100,116,139,0.2)"},
};

function RolePill({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.user;
  return (
    <span style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,
      fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",
      padding:"2px 10px",borderRadius:6}}>{role}</span>
  );
}

function Spin() {
  return <div style={{width:18,height:18,border:`2px solid ${C.border}`,borderTopColor:C.blue,
    borderRadius:"50%",animation:"uspin 0.7s linear infinite",display:"inline-block"}}/>;
}

// ── Queue Monitor ─────────────────────────────────────────────────────────────
function QueueMonitor() {
  const [stats,setStats]       = useState(null);
  const [pending,setPending]   = useState([]);
  const [failed,setFailed]     = useState([]);
  const [loading,setLoading]   = useState(true);
  const [expanded,setExpanded] = useState(false);

  const fetch = async () => {
    try {
      const {data} = await api.get("/auth/queue-stats");
      setStats(data.stats);
      setPending(data.pendingJobs||[]);
      setFailed(data.recentFailed||[]);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(()=>{ fetch(); const t=setInterval(fetch,30000); return()=>clearInterval(t); },[]);

  if (loading) return null;
  const allClear = stats?.pending===0 && stats?.failed===0;
  const borderCol = allClear ? C.border : stats?.failed>0 ? "#FECACA" : "#FDE68A";

  return (
    <div style={{background:C.white,border:`1px solid ${borderCol}`,borderRadius:12,
      marginBottom:20,overflow:"hidden"}}>
      <div onClick={()=>setExpanded(p=>!p)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 18px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:9,height:9,borderRadius:"50%",
            background:allClear?C.green:stats?.failed>0?C.red:C.yellow,
            boxShadow:`0 0 6px ${allClear?C.green:stats?.failed>0?C.red:C.yellow}80`}}/>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:C.text}}>Google Sheets Sync Queue</div>
            <div style={{fontSize:12,color:C.faint}}>MongoDB-backed retry · auto-refreshes 30s</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{background:C.panel,border:`1px solid ${C.border}`,
            fontSize:12,padding:"3px 10px",borderRadius:6,color:C.muted,fontFamily:"monospace"}}>
            {stats?.pending??0} pending
          </span>
          {stats?.failed>0 && (
            <span style={{background:"#FEF2F2",border:"1px solid #FECACA",
              fontSize:12,padding:"3px 10px",borderRadius:6,color:C.red,fontFamily:"monospace"}}>
              {stats.failed} failed
            </span>
          )}
          {allClear && (
            <span style={{background:"#F0FDF4",border:"1px solid #BBF7D0",
              fontSize:12,padding:"3px 10px",borderRadius:6,color:C.green}}>✓ all synced</span>
          )}
          <span style={{color:C.faint,fontSize:12}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{borderTop:`1px solid ${C.border}`,padding:18}}>
          <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:9,
            padding:"11px 15px",marginBottom:16,fontSize:13,color:C.muted,lineHeight:1.6}}>
            <span style={{color:C.blue,fontWeight:700}}>How it works: </span>
            When a Sheets sync fails, the operation is stored in MongoDB. A worker retries every 2 minutes with backoff. Success → auto-deleted. No data is ever lost.
          </div>
          {allClear && (
            <div style={{textAlign:"center",padding:"20px 0",color:C.faint,fontSize:13}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              All Google Sheets operations are in sync
            </div>
          )}
          {pending.length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>Pending ({pending.length})</div>
              {pending.map((j,i)=>(
                <div key={i} style={{background:C.panel,border:`1px solid ${C.border}`,
                  borderRadius:8,padding:"9px 13px",marginBottom:6,
                  display:"flex",gap:12,alignItems:"center",fontSize:12}}>
                  <span style={{fontWeight:700,color:C.blue}}>{j.operation}</span>
                  <span style={{color:C.muted,fontFamily:"monospace"}}>{String(j.driverId||"").slice(-8)}</span>
                  <span style={{color:C.faint}}>Attempt {j.attempts}</span>
                  <span style={{color:C.red,marginLeft:"auto",fontSize:11}}>{j.lastError}</span>
                </div>
              ))}
            </div>
          )}
          {failed.length>0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>Permanently Failed ({failed.length})</div>
              {failed.map((j,i)=>(
                <div key={i} style={{background:"#FEF2F2",border:"1px solid #FECACA",
                  borderRadius:8,padding:"9px 13px",marginBottom:6,
                  display:"flex",gap:12,alignItems:"center",fontSize:12}}>
                  <span style={{fontWeight:700,color:C.red}}>{j.operation}</span>
                  <span style={{color:C.muted,fontFamily:"monospace"}}>{j.attempts} attempts</span>
                  <span style={{color:C.red,marginLeft:"auto",fontSize:11}}>{j.lastError}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{textAlign:"right",marginTop:12}}>
            <button onClick={fetch}
              style={BTN(C.panel,C.muted,{fontSize:12,border:`1px solid ${C.border}`,padding:"6px 14px"})}>
              ↻ Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Challan Reset ─────────────────────────────────────────────────────────────
function ChallanResetSection() {
  const { hasRole } = useAuth();
  const [settings,setSettings] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState("");

  const load = async () => {
    try { const {data}=await api.get("/vehicles/challan-settings"); setSettings(data.settings); }
    catch {}
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const update = (i,k,v) => setSettings(p=>p.map((s,idx)=>idx===i?{...s,[k]:v}:s));

  const reset = async (s) => {
    setSaving(s.sheetType);
    try {
      await api.post("/vehicles/challan-reset",{sheetType:s.sheetType,resetDate:new Date(),autoResetDate:s.autoResetDate});
      toast.success(`${s.sheetType} counter reset`); load();
    } catch(e){toast.error(e.response?.data?.message||"Failed");}
    finally {setSaving("");}
  };

  const save = async (s) => {
    setSaving(s.sheetType+"_s");
    try {
      await api.post("/vehicles/challan-reset",{sheetType:s.sheetType,autoResetDate:s.autoResetDate});
      toast.success("Saved");
    } catch {toast.error("Save failed");}
    finally {setSaving("");}
  };

  const LABELS = {FML:"FML",FML_EXP:"EXP-FML",Others:"Others"};

  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,
      overflow:"hidden",marginTop:20}}>
      <div style={{padding:"13px 18px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",gap:8,background:C.panel}}>
        <span style={{fontSize:16}}>🔢</span>
        <span style={{fontWeight:700,fontSize:14,color:C.text}}>Challan Number Settings</span>
        <span style={{fontSize:12,color:C.faint,marginLeft:4}}>Auto-resets April 1 each year</span>
      </div>
      {loading ? (
        <div style={{padding:32,textAlign:"center"}}><Spin/></div>
      ) : (
        <div style={{padding:18,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          {settings.map((s,i)=>(
            <div key={s.sheetType} style={{background:C.panel,border:`1px solid ${C.border}`,
              borderRadius:10,padding:16}}>
              <div style={{fontWeight:700,fontSize:14,color:C.blue,marginBottom:12}}>
                {LABELS[s.sheetType]||s.sheetType}
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",
                  letterSpacing:"0.06em",marginBottom:5}}>Current Counter</div>
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
                  padding:"8px 12px",fontSize:13,color:C.text,fontFamily:"monospace"}}>
                  {s.prefix}{String(s.counter).padStart(2,"0")} → next: {s.prefix}{String(s.counter+1).padStart(2,"0")}
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",
                  letterSpacing:"0.06em",marginBottom:5}}>Auto-Reset Date (MM-DD)</div>
                <input value={s.autoResetDate||"04-01"} onChange={e=>update(i,"autoResetDate",e.target.value)}
                  style={{...INP,fontFamily:"monospace"}} />
              </div>
              <div style={{fontSize:12,color:C.faint,marginBottom:12}}>
                Last reset: {s.resetDate?new Date(s.resetDate).toLocaleDateString("en-IN"):"Never"}
              </div>
              {hasRole("superadmin") && (
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>save(s)} disabled={!!saving}
                    style={{...BTN(C.blue,"#fff",{flex:1,justifyContent:"center",padding:"7px"}),fontSize:12}}>
                    {saving===s.sheetType+"_s"?"Saving…":"Save"}
                  </button>
                  <button onClick={()=>reset(s)} disabled={!!saving}
                    style={{...BTN("#FEF2F2",C.red,{flex:1,justifyContent:"center",padding:"7px",
                      border:"1px solid #FECACA"}),fontSize:12}}>
                    {saving===s.sheetType?"Resetting…":"Reset Now"}
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

// ── Main Users Page ───────────────────────────────────────────────────────────
export default function Users() {
  const { user: me, hasRole } = useAuth();
  const [users,setUsers]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [saving,setSaving]   = useState(false);
  const [form,setForm]       = useState({name:"",email:"",password:"",role:"user"});

  const load = async () => {
    setLoading(true);
    try { const {data}=await api.get("/auth/users"); setUsers(data.users); }
    catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const register = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/register",form);
      toast.success(`User registered: ${form.email}`);
      setForm({name:"",email:"",password:"",role:"user"});
      setShowForm(false); load();
    } catch(err){ toast.error(err.response?.data?.message||"Failed"); }
    finally { setSaving(false); }
  };

  const toggle = async (userId,isActive) => {
    try {
      await api.patch(`/auth/users/${userId}/toggle`);
      toast.success(isActive?"Deactivated":"Activated"); load();
    } catch(err){ toast.error(err.response?.data?.message||"Failed"); }
  };

  const allowed = hasRole("superadmin") ? ROLES : ["manager","user"];

  return (
    <div style={{background:C.bg,minHeight:"100vh",padding:"0 0 40px"}}>

      {/* Header */}
      <div style={{padding:"20px 28px 16px",borderBottom:`1px solid ${C.border}`,
        background:C.white,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <span style={{fontSize:22}}>👥</span>
            <h1 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>User Management</h1>
          </div>
          <p style={{margin:0,fontSize:13,color:C.muted}}>
            {users.length} user{users.length!==1?"s":""} registered
          </p>
        </div>
        {hasRole("superadmin","admin") && (
          <button onClick={()=>setShowForm(p=>!p)}
            style={BTN(showForm?"#F1F5F9":C.blue,showForm?C.muted:"#fff",
              {border:showForm?`1px solid ${C.border}`:"none"})}>
            {showForm?"Cancel":"+ Register User"}
          </button>
        )}
      </div>

      <div style={{padding:"20px 28px"}}>

        {/* Sync queue — admin+ only */}
        {hasRole("superadmin","admin") && <QueueMonitor />}

        {/* Register form */}
        {showForm && (
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,
            padding:24,marginBottom:20}}>
            <h3 style={{margin:"0 0 18px",fontSize:15,fontWeight:700,color:C.text}}>
              Register New User
            </h3>
            <form onSubmit={register}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                {[
                  {label:"Full Name",  key:"name",     type:"text",     req:true},
                  {label:"Email",      key:"email",    type:"email",    req:true},
                  {label:"Password",   key:"password", type:"password", req:true},
                ].map(({label,key,type,req})=>(
                  <div key={key}>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",
                      letterSpacing:"0.06em",marginBottom:6}}>{label}{req&&<span style={{color:C.red}}> *</span>}</div>
                    <input type={type} value={form[key]} required={req} minLength={key==="password"?6:undefined}
                      onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={INP}
                      onFocus={e=>e.target.style.borderColor=C.blue}
                      onBlur={e=>e.target.style.borderColor=C.border} />
                  </div>
                ))}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",
                    letterSpacing:"0.06em",marginBottom:6}}>Role</div>
                  <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                    style={{...INP,cursor:"pointer"}}>
                    {allowed.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
                <button type="button" onClick={()=>setShowForm(false)}
                  style={BTN("#F1F5F9",C.muted,{border:`1px solid ${C.border}`})}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{...BTN(C.blue,"#fff"),opacity:saving?0.7:1}}>
                  {saving?<><Spin/> Registering…</>:"Register →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users table */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,
            display:"grid",gridTemplateColumns:"1fr 200px 110px 130px 100px",
            padding:"10px 18px"}}>
            {["User","Email","Role","Joined","Status"].map(h=>(
              <div key={h} style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{padding:40,textAlign:"center"}}><Spin/></div>
          ) : users.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:C.faint}}>No users found</div>
          ) : (
            users.map((u,i)=>(
              <div key={u._id}
                style={{display:"grid",gridTemplateColumns:"1fr 200px 110px 130px 100px",
                  padding:"13px 18px",borderBottom:i<users.length-1?`1px solid #F8FAFC`:"none",
                  alignItems:"center",opacity:u.isActive?1:0.5,transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.panel}
                onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:C.text}}>{u.name}</div>
                  {u._id===me?._id && (
                    <div style={{fontSize:11,color:C.blue,fontWeight:600}}>← you</div>
                  )}
                </div>
                <div style={{fontSize:13,color:C.muted}}>{u.email}</div>
                <div><RolePill role={u.role}/></div>
                <div style={{fontSize:12,color:C.faint}}>
                  {new Date(u.createdAt).toLocaleDateString("en-IN")}
                </div>
                <div>
                  {u.role!=="superadmin" && u._id!==me?._id && hasRole("superadmin") ? (
                    <button onClick={()=>toggle(u._id,u.isActive)}
                      style={{...BTN(u.isActive?"#FEF2F2":"#F0FDF4",u.isActive?C.red:C.green,
                        {padding:"5px 12px",fontSize:11,
                          border:`1px solid ${u.isActive?"#FECACA":"#BBF7D0"}`})}}>
                      {u.isActive?"Disable":"Enable"}
                    </button>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,
                      color:u.isActive?C.green:C.red}}>
                      <div style={{width:6,height:6,borderRadius:"50%",
                        background:u.isActive?C.green:C.red}}/>
                      {u.isActive?"Active":"Off"}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Challan reset — superadmin only */}
        {hasRole("superadmin") && <ChallanResetSection />}
      </div>

      <style>{`@keyframes uspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
