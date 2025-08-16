import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'
import { getCurrentEnvironment, validateEnvironment, performSecurityCheck } from './environment.js'

/**
 * 連接到 MongoDB
 */
const connectDB = async () => {
  try {
    // 環境驗證和安全檢查
    validateEnvironment()
    performSecurityCheck()

    const env = getCurrentEnvironment()
    const { uri, options } = env.database

    logger.info(`正在連接到 ${env.name} 環境的資料庫...`)
    logger.info(`資料庫名稱: ${env.database.name}`)

    await mongoose.connect(uri, options)

    // 監聽連線事件
    mongoose.connection.on('connected', () => {
      logger.info(`MongoDB ${env.name} 環境已連線`)
    })

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB ${env.name} 環境連線錯誤:`, err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn(`MongoDB ${env.name} 環境連線已斷開`)
    })

    // 優雅關閉
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info(`MongoDB ${env.name} 環境連線已關閉`)
      process.exit(0)
    })

    // 建立索引
    await createIndexes()
  } catch (err) {
    logger.error(`MongoDB ${getCurrentEnvironment().name} 環境連線失敗:`, err)
    process.exit(1)
  }
}

/**
 * 建立資料庫索引
 */
const createIndexes = async () => {
  try {
    // 取得所有模型
    const models = mongoose.models

    // 為每個模型建立索引
    for (const [modelName, model] of Object.entries(models)) {
      await createModelIndexes(model, modelName)
    }

    logger.info('資料庫索引建立完成')
  } catch (error) {
    logger.error('建立索引失敗:', error)
  }
}

/**
 * 為特定模型建立索引
 * @param {Object} model - Mongoose 模型
 * @param {string} modelName - 模型名稱
 */
const createModelIndexes = async (model, modelName) => {
  try {
    // 檢查模型是否有效
    if (!model || !model.collection) {
      throw new Error(`模型 ${modelName} 無效或沒有 collection 屬性`)
    }

    // 檢查資料庫連接狀態
    if (!mongoose.connection.readyState) {
      throw new Error(`資料庫未連接，狀態: ${mongoose.connection.readyState}`)
    }

    // 檢查集合是否存在
    const collections = await mongoose.connection.db
      .listCollections({ name: model.collection.name })
      .toArray()
    if (collections.length === 0) {
      logger.warn(`集合 ${model.collection.name} 不存在，跳過索引建立`)
      return
    }

    logger.debug(`開始為 ${modelName} 模型建立索引...`)

    // 通用索引建立函數，包含錯誤處理
    const createIndexSafely = async (indexSpec, options = {}) => {
      try {
        await model.collection.createIndex(indexSpec, options)
        logger.debug(`成功建立索引: ${JSON.stringify(indexSpec)}`)
      } catch (error) {
        // 如果是索引已存在的錯誤，記錄為警告而不是錯誤
        if (
          error.message.includes('existing index has the same name') ||
          error.message.includes('already exists')
        ) {
          logger.debug(`索引已存在，跳過建立: ${JSON.stringify(indexSpec)}`)
        } else {
          logger.warn(`建立索引失敗: ${JSON.stringify(indexSpec)}, 錯誤: ${error.message}`)
        }
      }
    }

    switch (modelName) {
      case 'User':
        await createIndexSafely({ username: 1 }, { unique: true })
        await createIndexSafely({ email: 1 }, { unique: false })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({ status: 1 })
        break

      case 'Meme':
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ author_id: 1 })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({ hot_score: -1 })
        await createIndexSafely({ tags_cache: 1 })
        await createIndexSafely({
          status: 1,
          created_at: -1,
        })
        await createIndexSafely({
          status: 1,
          hot_score: -1,
        })
        // 暫時移除全文搜尋索引以避免相容性問題
        // await createIndexSafely(
        //   {
        //     status: 1,
        //     title: 'text',
        //     description: 'text',
        //   },
        //   {
        //     default_language: 'none',
        //   },
        // )
        break

      case 'Like':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely(
          {
            user_id: 1,
            meme_id: 1,
          },
          { unique: true },
        )
        await createIndexSafely({ created_at: -1 })
        break

      case 'Comment':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({
          meme_id: 1,
          status: 1,
          created_at: -1,
        })
        break

      case 'Share':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      case 'View':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({
          meme_id: 1,
          created_at: -1,
        })
        break

      case 'Collection':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      case 'Follow':
        await createIndexSafely({ follower_id: 1 })
        await createIndexSafely({ following_id: 1 })
        await createIndexSafely(
          {
            follower_id: 1,
            following_id: 1,
          },
          { unique: true },
        )
        break

      case 'Tag':
        await createIndexSafely({ name: 1 }, { unique: true })
        await createIndexSafely({ usage_count: -1 })
        break

      case 'MemeTag':
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ tag_id: 1 })
        await createIndexSafely(
          {
            meme_id: 1,
            tag_id: 1,
          },
          { unique: true },
        )
        break

      case 'Notification':
        await createIndexSafely({ user_id: 1 })
        await createIndexSafely({ is_read: 1 })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({
          user_id: 1,
          is_read: 1,
        })
        break

      case 'Report':
        await createIndexSafely({ reporter_id: 1 })
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      case 'MemeVersion':
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ version: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      case 'MemeEditProposal':
        await createIndexSafely({ meme_id: 1 })
        await createIndexSafely({ proposer_id: 1 })
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      case 'Announcement':
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ created_at: -1 })
        await createIndexSafely({
          status: 1,
          created_at: -1,
        })
        break

      case 'Sponsor':
        await createIndexSafely({ status: 1 })
        await createIndexSafely({ created_at: -1 })
        break

      default:
        // 為其他模型建立基本索引
        await createIndexSafely({ created_at: -1 })
        break
    }
  } catch (error) {
    logger.error(`建立 ${modelName} 索引失敗: ${error.message}`)
    logger.error(`錯誤詳情: ${error.stack}`)
    throw error // 重新拋出錯誤以便上層處理
  }
}

/**
 * 取得資料庫統計資訊
 */
const getDBStats = async () => {
  try {
    const db = mongoose.connection.db
    const stats = await db.stats()

    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
    }
  } catch (error) {
    logger.error('取得資料庫統計失敗:', error)
    return null
  }
}

/**
 * 取得集合統計資訊
 */
const getCollectionStats = async (collectionName) => {
  try {
    const db = mongoose.connection.db
    const collection = db.collection(collectionName)
    const stats = await collection.stats()

    return {
      count: stats.count,
      size: stats.size,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      indexes: stats.nindexes,
      totalIndexSize: stats.totalIndexSize,
    }
  } catch (error) {
    logger.error(`取得 ${collectionName} 統計失敗:`, error)
    return null
  }
}

export default connectDB
export { getDBStats, getCollectionStats }
