import Tag from '../models/Tag.js'
import MemeTag from '../models/MemeTag.js'
import Meme from '../models/Meme.js'
import mongoose from 'mongoose'
import { translateToEnglish } from '../services/googleTranslate.js'
import { toSlug, toSlugOrNull } from '../utils/slugify.js'

// 建立標籤
export const createTag = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 檢查是否已存在相同名稱和語言的標籤
    const existingTag = await Tag.findOne({
      name: req.body.name,
      lang: req.body.lang || 'zh',
    }).session(session)

    if (existingTag) {
      await session.abortTransaction()
      return res.status(400).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    // 準備標籤資料
    const tagData = { ...req.body }

    // 如果沒有提供 slug，自動生成英文 slug
    if (!tagData.slug) {
      try {
        // 翻譯標籤名稱為英文
        const englishName = await translateToEnglish(tagData.name, tagData.lang)
        let baseSlug = toSlug(englishName)

        // 如果翻譯失敗或結果為空，直接使用原名稱生成 slug
        if (!baseSlug) {
          baseSlug = toSlug(tagData.name)
        }

        if (baseSlug) {
          // 檢查 slug 唯一性，如果重複則加上數字後綴
          let finalSlug = baseSlug
          let counter = 1

          while (true) {
            const existingSlugTag = await Tag.findOne({
              lang: tagData.lang || 'zh',
              slug: finalSlug,
            }).session(session)

            if (!existingSlugTag) {
              break
            }

            finalSlug = `${baseSlug}-${counter}`
            counter++
          }

          tagData.slug = finalSlug
        }
      } catch (error) {
        console.warn('自動生成 slug 失敗，使用原名稱:', error.message)
        // 如果翻譯失敗，嘗試直接從名稱生成 slug
        tagData.slug = toSlugOrNull(tagData.name)
      }
    }

    const tag = new Tag(tagData)
    await tag.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json(tag)
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(400).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有標籤（可加分頁、條件查詢）
export const getTags = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      lang,
      search, // 關鍵字搜尋（對 name）
      status, // 狀態篩選
      sort = 'name',
      order = 'asc',
    } = req.query

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 1000)
    const skip = (pageNum - 1) * limitNum

    const filter = {}
    if (lang) filter.lang = lang
    if (status) filter.status = status
    if (search && String(search).trim() !== '') {
      filter.name = new RegExp(String(search).trim(), 'i')
    }

    const sortField = ['name', 'createdAt', 'updatedAt'].includes(String(sort))
      ? String(sort)
      : 'name'
    const sortDir = String(order).toLowerCase() === 'desc' ? -1 : 1
    const sortObj = { [sortField]: sortDir }

    const tags = await Tag.find(filter).sort(sortObj).skip(skip).limit(limitNum)
    const total = await Tag.countDocuments(filter)
    const totalPages = Math.ceil(total / limitNum)

    res.json({
      tags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        lang: lang || null,
        status: status || null,
        search: search || null,
      },
      sort: { field: sortField, order: sortDir === -1 ? 'desc' : 'asc' },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得熱門標籤統計
export const getPopularTags = async (req, res) => {
  try {
    const { lang, limit = 20 } = req.query

    // 使用 MongoDB 聚合管道統計每個標籤的使用次數
    const matchStage = {}
    if (lang) matchStage.lang = lang

    const popularTags = await MemeTag.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$tag_id',
          usageCount: { $sum: 1 },
          lang: { $first: '$lang' },
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: '_id',
          foreignField: '_id',
          as: 'tag',
        },
      },
      {
        $unwind: '$tag',
      },
      {
        $project: {
          _id: '$tag._id',
          name: '$tag.name',
          lang: '$tag.lang',
          usageCount: 1,
          createdAt: '$tag.createdAt',
        },
      },
      {
        $sort: { usageCount: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ])

    res.json({
      popularTags,
      total: popularTags.length,
      generatedAt: new Date(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一標籤
export const getTagById = async (req, res) => {
  try {
    // 驗證 ObjectId 格式
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: '無效的標籤 ID 格式' })
    }

    const tag = await Tag.findById(req.params.id)
    if (!tag) return res.status(404).json({ error: '找不到標籤' })

    // 可選：同時返回使用此標籤的迷因數量
    const usageCount = await MemeTag.countDocuments({ tag_id: req.params.id })

    res.json({
      ...tag.toJSON(),
      usageCount,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新標籤
export const updateTag = async (req, res) => {
  // 驗證 ObjectId 格式
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: '無效的標籤 ID 格式' })
  }

  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 如果要更新名稱，檢查是否會造成重複
    if (req.body.name) {
      const existingTag = await Tag.findOne({
        name: req.body.name,
        lang: req.body.lang || 'zh',
      })
        .where('_id')
        .ne(req.params.id)
        .session(session)

      if (existingTag) {
        await session.abortTransaction()
        return res.status(400).json({
          error: '該語言下已存在相同名稱的標籤',
        })
      }
    }

    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!tag) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到標籤' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json(tag)
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(400).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除標籤
export const deleteTag = async (req, res) => {
  // 驗證 ObjectId 格式
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: '無效的標籤 ID 格式' })
  }

  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 檢查是否有迷因正在使用此標籤
    const usageCount = await MemeTag.countDocuments({ tag_id: req.params.id }).session(session)

    if (usageCount > 0) {
      await session.abortTransaction()
      return res.status(400).json({
        error: `無法刪除標籤，目前有 ${usageCount} 個迷因正在使用此標籤`,
        usageCount,
      })
    }

    const tag = await Tag.findByIdAndDelete(req.params.id).session(session)
    if (!tag) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到標籤' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({
      message: '標籤已刪除',
      deletedTag: tag,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得標籤分類（用於前端篩選）
export const getTagCategories = async (req, res) => {
  console.log('getTagCategories called with params:', req.params, 'query:', req.query)

  try {
    const { lang = 'zh' } = req.query

    // 取得所有標籤
    const allTags = await Tag.find({ lang }).sort({ name: 1 })

    // 分類標籤（基於迷因的 type 欄位）
    const categories = {
      memeTypes: [
        { _id: 'text', name: '用語', count: 0 },
        { _id: 'image', name: '圖片', count: 0 },
        { _id: 'video', name: '影片', count: 0 },
        { _id: 'audio', name: '音訊', count: 0 },
      ],
      popularTags: [],
      allTags: allTags,
    }

    // 計算每個分類的使用次數（基於迷因的 type 欄位）
    for (const category of categories.memeTypes) {
      try {
        // 直接計算該 type 的迷因數量
        const count = await Meme.countDocuments({
          type: category._id,
          status: 'public',
        })
        category.count = count
        console.log(`Category ${category.name}: ${count} memes`)
      } catch (error) {
        console.error(`計算迷因類型 ${category.name} 數量失敗:`, error)
        category.count = 0
      }
    }

    // 取得熱門標籤（前10個）
    try {
      const popularTags = await MemeTag.aggregate([
        {
          $group: {
            _id: '$tag_id',
            usageCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'tags',
            localField: '_id',
            foreignField: '_id',
            as: 'tag',
          },
        },
        {
          $unwind: '$tag',
        },
        {
          $match: {
            'tag.lang': lang,
          },
        },
        {
          $project: {
            _id: '$tag._id',
            name: '$tag.name',
            usageCount: 1,
          },
        },
        {
          $sort: { usageCount: -1 },
        },
        {
          $limit: 10,
        },
      ])

      categories.popularTags = popularTags
      console.log(`Found ${popularTags.length} popular tags`)
    } catch (error) {
      console.error('取得熱門標籤失敗:', error)
      categories.popularTags = []
    }

    console.log('Sending response:', {
      categories: {
        memeTypes: categories.memeTypes.length,
        popularTags: categories.popularTags.length,
        allTags: categories.allTags.length,
      },
      totalCategories: Object.keys(categories).length,
    })

    res.json({
      categories,
      totalCategories: Object.keys(categories).length,
      generatedAt: new Date(),
    })
  } catch (err) {
    console.error('getTagCategories 錯誤:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * 批次重建既有標籤的 slug 與 usageCount
 * Query 參數：
 * - lang: 僅處理特定語言（可省略處理全部）
 * - onlyMissingSlug=true: 只為缺少/空 slug 的標籤產生 slug
 * - updateUsage=true: 是否更新 usageCount
 * - translate=true: 產生 slug 前是否嘗試翻譯為英文
 * - limit: 只處理前 N 筆（測試用）
 */
export const rebuildTagsMetadata = async (req, res) => {
  const {
    lang,
    onlyMissingSlug = 'true',
    updateUsage = 'true',
    translate = 'true',
    limit,
  } = req.query

  try {
    const filter = {}
    if (lang) filter.lang = String(lang)

    let query = Tag.find(filter).sort({ createdAt: 1 })
    const limitNum = Math.max(parseInt(limit) || 0, 0)
    if (limitNum > 0) query = query.limit(limitNum)

    const tags = await query.lean()
    if (tags.length === 0) return res.json({ processed: 0, updated: 0, details: [] })

    // 預先計算所有 usageCount（一次聚合）
    let usageMap = {}
    if (String(updateUsage) === 'true') {
      const usageAgg = await MemeTag.aggregate([
        { $match: { tag_id: { $in: tags.map((t) => t._id.toString()) } } },
        { $group: { _id: '$tag_id', usageCount: { $sum: 1 } } },
      ])
      usageMap = usageAgg.reduce((acc, x) => {
        acc[String(x._id)] = x.usageCount || 0
        return acc
      }, {})
    }

    const results = []
    let updated = 0

    // 逐筆處理，確保 (lang, slug) 唯一性
    for (const t of tags) {
      const updates = {}
      const tagLang = t.lang || 'zh'

      // 處理 slug
      const needSlugWork =
        String(onlyMissingSlug) === 'true' ? !t.slug || String(t.slug).trim() === '' : true

      if (needSlugWork) {
        let candidate = null
        if (String(translate) === 'true') {
          // 若非 ASCII 或語言非 en，先嘗試翻譯
          const containsNonAscii = /[^\x20-\x7E]/.test(String(t.name || ''))
          if (containsNonAscii || tagLang !== 'en') {
            const translated = await translateToEnglish(t.name, tagLang)
            candidate = toSlugOrNull(translated || t.name)
          } else {
            candidate = toSlugOrNull(t.name)
          }
        } else {
          candidate = toSlugOrNull(t.name)
        }

        // 確保唯一且排除自身
        if (candidate) {
          let unique = candidate
          let suffix = 1
          // 最多嘗試 50 次
          for (let i = 0; i < 50; i++) {
            // 先查詢所有符合條件的標籤，然後在記憶體中過濾
            const existingTags = await Tag.find({
              lang: tagLang,
              slug: unique,
            }).lean()

            // 在記憶體中過濾掉當前標籤
            const dup = existingTags.find((tag) => tag._id.toString() !== t._id.toString())
            if (!dup) break
            suffix += 1
            unique = `${candidate}-${suffix}`
          }
          updates.slug = unique
        } else {
          updates.slug = undefined
        }
      }

      // 處理 usageCount
      if (String(updateUsage) === 'true') {
        const desired = usageMap[String(t._id)] || 0
        if (typeof t.usageCount !== 'number' || t.usageCount !== desired) {
          updates.usageCount = desired
        }
      }

      if (Object.keys(updates).length > 0) {
        await Tag.updateOne({ _id: t._id }, { $set: updates })
        updated += 1
        results.push({ id: t._id, name: t.name, lang: tagLang, updates })
      }
    }

    return res.json({ processed: tags.length, updated, details: results.slice(0, 50) })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

/**
 * 匯出標籤數據為 CSV 格式
 */
export const exportTags = async (req, res) => {
  try {
    const { lang, search, status, format = 'csv' } = req.query

    const filter = {}
    if (lang) filter.lang = lang
    if (search && String(search).trim() !== '') {
      filter.name = new RegExp(String(search).trim(), 'i')
    }
    if (status) filter.status = status

    const tags = await Tag.find(filter).sort({ name: 1 }).lean()

    if (format === 'csv') {
      // 產生 CSV
      const header = [
        'id',
        'name',
        'slug',
        'lang',
        'status',
        'usageCount',
        'aliases',
        'createdAt',
        'updatedAt',
      ]

      const rows = tags.map((tag) => [
        tag._id,
        tag.name || '',
        tag.slug || '',
        tag.lang || 'zh',
        tag.status || 'active',
        typeof tag.usageCount === 'number' ? tag.usageCount : 0,
        Array.isArray(tag.aliases) ? tag.aliases.join('|') : '',
        tag.createdAt ? new Date(tag.createdAt).toISOString() : '',
        tag.updatedAt ? new Date(tag.updatedAt).toISOString() : '',
      ])

      const csv = [header, ...rows]
        .map((r) =>
          r
            .map((v) => String(v).replace(/"/g, '""'))
            .map((v) => `"${v}"`)
            .join(','),
        )
        .join('\n')

      const filename = `tags-${new Date().toISOString().slice(0, 10)}.csv`
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      // 添加 BOM 以確保 Excel 正確識別 UTF-8 編碼
      const bom = '\uFEFF'
      res.status(200).send(bom + csv)
    } else {
      // JSON 格式
      res.json({
        tags,
        total: tags.length,
        exportedAt: new Date(),
        filters: { lang, search, status },
      })
    }
  } catch (error) {
    console.error('匯出標籤失敗:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * 切換標籤狀態（active/archived）
 */
export const toggleTagStatus = async (req, res) => {
  // 驗證 ObjectId 格式
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: '無效的標籤 ID 格式' })
  }

  try {
    const tag = await Tag.findById(req.params.id)
    if (!tag) {
      return res.status(404).json({ error: '找不到標籤' })
    }

    // 切換狀態
    const newStatus = tag.status === 'active' ? 'archived' : 'active'
    tag.status = newStatus
    await tag.save()

    res.json({
      message: '標籤狀態已更新',
      tag: {
        id: tag._id,
        name: tag.name,
        status: tag.status,
      },
    })
  } catch (error) {
    console.error('切換標籤狀態失敗:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * 合併標籤
 * 將次要標籤合併到主要標籤，並將次要標籤的別名和使用次數轉移
 */
export const mergeTags = async (req, res) => {
  const { primaryId, secondaryIds } = req.body

  // 驗證參數
  if (!primaryId || !secondaryIds || !Array.isArray(secondaryIds) || secondaryIds.length === 0) {
    return res.status(400).json({ error: '需要提供主要標籤 ID 和次要標籤 ID 陣列' })
  }

  // 驗證 ObjectId 格式
  if (!mongoose.Types.ObjectId.isValid(primaryId)) {
    return res.status(400).json({ error: '無效的主要標籤 ID 格式' })
  }

  for (const id of secondaryIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: `無效的次要標籤 ID 格式: ${id}` })
    }
  }

  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 取得主要標籤
    const primaryTag = await Tag.findById(primaryId).session(session)
    if (!primaryTag) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到主要標籤' })
    }

    // 取得次要標籤 - 驗證並轉換為 ObjectId
    const validSecondaryIds = secondaryIds.filter((id) => mongoose.Types.ObjectId.isValid(id))

    if (validSecondaryIds.length !== secondaryIds.length) {
      await session.abortTransaction()
      return res.status(400).json({ error: '部分次要標籤 ID 格式無效' })
    }

    const secondaryObjectIds = validSecondaryIds.map((id) => new mongoose.Types.ObjectId(id))

    const secondaryTags = await Tag.find({
      _id: { $in: secondaryObjectIds },
    }).session(session)

    if (secondaryTags.length !== secondaryIds.length) {
      await session.abortTransaction()
      return res.status(404).json({ error: '部分次要標籤不存在' })
    }

    // 檢查是否有重複的標籤 ID
    if (secondaryIds.includes(primaryId)) {
      await session.abortTransaction()
      return res.status(400).json({ error: '主要標籤不能包含在次要標籤中' })
    }

    // 合併別名
    const allAliases = new Set(primaryTag.aliases || [])
    for (const secondaryTag of secondaryTags) {
      if (secondaryTag.aliases && Array.isArray(secondaryTag.aliases)) {
        secondaryTag.aliases.forEach((alias) => {
          if (alias && alias.trim()) {
            allAliases.add(alias.trim())
          }
        })
      }
      // 將次要標籤的名稱也加入別名
      if (secondaryTag.name && secondaryTag.name.trim()) {
        allAliases.add(secondaryTag.name.trim())
      }
    }

    // 更新主要標籤的別名
    primaryTag.aliases = Array.from(allAliases)
    await primaryTag.save({ session })

    // 更新所有使用次要標籤的迷因，改為使用主要標籤
    for (const secondaryTag of secondaryTags) {
      await MemeTag.updateMany(
        { tag_id: secondaryTag._id },
        { tag_id: primaryTag._id },
        { session },
      )
    }

    // 刪除次要標籤 - 使用已轉換的 ObjectId
    await Tag.deleteMany({ _id: { $in: secondaryObjectIds } }).session(session)

    // 重新計算主要標籤的使用次數
    const usageCount = await MemeTag.countDocuments({
      tag_id: primaryTag._id,
    }).session(session)

    primaryTag.usageCount = usageCount
    await primaryTag.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({
      message: '標籤合併成功',
      primaryTag: {
        id: primaryTag._id,
        name: primaryTag.name,
        aliases: primaryTag.aliases,
        usageCount: primaryTag.usageCount,
      },
      mergedTags: secondaryTags.map((tag) => ({
        id: tag._id,
        name: tag.name,
      })),
      totalMerged: secondaryTags.length,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    console.error('合併標籤失敗:', error)
    res.status(500).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

/**
 * 批量刪除標籤
 */
export const batchDeleteTags = async (req, res) => {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '需要提供標籤 ID 陣列' })
  }

  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 驗證並轉換 ID 為 ObjectId
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id))

    if (validIds.length !== ids.length) {
      await session.abortTransaction()
      return res.status(400).json({ error: '部分標籤 ID 格式無效' })
    }

    const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id))

    // 檢查是否有標籤正在被使用
    const usageCounts = await MemeTag.aggregate([
      { $match: { tag_id: { $in: objectIds } } },
      { $group: { _id: '$tag_id', count: { $sum: 1 } } },
    ]).session(session)

    const usedTags = usageCounts.filter((item) => item.count > 0)
    if (usedTags.length > 0) {
      await session.abortTransaction()
      return res.status(400).json({
        error: '部分標籤正在被使用，無法刪除',
        usedTags: usedTags.map((item) => ({
          tagId: item._id,
          usageCount: item.count,
        })),
      })
    }

    // 刪除標籤 - 使用已轉換的 ObjectId
    const deleteResult = await Tag.deleteMany({ _id: { $in: objectIds } }).session(session)

    // 提交事務
    await session.commitTransaction()

    res.json({
      message: '批量刪除成功',
      deletedCount: deleteResult.deletedCount,
      totalRequested: ids.length,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    console.error('批量刪除標籤失敗:', error)
    res.status(500).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}
