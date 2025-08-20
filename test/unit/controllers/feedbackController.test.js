import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitFeedback } from '../../../controllers/feedbackController.js'

// Mock dependencies
vi.mock('../../../models/Feedback.js')
vi.mock('../../../utils/recaptchaService.js')
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe('FeedbackController', () => {
  let mockReq
  let mockRes

  beforeEach(() => {
    mockReq = {
      user: {
        _id: 'user123',
        email: 'test@example.com',
        email_verified: true,
      },
      body: {
        title: '測試標題',
        message: '測試訊息內容',
        category: 'suggestion',
        recaptchaToken: 'test-token',
      },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('submitFeedback', () => {
    it('應該拒絕提交當使用者沒有信箱', async () => {
      mockReq.user.email = null

      await submitFeedback(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '您需要先設定並驗證信箱才能提交意見',
      })
    })

    it('應該拒絕提交當使用者信箱未驗證', async () => {
      mockReq.user.email_verified = false

      await submitFeedback(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '請先驗證您的信箱才能提交意見',
      })
    })

    it('應該拒絕提交當使用者未登入', async () => {
      mockReq.user = null

      await submitFeedback(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '請先登入才能提交意見',
      })
    })
  })
})
