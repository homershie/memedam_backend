import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'

export const uploadImage = async (req, res) => {
  try {
    logger.info('=== 上傳控制器開始 ===')
    logger.info('req.file:', req.file)
    logger.info('req.files:', req.files)
    logger.info('請求標頭:', req.headers)

    if (!req.file) {
      logger.warn('req.file 不存在')
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到圖片檔案',
        debug: {
          hasFile: !!req.file,
          hasFiles: !!req.files,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.get('Content-Type'),
        },
      })
    }

    if (!req.file.path) {
      logger.warn('req.file.path 不存在')
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '檔案路徑不存在',
        debug: {
          fileInfo: req.file,
          hasPath: !!req.file.path,
        },
      })
    }

    logger.info('=== 上傳成功 ===')
    logger.info('送出前的 image_url:', req.file.path)
    logger.info('檔案資訊:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    })

    // Cloudinary Storage 已經自動上傳，req.file.path 就是雲端圖片網址
    return res.json({
      success: true,
      url: req.file.path,
      fileInfo: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      },
    })
  } catch (error) {
    logger.error('=== 上傳控制器錯誤 ===')
    logger.error('錯誤:', error)
    logger.error('錯誤堆疊:', error.stack)

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '上傳處理時發生錯誤',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

// 多檔案上傳處理
export const uploadImages = async (req, res) => {
  try {
    logger.info('=== 多檔案上傳控制器開始 ===')
    logger.info('req.files:', req.files)

    if (!req.files || req.files.length === 0) {
      logger.warn('req.files 不存在或為空')
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到圖片檔案',
        debug: {
          hasFiles: !!req.files,
          filesLength: req.files ? req.files.length : 0,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.get('Content-Type'),
        },
      })
    }

    // 檢查所有檔案是否有路徑
    const invalidFiles = req.files.filter((file) => !file.path)
    if (invalidFiles.length > 0) {
      logger.warn('部分檔案路徑不存在:', invalidFiles)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '部分檔案路徑不存在',
        debug: {
          invalidFiles: invalidFiles.map((f) => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
          })),
        },
      })
    }

    logger.info('=== 多檔案上傳成功 ===')
    logger.info('上傳檔案數量:', req.files.length)

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
    logger.error('=== 多檔案上傳控制器錯誤 ===')
    logger.error('錯誤:', error)
    logger.error('錯誤堆疊:', error.stack)

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '多檔案上傳處理時發生錯誤',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
