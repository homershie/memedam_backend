import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { StatusCodes } from 'http-status-codes'
import '../config/cloudinary.js'

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'others'
    if (file.fieldname === 'avatar') {
      folder = 'avatars'
    } else if (file.fieldname === 'image' || file.fieldname === 'images') {
      // 判斷是否為詳細頁圖片
      if (req.body && req.body.isDetailImage === 'true') {
        folder = 'memes_detail'
      } else {
        folder = 'memes'
      }
    }
    return { folder }
  },
})

const fileFilter = (req, file, callback) => {
  console.log('上傳檔案的資訊', file)
  // 支援 JPG, PNG, GIF, WebP
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    callback(null, true)
  } else {
    callback(new Error('請上傳 JPG、PNG、GIF 或 WebP 格式的圖片'), false)
  }
}

const limits = { fileSize: 1024 * 1024 * 10 } // 10MB

export const singleUpload =
  (fieldName = 'image') =>
  (req, res, next) => {
    multer({ storage, fileFilter, limits }).single(fieldName)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '檔案大小不能超過 10MB',
          })
        }
        if (err.message === '請上傳 JPG、PNG、GIF 或 WebP 格式的圖片') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '請上傳 JPG、PNG、GIF 或 WebP 格式的圖片',
          })
        }
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: err.message,
        })
      }
      console.log('上傳圖片成功：', req.file)
      next()
    })
  }

export const arrayUpload =
  (fieldName = 'images', maxCount = 5) =>
  (req, res, next) => {
    multer({ storage, fileFilter, limits }).array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '檔案大小不能超過 10MB',
          })
        }
        if (err.message === '請上傳 JPG、PNG、GIF 或 WebP 格式的圖片') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '請上傳 JPG、PNG、GIF 或 WebP 格式的圖片',
          })
        }
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: err.message,
        })
      }
      console.log('上傳多張圖片成功：', req.files)
      next()
    })
  }
