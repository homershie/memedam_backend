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
  console.log('檔案 MIME 類型:', file.mimetype)
  console.log('檔案名稱:', file.originalname)
  console.log('檔案大小:', file.size)
  console.log('檔案副檔名:', file.originalname.split('.').pop().toLowerCase())

  // 暫時允許所有檔案類型進行測試
  console.log('暫時允許所有檔案類型')
  callback(null, true)
}

const limits = { fileSize: 1024 * 1024 * 10 } // 10MB

export const singleUpload =
  (fieldName = 'image') =>
  (req, res, next) => {
    console.log('=== 上傳中間件開始 ===')
    console.log('期望的欄位名稱:', fieldName)
    console.log('請求方法:', req.method)
    console.log('請求路徑:', req.path)
    console.log('Content-Type:', req.get('Content-Type'))
    console.log('請求體:', req.body)
    console.log('請求檔案:', req.files)

    const upload = multer({ storage, fileFilter, limits }).single(fieldName)

    upload(req, res, (err) => {
      console.log('=== multer 處理完成 ===')
      console.log('錯誤:', err)
      console.log('處理後的 req.file:', req.file)
      console.log('處理後的 req.body:', req.body)

      if (err) {
        console.log('=== 上傳錯誤詳情 ===')
        console.log('錯誤類型:', err.code)
        console.log('錯誤訊息:', err.message)
        console.log('錯誤堆疊:', err.stack)

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'File size cannot exceed 10MB',
            error: err.message,
            code: err.code,
          })
        }
        if (err.message === 'Please upload JPG, PNG, GIF or WebP format images') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Please upload JPG, PNG, GIF or WebP format images',
            error: err.message,
            code: err.code,
          })
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: `Unexpected field. Expected field name: ${fieldName}`,
            error: err.message,
            code: err.code,
            expectedField: fieldName,
          })
        }
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: err.message,
          error: err.message,
          code: err.code,
        })
      }
      console.log('=== 上傳成功 ===')
      console.log('上傳圖片成功：', req.file)
      next()
    })
  }

export const arrayUpload =
  (fieldName = 'images', maxCount = 5) =>
  (req, res, next) => {
    multer({ storage, fileFilter, limits }).array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        console.log('上傳錯誤:', err.message)
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'File size cannot exceed 10MB',
          })
        }
        if (err.message === 'Please upload JPG, PNG, GIF or WebP format images') {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Please upload JPG, PNG, GIF or WebP format images',
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
