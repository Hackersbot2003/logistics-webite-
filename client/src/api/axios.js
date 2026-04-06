import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: "/api",
  timeout: 60000, // 60s for large uploads
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ds_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ds_token");
      localStorage.removeItem("ds_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
