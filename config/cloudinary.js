import { v2 as cloudinary } from 'cloudinary'

console.log('=== Cloudinary 配置檢查 ===')
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME)
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '已設定' : '未設定')
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '已設定' : '未設定')

// 檢查環境變數是否完整
const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  console.error('=== Cloudinary 配置錯誤 ===')
  console.error('缺少必要的環境變數:')
  console.error('- CLOUDINARY_CLOUD_NAME:', cloudName ? '已設定' : '未設定')
  console.error('- CLOUDINARY_API_KEY:', apiKey ? '已設定' : '未設定')
  console.error('- CLOUDINARY_API_SECRET:', apiSecret ? '已設定' : '未設定')
  throw new Error('Cloudinary 配置不完整，請檢查環境變數')
}

console.log('=== Cloudinary 配置成功 ===')

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
})

export default cloudinary
