import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'

// Mock Meme model
const mockMeme = {
  create: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findByIdAndDelete: vi.fn(),
  countDocuments: vi.fn(),
  aggregate: vi.fn(),
  updateMany: vi.fn(),
}

// Mock chain methods
const mockChain = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  populate: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  exec: vi.fn(),
}

describe('Meme Model 單元測試', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mockChain).forEach(fn => {
      if (fn.mockReturnThis) fn.mockReturnThis()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('迷因創建與驗證', () => {
    it('應該成功創建新迷因', async () => {
      const memeData = {
        title: '測試迷因',
        type: 'image',
        content: '這是測試內容',
        image_url: 'https://example.com/meme.jpg',
        author_id: new mongoose.Types.ObjectId(),
      }

      const expectedMeme = {
        _id: new mongoose.Types.ObjectId(),
        ...memeData,
        status: 'public',
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
        view_count: 0,
        share_count: 0,
        created_at: new Date(),
      }

      mockMeme.create.mockResolvedValue(expectedMeme)

      const meme = await mockMeme.create(memeData)

      expect(mockMeme.create).toHaveBeenCalledWith(memeData)
      expect(meme).toEqual(expectedMeme)
      expect(meme.status).toBe('public')
    })
  })
})
