import { v2 as cloudinary } from 'cloudinary'
import { logger } from './logger.js'

export const deleteCloudinaryImage = async (imageUrl) => {
    
  if (!imageUrl) {
    logger.info('沒有提供圖片 URL')
    return
  }

  logger.info({ imageUrl }, '準備刪除的圖片 URL')

  try {
    const publicId = extractPublicIdFromUrl(imageUrl)
    logger.info({ publicId }, '提取的 public_id')

    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId)
      logger.info({ result }, 'Cloudinary 刪除結果')

      if (result.result === 'ok') {
        logger.info({ publicId }, '成功刪除 Cloudinary 檔案')
      } else {
        logger.warn({ publicId, result: result.result }, '刪除失敗')
      }
    } else {
      logger.warn({ imageUrl }, '無法提取 public_id，跳過刪除')
    }
  } catch (error) {
    logger.error({ error, imageUrl }, '刪除 Cloudinary 檔案失敗')
    throw error
  }
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
