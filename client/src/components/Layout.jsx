import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Dark sidebar colors only
const S = { bg:"#0F172A", panel:"#1E293B", border:"#334155", text:"#E2E8F0", muted:"#94A3B8", faint:"#475569", active:"#3B82F6", activeBg:"rgba(59,130,246,0.12)" };

const NavItem = ({ to, label, icon }) => (
  <NavLink to={to} style={({ isActive }) => ({
    display:"flex", alignItems:"center", gap:9, padding:"9px 14px", borderRadius:7, fontSize:13.5,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? "#fff" : S.muted,
    background: isActive ? S.activeBg : "transparent",
    textDecoration:"none", transition:"all 0.13s",
    borderLeft: isActive ? `3px solid ${S.active}` : "3px solid transparent",
  })}>
    {icon && <span style={{fontSize:15}}>{icon}</span>}
    {label}
  </NavLink>
);

// Nav items with roles — matches your spec exactly
const NAV = [
  { label:"Dashboard",          path:"/dashboard",          icon:"📊", roles:["superadmin","admin","manager","user"] },
  { label:"Drivers",            path:"/drivers",            icon:"🧑‍✈️", roles:["superadmin","admin","manager","user"] },
  { label:"Vehicles",           path:"/vehicles",           icon:"🚛", roles:["superadmin","admin","manager","user"] },
  { label:"Accounts",           path:"/accounts",           icon:"📋", roles:["superadmin","admin","manager","user"] },
  { label:"Billing",            path:"/billing",            icon:"🧾", roles:["superadmin","admin","manager"] },
  { label:"LR Generator",       path:"/lr-generator",       icon:"📄", roles:["superadmin","admin","manager","user"] },
  { label:"ManageVehicleSheets",path:"/ManageVehicleSheets",icon:"📂", roles:["superadmin","admin"] },
  { label:"Lock Sheets",        path:"/lockSheets",         icon:"🔒", roles:["admin","superadmin"] },
  { label:"Logistics Partners", path:"/logistics-partners", icon:"🤝", roles:["superadmin","admin","manager","user"] },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV.filter(item => item.roles.includes(user?.role));

  const sidebar = (
    <>
      <div style={{ padding:"0 14px 20px", borderBottom:`1px solid ${S.border}`, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:32, height:32, background:"#2563EB", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🚛</div>
          <span style={{ fontWeight:800, fontSize:15, color:S.text, letterSpacing:"-0.3px" }}>LOGISTICS</span>
        </div>
      </div>

      <nav style={{ display:"flex", flexDirection:"column", gap:2, flex:1 }}>
        {visibleNav.map(item => (
          <NavItem key={item.path} to={item.path} label={item.label} icon={item.icon} />
        ))}
      </nav>

      <div style={{ borderTop:`1px solid ${S.border}`, paddingTop:14, marginTop:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, paddingLeft:4 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:connected?"#22C55E":"#EF4444" }} />
          <span style={{ fontSize:11, color:S.faint, fontFamily:"monospace" }}>{connected?"LIVE":"OFFLINE"}</span>
        </div>
        <div style={{ background:"#0F172A", border:`1px solid ${S.border}`, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:600, color:S.text, marginBottom:3 }}>{user?.name}</div>
          <span style={{ fontSize:11, color:"#60A5FA", background:"rgba(59,130,246,0.1)", display:"inline-block", padding:"1px 8px", borderRadius:4, fontFamily:"monospace", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            {user?.role}
          </span>
        </div>
        {hasRole("superadmin") && (
          <button onClick={() => navigate("/users")}
            style={{ width:"100%", padding:"7px", background:"rgba(37,99,235,0.15)", border:`1px solid rgba(37,99,235,0.3)`, borderRadius:7, color:"#60A5FA", fontSize:12, cursor:"pointer", fontWeight:600, marginBottom:6 }}>
            Register User
          </button>
        )}
        <button onClick={() => { logout(); navigate("/home"); }}
          style={{ width:"100%", padding:"7px", background:"rgba(239,68,68,0.15)", border:`1px solid rgba(239,68,68,0.3)`, borderRadius:7, color:"#F87171", fontSize:12, cursor:"pointer", fontWeight:600 }}>
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#F8FAFC" }}>
      <aside style={{ width:210, flexShrink:0, background:S.bg, borderRight:`1px solid ${S.border}`, display:"flex", flexDirection:"column", padding:"18px 8px", position:"sticky", top:0, height:"100vh", overflowY:"auto" }} className="ds-sidebar">
        {sidebar}
      </aside>

      <button onClick={() => setMobileOpen(o => !o)}
        style={{ 
          display: "none",
          position: "fixed", 
          top: 12, 
          left: 12, 
          zIndex: 2000, 
          background: S.bg, 
          border: `1px solid ${S.border}`, 
          borderRadius: 8, 
          padding: "8px 11px", 
          cursor: "pointer", 
          color: S.text, 
          fontSize: 18,
          alignItems: "center",
          justifyContent: "center"
        }}
        className="ds-hamburger">
        ☰
      </button>

     {mobileOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1999
    }}
  >
    {/* Background overlay */}
    <div
      onClick={() => setMobileOpen(false)}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.6)"
      }}
    />

    {/* Sidebar drawer */}
    <aside
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 210,
        height: "100%",
        background: S.bg,
        padding: "18px 8px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        zIndex: 2000,
        borderRight: `1px solid ${S.border}`
      }}
    >
      {sidebar}
    </aside>
  </div>
)}

      <main style={{ flex:1, overflow:"auto", minWidth:0, background:"#F8FAFC" }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .ds-sidebar {
            display: none !important;
          }
          .ds-hamburger {
            display: flex !important;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
