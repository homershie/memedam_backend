import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'
import Meme from '../models/Meme.js'
import Source from '../models/Source.js'
import Scene from '../models/Scene.js'
import { StatusCodes } from 'http-status-codes'
import { body, validationResult } from 'express-validator'
import MemeTag from '../models/MemeTag.js' // Added import for MemeTag
import {
  processAdvancedSearchResults,
  combineAdvancedSearchFilters,
  getSearchStats,
  advancedFuzzySearch,
} from '../utils/advancedSearch.js'
import Tag from '../models/Tag.js'
import User from '../models/User.js'
import { deleteImageByUrl } from '../services/uploadService.js'
import {
  calculateMemeHotScore,
  getHotScoreLevel,
  calculateEngagementScore,
  calculateQualityScore,
} from '../utils/hotScore.js'
import { translateToEnglish } from '../services/googleTranslate.js'
import { toSlug, toSlugOrNull } from '../utils/slugify.js'

// 匯出 CSV（管理端）
export const exportMemesCsv = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000)
    const skip = (pageNum - 1) * limitNum

    // 僅管理員/助理可匯出全部狀態；一般使用者僅可匯出 public
    const isPrivilegedUser = Boolean(req.user && ['admin', 'manager'].includes(req.user.role))
    const filter = {}
    if (!isPrivilegedUser) {
      filter.status = 'public'
    }

    const memesData = await Meme.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('author_id', 'username display_name')
      .lean()

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      const mustQuote = /[",\n\r]/.test(str)
      const escaped = str.replace(/"/g, '""')
      return mustQuote ? `"${escaped}"` : escaped
    }

    const headers = [
      '_id',
      'title',
      'type',
      'status',
      'views',
      'like_count',
      'comment_count',
      'hot_score',
      'tags',
      'author_username',
      'author_display_name',
      'createdAt',
    ]

    const rows = memesData.map((meme) => {
      const tags = Array.isArray(meme.tags_cache) ? meme.tags_cache.join('|') : ''
      const row = [
        meme._id,
        meme.title,
        meme.type,
        meme.status,
        meme.views ?? 0,
        meme.like_count ?? 0,
        meme.comment_count ?? 0,
        meme.hot_score ?? 0,
        tags,
        meme.author_id?.username ?? '',
        meme.author_id?.display_name ?? '',
        meme.createdAt ? new Date(meme.createdAt).toISOString() : '',
      ]
      return row.map(escapeCsv).join(',')
    })

    const csv = [headers.join(','), ...rows].join('\r\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="memes-${new Date().toISOString().slice(0, 10)}.csv"`,
    )

    // 前置 BOM 讓 Excel 能正確以 UTF-8 顯示
    res.status(200).send(`\uFEFF${csv}`)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 建立迷因
export const validateCreateMeme = [
  body('title').isLength({ min: 1, max: 100 }).withMessage('標題必填，且長度需在 1~100 字'),
  body('content').optional().isLength({ max: 1000 }).withMessage('內容長度最多 1000 字'),
]

// 更新迷因驗證
export const validateUpdateMeme = [
  body('title').optional().isLength({ min: 1, max: 100 }).withMessage('標題長度需在 1~100 字'),
  body('content').optional().isLength({ max: 1000 }).withMessage('內容長度最多 1000 字'),
  body('type')
    .optional()
    .isIn(['image', 'video', 'audio', 'text'])
    .withMessage('類型必須是 image、video、audio 或 text'),
  body('status')
    .optional()
    .isIn(['draft', 'public', 'hidden', 'banned', 'deleted'])
    .withMessage('狀態必須是 draft、public、hidden、banned 或 deleted'),
]

export const createMeme = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }

  // 使用 session 來確保原子性操作
  const session = await Meme.startSession()
  session.startTransaction()

  try {
    // 取得圖片網址（多圖上傳，僅取第一張作為主圖）
    let image_url = ''
    if (req.files && req.files.length > 0) {
      image_url = req.files[0].path || req.files[0].url || req.files[0].secure_url || ''
    } else if (req.body.image_url) {
      image_url = req.body.image_url
    }

    // 其他欄位
    const {
      title,
      content = '',
      type,
      detail_markdown,
      tags_cache = [],
      source_url = '',
      video_url = '',
      audio_url = '',
      slug,
    } = req.body

    // 從認證中間件獲取用戶ID
    const author_id = req.user._id

    // tags_cache 可能是字串（單一標籤），也可能是陣列
    let tagsArr = tags_cache
    if (typeof tags_cache === 'string') {
      try {
        tagsArr = JSON.parse(tags_cache)
      } catch {
        tagsArr = [tags_cache]
      }
    }

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
            const existingSlugMeme = await Meme.findOne({ slug: finalSlug }).session(session)

            if (!existingSlugMeme) {
              break
            }

            finalSlug = `${baseSlug}-${counter}`
            counter++
          }
        }
      } catch (error) {
        logger.warn('自動生成 slug 失敗，使用原標題:', error.message)
        // 如果翻譯失敗，嘗試直接從標題生成 slug
        finalSlug = toSlugOrNull(title)
      }
    }

    const meme = new Meme({
      title,
      content,
      image_url,
      video_url,
      audio_url,
      author_id,
      type,
      detail_markdown,
      tags_cache: tagsArr,
      source_url,
      slug: finalSlug,
    })

    // 使用 session 保存迷因
    await meme.save({ session })

    // 使用原子操作更新用戶迷因數量統計，避免 race condition
    await User.findByIdAndUpdate(author_id, { $inc: { meme_count: 1 } }, { session, new: true })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json({ success: true, data: meme, error: null })
  } catch (err) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '迷因已存在，請檢查標題是否重複',
      })
    }

    // 處理其他 MongoDB 錯誤
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: err.message,
      })
    }

    res.status(500).json({ success: false, data: null, error: err.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有迷因（可加分頁、條件查詢）
export const getMemes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tags,
      types, // 新增：支援多個類型篩選
      search,
      type,
      status,
      sort = 'comprehensive', // 預設使用綜合排序
      order = 'desc',
      useAdvancedSearch = 'true', // 使用進階搜尋
      author,
      dateFrom,
      dateTo,
    } = req.query

    // 權限：僅 admin/manager 可檢視非 public 項目
    const isPrivilegedUser = Boolean(req.user && ['admin', 'manager'].includes(req.user.role))

    // 正規化輸入，將『全部』/ 'all' / 空字串 視為未篩選
    const normalizeAll = (val) => {
      if (val === undefined || val === null) return ''
      const v = String(val).trim()
      if (v === '' || v.toLowerCase() === 'all' || v === '全部') return ''
      return v
    }

    const typeVal = normalizeAll(type)
    const statusVal = normalizeAll(status)
    const searchVal = normalizeAll(search)
    const authorVal = normalizeAll(author)
    const dateFromVal = normalizeAll(dateFrom)
    const dateToVal = normalizeAll(dateTo)

    const typesArrRaw = types
      ? Array.isArray(types)
        ? types
        : String(types)
            .split(',')
            .map((t) => t.trim())
      : []
    const typesArr = typesArrRaw.filter((t) => normalizeAll(t) !== '')

    const tagsArrRaw = Array.isArray(tags)
      ? tags
      : tags
        ? String(tags)
            .split(',')
            .map((t) => t.trim())
        : []
    const tagsArr = tagsArrRaw.filter((t) => normalizeAll(t) !== '')

    // 正規化布林與「是否真的有過濾條件」
    const useAdvanced = String(useAdvancedSearch).toLowerCase() === 'true'
    const hasFilters = Boolean(
      (typesArr && typesArr.length > 0) ||
        typeVal !== '' ||
        statusVal !== '' ||
        searchVal !== '' ||
        authorVal !== '' ||
        dateFromVal !== '' ||
        dateToVal !== '' ||
        (tagsArr && tagsArr.length > 0),
    )

    // 僅在「要求進階搜尋且真的有過濾條件」時才走進階路徑，否則走傳統查詢（確保『全部』能顯示所有資料）
    if (useAdvanced && hasFilters) {
      // 建立基本查詢條件
      const baseFilter = {}

      // 類型/狀態篩選（多選/單選）
      if (typesArr.length > 0) {
        baseFilter.type = { $in: typesArr }
      } else if (typeVal !== '') {
        baseFilter.type = typeVal
      }

      // 狀態：非特權使用者一律限制為 public
      if (isPrivilegedUser) {
        if (statusVal !== '') baseFilter.status = statusVal
      } else {
        baseFilter.status = 'public'
      }

      // 取得所有符合基本篩選條件的迷因
      const allMemesData = await Meme.find(baseFilter)
        .populate('author_id', 'username display_name avatar meme_count')
        .lean()

      // 轉換資料結構並扁平化作者資訊
      const memesWithFlattenedAuthor = allMemesData.map((meme) => ({
        ...meme,
        author: meme.author_id,
        author_id: meme.author_id?._id,
        username: meme.author_id?.username || '',
        display_name: meme.author_id?.display_name || '',
        // 確保數值欄位存在
        views: meme.views || 0,
        likes: meme.likes || 0,
        shares: meme.shares || 0,
        comments: meme.comments || 0,
        likes_count: meme.likes_count || 0,
        dislikes_count: meme.dislikes_count || 0,
        shares_count: meme.shares_count || 0,
        comments_count: meme.comments_count || 0,
      }))

      // 使用進階搜尋過濾器
      const searchParams = {
        search: searchVal,
        type: typeVal,
        status: statusVal,
        tags: tagsArr,
        author: authorVal,
        dateFrom: dateFromVal,
        dateTo: dateToVal,
      }

      const filteredMemes = combineAdvancedSearchFilters(memesWithFlattenedAuthor, searchParams)

      // 確保即使沒有搜尋詞也會計算各項分數，讓排序（comprehensive/quality 等）生效
      const resultsWithScores = advancedFuzzySearch(filteredMemes, searchVal || '')

      // 處理進階搜尋結果的排序和分頁（支援 asc/desc）。
      // 注意：前端會將 sort/newest 之類透過 memeService 轉成 sort=field, order=asc|desc。
      // 進階排序只讀取單一 sortBy 參數，因此這裡將 order 合併回 sort 供排序器解析。
      const combinedSort = order ? `${sort}_${order}` : sort
      const {
        results: memes,
        pagination: searchPagination,
        scoring,
      } = processAdvancedSearchResults(resultsWithScores, { page, limit }, combinedSort)

      // 取得搜尋統計資訊
      const searchStats = getSearchStats(filteredMemes)

      res.json({
        memes,
        pagination: searchPagination,
        filters: {
          search: searchVal || null,
          tags: tagsArr.length > 0 ? tagsArr : null,
          type: typeVal || null,
          status: statusVal || null,
          author: authorVal || null,
          dateFrom: dateFromVal || null,
          dateTo: dateToVal || null,
        },
        scoring,
        searchStats,
        searchAlgorithm: 'advanced',
      })
    } else {
      // 使用傳統的 MongoDB 查詢（向後相容）
      const mongoQuery = {}

      // 基本篩選條件
      if (typesArr.length > 0) {
        mongoQuery.type = { $in: typesArr }
      } else if (typeVal !== '') {
        mongoQuery.type = typeVal
      }

      // 狀態：非特權使用者一律限制為 public
      if (isPrivilegedUser) {
        if (statusVal !== '') {
          mongoQuery.status = statusVal
        }
      } else {
        mongoQuery.status = 'public'
      }

      // 作者篩選條件
      if (authorVal) {
        mongoQuery.author_id = authorVal
      }

      // 搜尋和標籤條件
      const orConditions = []

      // 搜尋條件：搜尋標題或內容 (使用 RegExp 避免 Mongoose 轉換問題)
      if (searchVal) {
        const searchRegex = new RegExp(searchVal, 'i')
        orConditions.push({ title: searchRegex }, { content: searchRegex })
      }

      // 標籤條件
      if (tagsArr.length > 0) {
        tagsArr.forEach((tag) => {
          orConditions.push({ tags_cache: tag })
        })
      }

      // 如果有搜尋或標籤條件，加入 $or 查詢
      if (orConditions.length > 0) {
        mongoQuery.$or = orConditions
      }

      // 排序設定
      const sortObj = {}
      sortObj[sort] = order === 'desc' ? -1 : 1

      // 分頁計算
      const skip = (parseInt(page) - 1) * parseInt(limit)
      const limitNum = parseInt(limit)

      // 查詢迷因
      const memesData = await Meme.find(mongoQuery)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('author_id', 'username display_name avatar')

      // 轉換資料結構，將 author_id 改為 author
      const memes = memesData.map((meme) => {
        const memeObj = meme.toObject()
        return {
          ...memeObj,
          author: memeObj.author_id,
          author_id: memeObj.author_id?._id,
        }
      })

      // 計算總數
      const total = await Meme.countDocuments(mongoQuery)

      // 計算總頁數
      const totalPages = Math.ceil(total / limitNum)

      res.json({
        memes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          search: searchVal || null,
          tags: tagsArr.length > 0 ? tagsArr : null,
          type: typeVal || null,
          status: statusVal || null,
        },
      })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因（支援 ID 或 slug）
export const getMemeById = async (req, res) => {
  try {
    const { id } = req.params

    // 檢查是否為有效的 ObjectId
    const isObjectId = mongoose.Types.ObjectId.isValid(id)

    // 建立查詢條件
    const query = isObjectId ? { _id: new mongoose.Types.ObjectId(id) } : { slug: id }

    // 權限：僅 admin/manager 可檢視非 public 項目
    const isPrivilegedUser = Boolean(req.user && ['admin', 'manager'].includes(req.user.role))

    if (!isPrivilegedUser) {
      query.status = 'public'
    }

    const meme = await Meme.findOne(query)
      .populate('author_id', 'username display_name avatar')
      .lean()

    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到指定的迷因',
      })
    }

    // 計算各種分數
    const hotScore = calculateMemeHotScore(meme)
    const hotLevel = getHotScoreLevel(hotScore)
    const engagementScore = calculateEngagementScore(meme)
    const qualityScore = calculateQualityScore(meme)

    // 組織作者資訊
    const author = meme.author_id
      ? {
          _id: meme.author_id._id,
          username: meme.author_id.username,
          display_name: meme.author_id.display_name,
          avatar: meme.author_id.avatar,
        }
      : null

    const memeWithScores = {
      ...meme,
      author,
      hot_score: hotScore,
      hot_level: hotLevel,
      engagement_score: engagementScore,
      quality_score: qualityScore,
    }

    res.json({
      success: true,
      data: {
        meme: memeWithScores,
      },
      error: null,
    })
  } catch (err) {
    logger.error('取得迷因時發生錯誤:', err)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '取得迷因時發生錯誤',
    })
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
    const existingMeme = await Meme.findOne({ slug }).select('_id title').lean()

    res.json({
      success: true,
      data: {
        slug,
        available: !existingMeme,
        existing_meme: existingMeme
          ? {
              id: existingMeme._id,
              title: existingMeme.title,
            }
          : null,
      },
      error: null,
    })
  } catch (err) {
    logger.error('檢查 slug 可用性時發生錯誤:', err)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '檢查 slug 可用性時發生錯誤',
    })
  }
}

// 更新迷因
export const updateMeme = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }

  // 使用 session 來確保原子性操作
  const session = await Meme.startSession()
  session.startTransaction()

  try {
    // 先獲取原始迷因資料
    const originalMeme = await Meme.findById(req.params.id).session(session)
    if (!originalMeme) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到迷因' })
    }

    // 準備更新資料
    const updateData = { ...req.body }

    // 處理 modified_at，確保為有效日期，避免傳入查詢物件導致轉型錯誤
    const sanitizeModifiedAt = (obj) => {
      if (!obj || typeof obj !== 'object') return
      if (Object.prototype.hasOwnProperty.call(obj, 'modified_at')) {
        const val = obj.modified_at
        if (val instanceof Date) {
          return
        }
        if (typeof val === 'string' || typeof val === 'number') {
          const parsed = new Date(val)
          if (!isNaN(parsed)) {
            obj.modified_at = parsed
            return
          }
        }
        delete obj.modified_at
      }
    }

    sanitizeModifiedAt(updateData)
    sanitizeModifiedAt(updateData.$set)
    sanitizeModifiedAt(updateData.$setOnInsert)

    // 檢查是否有新圖片上傳
    if (req.files && req.files.length > 0) {
      // 取得新圖片 URL（多圖上傳，僅取第一張作為主圖）
      const newImageUrl = req.files[0].path || req.files[0].url || req.files[0].secure_url || ''

      if (newImageUrl) {
        // 刪除舊圖片（如果存在且與新圖片不同）
        if (originalMeme.image_url && originalMeme.image_url !== newImageUrl) {
          try {
            await deleteImageByUrl(originalMeme.image_url)
          } catch (deleteError) {
            logger.error('刪除舊圖片失敗:', deleteError)
            // 不中斷更新流程，只記錄錯誤
          }
        }

        // 更新為新圖片 URL
        updateData.image_url = newImageUrl
      }
    } else if (req.body.image_url && req.body.image_url !== originalMeme.image_url) {
      // 如果是透過 body 傳入新的圖片 URL（非上傳檔案）
      if (originalMeme.image_url) {
        try {
          await deleteImageByUrl(originalMeme.image_url)
        } catch (deleteError) {
          logger.error('刪除舊圖片失敗:', deleteError)
        }
      }
    }

    // 檢查迷因類型變更，處理相關媒體檔案
    if (updateData.type && updateData.type !== originalMeme.type) {
      // 如果從圖片類型變更為其他類型，刪除舊圖片
      if (originalMeme.type === 'image' && updateData.type !== 'image') {
        if (originalMeme.image_url) {
          try {
            await deleteImageByUrl(originalMeme.image_url)
          } catch (deleteError) {
            logger.error('類型變更時刪除舊圖片失敗:', deleteError)
          }
        }
        // 清空圖片 URL
        updateData.image_url = ''
      }

      // 根據新類型清空不相關的媒體欄位
      switch (updateData.type) {
        case 'image':
          // 變更為圖片類型，清空影片和音訊
          updateData.video_url = ''
          updateData.audio_url = ''
          break
        case 'video':
          // 變更為影片類型，清空音訊（保留圖片作為縮圖）
          updateData.audio_url = ''
          break
        case 'audio':
          // 變更為音訊類型，清空影片（保留圖片作為封面）
          updateData.video_url = ''
          break
        case 'text':
          // 變更為文字類型，清空所有媒體（如果不是從 image 類型來的話圖片已經在上面處理了）
          if (originalMeme.type !== 'image') {
            updateData.image_url = ''
          }
          updateData.video_url = ''
          updateData.audio_url = ''
          break
      }
    }

    // 處理標籤快取
    if (updateData.tags_cache) {
      let tagsArr = updateData.tags_cache
      if (typeof updateData.tags_cache === 'string') {
        try {
          tagsArr = JSON.parse(updateData.tags_cache)
        } catch {
          tagsArr = [updateData.tags_cache]
        }
      }
      updateData.tags_cache = tagsArr
    }

    // 執行更新，使用 session 確保原子性
    const updatedMeme = await Meme.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
      session,
    })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: updatedMeme, error: null })
  } catch (err) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '更新失敗，可能與其他迷因產生衝突',
      })
    }

    // 處理其他 MongoDB 錯誤
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: err.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: err.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除迷因
export const deleteMeme = async (req, res) => {
  try {
    // 先獲取迷因資料以取得圖片 URL 和作者 ID
    const meme = await Meme.findById(req.params.id)
    if (!meme) {
      return res.status(404).json({ error: '找不到迷因' })
    }

    const author_id = meme.author_id

    // 刪除主要圖片（如果存在）
    if (meme.image_url) {
      try {
        await deleteImageByUrl(meme.image_url)
      } catch (deleteError) {
        logger.error('刪除迷因主要圖片失敗:', deleteError)
        // 不中斷刪除流程，只記錄錯誤
      }
    }

    // 刪除詳細介紹中的圖片（如果存在）
    if (meme.detail_images && meme.detail_images.length > 0) {
      for (const detailImageUrl of meme.detail_images) {
        try {
          await deleteImageByUrl(detailImageUrl)
        } catch (deleteError) {
          logger.error('刪除詳細介紹圖片失敗:', {
            imageUrl: detailImageUrl,
            error: deleteError.message,
          })
          // 不中斷刪除流程，只記錄錯誤
        }
      }
    }

    // 刪除影片檔案（如果存在且為 Cloudinary URL）
    if (meme.video_url && meme.video_url.includes('cloudinary.com')) {
      try {
        await deleteImageByUrl(meme.video_url)
      } catch (deleteError) {
        logger.error('刪除迷因影片失敗:', deleteError)
        // 不中斷刪除流程，只記錄錯誤
      }
    }

    // 刪除音訊檔案（如果存在且為 Cloudinary URL）
    if (meme.audio_url && meme.audio_url.includes('cloudinary.com')) {
      try {
        await deleteImageByUrl(meme.audio_url)
      } catch (deleteError) {
        logger.error('刪除迷因音訊失敗:', deleteError)
        // 不中斷刪除流程，只記錄錯誤
      }
    }

    // 刪除來源檔案（如果存在且為 Cloudinary URL）
    if (meme.source_url && meme.source_url.includes('cloudinary.com')) {
      try {
        await deleteImageByUrl(meme.source_url)
      } catch (deleteError) {
        logger.error('刪除迷因來源檔案失敗:', deleteError)
        // 不中斷刪除流程，只記錄錯誤
      }
    }

    // 刪除迷因記錄
    await Meme.findByIdAndDelete(req.params.id)

    // 更新用戶迷因數量統計
    await User.findByIdAndUpdate(author_id, { $inc: { meme_count: -1 } })

    res.json({ success: true, message: '迷因已刪除', error: null })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 批量刪除迷因
export const batchDeleteMemes = async (req, res) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的迷因ID陣列',
      })
    }

    logger.info('開始批量刪除迷因，數量:', ids.length)

    // 先獲取所有要刪除的迷因資料
    const memes = await Meme.find({ _id: { $in: ids } })

    if (memes.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到指定的迷因',
      })
    }

    // 統計各作者的迷因數量，用於後續更新
    const authorCounts = {}
    let deletedCount = 0
    const cloudinaryErrors = []

    // 逐一處理每個迷因
    for (const meme of memes) {
      try {
        // 刪除主要圖片（如果存在）
        if (meme.image_url) {
          try {
            await deleteImageByUrl(meme.image_url)
          } catch (deleteError) {
            logger.error('刪除迷因主要圖片失敗:', deleteError)
            cloudinaryErrors.push({
              memeId: meme._id,
              imageUrl: meme.image_url,
              error: deleteError.message,
            })
            // 不中斷刪除流程，只記錄錯誤
          }
        }

        // 刪除詳細介紹中的圖片（如果存在）
        if (meme.detail_images && meme.detail_images.length > 0) {
          for (const detailImageUrl of meme.detail_images) {
            try {
              await deleteImageByUrl(detailImageUrl)
            } catch (deleteError) {
              logger.error('刪除詳細介紹圖片失敗:', {
                imageUrl: detailImageUrl,
                error: deleteError.message,
              })
              cloudinaryErrors.push({
                memeId: meme._id,
                imageUrl: detailImageUrl,
                error: deleteError.message,
              })
              // 不中斷刪除流程，只記錄錯誤
            }
          }
        }

        // 刪除影片檔案（如果存在且為 Cloudinary URL）
        if (meme.video_url && meme.video_url.includes('cloudinary.com')) {
          try {
            await deleteImageByUrl(meme.video_url)
          } catch (deleteError) {
            logger.error('刪除迷因影片失敗:', deleteError)
            cloudinaryErrors.push({
              memeId: meme._id,
              imageUrl: meme.video_url,
              error: deleteError.message,
            })
            // 不中斷刪除流程，只記錄錯誤
          }
        }

        // 刪除音訊檔案（如果存在且為 Cloudinary URL）
        if (meme.audio_url && meme.audio_url.includes('cloudinary.com')) {
          try {
            await deleteImageByUrl(meme.audio_url)
          } catch (deleteError) {
            logger.error('刪除迷因音訊失敗:', deleteError)
            cloudinaryErrors.push({
              memeId: meme._id,
              imageUrl: meme.audio_url,
              error: deleteError.message,
            })
            // 不中斷刪除流程，只記錄錯誤
          }
        }

        // 刪除來源檔案（如果存在且為 Cloudinary URL）
        if (meme.source_url && meme.source_url.includes('cloudinary.com')) {
          try {
            await deleteImageByUrl(meme.source_url)
          } catch (deleteError) {
            logger.error('刪除迷因來源檔案失敗:', deleteError)
            cloudinaryErrors.push({
              memeId: meme._id,
              imageUrl: meme.source_url,
              error: deleteError.message,
            })
            // 不中斷刪除流程，只記錄錯誤
          }
        }

        // 統計作者迷因數量
        const authorId = meme.author_id.toString()
        authorCounts[authorId] = (authorCounts[authorId] || 0) + 1

        // 刪除迷因記錄
        await Meme.findByIdAndDelete(meme._id)
        deletedCount++
      } catch (error) {
        logger.error('刪除迷因失敗:', { memeId: meme._id, error: error.message })
        // 繼續處理其他迷因
      }
    }

    // 批量更新用戶迷因數量統計
    for (const [authorId, count] of Object.entries(authorCounts)) {
      try {
        await User.findByIdAndUpdate(authorId, { $inc: { meme_count: -count } })
      } catch (error) {
        logger.error('更新用戶迷因數量失敗:', { authorId, error: error.message })
      }
    }

    logger.info('批量刪除完成，成功刪除:', deletedCount, '個迷因')

    res.json({
      success: true,
      message: `成功刪除 ${deletedCount} 個迷因`,
      deletedCount,
      cloudinaryErrors: cloudinaryErrors.length > 0 ? cloudinaryErrors : undefined,
      error: null,
    })
  } catch (err) {
    logger.error('批量刪除迷因錯誤:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// 新增協作者
export const addEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限授權協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    if (meme.editors.map((id) => id.toString()).includes(userId)) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: '該用戶已是協作者' })
    }
    meme.editors.push(userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 移除協作者
export const removeEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限移除協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    meme.editors = meme.editors.filter((id) => id.toString() !== userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
// 使用標籤ID進行進階篩選（使用 MemeTag 關聯表）
export const getMemesByTags = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tagIds,
      search,
      type,
      status,
      sort = 'createdAt',
      order = 'desc',
      useAdvancedSearch = 'true', // 使用進階搜尋
    } = req.query

    // 驗證標籤ID參數
    if (!tagIds) {
      return res.status(400).json({ error: '請提供標籤ID參數' })
    }

    let tagIdArray = tagIds
    if (typeof tagIds === 'string') {
      // 支援逗號分隔的標籤ID字串
      tagIdArray = tagIds.split(',').map((id) => id.trim())
    }

    // 排序設定
    const sortObj = {}
    sortObj[sort] = order === 'desc' ? -1 : 1

    // 如果使用進階搜尋且有搜尋關鍵字
    if (search && useAdvancedSearch === 'true') {
      // 先取得所有符合標籤條件的迷因
      const basePipeline = [
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        {
          $group: {
            _id: '$meme_id',
          },
        },
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        {
          $unwind: '$meme',
        },
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'meme.author_id',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: '$meme._id',
            title: '$meme.title',
            content: '$meme.content',
            detail_markdown: '$meme.detail_markdown',
            type: '$meme.type',
            image_url: '$meme.image_url',
            video_url: '$meme.video_url',
            audio_url: '$meme.audio_url',
            status: '$meme.status',
            views: '$meme.views',
            likes: '$meme.likes',
            shares: '$meme.shares',
            comments: '$meme.comments',
            likes_count: '$meme.likes_count',
            dislikes_count: '$meme.dislikes_count',
            shares_count: '$meme.shares_count',
            comments_count: '$meme.comments_count',
            tags_cache: '$meme.tags_cache',
            createdAt: '$meme.createdAt',
            updatedAt: '$meme.updatedAt',
            author_id: '$meme.author_id',
            username: '$author.username',
            display_name: '$author.display_name',
            author: {
              _id: '$author._id',
              username: '$author.username',
              display_name: '$author.display_name',
              avatar: '$author.avatar',
              meme_count: '$author.meme_count',
            },
          },
        },
      ]

      const allMemes = await MemeTag.aggregate(basePipeline)

      // 轉換資料結構並扁平化作者資訊
      const memesWithFlattenedAuthor = allMemes.map((meme) => ({
        ...meme,
        author: meme.author,
        author_id: meme.author_id,
        username: meme.username || '',
        display_name: meme.display_name || '',
        // 確保數值欄位存在
        views: meme.views || 0,
        likes: meme.likes || 0,
        shares: meme.shares || 0,
        comments: meme.comments || 0,
        likes_count: meme.likes_count || 0,
        dislikes_count: meme.dislikes_count || 0,
        shares_count: meme.shares_count || 0,
        comments_count: meme.comments_count || 0,
      }))

      // 使用進階搜尋過濾器
      const searchParams = {
        search,
        type,
        status,
      }

      const filteredMemes = combineAdvancedSearchFilters(memesWithFlattenedAuthor, searchParams)

      // 處理進階搜尋結果的排序和分頁
      const {
        results: memes,
        pagination: searchPagination,
        scoring,
      } = processAdvancedSearchResults(filteredMemes, { page, limit }, sort)

      // 取得搜尋統計資訊
      const searchStats = getSearchStats(filteredMemes)

      res.json({
        memes,
        pagination: searchPagination,
        filters: {
          search,
          tagIds: tagIdArray,
          type,
          status,
        },
        scoring,
        searchStats,
        searchAlgorithm: 'advanced',
      })
    } else {
      // 使用傳統的 MongoDB 聚合查詢
      const pipeline = [
        // 第一步：篩選符合標籤的迷因標籤關聯
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        // 第二步：分組去重，取得迷因ID
        {
          $group: {
            _id: '$meme_id',
          },
        },
        // 第三步：查詢迷因詳細資訊
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        // 第四步：展開迷因陣列
        {
          $unwind: '$meme',
        },
        // 第五步：篩選迷因條件
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(search && {
              $or: [
                { 'meme.title': new RegExp(search, 'i') },
                { 'meme.content': new RegExp(search, 'i') },
              ],
            }),
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        // 第六步：排序
        {
          $sort: sortObj,
        },
        // 第七步：分頁
        {
          $skip: (parseInt(page) - 1) * parseInt(limit),
        },
        {
          $limit: parseInt(limit),
        },
        // 第八步：查詢作者資訊
        {
          $lookup: {
            from: 'users',
            localField: 'meme.author_id',
            foreignField: '_id',
            as: 'author',
          },
        },
        // 第九步：展開作者陣列
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        // 第十步：重新整理輸出格式
        {
          $project: {
            _id: '$meme._id',
            title: '$meme.title',
            content: '$meme.content',
            type: '$meme.type',
            image_url: '$meme.image_url',
            video_url: '$meme.video_url',
            audio_url: '$meme.audio_url',
            status: '$meme.status',
            views: '$meme.views',
            like_count: '$meme.like_count',
            comment_count: '$meme.comment_count',
            tags_cache: '$meme.tags_cache',
            createdAt: '$meme.createdAt',
            updatedAt: '$meme.updatedAt',
            author: {
              _id: '$author._id',
              username: '$author.username',
              display_name: '$author.display_name',
              avatar: '$author.avatar',
            },
          },
        },
      ]

      // 執行聚合查詢
      const memes = await MemeTag.aggregate(pipeline)

      // 計算總數（使用類似的聚合管道但只計算數量）
      const countPipeline = [
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        {
          $group: {
            _id: '$meme_id',
          },
        },
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        {
          $unwind: '$meme',
        },
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(search && {
              $or: [
                { 'meme.title': new RegExp(search, 'i') },
                { 'meme.content': new RegExp(search, 'i') },
              ],
            }),
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        {
          $count: 'total',
        },
      ]

      const totalResult = await MemeTag.aggregate(countPipeline)
      const total = totalResult.length > 0 ? totalResult[0].total : 0
      const limitNum = parseInt(limit)

      // 計算總頁數
      const totalPages = Math.ceil(total / limitNum)

      res.json({
        memes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          search,
          tagIds: tagIdArray,
          type,
          status,
        },
      })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得搜尋建議
export const getSearchSuggestions = async (req, res) => {
  try {
    const {
      q = '',
      limit = 10,
      type = 'all', // all, keywords, tags, authors
    } = req.query

    const searchTerm = q.trim()
    const limitNum = Math.min(parseInt(limit), 50) // 最多返回50個建議

    const suggestions = {
      keywords: [],
      tags: [],
      authors: [],
    }

    // 如果沒有搜尋詞，返回熱門建議
    if (!searchTerm) {
      // 取得熱門標籤（基於使用頻率）
      if (type === 'all' || type === 'tags') {
        const popularTags = await Meme.aggregate([
          { $match: { status: 'public' } },
          { $unwind: '$tags_cache' },
          { $group: { _id: '$tags_cache', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limitNum },
          { $project: { _id: 0, name: '$_id', count: 1 } },
        ])
        suggestions.tags = popularTags
      }

      // 取得熱門關鍵字（基於最近搜尋的迷因標題）
      if (type === 'all' || type === 'keywords') {
        const popularKeywords = await Meme.aggregate([
          { $match: { status: 'public' } },
          { $sort: { views: -1 } },
          { $limit: limitNum },
          { $project: { _id: 0, title: 1, views: 1 } },
        ])
        suggestions.keywords = popularKeywords.map((item) => ({
          text: item.title,
          views: item.views,
        }))
      }

      // 取得活躍作者
      if (type === 'all' || type === 'authors') {
        const activeAuthors = await Meme.aggregate([
          { $match: { status: 'public' } },
          {
            $group: {
              _id: '$author_id',
              meme_count: { $sum: 1 },
              total_views: { $sum: '$views' },
            },
          },
          { $sort: { meme_count: -1, total_views: -1 } },
          { $limit: limitNum },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },
          {
            $project: {
              _id: 0,
              username: '$author.username',
              display_name: '$author.display_name',
              meme_count: 1,
              total_views: 1,
            },
          },
        ])
        suggestions.authors = activeAuthors
      }

      return res.json({
        success: true,
        data: suggestions,
        query: searchTerm,
      })
    }

    // 有搜尋詞時的建議
    const promises = []

    // 關鍵字建議（基於迷因標題和內容）
    if (type === 'all' || type === 'keywords') {
      promises.push(
        Meme.aggregate([
          {
            $match: {
              status: 'public',
              $or: [
                { title: new RegExp(searchTerm, 'i') },
                { content: new RegExp(searchTerm, 'i') },
              ],
            },
          },
          { $sort: { views: -1, like_count: -1 } },
          { $limit: limitNum },
          {
            $project: {
              _id: 0,
              title: 1,
              content: { $substr: ['$content', 0, 100] }, // 只取前100字
              views: 1,
              like_count: 1,
            },
          },
        ]).then((results) => {
          suggestions.keywords = results.map((item) => ({
            text: item.title,
            snippet: item.content,
            views: item.views,
            likes: item.like_count,
          }))
        }),
      )
    }

    // 標籤建議
    if (type === 'all' || type === 'tags') {
      promises.push(
        Tag.find({
          name: new RegExp(searchTerm, 'i'),
        })
          .limit(limitNum)
          .select('name -_id')
          .then(async (tags) => {
            // 取得每個標籤的使用次數
            const tagStats = await Promise.all(
              tags.map(async (tag) => {
                const count = await Meme.countDocuments({
                  status: 'public',
                  tags_cache: tag.name,
                })
                return {
                  name: tag.name,
                  count,
                }
              }),
            )
            // 按使用次數排序
            suggestions.tags = tagStats.sort((a, b) => b.count - a.count)
          }),
      )
    }

    // 作者建議
    if (type === 'all' || type === 'authors') {
      promises.push(
        User.find({
          $or: [
            { username: new RegExp(searchTerm, 'i') },
            { display_name: new RegExp(searchTerm, 'i') },
          ],
        })
          .limit(limitNum)
          .select('username display_name')
          .then(async (users) => {
            // 取得每個作者的迷因數量
            const authorStats = await Promise.all(
              users.map(async (user) => {
                const meme_count = await Meme.countDocuments({
                  status: 'public',
                  author_id: user._id,
                })
                return {
                  username: user.username,
                  display_name: user.display_name,
                  meme_count,
                }
              }),
            )
            // 按迷因數量排序
            suggestions.authors = authorStats.sort((a, b) => b.meme_count - a.meme_count)
          }),
      )
    }

    // 等待所有查詢完成
    await Promise.all(promises)

    res.json({
      success: true,
      data: suggestions,
      query: searchTerm,
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      data: null,
    })
  }
}

// 更新單一迷因的熱門分數
export const updateMemeHotScore = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme) {
      return res.status(404).json({ success: false, error: '找不到迷因' })
    }

    // 計算新的熱門分數
    const hotScore = calculateMemeHotScore(meme)
    const hotLevel = getHotScoreLevel(hotScore)
    const engagementScore = calculateEngagementScore(meme)
    const qualityScore = calculateQualityScore(meme)

    // 更新迷因的熱門分數
    meme.hot_score = hotScore
    await meme.save()

    res.json({
      success: true,
      data: {
        meme_id: meme._id,
        hot_score: hotScore,
        hot_level: hotLevel,
        engagement_score: engagementScore,
        quality_score: qualityScore,
        updated_at: meme.updatedAt,
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 批次更新所有迷因的熱門分數
export const batchUpdateHotScores = async (req, res) => {
  try {
    const { limit = 1000 } = req.query

    // 取得需要更新的迷因（排除已刪除的）
    const memes = await Meme.find({ status: { $ne: 'deleted' } })
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })

    let updatedCount = 0
    const results = []

    for (const meme of memes) {
      const hotScore = calculateMemeHotScore(meme)
      const hotLevel = getHotScoreLevel(hotScore)

      // 更新熱門分數
      meme.hot_score = hotScore
      await meme.save()

      results.push({
        meme_id: meme._id,
        title: meme.title,
        hot_score: hotScore,
        hot_level: hotLevel,
      })

      updatedCount++
    }

    res.json({
      success: true,
      data: {
        updated_count: updatedCount,
        results: results.slice(0, 10), // 只返回前10個結果作為範例
        message: `成功更新 ${updatedCount} 個迷因的熱門分數`,
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 取得熱門迷因列表
export const getHotMemes = async (req, res) => {
  try {
    const { limit = 50, days = 7, type = 'all', status = 'public' } = req.query

    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - parseInt(days))

    const filter = {
      status: status,
      createdAt: mongoose.trusted({ $gte: dateLimit }),
    }

    // 根據類型篩選
    if (type !== 'all') {
      filter.type = type
    }

    const memes = await Meme.find(filter)
      .sort({ hot_score: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    // 為每個迷因添加熱門等級和分數資訊
    const memesWithScores = memes.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        hot_level: getHotScoreLevel(memeObj.hot_score),
        engagement_score: calculateEngagementScore(memeObj),
        quality_score: calculateQualityScore(memeObj),
      }
    })

    res.json({
      success: true,
      data: {
        memes: memesWithScores,
        filters: {
          limit: parseInt(limit),
          days: parseInt(days),
          type,
          status,
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 取得趨勢迷因列表
export const getTrendingMemes = async (req, res) => {
  try {
    const { limit = 50, hours = 24, type = 'all', status = 'public' } = req.query

    const dateLimit = new Date()
    dateLimit.setHours(dateLimit.getHours() - parseInt(hours))

    const filter = {
      status: status,
      createdAt: mongoose.trusted({ $gte: dateLimit }),
    }

    // 根據類型篩選
    if (type !== 'all') {
      filter.type = type
    }

    const memes = await Meme.find(filter)
      .sort({ hot_score: -1, views: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    // 為每個迷因添加熱門等級和分數資訊
    const memesWithScores = memes.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        hot_level: getHotScoreLevel(memeObj.hot_score),
        engagement_score: calculateEngagementScore(memeObj),
        quality_score: calculateQualityScore(memeObj),
      }
    })

    res.json({
      success: true,
      data: {
        memes: memesWithScores,
        filters: {
          limit: parseInt(limit),
          days: parseInt(hours),
          type,
          status,
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 取得迷因的詳細分數分析
export const getMemeScoreAnalysis = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme) {
      return res.status(404).json({ success: false, error: '找不到迷因' })
    }

    const memeObj = meme.toObject()
    const hotScore = calculateMemeHotScore(memeObj)
    const hotLevel = getHotScoreLevel(hotScore)
    const engagementScore = calculateEngagementScore(memeObj)
    const qualityScore = calculateQualityScore(memeObj)

    res.json({
      success: true,
      data: {
        meme_id: meme._id,
        title: meme.title,
        hot_score: hotScore,
        hot_level: hotLevel,
        engagement_score: engagementScore,
        quality_score: qualityScore,
        stats: {
          views: meme.views,
          likes: meme.like_count,
          dislikes: meme.dislike_count,
          comments: meme.comment_count,
          collections: meme.collection_count,
          shares: meme.share_count,
        },
        analysis: {
          hot_score_formula: '基礎分數 * 時間衰減因子',
          engagement_rate: `${engagementScore.toFixed(2)}%`,
          quality_ratio: `${qualityScore.toFixed(2)}%`,
          time_factor: `${(1 / (1 + Math.log((new Date() - meme.createdAt) / (1000 * 60 * 60 * 24) + 1))).toFixed(3)}`,
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// 取得隨機迷因
export const getRandomMeme = async (req, res) => {
  try {
    const { type = 'all', status = 'public', excludeId = null, tags = null } = req.query

    // 建立篩選條件
    const filter = {
      status: status,
    }

    // 根據類型篩選
    if (type !== 'all') {
      filter.type = type
    }

    // 排除指定ID（避免重複顯示同一個迷因）
    if (excludeId) {
      filter._id = { $ne: excludeId }
    }

    // 根據標籤篩選
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags]
      filter.tags_cache = { $in: tagArray }
    }

    // 使用 MongoDB 的 $sample 操作符來隨機選擇一個迷因
    const randomMeme = await Meme.aggregate([
      { $match: filter },
      { $sample: { size: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'author_id',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          content: 1,
          image_url: 1,
          video_url: 1,
          audio_url: 1,
          type: 1,
          detail_markdown: 1,
          tags_cache: 1,
          source_url: 1,
          views: 1,
          like_count: 1,
          dislike_count: 1,
          comment_count: 1,
          collection_count: 1,
          share_count: 1,
          hot_score: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          'author._id': 1,
          'author.username': 1,
          'author.display_name': 1,
          'author.avatar': 1,
        },
      },
    ])

    if (randomMeme.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到符合條件的迷因',
        data: null,
      })
    }

    const meme = randomMeme[0]

    // 計算熱門分數和等級
    const hotScore = calculateMemeHotScore(meme)
    const hotLevel = getHotScoreLevel(hotScore)
    const engagementScore = calculateEngagementScore(meme)
    const qualityScore = calculateQualityScore(meme)

    // 重新組織作者資訊
    const author = meme.author
      ? {
          _id: meme.author._id,
          username: meme.author.username,
          display_name: meme.author.display_name,
          avatar: meme.author.avatar,
        }
      : null

    // 移除聚合查詢產生的 author 欄位，改用重新組織的 author 物件
    delete meme.author

    const memeWithScores = {
      ...meme,
      author,
      hot_score: hotScore,
      hot_level: hotLevel,
      engagement_score: engagementScore,
      quality_score: qualityScore,
    }

    res.json({
      success: true,
      data: {
        meme: memeWithScores,
        filters: {
          type,
          status,
          excludeId,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
        },
      },
      error: null,
    })
  } catch (err) {
    logger.error('取得隨機迷因時發生錯誤:', err)
    res.status(500).json({
      success: false,
      error: '取得隨機迷因時發生錯誤',
      data: null,
    })
  }
}

// ===== 三層模型 Bundle API =====

// 取得迷因 bundle（包含來源、片段、變體等資料）
export const getMemeBundle = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params
    const include = (req.query.include || '').split(',').filter(Boolean)

    // 查詢迷因
    const match = mongoose.Types.ObjectId.isValid(idOrSlug)
      ? { _id: new mongoose.Types.ObjectId(idOrSlug) }
      : { slug: idOrSlug }

    const meme = await Meme.findOne(match)
      .populate('author_id', 'username display_name avatar')
      .lean()

    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '迷因不存在',
      })
    }

    const result = { meme }

    // 並行取得所需資料
    const promises = []

    // scene/source 資料（加入 ObjectId 驗證以避免 CastError）
    if (
      include.includes('scene') &&
      meme.scene_id &&
      mongoose.Types.ObjectId.isValid(meme.scene_id)
    ) {
      promises.push(
        Scene.findById(meme.scene_id)
          .lean()
          .then((scene) => {
            result.scene = scene
          })
          .catch(() => {}),
      )
    }

    if (include.includes('source') && (meme.source_id || result.scene?.source_id)) {
      const sourceId = meme.source_id || result.scene?.source_id
      if (sourceId && mongoose.Types.ObjectId.isValid(sourceId)) {
        const sourceObjectId =
          sourceId instanceof mongoose.Types.ObjectId
            ? sourceId
            : new mongoose.Types.ObjectId(sourceId)
        promises.push(
          Source.findById(sourceObjectId)
            .lean()
            .then((source) => {
              result.source = source
            })
            .catch(() => {}),
        )
      }
    }

    // 同 lineage（變體/混剪族譜）
    if (include.includes('variants')) {
      const rootId = meme.lineage?.root || meme._id
      const currentMemeId =
        meme._id instanceof mongoose.Types.ObjectId
          ? meme._id
          : new mongoose.Types.ObjectId(meme._id)
      promises.push(
        Meme.find({
          'lineage.root': rootId,
          status: 'public',
          _id: mongoose.trusted({ $ne: currentMemeId }), // 排除自己（避免 CastError）
        })
          .select(
            'title slug image_url video_url variant_of lineage like_count view_count author_id source_id scene_id createdAt',
          )
          .sort({ 'lineage.depth': 1, like_count: -1, createdAt: -1 })
          .limit(60)
          .populate('author_id', 'username display_name avatar')
          .lean()
          .then((variants) => {
            result.variants = variants
          }),
      )
    }

    // 同來源其他迷因（排除自己） - 加入 ObjectId 驗證與 Query Builder 避免 CastError
    if (include.includes('from_source') && (meme.source_id || result.scene?.source_id)) {
      const rawSourceId = meme.source_id || result.scene?.source_id
      if (rawSourceId && mongoose.Types.ObjectId.isValid(rawSourceId)) {
        const sourceObjectId =
          rawSourceId instanceof mongoose.Types.ObjectId
            ? rawSourceId
            : new mongoose.Types.ObjectId(rawSourceId)

        const currentMemeId =
          meme._id instanceof mongoose.Types.ObjectId
            ? meme._id
            : new mongoose.Types.ObjectId(meme._id)

        const query = Meme.find({
          source_id: sourceObjectId,
          status: 'public',
          _id: mongoose.trusted({ $ne: currentMemeId }),
        })
          .select(
            'title slug image_url video_url like_count view_count author_id scene_id lineage createdAt',
          )
          .sort({ like_count: -1, createdAt: -1 })
          .limit(30)
          .populate('author_id', 'username display_name avatar')
          .populate('scene_id', 'title quote start_time end_time')
          .lean()

        promises.push(
          query
            .then((fromSource) => {
              result.from_source = fromSource
            })
            .catch(() => {}),
        )
      } else {
        // 若 sourceId 無效則回傳空陣列避免中斷
        result.from_source = []
      }
    }

    // 執行所有並行查詢
    await Promise.all(promises)

    // 如果之前沒有取得 source 但現在有 scene，補充取得 source
    if (!result.source && result.scene?.source_id && include.includes('source')) {
      result.source = await Source.findById(result.scene.source_id).lean()
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('取得迷因 bundle 時發生錯誤:', error)
    next(error)
  }
}

// 取得同一系譜的變體迷因
export const getMemeVariants = async (req, res, next) => {
  try {
    const { id } = req.params
    const { limit = 60, page = 1 } = req.query

    const meme = await Meme.findById(id).select('lineage').lean()
    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '迷因不存在',
      })
    }

    const rootId = meme.lineage?.root || id
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [variants, total] = await Promise.all([
      Meme.find({
        'lineage.root': rootId,
        status: 'public',
        _id: { $ne: id },
      })
        .select(
          'title slug image_url video_url variant_of lineage like_count view_count author_id createdAt',
        )
        .sort({ 'lineage.depth': 1, like_count: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author_id', 'username display_name avatar')
        .lean(),
      Meme.countDocuments({
        'lineage.root': rootId,
        status: 'public',
        _id: { $ne: id },
      }),
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      data: variants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    logger.error('取得變體迷因時發生錯誤:', error)
    next(error)
  }
}

// 取得同一來源的其他迷因
export const getMemesFromSameSource = async (req, res, next) => {
  try {
    const { id } = req.params
    const { limit = 30, page = 1 } = req.query

    const meme = await Meme.findById(id).select('source_id scene_id').lean()
    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '迷因不存在',
      })
    }

    // 如果有 scene_id，先取得對應的 source_id
    let sourceId = meme.source_id
    if (!sourceId && meme.scene_id) {
      const scene = await Scene.findById(meme.scene_id).select('source_id').lean()
      if (scene) {
        sourceId = scene.source_id
      }
    }

    if (!sourceId) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        message: '此迷因沒有關聯的來源',
      })
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [memes, total] = await Promise.all([
      Meme.find({
        source_id: sourceId,
        status: 'public',
        _id: { $ne: id },
      })
        .select(
          'title slug image_url video_url like_count view_count scene_id lineage author_id createdAt',
        )
        .sort({ like_count: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author_id', 'username display_name avatar')
        .populate('scene_id', 'title quote start_time end_time')
        .lean(),
      Meme.countDocuments({
        source_id: sourceId,
        status: 'public',
        _id: { $ne: id },
      }),
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      data: memes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    logger.error('取得同來源迷因時發生錯誤:', error)
    next(error)
  }
}

// 根據來源 ID 取得迷因列表
export const getMemesBySource = async (req, res, next) => {
  try {
    const { sourceId } = req.params
    const { limit = 12, page = 1, sort = 'hot' } = req.query

    // 驗證 sourceId 格式
    if (!mongoose.Types.ObjectId.isValid(sourceId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的來源 ID',
      })
    }

    // 檢查來源是否存在
    const source = await Source.findById(sourceId).lean()
    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    // 根據排序方式設定排序條件
    let sortCondition = {}
    switch (sort) {
      case 'hot':
        sortCondition = { hot_score: -1, like_count: -1, createdAt: -1 }
        break
      case 'new':
        sortCondition = { createdAt: -1 }
        break
      case 'likes':
        sortCondition = { like_count: -1, createdAt: -1 }
        break
      case 'views':
        sortCondition = { view_count: -1, createdAt: -1 }
        break
      default:
        sortCondition = { hot_score: -1, like_count: -1, createdAt: -1 }
    }

    const [memes, total] = await Promise.all([
      Meme.find({
        source_id: sourceId,
        status: 'public',
      })
        .select('title slug image_url video_url like_count view_count author_id scene_id createdAt')
        .sort(sortCondition)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author_id', 'username display_name avatar')
        .populate('scene_id', 'title quote start_time end_time')
        .lean(),
      Meme.countDocuments({
        source_id: sourceId,
        status: 'public',
      }),
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        memes,
        source,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    logger.error('根據來源取得迷因時發生錯誤:', error)
    next(error)
  }
}
