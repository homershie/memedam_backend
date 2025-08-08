import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import mongoose from 'mongoose'

const testOAuthBind = async () => {
  let testUser
  let authToken

  try {
    console.log('🧪 開始 OAuth 綁定功能測試...')

    // 創建測試用戶
    console.log('👤 創建測試用戶...')
    testUser = new User({
      username: 'testuseroauth',
      email: 'testuser_oauth@example.com',
      password: 'password123',
      role: 'user',
    })
    await testUser.save()
    console.log('✅ 測試用戶創建成功')

    // 登入獲取 token
    console.log('🔐 登入獲取 token...')
    const loginResponse = await request(app).post('/api/users/login').send({
      login: 'testuser_oauth@example.com',
      password: 'password123',
    })

    if (loginResponse.status !== 200) {
      throw new Error(`登入失敗: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`)
    }

    authToken = loginResponse.body.token
    console.log('✅ 登入成功，獲取到 token')

    // 測試 GET /api/users/bind-status
    console.log('\n📊 測試 GET /api/users/bind-status...')
    const bindStatusResponse = await request(app)
      .get('/api/users/bind-status')
      .set('Authorization', `Bearer ${authToken}`)

    if (bindStatusResponse.status === 200) {
      console.log('✅ bind-status 測試成功')
      console.log('綁定狀態:', bindStatusResponse.body.bindStatus)
    } else {
      console.log('❌ bind-status 測試失敗:', bindStatusResponse.status, bindStatusResponse.body)
    }

    // 測試未授權訪問
    console.log('\n🚫 測試未授權訪問...')
    const unauthorizedResponse = await request(app).get('/api/users/bind-status')
    if (unauthorizedResponse.status === 401) {
      console.log('✅ 未授權訪問正確被拒絕')
    } else {
      console.log('❌ 未授權訪問測試失敗:', unauthorizedResponse.status)
    }

    // 測試 GET /api/users/bind-auth/:provider
    console.log('\n🔗 測試 Google 綁定初始化...')
    const googleBindResponse = await request(app)
      .get('/api/users/bind-auth/google')
      .set('Authorization', `Bearer ${authToken}`)

    if (googleBindResponse.status === 200) {
      console.log('✅ Google 綁定初始化成功')
      console.log('Auth URL:', googleBindResponse.body.authUrl)
      console.log('State:', googleBindResponse.body.state)
    } else {
      console.log('❌ Google 綁定初始化失敗:', googleBindResponse.status, googleBindResponse.body)
    }

    // 測試 Facebook 綁定初始化
    console.log('\n🔗 測試 Facebook 綁定初始化...')
    const facebookBindResponse = await request(app)
      .get('/api/users/bind-auth/facebook')
      .set('Authorization', `Bearer ${authToken}`)

    if (facebookBindResponse.status === 200) {
      console.log('✅ Facebook 綁定初始化成功')
      console.log('Auth URL:', facebookBindResponse.body.authUrl)
      console.log('State:', facebookBindResponse.body.state)
    } else {
      console.log(
        '❌ Facebook 綁定初始化失敗:',
        facebookBindResponse.status,
        facebookBindResponse.body,
      )
    }

    // 測試不支援的 provider
    console.log('\n❌ 測試不支援的 provider...')
    const invalidProviderResponse = await request(app)
      .get('/api/users/bind-auth/invalid')
      .set('Authorization', `Bearer ${authToken}`)

    if (invalidProviderResponse.status === 400) {
      console.log('✅ 不支援的 provider 正確被拒絕')
    } else {
      console.log('❌ 不支援的 provider 測試失敗:', invalidProviderResponse.status)
    }

    // 測試綁定狀態檢查
    console.log('\n📋 測試綁定狀態檢查...')
    const statusCheckResponse = await request(app)
      .get('/api/users/bind-status')
      .set('Authorization', `Bearer ${authToken}`)

    if (statusCheckResponse.status === 200) {
      const bindStatus = statusCheckResponse.body.bindStatus
      console.log('✅ 綁定狀態檢查成功')
      console.log('Google 綁定狀態:', bindStatus.google)
      console.log('Facebook 綁定狀態:', bindStatus.facebook)
      console.log('Discord 綁定狀態:', bindStatus.discord)
      console.log('Twitter 綁定狀態:', bindStatus.twitter)
    } else {
      console.log('❌ 綁定狀態檢查失敗:', statusCheckResponse.status)
    }

    console.log('\n🎉 所有 OAuth 綁定測試完成！')
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error)
  } finally {
    // 清理測試用戶
    if (testUser) {
      try {
        await User.findByIdAndDelete(testUser._id)
        console.log('🧹 測試用戶清理完成')
      } catch (cleanupError) {
        console.error('清理測試用戶時發生錯誤:', cleanupError)
      }
    }

    // 關閉資料庫連線
    try {
      await mongoose.connection.close()
      console.log('🔌 資料庫連線已關閉')
    } catch (closeError) {
      console.error('關閉資料庫連線時發生錯誤:', closeError)
    }
  }
}

// 執行測試
testOAuthBind()
