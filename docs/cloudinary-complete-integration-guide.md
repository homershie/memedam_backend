# Cloudinary 完整整合指南

## 概述

本指南涵蓋 MemeDam 後端系統中 Cloudinary 圖片上傳功能的完整整合過程，從初始整合到最終遷移的完整記錄。

## 整合歷程

### 階段一：初始整合（2024-12-19）

- 將分散的上傳功能整合到 `services/uploadService.js`
- 保持向後相容性
- 新增公告圖片上傳功能

### 階段二：完整遷移（2024-12-19）

- 移除舊檔案：`middleware/upload.js`、`utils/deleteImg.js`
- 更新所有相關程式碼
- 完成統一架構

## 核心架構

### 主要服務檔案

- **`services/uploadService.js`** - 統一的上傳服務
  - Cloudinary 配置
  - Multer 中間件設定
  - 檔案分類邏輯
  - 錯誤處理機制
  - 所有上傳和刪除功能

### 支援檔案

- **`controllers/uploadController.js`** - 上傳控制器
- **`config/cloudinary.js`** - Cloudinary 配置

## 功能清單

### 上傳功能

| 功能         | 函數名稱                           | 說明                      |
| ------------ | ---------------------------------- | ------------------------- |
| 單一檔案上傳 | `singleUpload(fieldName)`          | 通用單一檔案上傳          |
| 多檔案上傳   | `arrayUpload(fieldName, maxCount)` | 通用多檔案上傳            |
| 圖片上傳     | `uploadImage`                      | 預設圖片上傳              |
| 頭像上傳     | `uploadAvatar`                     | 用戶頭像上傳              |
| 多圖片上傳   | `uploadImages`                     | 預設多圖片上傳（最多5張） |
| 公告圖片上傳 | `uploadAnnouncementImage`          | 公告專用圖片上傳          |

### 刪除功能

| 功能              | 函數名稱                     | 說明                                    |
| ----------------- | ---------------------------- | --------------------------------------- |
| 依 public_id 刪除 | `deleteImage(publicId)`      | 使用 Cloudinary public_id 刪除          |
| 依 URL 刪除       | `deleteImageByUrl(imageUrl)` | 使用圖片 URL 刪除（自動提取 public_id） |

### 工具功能

| 功能     | 函數名稱                           | 說明                     |
| -------- | ---------------------------------- | ------------------------ |
| URL 生成 | `getImageUrl(publicId, options)`   | 生成帶轉換選項的圖片 URL |
| 錯誤處理 | `uploadMiddleware(uploadFunction)` | 統一的錯誤處理中間件     |

## 使用方式

### 導入方式

```javascript
import {
  singleUpload,
  arrayUpload,
  uploadImage,
  uploadAvatar,
  uploadImages,
  uploadAnnouncementImage,
  deleteImageByUrl,
  getImageUrl,
} from '../services/uploadService.js'
```

### 在路由中使用

```javascript
// 單一圖片上傳
router.post('/upload/image', uploadImage, uploadController)

// 頭像上傳
router.post('/upload/avatar', uploadAvatar, uploadController)

// 多圖片上傳
router.post('/upload/images', uploadImages, uploadController)

// 公告圖片上傳
router.post('/announcements', uploadAnnouncementImage, createAnnouncement)
```

### 在控制器中使用

```javascript
// 上傳處理
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '沒有收到圖片檔案' })
    }

    res.json({
      success: true,
      url: req.file.path,
      fileInfo: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// 刪除舊圖片
export const updateUser = async (req, res) => {
  try {
    const oldAvatarUrl = user.avatar

    // 更新用戶資料
    const updatedUser = await User.findByIdAndUpdate(id, updateData)

    // 刪除舊頭像
    if (oldAvatarUrl && oldAvatarUrl !== updatedUser.avatar) {
      await deleteImageByUrl(oldAvatarUrl)
    }

    res.json({ success: true, user: updatedUser })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
```

## 檔案分類邏輯

系統會根據上傳類型自動將檔案分類到不同的 Cloudinary 資料夾：

```javascript
// 根據檔案欄位名稱和請求內容決定資料夾
if (file.fieldname === 'avatar') {
  folder = 'avatars'
} else if (file.fieldname === 'image' || file.fieldname === 'images') {
  if (req.body && req.body.isDetailImage === 'true') {
    folder = 'memes_detail'
  } else if (req.body && req.body.type === 'announcement') {
    folder = 'announcements'
  } else {
    folder = 'memes'
  }
}
```

### 資料夾結構

- **`avatars/`** - 用戶頭像
- **`memes/`** - 迷因圖片
- **`memes_detail/`** - 迷因詳細頁圖片
- **`announcements/`** - 公告圖片
- **`others/`** - 其他檔案

## 錯誤處理

### 檔案限制

- **檔案大小**：最大 10MB
- **檔案類型**：JPG, JPEG, PNG, GIF, WebP
- **錯誤訊息**：
  - `檔案大小不能超過 10MB`
  - `只允許上傳圖片檔案`
  - `意外的檔案欄位`

### 統一錯誤處理

所有上傳錯誤都會被適當捕獲並回傳給客戶端，同時記錄詳細的日誌。

## 環境配置

### 必要的環境變數

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 預設配置

- 檔案大小限制：10MB
- 圖片轉換：寬度 800px，高度 600px，自動品質
- 支援格式：JPG, JPEG, PNG, GIF, WebP

## 遷移記錄

### 移除的檔案

- ❌ `middleware/upload.js` - 舊的上傳中間件
- ❌ `utils/deleteImg.js` - 舊的圖片刪除工具

### 更新的檔案

- ✅ `controllers/userController.js` - 更新為使用 `deleteImageByUrl`
- ✅ `controllers/memeController.js` - 更新為使用 `deleteImageByUrl`
- ✅ `test/unit/controllers/memeController.test.js` - 更新 mock 路徑
- ✅ `test/unit/controllers/userController.test.js` - 更新 mock 路徑
- ✅ `routes/announcementRoutes.js` - 使用 `uploadAnnouncementImage`
- ✅ `routes/uploadRoutes.js` - 使用整合後的服務
- ✅ `routes/memeRoutes.js` - 使用 `uploadImages`
- ✅ `routes/userRoutes.js` - 使用 `uploadAvatar`

## 測試指南

### 功能測試清單

- [ ] 單一圖片上傳
- [ ] 多圖片上傳
- [ ] 頭像上傳
- [ ] 公告圖片上傳
- [ ] 圖片刪除（依 URL）
- [ ] 圖片刪除（依 public_id）
- [ ] URL 生成

### 錯誤處理測試

- [ ] 檔案大小超限
- [ ] 不支援的檔案類型
- [ ] 缺少檔案
- [ ] 網路錯誤
- [ ] Cloudinary 配置錯誤

### 測試命令

```bash
# 執行所有測試
npm test

# 執行特定測試
npm test -- test/unit/controllers/memeController.test.js
npm test -- test/unit/controllers/userController.test.js
```

## 最佳實踐

### 1. 錯誤處理

```javascript
// 使用 try-catch 包裝所有 Cloudinary 操作
try {
  await deleteImageByUrl(imageUrl)
} catch (error) {
  logger.error('刪除圖片失敗:', error)
  // 根據需求決定是否拋出錯誤
}
```

### 2. 日誌記錄

```javascript
// 記錄重要的上傳操作
logger.info('圖片上傳成功', {
  originalName: req.file.originalname,
  size: req.file.size,
  url: req.file.path,
})
```

### 3. 效能優化

- 使用適當的圖片轉換參數
- 考慮實作圖片壓縮
- 監控上傳成功率和錯誤率

## 後續發展建議

### 短期目標

1. **監控系統**：實作上傳成功率和錯誤率監控
2. **效能優化**：實作圖片壓縮和快取策略
3. **安全性增強**：實作檔案內容驗證

### 長期目標

1. **備份策略**：實作 Cloudinary 備份機制
2. **CDN 整合**：充分利用 Cloudinary 的 CDN 功能
3. **進階轉換**：實作更多圖片處理功能

## 相關文件

- [Cloudinary 官方文檔](https://cloudinary.com/documentation)
- [Multer 文檔](https://github.com/expressjs/multer)
- [Multer Storage Cloudinary 文檔](https://github.com/affanshahid/multer-storage-cloudinary)

## 更新日誌

### 2024-12-19

- 完成 Cloudinary 功能整合
- 移除舊檔案，完成統一架構
- 更新所有相關程式碼和測試
- 完善錯誤處理和日誌記錄
