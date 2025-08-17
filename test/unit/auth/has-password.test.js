import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import User from '../../../models/User.js'
import { updateHasPasswordField } from '../../../utils/updateHasPassword.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('has_password 功能測試', () => {
  let userWithPassword, socialUser

  beforeAll(async () => {
    // 清理測試資料
    await User.deleteMany({ username: { $regex: /^test_/ } })

    // 建立測試用戶 - 有密碼的用戶
    userWithPassword = await createTestUser(User, {
      username: 'test_user_with_password',
      email: 'test1@example.com',
      password: 'testpassword123',
      display_name: '測試用戶1',
    })

    // 建立測試用戶 - 社群登入用戶（沒有密碼）
    socialUser = await createTestUser(User, {
      username: 'test_social_user',
      email: 'test2@example.com',
      google_id: 'test_google_id_123',
      login_method: 'google',
      display_name: '測試社群用戶',
      password: undefined, // 確保沒有密碼
    })
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  it('應該正確更新 has_password 欄位', async () => {
    // 檢查初始狀態
    const user1 = await User.findOne({ username: 'test_user_with_password' })
    const user2 = await User.findOne({ username: 'test_social_user' })

    // 執行更新腳本
    await updateHasPasswordField()

    // 檢查更新後的狀態
    const updatedUser1 = await User.findOne({ username: 'test_user_with_password' })
    const updatedUser2 = await User.findOne({ username: 'test_social_user' })

    // 驗證結果
    expect(updatedUser1.has_password).toBe(true)
    expect(updatedUser2.has_password).toBe(false)
  })

  it('應該在密碼變更時更新 has_password', async () => {
    // 為社群用戶設定密碼
    socialUser.password = 'newpassword123'
    await socialUser.save()

    const userAfterPasswordChange = await User.findOne({ username: 'test_social_user' })
    expect(userAfterPasswordChange.has_password).toBe(true)
  })

  it('應該在移除密碼時更新 has_password', async () => {
    // 移除密碼
    socialUser.password = undefined
    await socialUser.save()

    const userAfterPasswordRemoval = await User.findOne({ username: 'test_social_user' })
    expect(userAfterPasswordRemoval.has_password).toBe(false)
  })

  it('應該處理大量用戶的 has_password 更新', async () => {
    // 創建多個測試用戶
    const testUsers = []
    for (let i = 0; i < 5; i++) {
      const user = await createTestUser(User, {
        username: `test_batch_user_${i}`,
        email: `batch${i}@example.com`,
        password: i % 2 === 0 ? 'password123' : undefined,
        display_name: `批次用戶 ${i}`,
      })
      testUsers.push(user)
    }

    // 執行更新
    await updateHasPasswordField()

    // 驗證結果
    for (let i = 0; i < testUsers.length; i++) {
      const updatedUser = await User.findById(testUsers[i]._id)
      const expectedHasPassword = i % 2 === 0
      expect(updatedUser.has_password).toBe(expectedHasPassword)
    }
  })
})
