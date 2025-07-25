import { StatusCodes } from 'http-status-codes'

export const uploadImage = async (req, res) => {
  try {
    console.log('req.file:', req.file)
    console.log('req.body:', req.body)
    console.log('送出前的 image_url:', req.file.path)
    if (!req.file || !req.file.path) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有收到圖片檔案',
      })
    }
    // Cloudinary Storage 已經自動上傳，req.file.path 就是雲端圖片網址
    return res.json({
      success: true,
      url: req.file.path,
    })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    })
  }
}
