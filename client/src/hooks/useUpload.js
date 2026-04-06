import { useState, useCallback } from "react";

/**
 * useUpload
 *
 * Manages image upload state for all 4 driver document categories.
 * Tracks:
 *   - existingUrls / existingIds (from server, i.e. already on Drive)
 *   - newFiles (File objects queued for upload)
 *   - removeIds (Drive IDs marked for deletion)
 *
 * Usage:
 *   const upload = useUpload(driver);  // pass driver for edit mode, null for create
 *   <ImageUploader {...upload.photos} />
 *   const formData = upload.appendToFormData(fd);
 */
export const useUpload = (driver = null) => {
  const make = (urlKey, idKey) => ({
    urls: driver?.[urlKey] || [],
    ids: driver?.[idKey] || [],
  });

  const [existing, setExisting] = useState({
    photos: make("photoUrls", "photoDriveIds"),
    aadhar: make("aadharUrls", "aadharDriveIds"),
    license: make("licenseUrls", "licenseDriveIds"),
    token: make("tokenUrls", "tokenDriveIds"),
  });

  const [newFiles, setNewFiles] = useState({
    photos: [],
    aadhar: [],
    license: [],
    token: [],
  });

  const [removeIds, setRemoveIds] = useState({
    photos: [],
    aadhar: [],
    license: [],
    token: [],
  });

  const removeExisting = useCallback((category) => (driveId) => {
    setExisting((prev) => ({
      ...prev,
      [category]: {
        urls: prev[category].urls.filter((_, i) => prev[category].ids[i] !== driveId),
        ids: prev[category].ids.filter((id) => id !== driveId),
      },
    }));
    setRemoveIds((prev) => ({
      ...prev,
      [category]: [...prev[category], driveId],
    }));
  }, []);

  const setNewForCategory = useCallback((category) => (updater) => {
    setNewFiles((prev) => ({
      ...prev,
      [category]: typeof updater === "function" ? updater(prev[category]) : updater,
    }));
  }, []);

  /**
   * Append all file data to a FormData object for submission.
   */
  const appendToFormData = useCallback((fd) => {
    const categories = ["photos", "aadhar", "license", "token"];
    categories.forEach((cat) => {
      const fieldName = cat === "photos" ? "photos" : cat;
      newFiles[cat].forEach((file) => fd.append(fieldName, file));
      fd.append(`remove${cat.charAt(0).toUpperCase() + cat.slice(1)}`, JSON.stringify(removeIds[cat]));
    });
    return fd;
  }, [newFiles, removeIds]);

  /**
   * Reset all state (for after successful submit)
   */
  const reset = useCallback(() => {
    setExisting({ photos: { urls: [], ids: [] }, aadhar: { urls: [], ids: [] }, license: { urls: [], ids: [] }, token: { urls: [], ids: [] } });
    setNewFiles({ photos: [], aadhar: [], license: [], token: [] });
    setRemoveIds({ photos: [], aadhar: [], license: [], token: [] });
  }, []);

  const totalNewFiles = Object.values(newFiles).reduce((s, arr) => s + arr.length, 0);
  const hasChanges = totalNewFiles > 0 || Object.values(removeIds).some((arr) => arr.length > 0);

  return {
    // Per-category props, spread directly into <ImageUploader>
    photos: {
      existingUrls: existing.photos.urls,
      existingIds: existing.photos.ids,
      newFiles: newFiles.photos,
      onNewFiles: setNewForCategory("photos"),
      onRemoveExisting: removeExisting("photos"),
    },
    aadhar: {
      existingUrls: existing.aadhar.urls,
      existingIds: existing.aadhar.ids,
      newFiles: newFiles.aadhar,
      onNewFiles: setNewForCategory("aadhar"),
      onRemoveExisting: removeExisting("aadhar"),
    },
    license: {
      existingUrls: existing.license.urls,
      existingIds: existing.license.ids,
      newFiles: newFiles.license,
      onNewFiles: setNewForCategory("license"),
      onRemoveExisting: removeExisting("license"),
    },
    token: {
      existingUrls: existing.token.urls,
      existingIds: existing.token.ids,
      newFiles: newFiles.token,
      onNewFiles: setNewForCategory("token"),
      onRemoveExisting: removeExisting("token"),
    },
    appendToFormData,
    reset,
    hasChanges,
    totalNewFiles,
  };
};
