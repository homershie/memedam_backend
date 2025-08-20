import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'

describe('聯絡表單 API', () => {
  describe('POST /api/email/contact', () => {
    it('應該成功發送聯絡表單', async () => {
      const contactData = {
        fullName: '測試用戶',
        email: 'test@example.com',
        topic: 'general',
        userType: 'general',
        message: '這是一個測試訊息，用來驗證聯絡表單功能是否正常運作。',
      }

      const response = await request(app).post('/api/email/contact').send(contactData).expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('聯絡表單已成功送出')
      expect(response.body.data).toMatchObject({
        fullName: contactData.fullName,
        email: contactData.email,
        topic: contactData.topic,
        userType: contactData.userType,
      })
      expect(response.body.data.submittedAt).toBeDefined()
    })

    it('應該拒絕缺少必填欄位的請求', async () => {
      const invalidData = {
        fullName: '測試用戶',
        email: 'test@example.com',
        // 缺少 topic, userType, message
      }

      const response = await request(app).post('/api/email/contact').send(invalidData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('請填寫所有必填欄位')
    })

    it('應該拒絕無效的 email 格式', async () => {
      const invalidData = {
        fullName: '測試用戶',
        email: 'invalid-email',
        topic: 'general',
        userType: 'general',
        message: '這是一個測試訊息。',
      }

      const response = await request(app).post('/api/email/contact').send(invalidData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('請提供有效的 email 地址')
    })

    it('應該拒絕過短的訊息內容', async () => {
      const invalidData = {
        fullName: '測試用戶',
        email: 'test@example.com',
        topic: 'general',
        userType: 'general',
        message: '太短', // 少於 10 個字元
      }

      const response = await request(app).post('/api/email/contact').send(invalidData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('訊息內容至少需要10個字元')
    })

    it('應該處理空字串和空白字元', async () => {
      const contactData = {
        fullName: '  測試用戶  ',
        email: '  test@example.com  ',
        topic: 'general',
        userType: 'general',
        message: '  這是一個測試訊息，用來驗證聯絡表單功能是否正常運作。  ',
      }

      const response = await request(app).post('/api/email/contact').send(contactData)

      // 先檢查回應內容
      console.log('Response status:', response.status)
      console.log('Response body:', response.body)

      if (response.status === 200) {
        expect(response.body.success).toBe(true)
        expect(response.body.data.fullName).toBe('測試用戶') // 應該被 trim
        expect(response.body.data.email).toBe('test@example.com') // 應該被 trim
      } else {
        // 如果失敗，顯示錯誤訊息
        console.log('Error response:', response.body)
        throw new Error(`Expected 200 but got ${response.status}: ${JSON.stringify(response.body)}`)
      }
    })
  })
})
