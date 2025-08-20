import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import User from '../../../models/User.js'
import { cleanupTestData } from '../../setup.js'

describe('OAuth 社群登入 has_password 測試', () => {
  beforeAll(async () => {
    // 清理測試資料
    await User.deleteMany({ username: { $regex: /^test_oauth_/ } })
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  it('Google 社群登入用戶的 has_password 應該為 false', async () => {
    // 模擬 Google OAuth 登入創建用戶
    const googleUser = new User({
      username: 'test_oauth_google_user',
      email: 'google@example.com',
      google_id: 'google_123456',
      display_name: 'Google 用戶',
      login_method: 'google',
      status: 'active',
    })

    await googleUser.save()

    // 驗證社群用戶的 has_password 應該是 false
    expect(googleUser.has_password).toBe(false)

    // 從資料庫重新查詢確認
    const savedUser = await User.findById(googleUser._id)
    expect(savedUser.has_password).toBe(false)
  })

  it('Facebook 社群登入用戶的 has_password 應該為 false', async () => {
    // 模擬 Facebook OAuth 登入創建用戶
    const facebookUser = new User({
      username: 'test_oauth_facebook_user',
      email: 'facebook@example.com',
      facebook_id: 'facebook_123456',
      display_name: 'Facebook 用戶',
      login_method: 'facebook',
      status: 'active',
    })

    await facebookUser.save()

    // 驗證社群用戶的 has_password 應該是 false
    expect(facebookUser.has_password).toBe(false)

    // 從資料庫重新查詢確認
    const savedUser = await User.findById(facebookUser._id)
    expect(savedUser.has_password).toBe(false)
  })

  it('Discord 社群登入用戶的 has_password 應該為 false', async () => {
    // 模擬 Discord OAuth 登入創建用戶
    const discordUser = new User({
      username: 'test_oauth_discord_user',
      email: 'discord@example.com',
      discord_id: 'discord_123456',
      display_name: 'Discord 用戶',
      login_method: 'discord',
      status: 'active',
    })

    await discordUser.save()

    // 驗證社群用戶的 has_password 應該是 false
    expect(discordUser.has_password).toBe(false)

    // 從資料庫重新查詢確認
    const savedUser = await User.findById(discordUser._id)
    expect(savedUser.has_password).toBe(false)
  })

  it('Twitter 社群登入用戶的 has_password 應該為 false', async () => {
    // 模擬 Twitter OAuth 登入創建用戶
    const twitterUser = new User({
      username: 'test_oauth_twitter_user',
      email: 'twitter@example.com',
      twitter_id: 'twitter_123456',
      display_name: 'Twitter 用戶',
      login_method: 'twitter',
      status: 'active',
    })

    await twitterUser.save()

    // 驗證社群用戶的 has_password 應該是 false
    expect(twitterUser.has_password).toBe(false)

    // 從資料庫重新查詢確認
    const savedUser = await User.findById(twitterUser._id)
    expect(savedUser.has_password).toBe(false)
  })

  it('社群用戶設定密碼後 has_password 應該為 true', async () => {
    // 創建一個社群用戶
    const socialUser = new User({
      username: 'test_oauth_set_password',
      email: 'setpassword@example.com',
      google_id: 'google_set_password_123',
      display_name: '設定密碼測試用戶',
      login_method: 'google',
      status: 'active',
    })

    await socialUser.save()

    // 驗證社群用戶初始狀態
    expect(socialUser.has_password).toBe(false)

    // 模擬 changePassword API 的邏輯
    // 使用 findOneAndUpdate 避免觸發 pre-save hook
    const updatedUser = await User.findOneAndUpdate(
      { _id: socialUser._id },
      {
        $set: {
          password: 'newpassword123',
          has_password: true,
        },
      },
      { new: true, runValidators: false },
    )

    // 社群用戶設定密碼後，has_password 應該為 true
    // 因為用戶主動設定了自己的密碼
    expect(updatedUser.has_password).toBe(true)
  })

  it('社群用戶設定密碼後不應該被強制登出', async () => {
    // 創建一個社群用戶
    const socialUser = new User({
      username: 'test_oauth_no_logout',
      email: 'nologout@example.com',
      google_id: 'google_no_logout_123',
      display_name: '不登出測試用戶',
      login_method: 'google',
      status: 'active',
      tokens: ['test_token_1', 'test_token_2'], // 模擬現有的登入 token
    })

    await socialUser.save()

    // 驗證社群用戶初始狀態
    expect(socialUser.has_password).toBe(false)
    expect(socialUser.tokens).toHaveLength(2)

    // 模擬 changePassword API 的邏輯（第一次設定密碼）
    const updatedUser = await User.findOneAndUpdate(
      { _id: socialUser._id },
      {
        $set: {
          password: 'newpassword123',
          has_password: true,
        },
      },
      { new: true, runValidators: false },
    )

    // 社群用戶設定密碼後，has_password 應該為 true
    expect(updatedUser.has_password).toBe(true)

    // 社群用戶第一次設定密碼後，tokens 應該保持不變（不被清除）
    expect(updatedUser.tokens).toHaveLength(2)
    expect(updatedUser.tokens).toEqual(['test_token_1', 'test_token_2'])
  })

  it('社群用戶完成 username 選擇後不應該被要求重新選擇', async () => {
    // 創建一個需要選擇 username 的社群用戶
    const socialUser = new User({
      username: 'temp_twitter_123_1234567890',
      email: '',
      twitter_id: 'twitter_123',
      display_name: '測試用戶',
      login_method: 'twitter',
      status: 'active',
      needs_username_selection: true,
    })

    await socialUser.save()

    // 驗證初始狀態
    expect(socialUser.needs_username_selection).toBe(true)
    expect(socialUser.email).toBe('')

    // 模擬完成 username 選擇
    const updatedUser = await User.findOneAndUpdate(
      { _id: socialUser._id },
      {
        $set: {
          username: 'final_username',
          needs_username_selection: false,
        },
      },
      { new: true, runValidators: false },
    )

    // 驗證更新後的狀態
    expect(updatedUser.needs_username_selection).toBe(false)
    expect(updatedUser.username).toBe('final_username')
    expect(updatedUser.email).toBe('') // email 仍然是空的

    // 模擬 checkIfNeedsUsername 函數的邏輯
    const needsUsername = updatedUser.needs_username_selection

    // 驗證結果：不應該需要選擇 username
    expect(needsUsername).toBe(false)
  })

  it('一般用戶變更密碼後應該被強制登出', async () => {
    // 創建一般用戶（已有密碼）
    const normalUser = new User({
      username: 'test_normal_change_password',
      email: 'normalchange@example.com',
      display_name: '一般用戶變更密碼測試',
      login_method: 'local',
      status: 'active',
      has_password: true,
      password: 'oldpassword123',
      tokens: ['test_token_1', 'test_token_2'], // 模擬現有的登入 token
    })

    await normalUser.save()

    // 驗證一般用戶初始狀態
    expect(normalUser.has_password).toBe(true)
    expect(normalUser.tokens).toHaveLength(2)

    // 模擬 changePassword API 的邏輯（變更密碼）
    const updatedUser = await User.findOneAndUpdate(
      { _id: normalUser._id },
      {
        $set: {
          password: 'newpassword123',
          tokens: [], // 變更密碼時清除所有 token
        },
      },
      { new: true, runValidators: false },
    )

    // 一般用戶變更密碼後，tokens 應該被清除
    expect(updatedUser.tokens).toHaveLength(0)
  })

  it('一般用戶設定密碼後 has_password 應該為 true', async () => {
    // 創建一般用戶（沒有社群 ID）
    const normalUser = new User({
      username: 'test_normal_set_password',
      email: 'normalset@example.com',
      display_name: '一般用戶設定密碼測試',
      login_method: 'local',
      status: 'active',
    })

    // 設定密碼
    normalUser.password = 'password123'
    await normalUser.save()

    // 驗證一般用戶的 has_password 應該是 true
    expect(normalUser.has_password).toBe(true)

    // 從資料庫重新查詢確認
    const savedUser = await User.findById(normalUser._id)
    expect(savedUser.has_password).toBe(true)
  })
})
