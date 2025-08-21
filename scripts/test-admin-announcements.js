import axios from 'axios'

const API_BASE_URL = 'http://localhost:4000'

// 模擬管理員 token（實際使用時需要真實的 token）
const ADMIN_TOKEN = 'your-admin-token-here'

// 測試管理員取得所有公告
const testAdminGetAllAnnouncements = async () => {
  try {
    console.log('測試管理員取得所有公告...')
    const response = await axios.get(`${API_BASE_URL}/api/announcements/admin/all`, {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      params: {
        limit: 10,
        page: 1,
      },
    })
    console.log('回應狀態:', response.status)
    console.log('回應資料:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('測試失敗:', error.response?.data || error.message)
  }
}

// 測試一般用戶取得公告（應該只看到公開的）
const testPublicGetAnnouncements = async () => {
  try {
    console.log('測試一般用戶取得公告...')
    const response = await axios.get(`${API_BASE_URL}/api/announcements`, {
      params: {
        limit: 10,
        page: 1,
      },
    })
    console.log('回應狀態:', response.status)
    console.log('回應資料:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('測試失敗:', error.response?.data || error.message)
  }
}

// 主函數
const main = async () => {
  console.log('開始測試公告 API...')

  // 測試一般用戶 API
  await testPublicGetAnnouncements()

  // 測試管理員 API
  await testAdminGetAllAnnouncements()

  console.log('測試完成')
}

// 執行測試
main().catch(console.error)
