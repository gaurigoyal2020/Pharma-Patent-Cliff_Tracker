// services/api.js
import axios from 'axios';

// ── Axios instances ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const ML_API = axios.create({
  baseURL: import.meta.env.VITE_ML_API_URL || 'http://localhost:5001',
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (email, password) =>
  api.post('/auth/register', { email, password }).then(r => r.data);

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

// ── User profile ──────────────────────────────────────────────────────────────
export const getUserProfile = () =>
  api.get('/auth/me').then(r => r.data);

// ── Watchlist ─────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's watchlist.
 * Returns: { success, count, data: WatchlistEntry[] }
 */
export const getWatchlist = () =>
  api.get('/users/watchlist').then(r => r.data);

/**
 * Add a drug to the watchlist.
 * @param {{ drug_name, generic_name, patent_expiry, dosage_form?, category? }} entry
 * Returns: { success, data: WatchlistEntry }
 */
export const addWatchlistEntry = (entry) =>
  api.post('/users/watchlist', entry).then(r => r.data);

/**
 * Remove a watchlist entry by id.
 * Returns: { success, message }
 */
export const removeWatchlistEntry = (id) =>
  api.delete(`/users/watchlist/${id}`).then(r => r.data);

// ── Alerts ────────────────────────────────────────────────────────────────────

/**
 * Fetch all alerts for the authenticated user.
 * Returns: { success, count, data: Alert[] }
 */
export const getAlerts = () =>
  api.get('/users/alerts').then(r => r.data);

/**
 * Mark a single alert as read.
 * Returns: { success, message }
 */
export const markAlertRead = (id) =>
  api.patch(`/users/alerts/${id}/read`).then(r => r.data);

/**
 * Dismiss (delete) a single alert.
 * Returns: { success, message }
 */
export const dismissAlert = (id) =>
  api.delete(`/users/alerts/${id}`).then(r => r.data);

// ── Drugs ─────────────────────────────────────────────────────────────────────
export const searchDrugs = (query) =>
  api.get(`/drugs/search?q=${encodeURIComponent(query)}`).then(r => r.data);

export const getDrugDetails = (drugId) =>
  api.get(`/drugs/${drugId}`).then(r => r.data);

/**
 * Send raw OCR text to the backend, which tokenises it and looks up
 * matching drug names in the database. Returns { success, drugName } or
 * throws on a non-2xx response.
 */
export const matchDrugFromOCR = (text) =>
  api.post('/drugs/match', { text }).then(r => r.data);

// ── Diseases ──────────────────────────────────────────────────────────────────
export const getDiseases = () =>
  api.get('/diseases').then(r => r.data);

export const getDrugsByDisease = (disease) =>
  api.get(`/diseases/${encodeURIComponent(disease)}/drugs`).then(r => r.data);

// ── ML / Predictions ──────────────────────────────────────────────────────────
export const predictGenericLaunch = (drugData) =>
  ML_API.post('/predict', drugData).then(r => r.data);

export const getModelInsights = () =>
  ML_API.get('/insights').then(r => r.data);

export const getBatchPredictions = (drugs) =>
  ML_API.post('/predict/batch', { drugs }).then(r => r.data);

export default api;