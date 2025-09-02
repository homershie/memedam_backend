import mongoose from 'mongoose'
import Source from '../models/Source.js'
import Scene from '../models/Scene.js'
import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { translateToEnglish } from '../services/googleTranslate.js'
import { toSlug, toSlugOrNull } from '../utils/slugify.js'

// 取得單一來源及相關資料（bundle API）
export const getSourceBundle = async (req, res, next) => {
  try {
    const { slug } = req.params
    const include = (req.query.include || '').split(',').filter(Boolean)

    // 查詢來源
    const source = await Source.findOne({
      $or: [{ slug }, mongoose.Types.ObjectId.isValid(slug) ? { _id: slug } : null].filter(Boolean),
    }).lean()

    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    const result = { source }

    // 包含片段資料
    if (include.includes('scenes')) {
      result.scenes = await Scene.find({ source_id: source._id })
        .select('title slug episode start_time end_time quote images counts')
        .sort({ start_time: 1, episode: 1 })
        .lean()
    }

    // 包含迷因資料
    if (include.includes('memes')) {
      result.memes = await Meme.find({
        source_id: source._id,
        status: 'public',
      })
        .select(
          'title slug image_url video_url like_count view_count scene_id lineage author_id createdAt',
        )
        .sort({ like_count: -1, createdAt: -1 })
        .limit(90)
        .populate('author_id', 'username display_name avatar')
        .lean()
    }

    // 包含統計資料
    if (include.includes('stats')) {
      const [memeCount, sceneCount, totalViews, totalLikes] = await Promise.all([
        Meme.countDocuments({ source_id: source._id, status: 'public' }),
        Scene.countDocuments({ source_id: source._id, status: 'active' }),
        Meme.aggregate([
          { $match: { source_id: source._id, status: 'public' } },
          { $group: { _id: null, total: { $sum: '$views' } } },
        ]).then((r) => r[0]?.total || 0),
        Meme.aggregate([
          { $match: { source_id: source._id, status: 'public' } },
          { $group: { _id: null, total: { $sum: '$like_count' } } },
        ]).then((r) => r[0]?.total || 0),
      ])

      result.stats = {
        memes: memeCount,
        scenes: sceneCount,
        views: totalViews,
        likes: totalLikes,
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 取得來源列表
export const getSources = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      search,
      tags,
      sortBy = 'popular', // popular, newest, alphabetical
    } = req.query

    const query = { status: 'active' }

    // 類型篩選
    if (type) {
      query.type = type
    }

    // 搜尋
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [{ title: searchRegex }, { alt_titles: searchRegex }, { synopsis: searchRegex }]
    }

    // 標籤篩選
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',')
      query.tags = { $in: tagArray }
    }

    // 排序選項
    let sortOption = {}
    switch (sortBy) {
      case 'newest':
        sortOption = { createdAt: -1 }
        break
      case 'alphabetical':
        sortOption = { title: 1 }
        break
      case 'popular':
      default:
        sortOption = { 'counts.memes': -1, 'counts.views': -1 }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [sources, total] = await Promise.all([
      Source.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .select('title slug type year origin_country thumbnails counts tags createdAt')
        .lean(),
      Source.countDocuments(query),
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      data: sources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
}

// 建立新來源
export const createSource = async (req, res, next) => {
  try {
    const {
      type,
      title,
      alt_titles,
      year,
      origin_country,
      creators,
      synopsis,
      context,
      license,
      links,
      thumbnails,
      slug,
      tags,
    } = req.body

    // 處理 slug 自動生成
    let finalSlug = slug
    if (!finalSlug && title) {
      try {
        // 嘗試翻譯標題為英文後生成 slug
        const englishTitle = await translateToEnglish(title, 'zh')
        let baseSlug = toSlug(englishTitle)

        // 如果翻譯失敗或結果為空，直接使用原標題生成 slug
        if (!baseSlug) {
          baseSlug = toSlug(title)
        }

        if (baseSlug) {
          // 檢查 slug 唯一性，如果重複則加上數字後綴
          finalSlug = baseSlug
          let counter = 1

          while (true) {
            const existingSlugSource = await Source.findOne({ slug: finalSlug })

            if (!existingSlugSource) {
              break
            }

            finalSlug = `${baseSlug}-${counter}`
            counter++
          }
        }
      } catch (error) {
        console.warn('自動生成 slug 失敗，使用原標題:', error.message)
        // 如果翻譯失敗，嘗試直接從標題生成 slug
        finalSlug = toSlugOrNull(title)
      }
    }

    // 檢查 slug 是否已存在
    if (finalSlug) {
      const existingSource = await Source.findOne({ slug: finalSlug })
      if (existingSource) {
        return res.status(StatusCodes.CONFLICT).json({
          success: false,
          message: 'Slug 已被使用',
        })
      }
    }

    const source = new Source({
      type,
      title,
      alt_titles,
      year,
      origin_country,
      creators,
      synopsis,
      context,
      license,
      links,
      thumbnails,
      slug: finalSlug,
      tags,
    })

    await source.save()

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '來源建立成功',
      data: source,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Slug 已被使用',
      })
    }
    next(error)
  }
}

// 更新來源
export const updateSource = async (req, res, next) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // 移除不應該被更新的欄位
    delete updateData._id
    delete updateData.counts
    delete updateData.createdAt
    delete updateData.updatedAt

    const source = await Source.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '來源更新成功',
      data: source,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Slug 已被使用',
      })
    }
    next(error)
  }
}

// 刪除來源
export const deleteSource = async (req, res, next) => {
  try {
    const { id } = req.params

    // 檢查是否有相關的迷因
    const memeCount = await Meme.countDocuments({
      source_id: id,
      status: { $ne: 'deleted' },
    })

    if (memeCount > 0) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: `無法刪除：此來源有 ${memeCount} 個相關迷因`,
      })
    }

    // 檢查是否有相關的片段
    const sceneCount = await Scene.countDocuments({
      source_id: id,
      status: { $ne: 'deleted' },
    })

    if (sceneCount > 0) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: `無法刪除：此來源有 ${sceneCount} 個相關片段`,
      })
    }

    const source = await Source.findByIdAndUpdate(
      id,
      { status: 'deleted', deleted_at: new Date() },
      { new: true },
    )

    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '來源已標記為刪除',
    })
  } catch (error) {
    next(error)
  }
}

// 更新來源統計
export const updateSourceStats = async (req, res, next) => {
  try {
    const { id } = req.params

    const source = await Source.findById(id)
    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    await source.updateCounts()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '統計數據更新成功',
      data: source.counts,
    })
  } catch (error) {
    next(error)
  }
}

// 搜尋來源（自動完成）
export const searchSourcesAutocomplete = async (req, res, next) => {
  try {
    const { q } = req.query

    if (!q || q.length < 2) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
      })
    }

    const searchRegex = new RegExp(q, 'i')
    const sources = await Source.find({
      status: 'active',
      $or: [{ title: searchRegex }, { alt_titles: searchRegex }],
    })
      .select('title slug type year thumbnails')
      .limit(10)
      .lean()

    res.status(StatusCodes.OK).json({
      success: true,
      data: sources,
    })
  } catch (error) {
    next(error)
  }
}

// 取得熱門來源
export const getPopularSources = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query

    const sources = await Source.getPopularSources(parseInt(limit))

    res.status(StatusCodes.OK).json({
      success: true,
      data: sources,
    })
  } catch (error) {
    next(error)
  }
}

// 檢查 slug 是否可用
export const checkSlugAvailable = async (req, res) => {
  try {
    const { slug } = req.query

    if (!slug) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '請提供 slug 參數',
      })
    }

    // 檢查 slug 是否已存在
    const existingSource = await Source.findOne({ slug }).select('_id title').lean()

    res.json({
      success: true,
      data: {
        slug,
        available: !existingSource,
        existing_source: existingSource
          ? {
              id: existingSource._id,
              title: existingSource.title,
            }
          : null,
      },
      error: null,
    })
  } catch (err) {
    console.error('檢查來源 slug 可用性時發生錯誤:', err)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '檢查 slug 可用性時發生錯誤',
    })
  }
}
