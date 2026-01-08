import axios from 'axios'

/**
 * Axios instance dengan konfigurasi default
 * - withCredentials: true untuk mengirim cookies (session auth)
 * - baseURL dari environment variable
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
