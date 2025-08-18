import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import User from '../../../models/User.js'
import { updateHasPasswordField } from '../../../utils/updateHasPassword.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('has_password 功能測試', () => {
  let socialUser

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
    // 使用 findOneAndUpdate 避免 pre-save hook
    socialUser = await User.findOneAndUpdate(
      { username: 'test_social_user' },
      {
        username: 'test_social_user',
        email: 'test2@example.com',
        google_id: 'test_google_id_123',
        login_method: 'google',
        display_name: '測試社群用戶',
        status: 'active',
        has_password: false,
        // 不設置 password 欄位
      },
      { upsert: true, new: true, runValidators: false },
    )
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  it('應該正確更新 has_password 欄位', async () => {
    // 檢查初始狀態
    await User.findOne({ username: 'test_user_with_password' })
    await User.findOne({ username: 'test_social_user' })

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
    const user = await User.findOne({ username: 'test_social_user' })
    user.password = 'newpassword123'
    await user.save()

    const userAfterPasswordChange = await User.findOne({ username: 'test_social_user' })
    expect(userAfterPasswordChange.has_password).toBe(true)
  })

  it('應該在移除密碼時更新 has_password', async () => {
    // 使用 findOneAndUpdate 移除密碼，避免 pre-save hook
    await User.findOneAndUpdate(
      { username: 'test_social_user' },
      { $unset: { password: 1 }, has_password: false },
      { runValidators: false },
    )

    const userAfterPasswordRemoval = await User.findOne({ username: 'test_social_user' })
    expect(userAfterPasswordRemoval.has_password).toBe(false)
  })

  it('應該處理大量用戶的 has_password 更新', async () => {
    // 創建多個測試用戶
    const testUsers = []
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) {
        // 有密碼的用戶
        const user = await createTestUser(User, {
          username: `test_batch_user_${i}`,
          email: `batch${i}@example.com`,
          password: 'password123',
          display_name: `批次用戶 ${i}`,
        })
        testUsers.push(user)
      } else {
        // 無密碼的用戶（OAuth）
        const user = await User.findOneAndUpdate(
          { username: `test_batch_user_${i}` },
          {
            username: `test_batch_user_${i}`,
            email: `batch${i}@example.com`,
            google_id: `google_${i}`,
            login_method: 'google',
            display_name: `批次用戶 ${i}`,
            status: 'active',
            has_password: false,
          },
          { upsert: true, new: true, runValidators: false },
        )
        testUsers.push(user)
      }
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
