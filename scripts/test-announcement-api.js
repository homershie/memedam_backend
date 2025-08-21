import axios from 'axios'

const API_BASE_URL = 'http://localhost:3000'

// 測試取得公告列表
const testGetAnnouncements = async () => {
  try {
    console.log('測試取得公告列表...')
    const response = await axios.get(`${API_BASE_URL}/api/announcements?status=public&limit=3`)
    console.log('回應狀態:', response.status)
    console.log('回應資料:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('測試失敗:', error.response?.data || error.message)
  }
}

// 測試取得單一公告
const testGetAnnouncementById = async (id) => {
  try {
    console.log(`測試取得公告 ID: ${id}...`)
    const response = await axios.get(`${API_BASE_URL}/api/announcements/${id}`)
    console.log('回應狀態:', response.status)
    console.log('回應資料:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('測試失敗:', error.response?.data || error.message)
  }
}

// 主函數
const main = async () => {
  console.log('開始測試公告 API...')

  // 測試取得公告列表
  await testGetAnnouncements()

  // 如果有公告，測試取得第一個公告
  try {
    const listResponse = await axios.get(`${API_BASE_URL}/api/announcements?status=public&limit=1`)
    if (listResponse.data?.data?.length > 0) {
      const firstAnnouncement = listResponse.data.data[0]
      await testGetAnnouncementById(firstAnnouncement._id)
    }
  } catch (error) {
    console.error('無法取得公告列表進行後續測試:', error.message)
  }

  console.log('測試完成')
}

// 執行測試
main().catch(console.error)
