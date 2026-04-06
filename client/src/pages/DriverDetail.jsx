import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";

const InfoRow = ({ label, value }) => (
  <div style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid #1E2535" }}>
    <div style={{ width: "160px", flexShrink: 0, fontSize: "12px", color: "#475569", fontFamily: "'Syne', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: "1px" }}>
      {label}
    </div>
    <div style={{ fontSize: "14px", color: "#CBD5E1", flex: 1 }}>{value || <span style={{ color: "#2A3347" }}>Not provided</span>}</div>
  </div>
);

const ImageGallery = ({ urls, label }) => {
  const [lightbox, setLightbox] = useState(null);
  if (!urls?.length) return null;
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontFamily: "'Syne', sans-serif" }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {urls.map((url, i) => (
          <div
            key={i}
            onClick={() => setLightbox(url)}
            style={{
              width: "100px", height: "100px", borderRadius: "10px",
              overflow: "hidden", cursor: "zoom-in",
              border: "1px solid #2A3347",
              transition: "transform 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.borderColor = "#F59E0B60"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "#2A3347"; }}
          >
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ))}
      </div>
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, cursor: "zoom-out",
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
};

export default function DriverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/drivers/${id}`)
      .then(({ data }) => setDriver(data.driver))
      .catch(() => { toast.error("Driver not found"); navigate("/"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #2A3347", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!driver) return null;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", color: "#475569", fontSize: "13px", cursor: "pointer", marginBottom: "20px", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}
      >
        ← Dashboard
      </button>

      {/* Header Card */}
      <div style={{
        background: "linear-gradient(135deg, #0E1117 0%, #161B26 100%)",
        border: "1px solid #1E2535", borderRadius: "18px",
        padding: "28px 32px", marginBottom: "20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            overflow: "hidden", border: "3px solid rgba(245,158,11,0.3)",
            background: "#1E2535", flexShrink: 0,
          }}>
            {driver.photoUrls?.[0] ? (
              <img src={driver.photoUrls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#F59E0B", fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                {driver.fullName?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "24px", color: "#E2E8F0", margin: 0 }}>
              {driver.fullName}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
              <span style={{
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                color: "#FBBF24", fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700, padding: "3px 12px", borderRadius: "6px",
              }}>
                {driver.tokenNo}
              </span>
              {driver.phoneNumber && (
                <span style={{ fontSize: "13px", color: "#64748B" }}>{driver.phoneNumber}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {driver.pdfUrl && (
            <a
              href={driver.pdfUrl} target="_blank" rel="noreferrer"
              style={{
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                color: "#4ADE80", padding: "9px 18px", borderRadius: "9px",
                fontSize: "13px", textDecoration: "none", fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              📄 View PDF
            </a>
          )}
          {hasRole("superadmin", "admin", "manager") && (
            <button
              onClick={() => navigate(`/drivers/${driver._id}/edit`)}
              style={{
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                color: "#FBBF24", padding: "9px 18px", borderRadius: "9px",
                fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
              }}
            >
              Edit Driver
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Personal Info */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", padding: "24px", gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>
            Personal Details
          </div>
          <div>
            <InfoRow label="Full Name" value={driver.fullName} />
            <InfoRow label="Father's Name" value={driver.fatherName} />
            <InfoRow label="Phone" value={driver.phoneNumber} />
            <InfoRow label="Date of Birth" value={driver.dateOfBirth} />
            <InfoRow label="Marital Status" value={driver.maritalStatus} />
          </div>
        </div>

        {/* Addresses */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", padding: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>Addresses</div>
          <InfoRow label="Temporary" value={driver.temporaryAddress} />
          <InfoRow label="Permanent" value={driver.permanentAddress} />
        </div>

        {/* Emergency */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", padding: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>Emergency Contact</div>
          <InfoRow label="Person" value={driver.emergencyPerson} />
          <InfoRow label="Relation" value={driver.emergencyRelation} />
          <InfoRow label="Contact" value={driver.emergencyContact} />
        </div>

        {/* Documents */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", padding: "24px", gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", fontFamily: "'Syne', sans-serif" }}>Documents</div>
          <InfoRow label="Aadhar No" value={driver.aadharNo} />
          <InfoRow label="License No" value={driver.licenseNo} />
          <InfoRow label="License Validity" value={driver.licenseValidity} />
          <InfoRow label="Sender Name" value={driver.senderName} />
          <InfoRow label="Sender Contact" value={driver.senderContact} />
          <InfoRow label="Incharge Name" value={driver.inchargeName} />
        </div>

        {/* Images */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "14px", padding: "24px", gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", fontFamily: "'Syne', sans-serif" }}>
            Document Images
          </div>
          <ImageGallery urls={driver.photoUrls} label="Photographs" />
          <ImageGallery urls={driver.aadharUrls} label="Aadhar Card" />
          <ImageGallery urls={driver.licenseUrls} label="Driving License" />
          <ImageGallery urls={driver.tokenUrls} label="Token Card" />
          {!driver.photoUrls?.length && !driver.aadharUrls?.length && !driver.licenseUrls?.length && !driver.tokenUrls?.length && (
            <div style={{ color: "#2A3347", fontSize: "14px", textAlign: "center", padding: "24px 0" }}>No images uploaded</div>
          )}
        </div>

        {/* Metadata */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "12px", color: "#2A3347", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
            Created {driver.createdAt ? format(new Date(driver.createdAt), "PPpp") : "—"}
            {driver.updatedAt && driver.updatedAt !== driver.createdAt && (
              <> · Updated {format(new Date(driver.updatedAt), "PPpp")}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
