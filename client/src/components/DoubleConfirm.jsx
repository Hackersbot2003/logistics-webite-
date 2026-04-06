import { useState } from "react";

/**
 * Double-confirm delete modal.
 * User must type "DELETE" before the delete button activates.
 * Usage:
 *   const { ask, modal } = useDoubleConfirm();
 *   ask(`Delete "${name}"? This cannot be undone.`, async () => { ... });
 *   return <>{modal}{...rest}</>
 */
export function useDoubleConfirm() {
  const [state, setState] = useState(null); // { msg, onConfirm }
  const [typed, setTyped] = useState("");

  const ask = (msg, onConfirm) => { setState({ msg, onConfirm }); setTyped(""); };
  const cancel = () => { setState(null); setTyped(""); };
  const confirm = () => {
    if (typed === "DELETE") { state?.onConfirm?.(); cancel(); }
  };

  const modal = state ? (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:"#fff",borderRadius:14,padding:28,width:"min(90vw,440px)",boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize:28,marginBottom:10 }}>⚠️</div>
        <div style={{ fontWeight:800,fontSize:17,color:"#1E293B",marginBottom:10 }}>Confirm Delete</div>
        <div style={{ color:"#64748B",fontSize:14,lineHeight:1.6,marginBottom:20 }}>{state.msg}</div>
        <div style={{ fontSize:13,fontWeight:600,color:"#64748B",marginBottom:8 }}>
          Type <span style={{ fontFamily:"monospace",background:"#F1F5F9",padding:"1px 6px",borderRadius:4,color:"#EF4444" }}>DELETE</span> to confirm:
        </div>
        <input autoFocus value={typed}
          onChange={e => setTyped(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && confirm()}
          placeholder="Type DELETE"
          style={{ width:"100%",padding:"10px 12px",border:"2px solid #E2E8F0",borderRadius:7,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:16 }} />
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={cancel}
            style={{ padding:"8px 20px",background:"#F1F5F9",border:"none",borderRadius:7,cursor:"pointer",fontWeight:600,fontSize:13,color:"#64748B" }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={typed !== "DELETE"}
            style={{ padding:"8px 20px",background:typed==="DELETE"?"#EF4444":"#FCA5A5",border:"none",borderRadius:7,cursor:typed==="DELETE"?"pointer":"not-allowed",fontWeight:700,fontSize:13,color:"#fff",transition:"all 0.15s" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, modal };
}
