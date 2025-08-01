import { StatusCodes } from 'http-status-codes'

export const uploadImage = async (req, res) => {
  try {
    console.log('=== 上傳控制器開始 ===')
    console.log('req.file:', req.file)
    console.log('req.body:', req.body)
    console.log('req.files:', req.files)
    console.log('請求標頭:', req.headers)

    if (!req.file) {
      console.log('req.file 不存在')
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
      console.log('req.file.path 不存在')
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '檔案路徑不存在',
        debug: {
          fileInfo: req.file,
          hasPath: !!req.file.path,
        },
      })
    }

    console.log('=== 上傳成功 ===')
    console.log('送出前的 image_url:', req.file.path)
    console.log('檔案資訊:', {
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
      },
    })
  } catch (error) {
    console.log('=== 上傳控制器錯誤 ===')
    console.log('錯誤:', error)
    console.log('錯誤堆疊:', error.stack)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
