import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'
import User from '../models/User.js'
import { deleteImageByUrl } from '../services/uploadService.js'

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

// 頭像上傳處理
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到頭像檔案',
      })
    }

    if (!req.file.path) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '檔案路徑不存在',
      })
    }

    // 獲取用戶ID（從JWT中間件設置的req.user）
    const userId = req.user._id || req.user.id
    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '無法獲取用戶資訊',
      })
    }

    // 確保 userId 是有效的 ObjectId
    const mongoose = (await import('mongoose')).default
    const ObjectId = mongoose.Types.ObjectId
    let finalUserId = userId

    // 如果 userId 不是 ObjectId，嘗試轉換
    if (!(userId instanceof ObjectId)) {
      try {
        finalUserId = new ObjectId(String(userId))
      } catch (error) {
        logger.error(`無效的用戶ID格式: ${userId}`, error)
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的用戶ID格式',
        })
      }
    }

    logger.info(`頭像上傳 - 原始用戶ID: ${userId}, 類型: ${typeof userId}`)
    logger.info(`頭像上傳 - 最終用戶ID: ${finalUserId}, 類型: ${typeof finalUserId}`)

    // Cloudinary Storage 已經自動上傳，req.file.path 就是雲端圖片網址
    const avatarUrl = req.file.path
    logger.info(`頭像上傳 - 頭像URL: ${avatarUrl}`)

    // 先檢查用戶是否存在
    const existingUser = await User.findById(finalUserId)
    if (!existingUser) {
      logger.error(`用戶不存在: ${finalUserId}`)
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    logger.info(`找到用戶: ${existingUser.username}, 當前頭像: ${existingUser.avatar}`)

    // 如果用戶已有頭像且為 Cloudinary URL，刪除舊圖片
    if (existingUser.avatar && existingUser.avatar.includes('cloudinary.com')) {
      try {
        logger.info(`刪除舊頭像: ${existingUser.avatar}`)
        await deleteImageByUrl(existingUser.avatar)
        logger.info('舊頭像刪除成功')
      } catch (deleteError) {
        logger.error('刪除舊頭像失敗:', deleteError)
        // 不中斷上傳流程，只記錄錯誤
      }
    }

    // 更新用戶的頭像欄位
    let updatedUser
    try {
      updatedUser = await User.findByIdAndUpdate(
        finalUserId,
        { avatar: avatarUrl },
        { new: true, runValidators: true, upsert: false },
      )

      logger.info(`用戶 ${finalUserId} 頭像更新成功: ${avatarUrl}`)
      logger.info(`更新後的用戶 avatar: ${updatedUser?.avatar}`)
    } catch (updateError) {
      logger.error(`更新用戶頭像失敗: ${updateError.message}`)
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '更新用戶頭像失敗',
        error: updateError.message,
      })
    }

    if (!updatedUser) {
      logger.error(`找不到用戶: ${finalUserId}`)
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    // 雙重驗證：確保更新真的成功了
    if (updatedUser.avatar !== avatarUrl) {
      logger.error(`頭像更新驗證失敗: 期望 ${avatarUrl}, 實際 ${updatedUser.avatar}`)
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '頭像更新驗證失敗',
      })
    }

    return res.json({
      success: true,
      url: avatarUrl,
      message: '頭像上傳並更新成功',
    })
  } catch (error) {
    logger.error('頭像上傳控制器錯誤:', error.message)

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '頭像上傳處理時發生錯誤',
    })
  }
}
