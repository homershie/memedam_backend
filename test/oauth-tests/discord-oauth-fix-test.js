// 測試 Discord OAuth 修復
import fetch from 'node-fetch'

const BASE_URL = process.env.API_URL || 'http://localhost:4000'

async function testDiscordOAuth() {
  console.log('=== Discord OAuth 修復測試 ===')

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
    console.log('初始化響應頭:', Object.fromEntries(initResponse.headers.entries()))

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
testDiscordOAuth()
