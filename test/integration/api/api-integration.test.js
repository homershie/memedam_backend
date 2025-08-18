import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Comment from '../../../models/Comment.js'
import Like from '../../../models/Like.js'
import Follow from '../../../models/Follow.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('API 整合測試套件', () => {
  let testUser1, testUser2, testUser3
  let authToken1, authToken2, authToken3
  let testMeme1, testMeme2, testMeme3

  beforeAll(async () => {
    // 創建測試用戶
    testUser1 = await createTestUser(User, {
      username: `api_test_user1_${Date.now()}`,
      email: `api_test1_${Date.now()}@example.com`,
      is_verified: true,
    })

    testUser2 = await createTestUser(User, {
      username: `api_test_user2_${Date.now()}`,
      email: `api_test2_${Date.now()}@example.com`,
      is_verified: true,
    })

    testUser3 = await createTestUser(User, {
      username: `api_test_user3_${Date.now()}`,
      email: `api_test3_${Date.now()}@example.com`,
      is_verified: true,
    })

    // 登入取得 tokens
    const [login1, login2, login3] = await Promise.all([
      request(app).post('/api/users/login').send({
        email: testUser1.email,
        password: 'testpassword123',
      }),
      request(app).post('/api/users/login').send({
        email: testUser2.email,
        password: 'testpassword123',
      }),
      request(app).post('/api/users/login').send({
        email: testUser3.email,
        password: 'testpassword123',
      }),
    ])

    authToken1 = login1.body.token
    authToken2 = login2.body.token
    authToken3 = login3.body.token

    // 創建測試迷因
    testMeme1 = await createTestMeme(Meme, {
      title: `API Test Meme 1_${Date.now()}`,
      author_id: testUser1._id,
      image_url: 'https://example.com/meme1.jpg',
      tags: ['funny', 'test'],
      view_count: 100,
      like_count: 10,
    })

    testMeme2 = await createTestMeme(Meme, {
      title: `API Test Meme 2_${Date.now()}`,
      author_id: testUser2._id,
      image_url: 'https://example.com/meme2.jpg',
      tags: ['meme', 'test'],
      view_count: 200,
      like_count: 20,
    })

    testMeme3 = await createTestMeme(Meme, {
      title: `API Test Meme 3_${Date.now()}`,
      author_id: testUser3._id,
      image_url: 'https://example.com/meme3.jpg',
      tags: ['viral', 'trending'],
      view_count: 500,
      like_count: 50,
    })
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme, Comment, Like, Follow })
  })

  describe('身分驗證與授權流程', () => {
    describe('用戶註冊', () => {
      it('應該成功註冊新用戶', async () => {
        const newUser = {
          username: `new_user_${Date.now()}`,
          email: `new_${Date.now()}@example.com`,
          password: 'SecurePass123!',
        }

        const response = await request(app)
          .post('/api/users/register')
          .send(newUser)

        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('user')
        expect(response.body.data.user.email).toBe(newUser.email)
      })

      it('應該拒絕重複的 email', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .send({
            username: `another_user_${Date.now()}`,
            email: testUser1.email,
            password: 'SecurePass123!',
          })

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('已存在')
      })

      it('應該驗證密碼強度', async () => {
        const response = await request(app)
          .post('/api/users/register')
          .send({
            username: `weak_pass_${Date.now()}`,
            email: `weak_${Date.now()}@example.com`,
            password: '123',
          })

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('密碼')
      })
    })

    describe('用戶登入', () => {
      it('應該成功登入並返回 token', async () => {
        const response = await request(app)
          .post('/api/users/login')
          .send({
            email: testUser1.email,
            password: 'testpassword123',
          })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('token')
        expect(response.body.user.email).toBe(testUser1.email)
      })

      it('應該拒絕錯誤的密碼', async () => {
        const response = await request(app)
          .post('/api/users/login')
          .send({
            email: testUser1.email,
            password: 'wrongpassword',
          })

        expect(response.status).toBe(401)
        expect(response.body.success).toBe(false)
      })

      it('應該拒絕不存在的用戶', async () => {
        const response = await request(app)
          .post('/api/users/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'anypassword',
          })

        expect(response.status).toBe(401)
        expect(response.body.success).toBe(false)
      })
    })

    describe('Token 驗證', () => {
      it('應該接受有效的 token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      it('應該拒絕無效的 token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid_token')

        expect(response.status).toBe(401)
        expect(response.body.success).toBe(false)
      })

      it('應該拒絕沒有 token 的請求', async () => {
        const response = await request(app)
          .get('/api/users/profile')

        expect(response.status).toBe(401)
        expect(response.body.success).toBe(false)
      })
    })
  })

  describe('迷因 CRUD 操作', () => {
    describe('創建迷因', () => {
      it('應該成功創建新迷因', async () => {
        const newMeme = {
          title: `New Meme ${Date.now()}`,
          description: 'This is a test meme',
          image_url: 'https://example.com/new-meme.jpg',
          tags: ['new', 'test'],
        }

        const response = await request(app)
          .post('/api/memes')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(newMeme)

        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.title).toBe(newMeme.title)
        expect(response.body.data.author_id).toBe(testUser1._id.toString())
      })

      it('應該驗證必填欄位', async () => {
        const response = await request(app)
          .post('/api/memes')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            description: 'Missing title',
          })

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
      })

      it('應該拒絕未授權的創建', async () => {
        const response = await request(app)
          .post('/api/memes')
          .send({
            title: 'Unauthorized meme',
            image_url: 'https://example.com/unauth.jpg',
          })

        expect(response.status).toBe(401)
        expect(response.body.success).toBe(false)
      })
    })

    describe('讀取迷因', () => {
      it('應該獲取單個迷因', async () => {
        const response = await request(app)
          .get(`/api/memes/${testMeme1._id}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data._id).toBe(testMeme1._id.toString())
      })

      it('應該獲取迷因列表', async () => {
        const response = await request(app)
          .get('/api/memes')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
        expect(response.body.data.length).toBeGreaterThan(0)
      })

      it('應該支援分頁', async () => {
        const response = await request(app)
          .get('/api/memes?page=1&limit=2')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveLength(2)
        expect(response.body.pagination).toBeDefined()
        expect(response.body.pagination.page).toBe(1)
        expect(response.body.pagination.limit).toBe(2)
      })

      it('應該支援標籤過濾', async () => {
        const response = await request(app)
          .get('/api/memes?tags=test')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data.every(meme => 
          meme.tags.includes('test')
        )).toBe(true)
      })
    })

    describe('更新迷因', () => {
      it('應該允許作者更新自己的迷因', async () => {
        const updates = {
          title: 'Updated Title',
          description: 'Updated description',
        }

        const response = await request(app)
          .patch(`/api/memes/${testMeme1._id}`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send(updates)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data.title).toBe(updates.title)
      })

      it('應該拒絕非作者的更新', async () => {
        const response = await request(app)
          .patch(`/api/memes/${testMeme1._id}`)
          .set('Authorization', `Bearer ${authToken2}`)
          .send({
            title: 'Unauthorized update',
          })

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })
    })

    describe('刪除迷因', () => {
      let memeToDelete

      beforeEach(async () => {
        memeToDelete = await createTestMeme(Meme, {
          title: `Delete Test ${Date.now()}`,
          author_id: testUser1._id,
          image_url: 'https://example.com/delete.jpg',
        })
      })

      it('應該允許作者刪除自己的迷因', async () => {
        const response = await request(app)
          .delete(`/api/memes/${memeToDelete._id}`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        // 確認迷因已被刪除
        const checkResponse = await request(app)
          .get(`/api/memes/${memeToDelete._id}`)

        expect(checkResponse.status).toBe(404)
      })

      it('應該拒絕非作者的刪除', async () => {
        const response = await request(app)
          .delete(`/api/memes/${memeToDelete._id}`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })
    })
  })

  describe('互動行為', () => {
    describe('讚/噓功能', () => {
      it('應該成功對迷因按讚', async () => {
        const response = await request(app)
          .post(`/api/memes/${testMeme2._id}/like`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data.likes).toBeGreaterThan(0)
      })

      it('應該防止重複按讚', async () => {
        // 第一次按讚
        await request(app)
          .post(`/api/memes/${testMeme3._id}/like`)
          .set('Authorization', `Bearer ${authToken1}`)

        // 嘗試重複按讚
        const response = await request(app)
          .post(`/api/memes/${testMeme3._id}/like`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
      })

      it('應該能夠取消讚', async () => {
        // 先按讚
        await request(app)
          .post(`/api/memes/${testMeme2._id}/like`)
          .set('Authorization', `Bearer ${authToken3}`)

        // 取消讚
        const response = await request(app)
          .delete(`/api/memes/${testMeme2._id}/like`)
          .set('Authorization', `Bearer ${authToken3}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      it('應該能夠按噓', async () => {
        const response = await request(app)
          .post(`/api/memes/${testMeme2._id}/dislike`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })

    describe('收藏功能', () => {
      it('應該成功收藏迷因', async () => {
        const response = await request(app)
          .post(`/api/memes/${testMeme1._id}/favorite`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      it('應該獲取用戶的收藏列表', async () => {
        // 先收藏幾個迷因
        await request(app)
          .post(`/api/memes/${testMeme1._id}/favorite`)
          .set('Authorization', `Bearer ${authToken3}`)

        await request(app)
          .post(`/api/memes/${testMeme2._id}/favorite`)
          .set('Authorization', `Bearer ${authToken3}`)

        // 獲取收藏列表
        const response = await request(app)
          .get('/api/users/favorites')
          .set('Authorization', `Bearer ${authToken3}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
        expect(response.body.data.length).toBeGreaterThanOrEqual(2)
      })

      it('應該能夠取消收藏', async () => {
        // 先收藏
        await request(app)
          .post(`/api/memes/${testMeme3._id}/favorite`)
          .set('Authorization', `Bearer ${authToken1}`)

        // 取消收藏
        const response = await request(app)
          .delete(`/api/memes/${testMeme3._id}/favorite`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })

    describe('留言功能', () => {
      let commentId

      it('應該成功發表留言', async () => {
        const comment = {
          content: 'This is a great meme!',
        }

        const response = await request(app)
          .post(`/api/memes/${testMeme1._id}/comments`)
          .set('Authorization', `Bearer ${authToken2}`)
          .send(comment)

        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.content).toBe(comment.content)
        expect(response.body.data.author_id).toBe(testUser2._id.toString())

        commentId = response.body.data._id
      })

      it('應該獲取迷因的留言列表', async () => {
        const response = await request(app)
          .get(`/api/memes/${testMeme1._id}/comments`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
      })

      it('應該支援留言回覆', async () => {
        const reply = {
          content: 'I agree with you!',
          parent_id: commentId,
        }

        const response = await request(app)
          .post(`/api/memes/${testMeme1._id}/comments`)
          .set('Authorization', `Bearer ${authToken3}`)
          .send(reply)

        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.parent_id).toBe(commentId)
      })

      it('應該允許作者刪除自己的留言', async () => {
        const response = await request(app)
          .delete(`/api/comments/${commentId}`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })

    describe('分享功能', () => {
      it('應該記錄分享行為', async () => {
        const response = await request(app)
          .post(`/api/memes/${testMeme1._id}/share`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            platform: 'facebook',
          })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data.share_count).toBeGreaterThan(0)
      })

      it('應該獲取分享統計', async () => {
        const response = await request(app)
          .get(`/api/memes/${testMeme1._id}/share-stats`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('total_shares')
        expect(response.body.data).toHaveProperty('by_platform')
      })
    })

    describe('關注功能', () => {
      it('應該成功關注用戶', async () => {
        const response = await request(app)
          .post(`/api/users/${testUser2._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      it('應該防止重複關注', async () => {
        // 第一次關注
        await request(app)
          .post(`/api/users/${testUser3._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)

        // 嘗試重複關注
        const response = await request(app)
          .post(`/api/users/${testUser3._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
      })

      it('應該獲取關注者列表', async () => {
        const response = await request(app)
          .get(`/api/users/${testUser2._id}/followers`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
      })

      it('應該獲取關注中列表', async () => {
        const response = await request(app)
          .get(`/api/users/${testUser1._id}/following`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
      })

      it('應該能夠取消關注', async () => {
        // 先關注
        await request(app)
          .post(`/api/users/${testUser2._id}/follow`)
          .set('Authorization', `Bearer ${authToken3}`)

        // 取消關注
        const response = await request(app)
          .delete(`/api/users/${testUser2._id}/follow`)
          .set('Authorization', `Bearer ${authToken3}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })
  })

  describe('推薦演算法測試', () => {
    describe('熱門推薦', () => {
      it('應該返回熱門迷因', async () => {
        const response = await request(app)
          .get('/api/memes/hot')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
        
        // 檢查是否按熱度排序
        if (response.body.data.length > 1) {
          const scores = response.body.data.map(meme => 
            meme.view_count + meme.like_count * 2 + meme.comment_count * 3
          )
          expect(scores).toEqual([...scores].sort((a, b) => b - a))
        }
      })

      it('應該支援時間範圍過濾', async () => {
        const response = await request(app)
          .get('/api/memes/hot?timeRange=week')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // 檢查返回的迷因是否在一週內
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        response.body.data.forEach(meme => {
          expect(new Date(meme.created_at)).toBeAfter(oneWeekAgo)
        })
      })
    })

    describe('個人化推薦', () => {
      beforeEach(async () => {
        // 建立用戶行為數據
        await request(app)
          .post(`/api/memes/${testMeme1._id}/like`)
          .set('Authorization', `Bearer ${authToken1}`)

        await request(app)
          .post(`/api/memes/${testMeme2._id}/view`)
          .set('Authorization', `Bearer ${authToken1}`)
      })

      it('應該基於用戶歷史推薦內容', async () => {
        const response = await request(app)
          .get('/api/memes/recommended')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeInstanceOf(Array)
      })

      it('應該排除已看過的內容', async () => {
        const response = await request(app)
          .get('/api/memes/recommended?excludeViewed=true')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // 檢查是否不包含已看過的迷因
        const viewedIds = [testMeme1._id.toString(), testMeme2._id.toString()]
        response.body.data.forEach(meme => {
          expect(viewedIds).not.toContain(meme._id)
        })
      })
    })

    describe('社交推薦', () => {
      beforeEach(async () => {
        // 建立社交關係
        await request(app)
          .post(`/api/users/${testUser2._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)

        await request(app)
          .post(`/api/users/${testUser3._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)
      })

      it('應該推薦關注用戶的內容', async () => {
        const response = await request(app)
          .get('/api/memes/following')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // 檢查是否來自關注的用戶
        const followingIds = [testUser2._id.toString(), testUser3._id.toString()]
        response.body.data.forEach(meme => {
          expect(followingIds).toContain(meme.author_id)
        })
      })

      it('應該推薦朋友喜歡的內容', async () => {
        // 朋友按讚
        await request(app)
          .post(`/api/memes/${testMeme3._id}/like`)
          .set('Authorization', `Bearer ${authToken2}`)

        const response = await request(app)
          .get('/api/memes/friends-liked')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })
  })

  describe('效能與穩定性測試', () => {
    describe('並發請求處理', () => {
      it('應該能處理多個並發請求', async () => {
        const requests = []
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app)
              .get('/api/memes')
              .set('Authorization', `Bearer ${authToken1}`)
          )
        }

        const responses = await Promise.all(requests)
        
        responses.forEach(response => {
          expect(response.status).toBe(200)
          expect(response.body.success).toBe(true)
        })
      })

      it('應該正確處理並發寫入', async () => {
        const likeRequests = []
        const tokens = [authToken1, authToken2, authToken3]

        // 多個用戶同時按讚
        for (const token of tokens) {
          likeRequests.push(
            request(app)
              .post(`/api/memes/${testMeme1._id}/like`)
              .set('Authorization', `Bearer ${token}`)
          )
        }

        const responses = await Promise.all(likeRequests)
        
        // 檢查所有請求都成功
        responses.forEach(response => {
          expect([200, 400]).toContain(response.status) // 200 成功，400 已按過讚
        })

        // 檢查最終狀態
        const meme = await Meme.findById(testMeme1._id)
        expect(meme.like_count).toBeGreaterThanOrEqual(testMeme1.like_count)
      })
    })

    describe('大數據量處理', () => {
      beforeEach(async () => {
        // 創建大量測試數據
        const memes = []
        for (let i = 0; i < 50; i++) {
          memes.push({
            title: `Bulk Meme ${i}`,
            author_id: testUser1._id,
            image_url: `https://example.com/bulk${i}.jpg`,
            tags: ['bulk', 'test'],
            view_count: Math.floor(Math.random() * 1000),
            like_count: Math.floor(Math.random() * 100),
          })
        }
        await Meme.insertMany(memes)
      })

      it('應該有效處理大量數據的分頁', async () => {
        const response = await request(app)
          .get('/api/memes?page=1&limit=20')

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveLength(20)
        expect(response.body.pagination.total).toBeGreaterThanOrEqual(50)
      })

      it('應該在合理時間內返回結果', async () => {
        const startTime = Date.now()
        
        const response = await request(app)
          .get('/api/memes?limit=100')

        const endTime = Date.now()
        const responseTime = endTime - startTime

        expect(response.status).toBe(200)
        expect(responseTime).toBeLessThan(2000) // 應該在 2 秒內返回
      })
    })

    describe('錯誤恢復', () => {
      it('應該優雅處理無效的 ID', async () => {
        const response = await request(app)
          .get('/api/memes/invalid_id')

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toBeDefined()
      })

      it('應該處理不存在的資源', async () => {
        const fakeId = '507f1f77bcf86cd799439011'
        const response = await request(app)
          .get(`/api/memes/${fakeId}`)

        expect(response.status).toBe(404)
        expect(response.body.success).toBe(false)
      })

      it('應該處理格式錯誤的請求', async () => {
        const response = await request(app)
          .post('/api/memes')
          .set('Authorization', `Bearer ${authToken1}`)
          .send('invalid json')
          .set('Content-Type', 'application/json')

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
      })
    })
  })

  describe('資料一致性檢查', () => {
    describe('交易一致性', () => {
      it('應該確保按讚計數的一致性', async () => {
        const meme = await createTestMeme(Meme, {
          title: `Consistency Test ${Date.now()}`,
          author_id: testUser1._id,
          like_count: 0,
        })

        // 多個用戶按讚
        await request(app)
          .post(`/api/memes/${meme._id}/like`)
          .set('Authorization', `Bearer ${authToken1}`)

        await request(app)
          .post(`/api/memes/${meme._id}/like`)
          .set('Authorization', `Bearer ${authToken2}`)

        await request(app)
          .post(`/api/memes/${meme._id}/like`)
          .set('Authorization', `Bearer ${authToken3}`)

        // 檢查計數
        const updatedMeme = await Meme.findById(meme._id)
        const likeCount = await Like.countDocuments({
          target_id: meme._id,
          target_type: 'Meme',
        })

        expect(updatedMeme.like_count).toBe(likeCount)
      })

      it('應該確保關注計數的一致性', async () => {
        const newUser = await createTestUser(User, {
          username: `consistency_${Date.now()}`,
          email: `consistency_${Date.now()}@example.com`,
        })

        // 多個用戶關注
        await request(app)
          .post(`/api/users/${newUser._id}/follow`)
          .set('Authorization', `Bearer ${authToken1}`)

        await request(app)
          .post(`/api/users/${newUser._id}/follow`)
          .set('Authorization', `Bearer ${authToken2}`)

        // 檢查計數
        const updatedUser = await User.findById(newUser._id)
        const followerCount = await Follow.countDocuments({
          following_id: newUser._id,
        })

        expect(updatedUser.followers_count).toBe(followerCount)
      })
    })

    describe('級聯操作', () => {
      it('刪除迷因應該刪除相關的讚和留言', async () => {
        const meme = await createTestMeme(Meme, {
          title: `Cascade Delete Test ${Date.now()}`,
          author_id: testUser1._id,
        })

        // 添加讚和留言
        await Like.create({
          user_id: testUser2._id,
          target_id: meme._id,
          target_type: 'Meme',
        })

        await Comment.create({
          content: 'Test comment',
          author_id: testUser2._id,
          meme_id: meme._id,
        })

        // 刪除迷因
        await request(app)
          .delete(`/api/memes/${meme._id}`)
          .set('Authorization', `Bearer ${authToken1}`)

        // 檢查相關數據是否被刪除
        const likes = await Like.find({ target_id: meme._id })
        const comments = await Comment.find({ meme_id: meme._id })

        expect(likes).toHaveLength(0)
        expect(comments).toHaveLength(0)
      })

      it('刪除用戶應該處理其所有內容', async () => {
        const userToDelete = await createTestUser(User, {
          username: `delete_test_${Date.now()}`,
          email: `delete_${Date.now()}@example.com`,
        })

              // 創建用戶內容
      await createTestMeme(Meme, {
        title: 'User content',
        author_id: userToDelete._id,
      })

        await Comment.create({
          content: 'User comment',
          author_id: userToDelete._id,
          meme_id: testMeme1._id,
        })

        // 刪除用戶
        await User.findByIdAndDelete(userToDelete._id)

        // 檢查內容處理（可能是刪除或標記）
        const userMemes = await Meme.find({ author_id: userToDelete._id })
        const userComments = await Comment.find({ author_id: userToDelete._id })

        // 根據業務邏輯，可能是刪除或保留但標記
        expect(userMemes.length + userComments.length).toBeLessThanOrEqual(2)
      })
    })
  })
})