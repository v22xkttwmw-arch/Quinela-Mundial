import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // withCredentials envía la cookie HttpOnly en cada request cross-origin
  withCredentials: true,
});

export default api;
