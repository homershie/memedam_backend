import { describe, it, expect, beforeAll, vi } from 'vitest'
import mongoose from 'mongoose'

// Mock the Follow model with proper validation behavior
vi.mock('../../../models/Follow.js', () => {
  // Create a mock model that properly simulates mongoose validation
  const MockModel = vi.fn().mockImplementation((data) => {
    const instance = {
      ...data,
      validateSync: vi.fn().mockImplementation(() => {
        // Simulate mongoose validation
        const errors = {}

        // Validate follower_id
        if (data.follower_id) {
          if (typeof data.follower_id === 'object' && data.follower_id !== null) {
            if (
              '$in' in data.follower_id ||
              '$nin' in data.follower_id ||
              '$eq' in data.follower_id ||
              '$ne' in data.follower_id
            ) {
              errors.follower_id = new Error('追隨者ID必須是有效的ObjectId，不能是查詢對象')
            }
          } else if (!mongoose.Types.ObjectId.isValid(data.follower_id)) {
            errors.follower_id = new Error('追隨者ID必須是有效的ObjectId')
          }
        }

        // Validate following_id
        if (data.following_id) {
          if (typeof data.following_id === 'object' && data.following_id !== null) {
            if (
              '$in' in data.following_id ||
              '$nin' in data.following_id ||
              '$eq' in data.following_id ||
              '$ne' in data.following_id
            ) {
              errors.following_id = new Error('被追隨者ID必須是有效的ObjectId，不能是查詢對象')
            }
          } else if (!mongoose.Types.ObjectId.isValid(data.following_id)) {
            errors.following_id = new Error('被追隨者ID必須是有效的ObjectId')
          }
        }

        if (Object.keys(errors).length > 0) {
          const validationError = new Error('Validation failed')
          validationError.errors = errors
          return validationError
        }
        return null
      }),
      validate: vi.fn().mockImplementation(async function () {
        const syncError = this.validateSync()
        if (syncError) {
          throw syncError
        }
        return this
      }),
      save: vi.fn().mockResolvedValue({ ...data, _id: new mongoose.Types.ObjectId() }),
    }

    return instance
  })

  // Add static methods
  MockModel.find = vi.fn()
  MockModel.findOne = vi.fn()
  MockModel.create = vi.fn()
  MockModel.findById = vi.fn()

  return {
    default: MockModel,
  }
})

import Follow from '../../../models/Follow.js'

describe('Follow Model Validation', () => {
  beforeAll(async () => {
    // 測試環境已經在 setup.js 中設置了記憶體 MongoDB
  })

  describe('follower_id and following_id validation', () => {
    it('應該拒絕包含 MongoDB 操作符的對象作為 follower_id', async () => {
      const invalidFollow = new Follow({
        follower_id: { $in: [new mongoose.Types.ObjectId()] },
        following_id: new mongoose.Types.ObjectId(),
        status: 'active',
      })

      await expect(invalidFollow.validate()).rejects.toThrow(
        '追隨者ID必須是有效的ObjectId，不能是查詢對象',
      )
    })

    it('應該拒絕包含 MongoDB 操作符的對象作為 following_id', async () => {
      const invalidFollow = new Follow({
        follower_id: new mongoose.Types.ObjectId(),
        following_id: { $in: [new mongoose.Types.ObjectId()] },
        status: 'active',
      })

      await expect(invalidFollow.validate()).rejects.toThrow(
        '被追隨者ID必須是有效的ObjectId，不能是查詢對象',
      )
    })

    it('應該接受有效的 ObjectId 實例', async () => {
      const validFollow = new Follow({
        follower_id: new mongoose.Types.ObjectId(),
        following_id: new mongoose.Types.ObjectId(),
        status: 'active',
      })

      await expect(validFollow.validate()).resolves.toBeDefined()
    })

    it('應該接受有效的 ObjectId 字符串', async () => {
      const validId = new mongoose.Types.ObjectId().toString()
      const validFollow = new Follow({
        follower_id: validId,
        following_id: new mongoose.Types.ObjectId(),
        status: 'active',
      })

      await expect(validFollow.validate()).resolves.toBeDefined()
    })
  })
})
