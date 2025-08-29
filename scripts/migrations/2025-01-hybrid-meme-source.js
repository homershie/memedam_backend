#!/usr/bin/env node

/**
 * 資料遷移腳本：導入三層來源結構（Source/Scene/Meme）
 * 
 * 執行方式：
 * node scripts/migrations/2025-01-hybrid-meme-source.js
 * 
 * 功能：
 * 1. 在 memes 集合加入新欄位：source_id, scene_id, variant_of, lineage, body
 * 2. 計算並更新所有迷因的 lineage（系譜）
 * 3. 更新來源和片段的統計數據
 * 4. 建立必要的索引
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 載入環境變數
dotenv.config({ path: path.join(__dirname, '../../.env') })

// 匯入模型
import Meme from '../../models/Meme.js'
import Source from '../../models/Source.js'
import Scene from '../../models/Scene.js'

// 連接資料庫
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('✅ 資料庫連接成功')
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error)
    process.exit(1)
  }
}

// 進度追蹤器
class ProgressTracker {
  constructor(total, taskName) {
    this.total = total
    this.current = 0
    this.taskName = taskName
    this.startTime = Date.now()
  }

  update(increment = 1) {
    this.current += increment
    const percentage = ((this.current / this.total) * 100).toFixed(2)
    const elapsed = (Date.now() - this.startTime) / 1000
    const rate = this.current / elapsed
    const remaining = (this.total - this.current) / rate
    
    process.stdout.write(
      `\r${this.taskName}: ${this.current}/${this.total} (${percentage}%) ` +
      `- 已用時: ${elapsed.toFixed(1)}s, 預計剩餘: ${remaining.toFixed(1)}s`
    )
  }

  complete() {
    const elapsed = (Date.now() - this.startTime) / 1000
    console.log(`\n✅ ${this.taskName} 完成！總用時: ${elapsed.toFixed(1)}s`)
  }
}

// 步驟 1：為 memes 集合添加新欄位
const addNewFieldsToMemes = async () => {
  console.log('\n📝 步驟 1：為 memes 集合添加新欄位...')
  
  try {
    // 檢查是否已有這些欄位
    const sampleMeme = await Meme.findOne().lean()
    if (sampleMeme && 'source_id' in sampleMeme) {
      console.log('⚠️  欄位已存在，跳過此步驟')
      return
    }

    // 使用 bulkWrite 批次更新
    const bulkOps = []
    const memes = await Meme.find({}).select('_id').lean()
    const tracker = new ProgressTracker(memes.length, '添加新欄位')

    for (const meme of memes) {
      bulkOps.push({
        updateOne: {
          filter: { _id: meme._id },
          update: {
            $setOnInsert: {
              source_id: null,
              scene_id: null,
              variant_of: null,
              lineage: {
                root: meme._id,
                depth: 0,
              },
              body: '',
            },
          },
          upsert: false,
        },
      })

      // 每 1000 筆執行一次批次更新
      if (bulkOps.length >= 1000) {
        await Meme.bulkWrite(bulkOps, { ordered: false })
        tracker.update(bulkOps.length)
        bulkOps.length = 0
      }
    }

    // 處理剩餘的更新
    if (bulkOps.length > 0) {
      await Meme.bulkWrite(bulkOps, { ordered: false })
      tracker.update(bulkOps.length)
    }

    tracker.complete()
  } catch (error) {
    console.error('❌ 添加新欄位失敗:', error)
    throw error
  }
}

// 步驟 2：計算並更新 lineage（系譜）
const calculateLineage = async () => {
  console.log('\n🌳 步驟 2：計算並更新 lineage（系譜）...')
  
  try {
    // 找出所有有 variant_of 的迷因
    const variantMemes = await Meme.find({ 
      variant_of: { $ne: null } 
    }).select('_id variant_of').lean()

    if (variantMemes.length === 0) {
      console.log('⚠️  沒有變體迷因，跳過此步驟')
      return
    }

    const tracker = new ProgressTracker(variantMemes.length, '計算系譜')
    const bulkOps = []

    for (const meme of variantMemes) {
      let root = meme.variant_of
      let depth = 1
      const seen = new Set([String(meme._id)])

      // 向上追溯找到根源
      while (root) {
        if (seen.has(String(root))) {
          console.warn(`\n⚠️  檢測到循環引用: ${meme._id}`)
          break
        }
        seen.add(String(root))

        const parent = await Meme.findById(root)
          .select('variant_of lineage.root')
          .lean()

        if (!parent) break

        // 如果父節點已有 lineage.root，直接使用
        if (parent.lineage?.root) {
          root = parent.lineage.root
          depth = (parent.lineage.depth || 0) + 1
          break
        }

        // 否則繼續向上追溯
        if (parent.variant_of) {
          root = parent.variant_of
          depth++
        } else {
          // parent 就是根源
          root = parent._id
          break
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: meme._id },
          update: {
            $set: {
              lineage: {
                root: root || meme.variant_of,
                depth: depth,
              },
            },
          },
        },
      })

      // 每 500 筆執行一次批次更新
      if (bulkOps.length >= 500) {
        await Meme.bulkWrite(bulkOps, { ordered: false })
        tracker.update(bulkOps.length)
        bulkOps.length = 0
      }
    }

    // 處理剩餘的更新
    if (bulkOps.length > 0) {
      await Meme.bulkWrite(bulkOps, { ordered: false })
      tracker.update(bulkOps.length)
    }

    tracker.complete()
  } catch (error) {
    console.error('❌ 計算系譜失敗:', error)
    throw error
  }
}

// 步驟 3：更新來源的統計數據
const updateSourceStats = async () => {
  console.log('\n📊 步驟 3：更新來源的統計數據...')
  
  try {
    const sources = await Source.find({ status: { $ne: 'deleted' } }).select('_id')
    
    if (sources.length === 0) {
      console.log('⚠️  沒有來源資料，跳過此步驟')
      return
    }

    const tracker = new ProgressTracker(sources.length, '更新來源統計')

    for (const source of sources) {
      // 計算相關片段數
      const sceneCount = await Scene.countDocuments({
        source_id: source._id,
        status: { $ne: 'deleted' },
      })

      // 計算相關迷因數和統計
      const memeStats = await Meme.aggregate([
        {
          $match: {
            source_id: source._id,
            status: { $ne: 'deleted' },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalViews: { $sum: '$views' },
            totalLikes: { $sum: '$like_count' },
            totalComments: { $sum: '$comment_count' },
          },
        },
      ])

      const stats = memeStats[0] || {
        count: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
      }

      await Source.findByIdAndUpdate(source._id, {
        $set: {
          'counts.scenes': sceneCount,
          'counts.memes': stats.count,
          'counts.views': stats.totalViews,
          'counts.likes': stats.totalLikes,
          'counts.comments': stats.totalComments,
        },
      })

      tracker.update()
    }

    tracker.complete()
  } catch (error) {
    console.error('❌ 更新來源統計失敗:', error)
    throw error
  }
}

// 步驟 4：更新片段的統計數據
const updateSceneStats = async () => {
  console.log('\n📊 步驟 4：更新片段的統計數據...')
  
  try {
    const scenes = await Scene.find({ status: { $ne: 'deleted' } }).select('_id')
    
    if (scenes.length === 0) {
      console.log('⚠️  沒有片段資料，跳過此步驟')
      return
    }

    const tracker = new ProgressTracker(scenes.length, '更新片段統計')

    for (const scene of scenes) {
      // 計算使用此片段的迷因數和統計
      const memeStats = await Meme.aggregate([
        {
          $match: {
            scene_id: scene._id,
            status: { $ne: 'deleted' },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalViews: { $sum: '$views' },
          },
        },
      ])

      const stats = memeStats[0] || {
        count: 0,
        totalViews: 0,
      }

      await Scene.findByIdAndUpdate(scene._id, {
        $set: {
          'counts.memes': stats.count,
          'counts.views': stats.totalViews,
          'counts.uses': stats.count,
        },
      })

      tracker.update()
    }

    tracker.complete()
  } catch (error) {
    console.error('❌ 更新片段統計失敗:', error)
    throw error
  }
}

// 步驟 5：建立索引
const createIndexes = async () => {
  console.log('\n🔍 步驟 5：建立索引...')
  
  try {
    // Meme 索引
    console.log('  建立 Meme 索引...')
    await Meme.collection.createIndex({ source_id: 1 })
    await Meme.collection.createIndex({ scene_id: 1 })
    await Meme.collection.createIndex({ variant_of: 1 })
    await Meme.collection.createIndex({ 'lineage.root': 1 })
    await Meme.collection.createIndex({ 'lineage.root': 1, 'lineage.depth': 1 })
    await Meme.collection.createIndex({ source_id: 1, status: 1 })
    await Meme.collection.createIndex({ scene_id: 1, status: 1 })

    // Source 索引
    console.log('  建立 Source 索引...')
    await Source.collection.createIndex({ slug: 1 }, { unique: true, sparse: true })
    await Source.collection.createIndex({ title: 1 })
    await Source.collection.createIndex({ type: 1, status: 1 })
    await Source.collection.createIndex({ 'counts.memes': -1 })

    // Scene 索引
    console.log('  建立 Scene 索引...')
    await Scene.collection.createIndex({ source_id: 1, start_time: 1 })
    await Scene.collection.createIndex({ source_id: 1, status: 1 })
    await Scene.collection.createIndex({ slug: 1 }, { sparse: true })
    await Scene.collection.createIndex({ 'counts.memes': -1 })

    console.log('✅ 索引建立完成')
  } catch (error) {
    console.error('❌ 建立索引失敗:', error)
    throw error
  }
}

// 主執行函數
const main = async () => {
  console.log('🚀 開始執行三層模型資料遷移...')
  console.log('================================')
  
  try {
    // 連接資料庫
    await connectDB()

    // 執行遷移步驟
    await addNewFieldsToMemes()
    await calculateLineage()
    await updateSourceStats()
    await updateSceneStats()
    await createIndexes()

    console.log('\n================================')
    console.log('✅ 資料遷移完成！')
    console.log('\n📌 後續步驟：')
    console.log('1. 手動建立來源（Source）資料')
    console.log('2. 手動建立片段（Scene）資料')
    console.log('3. 逐步為熱門迷因關聯 source_id 和 scene_id')
    console.log('4. 為變體迷因設定 variant_of 關係')
    
  } catch (error) {
    console.error('\n❌ 遷移失敗:', error)
    process.exit(1)
  } finally {
    // 關閉資料庫連接
    await mongoose.connection.close()
    console.log('\n📤 資料庫連接已關閉')
    process.exit(0)
  }
}

// 執行主函數
main().catch(console.error)