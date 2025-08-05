// 測試伺服器 - 只用來測試trending API修正
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 5000

// 中間件
app.use(cors())
app.use(express.json())

// 模擬成功的回應 - 確認伺服器能運行
app.get('/api/recommendations', (req, res) => {
  const { algorithm, include_social_signals } = req.query
  
  console.log(`API調用: algorithm=${algorithm}, include_social_signals=${include_social_signals}`)
  
  if (algorithm === 'trending') {
    // 模擬trending推薦的成功回應
    res.json({
      success: true,
      message: 'trending API修正測試成功',
      data: {
        recommendations: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasMore: false
        },
        metadata: {
          algorithm: 'trending',
          include_social_signals: include_social_signals === 'true',
          requestTime: new Date().toISOString()
        }
      }
    })
  } else {
    res.json({
      success: true,
      message: '其他算法測試',
      data: {
        recommendations: [],
        algorithm: algorithm || 'default'
      }
    })
  }
})

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '測試伺服器運行正常' })
})

app.listen(PORT, () => {
  console.log(`測試伺服器運行在端口 ${PORT}`)
  console.log(`測試trending API: http://localhost:${PORT}/api/recommendations?algorithm=trending&include_social_signals=true`)
})