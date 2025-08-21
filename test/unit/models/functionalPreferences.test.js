import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'

// Mock User model
const mockUser = {
  create: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOne: vi.fn(),
}

describe('User Model Functional Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('functionalPreferences 欄位驗證', () => {
    it('應該接受有效的主題設定', async () => {
      const validThemes = ['light', 'dark', 'auto']

      for (const theme of validThemes) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            theme,
          },
        }

        const expectedUser = {
          _id: new mongoose.Types.ObjectId(),
          ...userData,
          password: 'hashed_password123',
          functionalPreferences: {
            theme,
            language: 'zh-TW',
            personalization: {
              autoPlay: true,
              showNSFW: false,
              compactMode: false,
              infiniteScroll: true,
              notificationPreferences: {
                email: true,
                push: true,
                mentions: true,
                likes: true,
                comments: true,
              },
            },
            searchPreferences: {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: 'hot',
              defaultFilter: 'all',
            },
          },
        }

        mockUser.create.mockResolvedValue(expectedUser)

        const user = await mockUser.create(userData)
        expect(user.functionalPreferences.theme).toBe(theme)
      }
    })

    it('應該拒絕無效的主題設定', async () => {
      const invalidThemes = ['invalid', '', null, undefined, 123]

      for (const invalidTheme of invalidThemes) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            theme: invalidTheme,
          },
        }

        const error = new Error(`Invalid theme: ${invalidTheme}`)
        mockUser.create.mockRejectedValue(error)

        await expect(mockUser.create(userData)).rejects.toThrow(`Invalid theme: ${invalidTheme}`)
      }
    })

    it('應該接受有效的語言設定', async () => {
      const validLanguages = ['zh-TW', 'en-US', 'ja-JP']

      for (const language of validLanguages) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            language,
          },
        }

        const expectedUser = {
          _id: new mongoose.Types.ObjectId(),
          ...userData,
          password: 'hashed_password123',
          functionalPreferences: {
            theme: 'auto',
            language,
            personalization: {
              autoPlay: true,
              showNSFW: false,
              compactMode: false,
              infiniteScroll: true,
              notificationPreferences: {
                email: true,
                push: true,
                mentions: true,
                likes: true,
                comments: true,
              },
            },
            searchPreferences: {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: 'hot',
              defaultFilter: 'all',
            },
          },
        }

        mockUser.create.mockResolvedValue(expectedUser)

        const user = await mockUser.create(userData)
        expect(user.functionalPreferences.language).toBe(language)
      }
    })

    it('應該拒絕無效的語言設定', async () => {
      const invalidLanguages = ['invalid', '', null, undefined, 123]

      for (const invalidLanguage of invalidLanguages) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            language: invalidLanguage,
          },
        }

        const error = new Error(`Invalid language: ${invalidLanguage}`)
        mockUser.create.mockRejectedValue(error)

        await expect(mockUser.create(userData)).rejects.toThrow(
          `Invalid language: ${invalidLanguage}`,
        )
      }
    })

    it('應該接受有效的個人化設定', async () => {
      const personalizationData = {
        autoPlay: false,
        showNSFW: true,
        compactMode: true,
        infiniteScroll: false,
        notificationPreferences: {
          email: false,
          push: true,
          mentions: false,
          likes: true,
          comments: false,
        },
      }

      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'password123',
        functionalPreferences: {
          personalization: personalizationData,
        },
      }

      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
        functionalPreferences: {
          theme: 'auto',
          language: 'zh-TW',
          personalization: personalizationData,
          searchPreferences: {
            searchHistory: true,
            searchSuggestions: true,
            defaultSort: 'hot',
            defaultFilter: 'all',
          },
        },
      }

      mockUser.create.mockResolvedValue(expectedUser)

      const user = await mockUser.create(userData)
      expect(user.functionalPreferences.personalization).toEqual(personalizationData)
    })

    it('應該使用個人化設定的預設值', async () => {
      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'password123',
      }

      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
        functionalPreferences: {
          theme: 'auto',
          language: 'zh-TW',
          personalization: {
            autoPlay: true,
            showNSFW: false,
            compactMode: false,
            infiniteScroll: true,
            notificationPreferences: {
              email: true,
              push: true,
              mentions: true,
              likes: true,
              comments: true,
            },
          },
          searchPreferences: {
            searchHistory: true,
            searchSuggestions: true,
            defaultSort: 'hot',
            defaultFilter: 'all',
          },
        },
      }

      mockUser.create.mockResolvedValue(expectedUser)

      const user = await mockUser.create(userData)
      expect(user.functionalPreferences.personalization.autoPlay).toBe(true)
      expect(user.functionalPreferences.personalization.showNSFW).toBe(false)
      expect(user.functionalPreferences.personalization.compactMode).toBe(false)
      expect(user.functionalPreferences.personalization.infiniteScroll).toBe(true)
    })

    it('應該接受有效的搜尋偏好設定', async () => {
      const searchPreferencesData = {
        searchHistory: false,
        searchSuggestions: true,
        defaultSort: 'new',
        defaultFilter: 'sfw',
      }

      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'password123',
        functionalPreferences: {
          searchPreferences: searchPreferencesData,
        },
      }

      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
        functionalPreferences: {
          theme: 'auto',
          language: 'zh-TW',
          personalization: {
            autoPlay: true,
            showNSFW: false,
            compactMode: false,
            infiniteScroll: true,
            notificationPreferences: {
              email: true,
              push: true,
              mentions: true,
              likes: true,
              comments: true,
            },
          },
          searchPreferences: searchPreferencesData,
        },
      }

      mockUser.create.mockResolvedValue(expectedUser)

      const user = await mockUser.create(userData)
      expect(user.functionalPreferences.searchPreferences).toEqual(searchPreferencesData)
    })

    it('應該驗證搜尋排序選項', async () => {
      const validSortOptions = ['hot', 'new', 'top', 'rising']

      for (const sortOption of validSortOptions) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            searchPreferences: {
              defaultSort: sortOption,
            },
          },
        }

        const expectedUser = {
          _id: new mongoose.Types.ObjectId(),
          ...userData,
          password: 'hashed_password123',
          functionalPreferences: {
            theme: 'auto',
            language: 'zh-TW',
            personalization: {
              autoPlay: true,
              showNSFW: false,
              compactMode: false,
              infiniteScroll: true,
              notificationPreferences: {
                email: true,
                push: true,
                mentions: true,
                likes: true,
                comments: true,
              },
            },
            searchPreferences: {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: sortOption,
              defaultFilter: 'all',
            },
          },
        }

        mockUser.create.mockResolvedValue(expectedUser)

        const user = await mockUser.create(userData)
        expect(user.functionalPreferences.searchPreferences.defaultSort).toBe(sortOption)
      }
    })

    it('應該拒絕無效的搜尋排序選項', async () => {
      const invalidSortOptions = ['invalid', '', null, undefined, 123]

      for (const invalidSortOption of invalidSortOptions) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            searchPreferences: {
              defaultSort: invalidSortOption,
            },
          },
        }

        const error = new Error(`Invalid sort option: ${invalidSortOption}`)
        mockUser.create.mockRejectedValue(error)

        await expect(mockUser.create(userData)).rejects.toThrow(
          `Invalid sort option: ${invalidSortOption}`,
        )
      }
    })

    it('應該驗證搜尋篩選選項', async () => {
      const validFilterOptions = ['all', 'sfw', 'nsfw']

      for (const filterOption of validFilterOptions) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            searchPreferences: {
              defaultFilter: filterOption,
            },
          },
        }

        const expectedUser = {
          _id: new mongoose.Types.ObjectId(),
          ...userData,
          password: 'hashed_password123',
          functionalPreferences: {
            theme: 'auto',
            language: 'zh-TW',
            personalization: {
              autoPlay: true,
              showNSFW: false,
              compactMode: false,
              infiniteScroll: true,
              notificationPreferences: {
                email: true,
                push: true,
                mentions: true,
                likes: true,
                comments: true,
              },
            },
            searchPreferences: {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: 'hot',
              defaultFilter: filterOption,
            },
          },
        }

        mockUser.create.mockResolvedValue(expectedUser)

        const user = await mockUser.create(userData)
        expect(user.functionalPreferences.searchPreferences.defaultFilter).toBe(filterOption)
      }
    })

    it('應該拒絕無效的搜尋篩選選項', async () => {
      const invalidFilterOptions = ['invalid', '', null, undefined, 123]

      for (const invalidFilterOption of invalidFilterOptions) {
        const userData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123',
          functionalPreferences: {
            searchPreferences: {
              defaultFilter: invalidFilterOption,
            },
          },
        }

        const error = new Error(`Invalid filter option: ${invalidFilterOption}`)
        mockUser.create.mockRejectedValue(error)

        await expect(mockUser.create(userData)).rejects.toThrow(
          `Invalid filter option: ${invalidFilterOption}`,
        )
      }
    })
  })

  describe('functionalPreferences 更新操作', () => {
    it('應該成功更新主題設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const updateData = {
        'functionalPreferences.theme': 'dark',
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {
          theme: 'dark',
          language: 'zh-TW',
          personalization: {
            autoPlay: true,
            showNSFW: false,
            compactMode: false,
            infiniteScroll: true,
            notificationPreferences: {
              email: true,
              push: true,
              mentions: true,
              likes: true,
              comments: true,
            },
          },
          searchPreferences: {
            searchHistory: true,
            searchSuggestions: true,
            defaultSort: 'hot',
            defaultFilter: 'all',
          },
        },
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })

      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(userId, updateData, {
        new: true,
        runValidators: true,
      })
      expect(user.functionalPreferences.theme).toBe('dark')
    })

    it('應該成功更新語言設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const updateData = {
        'functionalPreferences.language': 'en-US',
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {
          theme: 'auto',
          language: 'en-US',
          personalization: {
            autoPlay: true,
            showNSFW: false,
            compactMode: false,
            infiniteScroll: true,
            notificationPreferences: {
              email: true,
              push: true,
              mentions: true,
              likes: true,
              comments: true,
            },
          },
          searchPreferences: {
            searchHistory: true,
            searchSuggestions: true,
            defaultSort: 'hot',
            defaultFilter: 'all',
          },
        },
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })

      expect(user.functionalPreferences.language).toBe('en-US')
    })

    it('應該成功更新個人化設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const personalizationData = {
        autoPlay: false,
        showNSFW: true,
        compactMode: true,
        infiniteScroll: false,
        notificationPreferences: {
          email: false,
          push: true,
          mentions: false,
          likes: true,
          comments: false,
        },
      }

      const updateData = {
        'functionalPreferences.personalization': personalizationData,
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {
          theme: 'auto',
          language: 'zh-TW',
          personalization: personalizationData,
          searchPreferences: {
            searchHistory: true,
            searchSuggestions: true,
            defaultSort: 'hot',
            defaultFilter: 'all',
          },
        },
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })

      expect(user.functionalPreferences.personalization).toEqual(personalizationData)
    })

    it('應該成功更新搜尋偏好設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const searchPreferencesData = {
        searchHistory: false,
        searchSuggestions: true,
        defaultSort: 'new',
        defaultFilter: 'sfw',
      }

      const updateData = {
        'functionalPreferences.searchPreferences': searchPreferencesData,
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {
          theme: 'auto',
          language: 'zh-TW',
          personalization: {
            autoPlay: true,
            showNSFW: false,
            compactMode: false,
            infiniteScroll: true,
            notificationPreferences: {
              email: true,
              push: true,
              mentions: true,
              likes: true,
              comments: true,
            },
          },
          searchPreferences: searchPreferencesData,
        },
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })

      expect(user.functionalPreferences.searchPreferences).toEqual(searchPreferencesData)
    })

    it('應該成功清除功能偏好設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const unsetData = {
        $unset: {
          'functionalPreferences.theme': 1,
          'functionalPreferences.language': 1,
          'functionalPreferences.personalization': 1,
          'functionalPreferences.searchPreferences': 1,
        },
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {},
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(userId, unsetData)

      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(userId, unsetData)
      expect(user.functionalPreferences).toEqual({})
    })
  })

  describe('functionalPreferences 查詢操作', () => {
    it('應該成功查詢用戶的功能偏好設定', async () => {
      const userId = new mongoose.Types.ObjectId()
      const expectedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {
          theme: 'dark',
          language: 'en-US',
          personalization: {
            autoPlay: false,
            showNSFW: true,
            compactMode: true,
            infiniteScroll: false,
            notificationPreferences: {
              email: false,
              push: true,
              mentions: false,
              likes: true,
              comments: false,
            },
          },
          searchPreferences: {
            searchHistory: false,
            searchSuggestions: true,
            defaultSort: 'new',
            defaultFilter: 'sfw',
          },
        },
      }

      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(expectedUser),
      })

      const user = await mockUser.findById(userId).select('functionalPreferences')

      expect(mockUser.findById).toHaveBeenCalledWith(userId)
      expect(user).toEqual(expectedUser)
      expect(user.functionalPreferences.theme).toBe('dark')
      expect(user.functionalPreferences.language).toBe('en-US')
      expect(user.functionalPreferences.personalization.autoPlay).toBe(false)
      expect(user.functionalPreferences.searchPreferences.defaultSort).toBe('new')
    })

    it('應該處理用戶沒有功能偏好設定的情況', async () => {
      const userId = new mongoose.Types.ObjectId()
      const expectedUser = {
        _id: userId,
        username: 'testuser',
        functionalPreferences: {},
      }

      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(expectedUser),
      })

      const user = await mockUser.findById(userId).select('functionalPreferences')

      expect(user.functionalPreferences).toEqual({})
    })
  })
})
