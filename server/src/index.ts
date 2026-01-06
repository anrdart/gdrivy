import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { metadataRouter } from './routes/metadata.js'
import { downloadRouter } from './routes/download.js'
import { folderRouter } from './routes/folder.js'
import { errorHandler } from './middleware/errorHandler.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS configuration for Google Drive API proxy
const corsOptions: cors.CorsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Disposition', 'X-Download-Progress'],
  credentials: true,
  maxAge: 86400, // 24 hours
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Routes
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
