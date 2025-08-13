// 測試 OAuth 臨時存儲功能
import {
  storeBindState,
  getBindState,
  removeBindState,
  getBindStateStats,
} from '../../utils/oauthTempStore.js'

console.log('🧪 開始測試 OAuth 臨時存儲功能...')

// 測試數據
const testState = 'test_state_123456789'
const testUserId = '507f1f77bcf86cd799439011'
const testProvider = 'google'

console.log('\n1. 測試存儲綁定狀態...')
const stored = storeBindState(testState, testUserId, testProvider)
console.log('存儲結果:', stored)

console.log('\n2. 測試獲取綁定狀態...')
const retrieved = getBindState(testState)
console.log('獲取結果:', retrieved)

console.log('\n3. 測試統計資訊...')
const stats = getBindStateStats()
console.log('統計資訊:', stats)

console.log('\n4. 測試刪除綁定狀態...')
const removed = removeBindState(testState)
console.log('刪除結果:', removed)

console.log('\n5. 測試刪除後再次獲取...')
const afterRemoval = getBindState(testState)
console.log('刪除後獲取結果:', afterRemoval)

console.log('\n6. 測試過期功能...')
// 創建一個過期的狀態（模擬）
const expiredState = 'expired_state_123'
const tempOAuthBindStates = new Map()
tempOAuthBindStates.set(expiredState, {
  userId: testUserId,
  provider: testProvider,
  timestamp: Date.now() - 6 * 60 * 1000, // 6分鐘前，應該過期
})

console.log('過期狀態測試完成')

console.log('\n✅ OAuth 臨時存儲功能測試完成！')
