import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到圖片檔案',
      })
    }

    if (!req.file.path) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '檔案路徑不存在',
      })
    }

    // Cloudinary Storage 已經自動上傳，req.file.path 就是雲端圖片網址
    return res.json({
      success: true,
      url: req.file.path,
    })
  } catch (error) {
    logger.error('上傳控制器錯誤:', error.message)

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '上傳處理時發生錯誤',
    })
  }
}

// 多檔案上傳處理
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到圖片檔案',
      })
    }

    // 檢查所有檔案是否有路徑
    const invalidFiles = req.files.filter((file) => !file.path)
    if (invalidFiles.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '部分檔案路徑不存在',
      })
    }

    // 回傳所有檔案的資訊
    const fileInfos = req.files.map((file) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    }))

    return res.json({
      success: true,
      files: fileInfos,
      count: req.files.length,
    })
  } catch (error) {
    logger.error('多檔案上傳控制器錯誤:', error.message)

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '多檔案上傳處理時發生錯誤',
    })
  }
}
