// Load .env first before any other imports that might use env vars
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { metadataRouter } from './routes/metadata.js'
import { downloadRouter } from './routes/download.js'
import { folderRouter } from './routes/folder.js'
import { authRouter } from './routes/auth.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001

// CORS configuration for Google Drive API proxy
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Disposition', 'X-Download-Progress'],
  credentials: true,
  maxAge: 86400, // 24 hours
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Session configuration - tokens stored server-side, not in localStorage
app.use(session({
  secret: process.env.SESSION_SECRET || 'rahasia',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  name: 'gdrive.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax', // CSRF protection
  },
}))

// Routes
app.use('/api/auth', authRouter)
app.use('/api/metadata', metadataRouter)
app.use('/api/download', downloadRouter)
app.use('/api/folder', folderRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
