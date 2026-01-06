import type { Request, Response, NextFunction } from 'express'
import { GoogleDriveError, ErrorCode } from '../services/googleDrive.js'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

// User-friendly error messages with suggested actions
const errorMessages: Record<string, { message: string; suggestion: string }> = {
  [ErrorCode.INVALID_LINK]: {
    message: 'Link tidak valid. Pastikan link berasal dari Google Drive.',
    suggestion: 'Coba paste ulang link dari Google Drive',
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    message: 'File tidak ditemukan atau sudah dihapus.',
    suggestion: 'Periksa kembali link atau hubungi pemilik file',
  },
  [ErrorCode.ACCESS_DENIED]: {
    message: 'File ini bersifat private atau memerlukan izin akses.',
    suggestion: 'Minta pemilik file untuk mengubah pengaturan sharing',
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    message: 'Kuota download Google Drive telah habis.',
    suggestion: 'Coba lagi dalam beberapa jam atau gunakan akun berbeda',
  },
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Koneksi internet bermasalah.',
    suggestion: 'Periksa koneksi internet dan coba lagi',
  },
  [ErrorCode.DOWNLOAD_FAILED]: {
    message: 'Download gagal.',
    suggestion: 'Klik tombol retry untuk mencoba lagi',
  },
  [ErrorCode.API_ERROR]: {
    message: 'Terjadi kesalahan pada server.',
    suggestion: 'Coba lagi dalam beberapa saat',
  },
}

export const errorHandler = (
  err: AppError | GoogleDriveError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500
  let code = 'INTERNAL_ERROR'
  let message = 'An unexpected error occurred'
  let suggestion: string | undefined

  if (err instanceof GoogleDriveError) {
    statusCode = err.statusCode
    code = err.code
    const errorInfo = errorMessages[err.code]
    message = errorInfo?.message || err.message
    suggestion = errorInfo?.suggestion
  } else if (err.statusCode) {
    statusCode = err.statusCode
    code = err.code || 'INTERNAL_ERROR'
    message = err.message
  }
  
  console.error(`[Error] ${code}: ${message}`)
  
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      suggestion,
    },
  })
}
