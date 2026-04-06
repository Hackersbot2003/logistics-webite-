import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const MAX = 5;

/**
 * ImageUploader
 *
 * Props:
 *   label          - section title
 *   existingUrls   - string[] from server (Drive URLs)
 *   existingIds    - string[] Drive file IDs matching existingUrls
 *   newFiles       - File[] state (new local files not yet uploaded)
 *   onNewFiles     - setter for newFiles
 *   onRemoveExisting - (driveId) => void
 *   accent         - color string
 */
export default function ImageUploader({
  label,
  existingUrls = [],
  existingIds = [],
  newFiles = [],
  onNewFiles,
  onRemoveExisting,
  accent = "#F59E0B",
}) {
  const [previews, setPreviews] = useState({});

  const totalCount = existingUrls.length + newFiles.length;
  const remaining = MAX - totalCount;

  const onDrop = useCallback((accepted) => {
    const toAdd = accepted.slice(0, remaining);
    // Generate preview URLs
    toAdd.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPreviews((p) => ({ ...p, [file.name + file.lastModified]: url }));
    });
    onNewFiles((prev) => [...prev, ...toAdd].slice(0, MAX - existingUrls.length));
  }, [remaining, existingUrls.length, onNewFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: remaining,
    disabled: remaining <= 0,
  });

  const removeNew = (file) => {
    const key = file.name + file.lastModified;
    URL.revokeObjectURL(previews[key]);
    setPreviews((p) => { const n = { ...p }; delete n[key]; return n; });
    onNewFiles((prev) => prev.filter((f) => f !== file));
  };

  const accentRgba = `${accent}20`;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <label style={{
          fontSize: "11px", fontWeight: 700, color: "#94A3B8",
          textTransform: "uppercase", letterSpacing: "0.1em",
          fontFamily: "'Syne', sans-serif",
        }}>
          {label}
        </label>
        <span style={{
          fontSize: "11px", color: totalCount >= MAX ? "#EF4444" : "#475569",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {totalCount}/{MAX}
        </span>
      </div>

      {/* Image grid */}
      {totalCount > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
          gap: "8px", marginBottom: "10px",
        }}>
          {/* Existing from Drive */}
          {existingUrls.map((url, i) => (
            <div key={existingIds[i] || i} style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", border: "1px solid #1E2535" }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(existingIds[i])}
                  style={{
                    position: "absolute", top: "4px", right: "4px",
                    width: "22px", height: "22px",
                    background: "rgba(239,68,68,0.9)", border: "none",
                    borderRadius: "50%", color: "white", fontSize: "12px",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* New local files */}
          {newFiles.map((file) => {
            const key = file.name + file.lastModified;
            const previewUrl = previews[key] || URL.createObjectURL(file);
            return (
              <div key={key} style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", border: `1px solid ${accent}40` }}>
                <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(0,0,0,0.5)", padding: "2px 4px",
                  fontSize: "9px", color: "#FBBF24", fontFamily: "'JetBrains Mono', monospace",
                  textAlign: "center",
                }}>
                  NEW
                </div>
                <button
                  type="button"
                  onClick={() => removeNew(file)}
                  style={{
                    position: "absolute", top: "4px", right: "4px",
                    width: "22px", height: "22px",
                    background: "rgba(239,68,68,0.9)", border: "none",
                    borderRadius: "50%", color: "white", fontSize: "12px",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dropzone */}
      {remaining > 0 && (
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? accent : "#2A3347"}`,
            borderRadius: "10px",
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? accentRgba : "#0E1117",
            transition: "all 0.2s",
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: "24px", marginBottom: "6px" }}>📁</div>
          <div style={{ fontSize: "13px", color: isDragActive ? accent : "#475569" }}>
            {isDragActive ? "Drop images here" : `Drag & drop or click · ${remaining} slot${remaining !== 1 ? "s" : ""} left`}
          </div>
          <div style={{ fontSize: "11px", color: "#2A3347", marginTop: "4px" }}>
            JPEG, PNG, WebP · max 10MB each
          </div>
        </div>
      )}
    </div>
  );
}
