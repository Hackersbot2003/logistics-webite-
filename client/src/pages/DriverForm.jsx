import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import ImageUploader from "../components/ImageUploader";

const Field = ({ label, children }) => (
  <div>
    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "'Syne', sans-serif" }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: "100%", background: "#0E1117", border: "1px solid #2A3347",
  borderRadius: "8px", padding: "10px 13px", fontSize: "14px",
  color: "#E2E8F0", outline: "none", fontFamily: "'DM Sans', sans-serif",
  transition: "border-color 0.15s",
};

const SectionTitle = ({ children, icon }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "10px",
    paddingBottom: "12px", borderBottom: "1px solid #1E2535", marginBottom: "20px",
  }}>
    <span style={{ fontSize: "18px" }}>{icon}</span>
    <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>
      {children}
    </h3>
  </div>
);

const INITIAL = {
  fullName: "", fatherName: "", phoneNumber: "", dateOfBirth: "",
  maritalStatus: "", temporaryAddress: "", permanentAddress: "",
  emergencyRelation: "", emergencyPerson: "", emergencyContact: "",
  aadharNo: "", licenseNo: "", licenseValidity: "",
  senderName: "", senderContact: "", inchargeName: "",
};

export default function DriverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  // Image state
  const [existingPhotos, setExistingPhotos] = useState({ urls: [], ids: [] });
  const [existingAadhar, setExistingAadhar] = useState({ urls: [], ids: [] });
  const [existingLicense, setExistingLicense] = useState({ urls: [], ids: [] });
  const [existingToken, setExistingToken] = useState({ urls: [], ids: [] });
  const [newPhotos, setNewPhotos] = useState([]);
  const [newAadhar, setNewAadhar] = useState([]);
  const [newLicense, setNewLicense] = useState([]);
  const [newToken, setNewToken] = useState([]);
  const [removePhotos, setRemovePhotos] = useState([]);
  const [removeAadhar, setRemoveAadhar] = useState([]);
  const [removeLicense, setRemoveLicense] = useState([]);
  const [removeToken, setRemoveToken] = useState([]);

  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await api.get(`/drivers/${id}`);
        const d = data.driver;
        setForm({
          fullName: d.fullName || "", fatherName: d.fatherName || "",
          phoneNumber: d.phoneNumber || "", dateOfBirth: d.dateOfBirth || "",
          maritalStatus: d.maritalStatus || "", temporaryAddress: d.temporaryAddress || "",
          permanentAddress: d.permanentAddress || "", emergencyRelation: d.emergencyRelation || "",
          emergencyPerson: d.emergencyPerson || "", emergencyContact: d.emergencyContact || "",
          aadharNo: d.aadharNo || "", licenseNo: d.licenseNo || "",
          licenseValidity: d.licenseValidity || "", senderName: d.senderName || "",
          senderContact: d.senderContact || "", inchargeName: d.inchargeName || "",
        });
        setExistingPhotos({ urls: d.photoUrls || [], ids: d.photoDriveIds || [] });
        setExistingAadhar({ urls: d.aadharUrls || [], ids: d.aadharDriveIds || [] });
        setExistingLicense({ urls: d.licenseUrls || [], ids: d.licenseDriveIds || [] });
        setExistingToken({ urls: d.tokenUrls || [], ids: d.tokenDriveIds || [] });
      } catch {
        toast.error("Failed to load driver");
        navigate("/");
      } finally {
        setFetching(false);
      }
    })();
  }, [id, isEdit, navigate]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const removeExisting = (setter, removeSetter) => (driveId) => {
    setter((p) => ({
      urls: p.urls.filter((_, i) => p.ids[i] !== driveId),
      ids: p.ids.filter((id) => id !== driveId),
    }));
    removeSetter((p) => [...p, driveId]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const errors = [];
    if (!form.senderName.trim())    errors.push("Sender Name is required");
    if (!form.senderContact.trim()) errors.push("Sender Contact is required");
    else if (!/^\d{10}$/.test(form.senderContact)) errors.push("Sender Contact must be exactly 10 digits");
    if (!form.inchargeName.trim())  errors.push("Incharge Name is required");

    // Validate documents (at least 1 each, create mode only)
    if (!isEdit) {
      if (!newPhotos.length)  errors.push("At least 1 Photograph is required");
      if (!newAadhar.length)  errors.push("At least 1 Aadhar document is required");
      if (!newLicense.length) errors.push("At least 1 License document is required");
      if (!newToken.length)   errors.push("At least 1 Token Card document is required");
    }

    if (errors.length) {
      errors.forEach(msg => toast.error(msg));
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      newPhotos.forEach((f) => fd.append("photos", f));
      newAadhar.forEach((f) => fd.append("aadhar", f));
      newLicense.forEach((f) => fd.append("license", f));
      newToken.forEach((f) => fd.append("token", f));

      if (isEdit) {
        fd.append("removePhotos", JSON.stringify(removePhotos));
        fd.append("removeAadhar", JSON.stringify(removeAadhar));
        fd.append("removeLicense", JSON.stringify(removeLicense));
        fd.append("removeToken", JSON.stringify(removeToken));
      }

      const config = {
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      };

      if (isEdit) {
        await api.put(`/drivers/${id}`, fd, config);
        toast.success("Driver updated");
      } else {
        const { data } = await api.post("/drivers", fd, config);
        toast.success(`Driver created — Token: ${data.driver.tokenNo}`);
      }

      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (fetching) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #2A3347", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: "#475569", fontSize: "13px", cursor: "pointer", marginBottom: "12px", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back to Dashboard
        </button>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "28px", color: "#E2E8F0", margin: 0 }}>
          {isEdit ? "Edit Driver" : "Add New Driver"}
        </h1>
        <p style={{ color: "#475569", fontSize: "14px", marginTop: "4px" }}>
          {isEdit ? "Update driver information and documents" : "Fill in driver details and upload documents"}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Personal Information ──────────────────── */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "16px", padding: "28px", marginBottom: "20px" }}>
          <SectionTitle icon="👤">Personal Information</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Field label="Full Name *">
              <input name="fullName" value={form.fullName} onChange={handleChange} required style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </Field>
            <Field label="Father's Name">
              <input name="fatherName" value={form.fatherName} onChange={handleChange} style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </Field>
            <Field label="Phone Number">
              <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </Field>
            <Field label="Date of Birth">
              <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange}
                style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "#2A3347"}
              />
            </Field>
            <Field label="Marital Status">
              <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange}
                style={{ ...inputStyle, appearance: "none" }}>
                <option value="">Select…</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Temporary Address">
                <textarea name="temporaryAddress" value={form.temporaryAddress} onChange={handleChange}
                  rows={2} style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </Field>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Permanent Address">
                <textarea name="permanentAddress" value={form.permanentAddress} onChange={handleChange}
                  rows={2} style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Emergency Contact ─────────────────────── */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "16px", padding: "28px", marginBottom: "20px" }}>
          <SectionTitle icon="🚨">Emergency Contact</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {[["emergencyPerson", "Contact Person"], ["emergencyRelation", "Relation"], ["emergencyContact", "Contact Number"]].map(([name, label]) => (
              <Field key={name} label={label}>
                <input name={name} value={form[name]} onChange={handleChange} style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </Field>
            ))}
          </div>
        </div>

        {/* ── Documents ─────────────────────────────── */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "16px", padding: "28px", marginBottom: "20px" }}>
          <SectionTitle icon="📋">Document Details</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              ["aadharNo", "Aadhar Number", "text", false],
              ["licenseNo", "License Number", "text", false],
              ["licenseValidity", "License Validity", "date", false],
              ["senderName", "Sender Name *", "text", true],
              ["senderContact", "Sender Contact * (10 digits)", "text", true],
              ["inchargeName", "Incharge Name *", "text", true],
            ].map(([name, label, type, req]) => (
              <Field key={name} label={<span>{label.replace(" *","")}{req && <span style={{ color:"#EF4444" }}> *</span>}</span>}>
                <input name={name} value={form[name]} onChange={handleChange}
                  type={type}
                  maxLength={name === "senderContact" ? 10 : undefined}
                  placeholder={name === "senderContact" ? "10 digits" : undefined}
                  style={{ ...inputStyle, ...(type === "date" ? { colorScheme: "dark" } : {}) }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(245,158,11,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "#2A3347"}
                />
              </Field>
            ))}
          </div>
        </div>

        {/* ── Image Upload ──────────────────────────── */}
        <div style={{ background: "#0E1117", border: "1px solid #1E2535", borderRadius: "16px", padding: "28px", marginBottom: "24px" }}>
          <SectionTitle icon="🖼️">Document Images</SectionTitle>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "24px", marginTop: "-12px" }}>
            Upload up to 5 images per category. A PDF will be auto-generated from all uploads.
          </p>

          <ImageUploader
            label="Photographs"
            existingUrls={existingPhotos.urls}
            existingIds={existingPhotos.ids}
            newFiles={newPhotos}
            onNewFiles={setNewPhotos}
            onRemoveExisting={removeExisting(setExistingPhotos, setRemovePhotos)}
            accent="#F59E0B"
          />
          <ImageUploader
            label="Aadhar Card"
            existingUrls={existingAadhar.urls}
            existingIds={existingAadhar.ids}
            newFiles={newAadhar}
            onNewFiles={setNewAadhar}
            onRemoveExisting={removeExisting(setExistingAadhar, setRemoveAadhar)}
            accent="#3B82F6"
          />
          <ImageUploader
            label="Driving License"
            existingUrls={existingLicense.urls}
            existingIds={existingLicense.ids}
            newFiles={newLicense}
            onNewFiles={setNewLicense}
            onRemoveExisting={removeExisting(setExistingLicense, setRemoveLicense)}
            accent="#22C55E"
          />
          <ImageUploader
            label="Token Card"
            existingUrls={existingToken.urls}
            existingIds={existingToken.ids}
            newFiles={newToken}
            onNewFiles={setNewToken}
            onRemoveExisting={removeExisting(setExistingToken, setRemoveToken)}
            accent="#A855F7"
          />
        </div>

        {/* ── Upload Progress ───────────────────────── */}
        {loading && uploadProgress > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Uploading to Google Drive…</span>
              <span style={{ fontSize: "12px", color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>{uploadProgress}%</span>
            </div>
            <div style={{ background: "#1E2535", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "999px",
                background: "linear-gradient(90deg, #F59E0B, #FBBF24)",
                width: `${uploadProgress}%`, transition: "width 0.3s ease",
                boxShadow: "0 0 10px rgba(245,158,11,0.5)",
              }} />
            </div>
          </div>
        )}

        {/* ── Actions ───────────────────────────────── */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              background: "#161B26", border: "1px solid #2A3347", color: "#94A3B8",
              padding: "11px 24px", borderRadius: "10px", fontSize: "14px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#92400E" : "#F59E0B",
              color: "#080A0F", border: "none",
              padding: "11px 32px", borderRadius: "10px", fontSize: "14px",
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "background 0.2s",
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 15, height: 15, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#080A0F", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Saving…
              </>
            ) : isEdit ? "Update Driver →" : "Create Driver →"}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </form>
    </div>
  );
}