// 測試 Discord OAuth Session 持久性
import fetch from 'node-fetch'

const BASE_URL = process.env.API_URL || 'https://api.memedam.com'

async function testDiscordOAuthSession() {
  console.log('=== Discord OAuth Session 持久性測試 ===')

  try {
    // 1. 測試 Discord OAuth 初始化端點
    console.log('1. 測試 Discord OAuth 初始化...')
    const initResponse = await fetch(`${BASE_URL}/api/users/auth/discord`, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'manual', // 不自動跟隨重定向
    })

    console.log('初始化響應狀態:', initResponse.status)

    // 檢查 session cookie
    const setCookieHeader = initResponse.headers.get('set-cookie')
    console.log('Session Cookie:', setCookieHeader)

    if (initResponse.status === 302) {
      const location = initResponse.headers.get('location')
      console.log('重定向到:', location)

      // 檢查是否包含 Discord OAuth URL
      if (location && location.includes('discord.com/api/oauth2/authorize')) {
        console.log('✅ Discord OAuth 初始化成功')

        // 解析 state 參數
        const url = new URL(location)
        const state = url.searchParams.get('state')
        console.log('OAuth state:', state)

        if (state) {
          console.log('✅ OAuth state 參數存在')

          // 2. 模擬 callback 請求（使用相同的 session cookie）
          console.log('\n2. 模擬 callback 請求...')

          // 提取 session cookie
          const sessionCookie = setCookieHeader?.split(';')[0]
          console.log('使用 Session Cookie:', sessionCookie)

          const callbackUrl = `${BASE_URL}/api/users/auth/discord/callback?code=test_code&state=${state}`
          console.log('Callback URL:', callbackUrl)

          const callbackResponse = await fetch(callbackUrl, {
            method: 'GET',
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Cookie: sessionCookie || '',
            },
            redirect: 'manual',
          })

          console.log('Callback 響應狀態:', callbackResponse.status)
          console.log('Callback 響應頭:', Object.fromEntries(callbackResponse.headers.entries()))

          if (callbackResponse.status === 302) {
            const callbackLocation = callbackResponse.headers.get('location')
            console.log('Callback 重定向到:', callbackLocation)

            if (callbackLocation && callbackLocation.includes('error=invalid_state')) {
              console.log('❌ Session 持久性問題：state 驗證失敗')
            } else if (callbackLocation && callbackLocation.includes('error=session_unavailable')) {
              console.log('❌ Session 持久性問題：session 不可用')
            } else {
              console.log('✅ Session 持久性正常')
            }
          } else {
            console.log('❌ 預期的 callback 重定向未發生')
          }
        } else {
          console.log('❌ OAuth state 參數缺失')
        }
      } else {
        console.log('❌ 重定向 URL 不是 Discord OAuth URL')
      }
    } else {
      console.log('❌ 預期的 302 重定向未發生')
    }
  } catch (error) {
    console.error('測試失敗:', error.message)
  }

  console.log('=== 測試完成 ===')
}

// 執行測試
testDiscordOAuthSession()
