import request from 'supertest'
import { app } from '../index.js'
import User from '../models/User.js'
import path from 'path'
import fs from 'fs'
import { signToken } from '../utils/jwt.js'

const testImagePath = path.join(process.cwd(), 'benefit04.jpg')

async function coverImageBypassTest() {
  console.log('🧪 開始繞過 reCAPTCHA 的封面圖片上傳測試...')

  // 檢查測試圖片是否存在
  if (!fs.existsSync(testImagePath)) {
    console.error('❌ 測試圖片 benefit04.jpg 不存在')
    return
  }

  console.log('✅ 找到測試圖片:', testImagePath)

  // 保存原始的 reCAPTCHA 設定
  const originalSecretKey = process.env.RECAPTCHA_SECRET_KEY
  const originalSiteKey = process.env.RECAPTCHA_SITE_KEY

  let testUser = null
  let authToken = null

  try {
    // 暫時移除 reCAPTCHA 設定以繞過驗證
    console.log('\n🔧 暫時移除 reCAPTCHA 設定...')
    delete process.env.RECAPTCHA_SECRET_KEY
    delete process.env.RECAPTCHA_SITE_KEY
    console.log('✅ reCAPTCHA 設定已暫時移除')

    // 1. 創建測試用戶
    console.log('\n1️⃣ 創建測試用戶...')
    testUser = await User.create({
      username: 'test_cover_bypass_user',
      email: 'test.cover.bypass@example.com',
      password: 'testpassword123',
      display_name: 'Test Cover Bypass User',
      tokens: [], // 初始化 tokens 陣列
    })

    console.log('✅ 測試用戶創建成功:', testUser.username)

    // 2. 生成 JWT token
    console.log('\n2️⃣ 生成認證 token...')
    authToken = signToken({ _id: testUser._id })
    console.log('✅ Token 生成成功')

    // 3. 將 token 添加到用戶的 tokens 陣列中
    console.log('\n3️⃣ 將 token 添加到用戶資料...')
    testUser.tokens = testUser.tokens || []
    testUser.tokens.push(authToken)

    // 檢查是否已達到 token 數量限制
    if (testUser.tokens.length > 3) {
      testUser.tokens.shift() // 移除最舊的 token
    }

    await testUser.save()
    console.log('✅ Token 已添加到用戶資料')

    // 4. 測試上傳封面圖片
    console.log('\n4️⃣ 測試上傳封面圖片...')
    const uploadResponse = await request(app)
      .post('/api/users/me/cover-image')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('cover_image', testImagePath)

    console.log('📤 上傳回應狀態:', uploadResponse.status)
    console.log('📤 上傳回應內容:', JSON.stringify(uploadResponse.body, null, 2))

    if (uploadResponse.status === 200) {
      console.log('✅ 封面圖片上傳成功!')
      console.log('📸 圖片 URL:', uploadResponse.body.url)

      // 5. 驗證用戶資料更新
      console.log('\n5️⃣ 驗證用戶資料更新...')
      const updatedUser = await User.findById(testUser._id)
      console.log('👤 更新後的用戶資料:', {
        username: updatedUser.username,
        cover_image: updatedUser.cover_image,
      })

      if (updatedUser.cover_image === uploadResponse.body.url) {
        console.log('✅ 用戶資料中的封面圖片已正確更新')
      } else {
        console.log('❌ 用戶資料中的封面圖片未正確更新')
      }

      // 6. 測試重複上傳（替換舊圖片）
      console.log('\n6️⃣ 測試重複上傳（替換舊圖片）...')
      const secondUploadResponse = await request(app)
        .post('/api/users/me/cover-image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('cover_image', testImagePath)

      if (secondUploadResponse.status === 200) {
        console.log('✅ 重複上傳成功')
        console.log('📸 新的圖片 URL:', secondUploadResponse.body.url)

        if (secondUploadResponse.body.url !== uploadResponse.body.url) {
          console.log('✅ 圖片 URL 已更新（舊圖片被替換）')
        } else {
          console.log('⚠️ 圖片 URL 相同（可能是快取問題）')
        }
      } else {
        console.log('❌ 重複上傳失敗:', secondUploadResponse.body)
      }

      // 7. 測試錯誤情況
      console.log('\n7️⃣ 測試錯誤情況...')

      // 測試無檔案上傳
      const noFileResponse = await request(app)
        .post('/api/users/me/cover-image')
        .set('Authorization', `Bearer ${authToken}`)

      console.log('📤 無檔案上傳回應:', noFileResponse.status, noFileResponse.body.message)

      // 測試無認證
      const noAuthResponse = await request(app)
        .post('/api/users/me/cover-image')
        .attach('cover_image', testImagePath)

      console.log('📤 無認證回應:', noAuthResponse.status)
    } else {
      console.error('❌ 封面圖片上傳失敗')
    }
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message)
    console.error('錯誤詳情:', error)
  } finally {
    // 恢復原始的 reCAPTCHA 設定
    console.log('\n🔧 恢復 reCAPTCHA 設定...')
    if (originalSecretKey) {
      process.env.RECAPTCHA_SECRET_KEY = originalSecretKey
    }
    if (originalSiteKey) {
      process.env.RECAPTCHA_SITE_KEY = originalSiteKey
    }
    console.log('✅ reCAPTCHA 設定已恢復')

    // 清理測試用戶
    if (testUser) {
      try {
        await User.findByIdAndDelete(testUser._id)
        console.log('🧹 測試用戶已清理')
      } catch (cleanupError) {
        console.error('❌ 清理測試用戶失敗:', cleanupError.message)
      }
    }
  }
}

// 執行測試
coverImageBypassTest()
  .then(() => {
    console.log('\n🎉 測試完成!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 測試失敗:', error)
    process.exit(1)
  })
