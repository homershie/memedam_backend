import Tag from '../models/Tag.js'
import MemeTag from '../models/MemeTag.js'
import Meme from '../models/Meme.js'
import mongoose from 'mongoose'

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

    const tag = new Tag(req.body)
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
      sort = 'name',
      order = 'asc',
    } = req.query

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 1000)
    const skip = (pageNum - 1) * limitNum

    const filter = {}
    if (lang) filter.lang = lang
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
        _id: { $ne: req.params.id },
      }).session(session)

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
