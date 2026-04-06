import { useState } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  navy: "#1E3A5F", blue: "#2563EB", green: "#16A34A",
  text: "#1E293B", muted: "#64748B", white: "#fff",
  border: "#E2E8F0", bg: "#F8FAFC",
};

export default function HomePage() {
  const navigate = useNavigate();
  const [trackId, setTrackId] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState("");
  const [tracking, setTracking] = useState(false);

  const doTrack = async () => {
    if (!trackId.trim()) return;
    setTracking(true); setTrackError(""); setTrackResult(null);
    try {
      const res = await fetch(`/api/vehicles/public/track/${trackId.trim()}`);
      const data = await res.json();
      if (!res.ok) { setTrackError(data.message || "Not found"); return; }
      setTrackResult(data.vehicle);
    } catch { setTrackError("Network error. Please try again."); }
    finally { setTracking(false); }
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      Delivered: { bg: "#DCFCE7", color: "#16A34A" },
      "In-Transit": { bg: "#DBEAFE", color: "#2563EB" },
      Accidental: { bg: "#FEE2E2", color: "#DC2626" },
    };
    const s = colors[status] || { bg: "#F1F5F9", color: "#64748B" };
    return (
      <span style={{ background: s.bg, color: s.color, padding: "3px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
        {status}
      </span>
    );
  };

  const TrackField = ({ label, value }) => value ? (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ minWidth: 140, fontWeight: 600, color: C.navy, fontSize: 13 }}>{label}:</span>
      <span style={{ color: C.text, fontSize: 13 }}>{value}</span>
    </div>
  ) : null;

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "100vh", background: C.white }}>

      {/* Navbar */}
      <nav style={{ background: C.white, borderBottom: "1px solid #E2E8F0", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: C.navy, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 18 }}>🚛</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: C.navy, letterSpacing: "-0.3px" }}>SHREE AARYA LOGISTICS</span>
        </div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["Home","About","Services","Tracking","Contact"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              style={{ color: C.muted, textDecoration: "none", fontSize: 14, fontWeight: 500 }}
              onMouseEnter={e => e.target.style.color = C.navy}
              onMouseLeave={e => e.target.style.color = C.muted}>
              {item}
            </a>
          ))}
          <button onClick={() => navigate("/login")}
            style={{ background: C.blue, color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            🔑 Login
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" style={{ position: "relative", minHeight: "85vh", background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1600&q=60')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.25 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, padding: "0 60px" }}>
          <div style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 20, display: "inline-block", padding: "4px 14px", marginBottom: 20 }}>
            <span style={{ color: "#60A5FA", fontSize: 13, fontWeight: 600 }}>Trusted Logistics Partner</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#fff", margin: "0 0 16px", lineHeight: 1.1 }}>
            Shree Aarya<br />
            <span style={{ color: "#60A5FA" }}>Logistics</span>
          </h1>
          <p style={{ fontSize: 18, color: "#94A3B8", margin: "0 0 36px", lineHeight: 1.6 }}>
            Reliable and On-Time Delivery Services
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            <button onClick={() => document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: C.blue, color: "#fff", border: "none", padding: "14px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Track Shipment →
            </button>
            <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", padding: "14px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Contact Us
            </button>
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
            {[["350+","Expert Drivers"],["15+","Years Experience"],["India-wide","Delivery Network"]].map(([n,l]) => (
              <div key={l}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{n}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" style={{ padding: "80px 60px", background: C.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 8, textAlign: "center" }}>Shree Aarya Logistics</h2>
          <div style={{ width: 60, height: 3, background: C.blue, margin: "0 auto 40px", borderRadius: 2 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
            <img src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=600&q=60"
              alt="Logistics truck" style={{ width: "100%", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: "🎯", title: "Mission Statement", text: "Dedicated to creating unique partnerships with customers by providing reliable and on-time delivery services, ensuring profitability and mutual growth." },
                { icon: "🏢", title: "Business Philosophy", text: "Strong value system with practices aimed at the company's success and excellence in logistics operations." },
                { icon: "⚡", title: "Strength", text: "350 skilled drivers dedicated to transporting export and domestic vehicles to desired destinations across India." },
              ].map(({ icon, title, text }) => (
                <div key={title} style={{ background: C.white, border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.green }}>{title}</span>
                  </div>
                  <p style={{ color: C.muted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Leadership */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 40 }}>
            {[
              { name: "Mr. Mukesh Rathore", role: "Proprietor", qual: "MBA in International Business (2000–2002) from IPS Academy D.A.V.V", exp: "16 years in various fields, including 7 years in senior positions within logistics companies." },
              { name: "Mr. Jibi T.S.", role: "Director Operations", qual: "", exp: "20 years in convoy business, notably serving Force Motors and other top luxury bus fabricators across India." },
            ].map(p => (
              <div key={p.name} style={{ background: C.white, border: "1px solid #E2E8F0", borderRadius: 14, padding: 24 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.navy, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.blue, marginBottom: 10 }}>{p.role}</div>
                {p.qual && <p style={{ fontSize: 13, color: C.muted, margin: "0 0 6px" }}>Qualifications: {p.qual}</p>}
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Experience: {p.exp}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracking */}
      <section id="tracking" style={{ padding: "80px 60px", background: C.white, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center", maxWidth: 1200, margin: "0 auto" }}>
        <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=60"
          alt="Tracking" style={{ width: "100%", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }} />
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Track Your Shipment</h2>
          <div style={{ width: 50, height: 3, background: C.blue, borderRadius: 2, marginBottom: 28 }} />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Tracking Number (Unique ID)</label>
            <input value={trackId} onChange={e => setTrackId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doTrack()}
              placeholder="Enter vehicle unique ID (e.g. IDsdSAL6746633)"
              style={{ width: "100%", padding: "13px 16px", border: "2px solid #E2E8F0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = C.blue}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"} />
          </div>
          <button onClick={doTrack} disabled={tracking}
            style={{ width: "100%", padding: "14px", background: C.blue, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: tracking ? 0.7 : 1 }}>
            {tracking ? "Tracking…" : "Track Now"}
          </button>

          {trackError && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#DC2626", fontSize: 14 }}>
              ⚠️ {trackError}
            </div>
          )}

          {trackResult && (
            <div style={{ marginTop: 16, background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Shipment Details</span>
                <StatusBadge status={trackResult.vehicleStatus} />
              </div>
              <TrackField label="Place of Delivery" value={trackResult.placeOfDelivery} />
              <TrackField label="Model" value={trackResult.model} />
              <TrackField label="Temp Reg No" value={trackResult.tempRegNo} />
              <TrackField label="Driver Name" value={trackResult.driverName} />
              <TrackField label="Date" value={trackResult.date} />
              <TrackField label="Time" value={trackResult.time} />
              <TrackField label="Vehicle Location" value={trackResult.vehicleLocation} />
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section id="services" style={{ padding: "80px 60px", background: C.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Services &amp; Assignments</h2>
            <div style={{ width: 50, height: 3, background: C.blue, borderRadius: 2, marginBottom: 28 }} />
            <div style={{ background: C.white, border: "1px solid #E2E8F0", borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 8 }}>Our Services</h3>
              <p style={{ color: C.muted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>Logistics solutions for transporting finished vehicles from manufacturing units to destinations across India.</p>
            </div>
            <div style={{ background: C.white, border: "1px solid #E2E8F0", borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 12 }}>Notable Assignments</h3>
              {["Successfully delivered 405 BRTS buses to Bangladesh","Managed logistics for MAN Trucks India Pvt. Ltd.","Force Motors Limited","VECV (Eicher Motors Ltd.)","Ashok Leyland"].map(a => (
                <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 14, color: C.muted }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>✓</span>{a}
                </div>
              ))}
            </div>
          </div>
          <img src="https://images.unsplash.com/photo-1546961342-ea5f62d5a27b?auto=format&fit=crop&w=600&q=60"
            alt="Services" style={{ width: "100%", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }} />
        </div>
      </section>

      {/* Clients */}
      <section style={{ padding: "60px 60px", background: C.white }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Our Esteemed Clients</h2>
          <div style={{ width: 50, height: 3, background: C.blue, borderRadius: 2, marginBottom: 32 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["M.G. Automotives Bus and Coaches (Luxury Coaches)","Instromedix India Pvt. Ltd.","Ziqitza Health Care Limited","First Responder (Fire Fighting Vehicles)","DSY Creations – Faridabad","Starline Motors","Karnataka Engineering","Krishna Coach","Natraj Motors Body Builders","K.P.N. Auto Wings","S.K.S Luxure Travels Pvt. Ltd."].map((c, i) => (
              <div key={c} style={{ fontSize: 14, color: C.muted, padding: "6px 0" }}>
                {i + 1}. {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: "60px 60px", background: C.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: C.navy, marginBottom: 8 }}>Contact Us</h2>
          <div style={{ width: 50, height: 3, background: C.blue, borderRadius: 2, marginBottom: 32 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {[
              { title: "Indore Office", lines: ["Address: 197-Ambikapuri Extn, Near Dakshin Kali Peeth Temple, Aerodrome Road, Indore – 452005 (M.P)","Phone: 0731–2620865","Mobile: +91 9179827886 / +91 7987775887","Email: mukesh.rathore@salg.co.in"] },
              { title: "Belgaum Office", lines: ["Address: Manasanjali House, Plot No – 26, Vinayak Housing Society, Sahu Nagar – Belgaum – 590010","Mobile: +91 9448116449 / +91 7022406449","Email: jibi.t.s@salg.co.in"] },
            ].map(o => (
              <div key={o.title} style={{ background: C.white, border: "1px solid #E2E8F0", borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontWeight: 800, fontSize: 16, color: C.navy, marginBottom: 14 }}>{o.title}</h3>
                {o.lines.map(l => <p key={l} style={{ fontSize: 14, color: C.muted, margin: "0 0 6px" }}>{l}</p>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.navy, color: "#fff", padding: "28px 60px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Shree Aarya Logistics</div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>Reliable and on-time delivery services</div>
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8" }}>© 2026 Shree Aarya Logistics. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
