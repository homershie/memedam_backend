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

// 橫式圖片尺寸轉換設定
export const IMAGE_SIZES = {
  s: {
    width: 320,
    height: 240,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '小',
    description: '適合插圖或內嵌小圖',
  },
  m: {
    width: 640,
    height: 480,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '中',
    description: '一般內容圖，清楚又不撐版',
  },
  l: {
    width: 960,
    height: 720,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '大',
    description: '接近滿欄寬，適合重點圖',
  },
  full: {
    width: '100%',
    height: 'auto',
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '滿版',
    description: '自適應容器寬度',
  },
}

// 直式圖片尺寸設定
export const IMAGE_SIZES_PORTRAIT = {
  s: {
    width: 240,
    height: 320,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '小',
    description: '240×320，適合手機',
  },
  m: {
    width: 480,
    height: 640,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '中',
    description: '480×640，一般內容',
  },
  l: {
    width: 720,
    height: 960,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
    name: '大',
    description: '720×960，重點圖片',
  },
}

// 配置 Cloudinary 儲存
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'others'

    // 確保 req.body 存在（在 multer 處理過程中可能為 undefined）
    if (!req.body) {
      req.body = {}
    }

    // 優先從 req.body 獲取參數，如果沒有則從 req.query 獲取
    const isDetailImage = req.body.isDetailImage || req.query.isDetailImage
    const memeId = req.body.memeId || req.query.memeId

    // 根據檔案欄位名稱決定資料夾
    if (file.fieldname === 'avatar') {
      folder = 'avatars'
    } else if (file.fieldname === 'cover_image') {
      folder = 'cover_images'
    } else if (file.fieldname === 'image' || file.fieldname === 'images') {
      // 判斷是否為詳細頁圖片
      if (isDetailImage === 'true') {
        // 如果有 memeId，則使用子資料夾結構
        if (memeId) {
          folder = `memes_detail/${memeId}`
        } else {
          folder = 'memes_detail'
        }
      } else if (req.body.type === 'announcement') {
        folder = 'announcements'
      } else {
        folder = 'memes'
      }
    }

    // 根據檔案類型設定不同的轉換
    let transformation = [{ quality: 'auto', format: 'auto' }]

    if (file.fieldname === 'avatar') {
      // 頭像：保持正方形比例，最大邊長400px
      transformation = [
        {
          width: 400,
          height: 400,
          crop: 'fill',
          gravity: 'face', // 優先保留人臉區域
          quality: 'auto',
          format: 'auto',
        },
      ]
    } else {
      // 其他圖片：使用適當的尺寸
      transformation = [
        {
          width: 1200,
          height: 900,
          crop: 'limit', // 不裁剪，保持完整圖片
          quality: 'auto',
          format: 'auto',
        },
      ]
    }

    // 檢查是否有動態上傳參數（優先級最高）
    if (req.uploadFolder) {
      folder = req.uploadFolder
    }
    if (req.uploadTransformation && Array.isArray(req.uploadTransformation)) {
      transformation = req.uploadTransformation
    }

    const result = {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation,
    }

    // 如果有動態 public_id，加入結果
    if (req.uploadPublicId) {
      result.public_id = req.uploadPublicId
    }

    return result
  },
})

// 檔案過濾器
const fileFilter = (req, file, callback) => {
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

// 處理多檔案上傳並保留文字欄位
export const uploadImagesWithFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'image', maxCount: 1 },
])

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

// 上傳封面圖片
export const uploadCoverImage = singleUpload('cover_image')

// 上傳多張圖片
export const uploadImages = arrayUpload('images', 5)

// 處理迷因創建的上傳（支援檔案 + 表單資料）
export const uploadMemeData = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'image', maxCount: 1 },
])

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

    // 處理 JSON 內容：如果 content 是字串且看起來像是 JSON，則解析它
    if (req.body.content && typeof req.body.content === 'string') {
      try {
        // 檢查是否是 JSON 格式的內容（檢查是否有 JSON 特徵）
        const contentStr = req.body.content.trim()
        if (
          contentStr.startsWith('{') ||
          contentStr.startsWith('[') ||
          contentStr.includes('"type":') ||
          contentStr.includes('"content":')
        ) {
          const parsedContent = JSON.parse(contentStr)
          req.body.content = parsedContent
          logger.info('成功解析 JSON 內容格式')
        }
      } catch (error) {
        // 如果解析失敗，保持原字串格式（可能是純文字）
        logger.info('內容保持為字串格式（非 JSON）:', error.message)
      }
    }

    next()
  })
}

// 從內容中提取圖片URL
export const extractImageUrlsFromContent = (content) => {
  const imageUrls = []

  if (!content || typeof content !== 'object') {
    return imageUrls
  }

  // 遞歸遍歷JSON結構，查找image節點
  const traverseContent = (node) => {
    if (!node || typeof node !== 'object') return

    // 如果是image節點，提取src
    if (node.type === 'image' && node.attrs && node.attrs.src) {
      const src = node.attrs.src
      if (src && typeof src === 'string' && !imageUrls.includes(src)) {
        imageUrls.push(src)
      }
    }

    // 如果有content陣列，遞歸處理
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverseContent)
    }

    // 如果有子節點，遞歸處理
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverseContent)
    }
  }

  traverseContent(content)
  return imageUrls
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

// 根據尺寸和方向取得圖片 URL
export const getImageUrlBySize = (publicId, size = 'm', orientation = 'landscape') => {
  const sizeConfig =
    orientation === 'portrait'
      ? IMAGE_SIZES_PORTRAIT[size] || IMAGE_SIZES_PORTRAIT.m
      : IMAGE_SIZES[size] || IMAGE_SIZES.m

  // 如果是滿版且是橫式，直接返回原始 URL
  if (size === 'full' && orientation === 'landscape') {
    return cloudinary.url(publicId, {
      quality: 'auto',
      format: 'auto',
      dpr: 'auto',
    })
  }

  return cloudinary.url(publicId, {
    width: sizeConfig.width,
    height: sizeConfig.height,
    crop: sizeConfig.crop,
    quality: sizeConfig.quality,
    format: sizeConfig.format,
    dpr: sizeConfig.dpr,
  })
}

// 取得圖片 srcset（支援響應式）
export const getImageSrcset = (publicId) => {
  const sizes = ['s', 'm', 'l']
  const srcset = sizes
    .map((size) => {
      const url = getImageUrlBySize(publicId, size)
      const width = IMAGE_SIZES[size].width
      return `${url} ${width}w`
    })
    .join(', ')

  return srcset
}

// 輔助函數：從 Cloudinary URL 提取 public_id
function extractPublicIdFromUrl(url) {
  // 例如：https://res.cloudinary.com/xxx/image/upload/v1234567890/folder/image.jpg
  // 或者：https://res.cloudinary.com/xxx/image/upload/folder/image.jpg
  const parts = url.split('/')
  const uploadIndex = parts.indexOf('upload')
  if (uploadIndex !== -1 && uploadIndex + 1 < parts.length) {
    // 檢查下一個部分是否為版本號（以 v 開頭）
    const nextPart = parts[uploadIndex + 1]
    const startIndex = nextPart && nextPart.startsWith('v') ? uploadIndex + 2 : uploadIndex + 1

    if (startIndex < parts.length) {
      return parts
        .slice(startIndex)
        .join('/')
        .replace(/\.[^/.]+$/, '')
    }
  }
  return null
}

// 上傳處理中間件（包含錯誤處理）
export const uploadMiddleware = (uploadFunction) => {
  return (req, res, next) => {
    uploadFunction(req, res, (err) => {
      if (err) {
        logger.error('上傳錯誤:', err.message)

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
  uploadCoverImage,
  uploadImages,
  uploadAnnouncementImage,
  deleteImage,
  deleteImageByUrl,
  extractImageUrlsFromContent,
  getImageUrl,
  uploadMiddleware,
}
