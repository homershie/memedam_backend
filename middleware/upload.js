import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { StatusCodes } from 'http-status-codes'

// 設定 Cloudinary 的 config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// 上傳設定
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
  }),
  // req = 請求資訊
  // file = 檔案資訊
  // callback(錯誤, 是否允許上傳)
  fileFilter: (req, file, callback) => {
    console.log('上傳檔案的資訊', file)
    // 檢查上傳的檔案是否為 JPEG 或 PNG 格式
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      callback(null, true)
    } else {
      callback(new Error('請上傳 JPEG 或 PNG 格式的圖片'), false)
    }
  },
  limits: {
    fileSize: 1024 * 1024, // 限制上傳檔案大小為 1MB
  },
})

export default (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    // 檢查是否上傳圖片，如果上傳圖片有錯誤，則回傳錯誤訊息
    if (err) {
      // 處理檔案大小錯誤
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '檔案大小不能超過 1MB',
        })
      }
      // 處理檔案格式錯誤
      if (err.message === '請上傳 JPEG 或 PNG 格式的圖片') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請上傳 JPEG 或 PNG 格式的圖片',
        })
      }
      // 處理其他錯誤
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: err.message,
      })
    }
    // 如果沒有上傳圖片，則回傳錯誤訊息
    // if (!req.file) {
    //   return res.status(StatusCodes.BAD_REQUEST).json({
    //     success: false,
    //     message: '請上傳圖片',
    //   })
    // }
    // 繼續下一步
    console.log('上傳圖片成功：', req.file)
    next()
  })
}
