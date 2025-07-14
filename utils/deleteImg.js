import { v2 as cloudinary } from 'cloudinary'

export const deleteCloudinaryImage = async (imageUrl) => {
    
  if (!imageUrl) {
    console.log('沒有提供圖片 URL')
    return
  }

  console.log('準備刪除的圖片 URL:', imageUrl)

  try {
    const publicId = extractPublicIdFromUrl(imageUrl)
    console.log('提取的 public_id:', publicId)

    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId)
      console.log('Cloudinary 刪除結果:', result)

      if (result.result === 'ok') {
        console.log(`成功刪除 Cloudinary 檔案: ${publicId}`)
      } else {
        console.log(`刪除失敗，結果: ${result.result}`)
      }
    } else {
      console.log('無法提取 public_id，跳過刪除')
    }
  } catch (error) {
    console.error('刪除 Cloudinary 檔案失敗:', error)
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
