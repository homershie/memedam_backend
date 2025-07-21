import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { StatusCodes } from 'http-status-codes'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'others'
    if (file.fieldname === 'avatar') {
      folder = 'avatars'
    } else if (file.fieldname === 'image' || file.fieldname === 'images') {
      folder = 'memes'
    }
    return { folder }
  },
})

const fileFilter = (req, file, callback) => {
  console.log('上傳檔案的資訊', file)
  if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
    callback(null, true)
  } else {
    callback(new Error('請上傳 JPEG 或 PNG 格式的圖片'), false)
  }
}

const limits = { fileSize: 1024 * 1024 } // 1MB

export const singleUpload =
  (fieldName = 'image') =>
  (req, res, next) => {
    multer({ storage, fileFilter, limits }).single(fieldName)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '檔案大小不能超過 1MB',
          })
        }
        if (err.message === '請上傳 JPEG 或 PNG 格式的圖片') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '請上傳 JPEG 或 PNG 格式的圖片',
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
            message: '檔案大小不能超過 1MB',
          })
        }
        if (err.message === '請上傳 JPEG 或 PNG 格式的圖片') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: '請上傳 JPEG 或 PNG 格式的圖片',
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
