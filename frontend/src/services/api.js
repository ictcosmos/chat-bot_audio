import axios from 'axios'
import { auth } from './firebase'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser

  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      auth.signOut()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export const chatAPI = {
  send: (data) => api.post('/chat', data),
  listChats: () => api.get('/chats'),
  searchChats: (q) => api.get(`/chats/search?q=${encodeURIComponent(q)}`),
  getChat: (chatId) => api.get(`/chats/${chatId}`),
  createChat: (data) => api.post('/chats', data),
  updateChat: (chatId, data) => api.patch(`/chats/${chatId}`, data),
  deleteChat: (chatId) => api.delete(`/chats/${chatId}`),
}

export const fileAPI = {
  upload: (formData) =>
    api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  list: () => api.get('/files'),

  delete: (fileId) => api.delete(`/files/${fileId}`),
}

export const voiceAPI = {
  transcribe: (formData) =>
    api.post('/voice/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  respond: (formData) =>
    api.post('/voice/respond', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  status: () => api.get('/voice/status'),

  preload: () => api.post('/voice/preload'),
}

export const driveAPI = {
  getAuthUrl: () => api.get('/drive/auth-url'),

  callback: (code) => api.get(`/drive/callback?code=${code}`),

  listFiles: (accessToken, query = '') =>
    api.get(`/drive/files?access_token=${accessToken}&query=${encodeURIComponent(query)}`),

  importFile: (data) => api.post('/drive/import', data),
}

export const authAPI = {
  verify: () => api.post('/auth/verify'),
  me: () => api.get('/auth/me'),
}

export default api