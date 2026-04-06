import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";

/**
 * useDrivers
 *
 * Manages paginated driver list with:
 *  - Server-side search (debounced)
 *  - Real-time Socket.IO sync
 *  - Optimistic deletes
 */
export const useDrivers = () => {
  const { on } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const fetchDrivers = useCallback(async (pg = 1, q = "") => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/drivers", {
        params: { page: pg, limit: 15, search: q || undefined },
      });
      setDrivers(data.drivers);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pg);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load drivers";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDrivers(1, "");
  }, [fetchDrivers]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchDrivers(1, search);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchDrivers]);

  // Real-time socket updates
  useEffect(() => {
    const unsubs = [
      on("driver:created", ({ driver }) => {
        setDrivers((prev) => {
          // Avoid duplicate if we already have it
          if (prev.some((d) => d._id === driver._id)) return prev;
          return [driver, ...prev];
        });
        setTotal((t) => t + 1);
        toast.success(`New driver added: ${driver.tokenNo}`, { icon: "🆕", id: driver._id });
      }),

      on("driver:updated", ({ driver }) => {
        setDrivers((prev) =>
          prev.map((d) => (d._id === driver._id ? { ...d, ...driver } : d))
        );
      }),

      on("driver:deleted", ({ driverId, tokenNo }) => {
        setDrivers((prev) => prev.filter((d) => d._id !== driverId));
        setTotal((t) => Math.max(0, t - 1));
        toast(`Driver ${tokenNo} removed`, { icon: "🗑️", id: driverId });
      }),
    ];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [on]);

  const deleteDriver = useCallback(async (id) => {
    // Optimistic update
    const prev = drivers;
    setDrivers((d) => d.filter((x) => x._id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await api.delete(`/drivers/${id}`);
      toast.success("Driver deleted");
    } catch (err) {
      // Rollback
      setDrivers(prev);
      setTotal((t) => t + 1);
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }, [drivers]);

  return {
    drivers,
    total,
    page,
    pages,
    search,
    loading,
    error,
    setSearch,
    fetchDrivers,
    deleteDriver,
    refresh: () => fetchDrivers(page, search),
  };
};
