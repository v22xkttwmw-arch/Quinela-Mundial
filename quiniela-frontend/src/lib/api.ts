import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // withCredentials envía la cookie HttpOnly en cada request cross-origin
  withCredentials: true,
});

// Fallback para iOS Safari: ITP bloquea las cookies cross-site (Vercel ↔
// Railway) incluso con SameSite=None; Secure. Si hay un token guardado en
// localStorage, lo mandamos también como Authorization header — el backend
// lo prioriza sobre la cookie (ver deps.py get_current_user).
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
