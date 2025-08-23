import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'
import { logger } from '../utils/logger.js'

// 配置 Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// 配置 Cloudinary 儲存
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'others'

    // 確保 req.body 存在（在 multer 處理過程中可能為 undefined）
    if (!req.body) {
      req.body = {}
    }

    // 根據檔案欄位名稱決定資料夾
    if (file.fieldname === 'avatar') {
      folder = 'avatars'
    } else if (file.fieldname === 'image' || file.fieldname === 'images') {
      // 判斷是否為詳細頁圖片
      if (req.body.isDetailImage === 'true') {
        folder = 'memes_detail'
      } else if (req.body.type === 'announcement') {
        folder = 'announcements'
      } else {
        folder = 'memes'
      }
    }

    return {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 800, height: 600, crop: 'fill', quality: 'auto' }],
    }
  },
})

// 檔案過濾器
const fileFilter = (req, file, callback) => {
  logger.info('上傳檔案資訊:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  })

  // 檢查檔案類型
  if (file.mimetype.startsWith('image/')) {
    callback(null, true)
  } else {
    callback(new Error('只允許上傳圖片檔案'), false)
  }
}

// 檔案大小限制
const limits = { fileSize: 10 * 1024 * 1024 } // 10MB

// 建立 multer 實例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits,
})

// 單一檔案上傳
export const singleUpload = (fieldName = 'image') => {
  return upload.single(fieldName)
}

// 多檔案上傳
export const arrayUpload = (fieldName = 'images', maxCount = 5) => {
  return upload.array(fieldName, maxCount)
}

// 上傳單一圖片（通用）
export const uploadImage = singleUpload('image')

// 上傳頭像
export const uploadAvatar = singleUpload('avatar')

// 上傳多張圖片
export const uploadImages = arrayUpload('images', 5)

// 上傳公告圖片
export const uploadAnnouncementImage = (req, res, next) => {
  // 在 multer 處理之前確保 req.body 存在
  if (!req.body) {
    req.body = {}
  }

  // 設定類型為公告
  req.body.type = 'announcement'

  // 使用 multer 處理檔案上傳
  return singleUpload('image')(req, res, (err) => {
    if (err) {
      logger.error('公告圖片上傳錯誤:', err)
      return next(err)
    }

    // multer 處理完成後，再次確保 req.body 存在
    if (!req.body) {
      req.body = {}
    }

    // 重新設定類型（因為 multer 可能會重置 req.body）
    req.body.type = 'announcement'

    next()
  })
}

// 刪除圖片
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId)
    logger.info('Cloudinary 刪除結果:', result)

    if (result.result === 'ok') {
      logger.info('成功刪除 Cloudinary 檔案:', publicId)
      return result
    } else {
      logger.warn('刪除失敗:', { publicId, result: result.result })
      throw new Error(`刪除失敗: ${result.result}`)
    }
  } catch (error) {
    logger.error('刪除圖片失敗:', error)
    throw error
  }
}

// 從 URL 提取 public_id 並刪除
export const deleteImageByUrl = async (imageUrl) => {
  if (!imageUrl) {
    logger.info('沒有提供圖片 URL')
    return
  }

  logger.info('準備刪除的圖片 URL:', imageUrl)

  try {
    const publicId = extractPublicIdFromUrl(imageUrl)
    logger.info('提取的 public_id:', publicId)

    if (publicId) {
      return await deleteImage(publicId)
    } else {
      logger.warn('無法提取 public_id，跳過刪除:', imageUrl)
      return null
    }
  } catch (error) {
    logger.error('刪除 Cloudinary 檔案失敗:', { error, imageUrl })
    throw error
  }
}

// 取得圖片 URL（帶轉換選項）
export const getImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 800,
    height: 600,
    crop: 'fill',
    quality: 'auto',
  }

  const finalOptions = { ...defaultOptions, ...options }
  return cloudinary.url(publicId, finalOptions)
}

// 輔助函數：從 Cloudinary URL 提取 public_id
function extractPublicIdFromUrl(url) {
  // 例如：https://res.cloudinary.com/xxx/image/upload/v1234567890/folder/image.jpg
  const parts = url.split('/')
  const uploadIndex = parts.indexOf('upload')
  if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
    // 跳過版本號，取得 public_id
    return parts
      .slice(uploadIndex + 2)
      .join('/')
      .replace(/\.[^/.]+$/, '')
  }
  return null
}

// 上傳處理中間件（包含錯誤處理）
export const uploadMiddleware = (uploadFunction) => {
  return (req, res, next) => {
    logger.info('=== 上傳中間件開始 ===')
    logger.info('請求方法:', req.method)
    logger.info('請求路徑:', req.path)
    logger.info('Content-Type:', req.get('Content-Type'))

    uploadFunction(req, res, (err) => {
      logger.info('=== multer 處理完成 ===')
      logger.info('錯誤:', err)
      logger.info('處理後的 req.file:', req.file)
      logger.info('處理後的 req.files:', req.files)

      if (err) {
        logger.error('=== 上傳錯誤詳情 ===')
        logger.error('錯誤類型:', err.code)
        logger.error('錯誤訊息:', err.message)

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: '檔案大小不能超過 10MB',
            error: err.message,
            code: err.code,
          })
        }

        if (err.message === '只允許上傳圖片檔案') {
          return res.status(400).json({
            success: false,
            message: '只允許上傳圖片檔案',
            error: err.message,
            code: err.code,
          })
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: `意外的檔案欄位`,
            error: err.message,
            code: err.code,
          })
        }

        return res.status(400).json({
          success: false,
          message: err.message,
          error: err.message,
          code: err.code,
        })
      }

      logger.info('=== 上傳成功 ===')
      if (req.file) {
        logger.info('上傳圖片成功:', req.file.path)
      } else if (req.files) {
        logger.info('上傳多張圖片成功:', req.files.length, '張')
      }

      next()
    })
  }
}

// 導出所有功能
export default {
  singleUpload,
  arrayUpload,
  uploadImage,
  uploadAvatar,
  uploadImages,
  uploadAnnouncementImage,
  deleteImage,
  deleteImageByUrl,
  getImageUrl,
  uploadMiddleware,
}
