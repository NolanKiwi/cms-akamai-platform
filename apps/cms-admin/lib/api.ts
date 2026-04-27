import axios from 'axios';
import Cookies from 'js-cookie';

const TOKEN_KEY = 'cms_token';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:17000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove(TOKEN_KEY);
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  },
);

export const setToken = (token: string) => Cookies.set(TOKEN_KEY, token, { expires: 7, secure: false });
export const clearToken = () => Cookies.remove(TOKEN_KEY);
export const getToken = () => Cookies.get(TOKEN_KEY);
