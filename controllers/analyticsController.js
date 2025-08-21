/**
 * 分析與監控控制器
 * 提供推薦效果指標和 A/B 測試管理功能
 */

import { StatusCodes } from 'http-status-codes'
import RecommendationMetrics from '../models/RecommendationMetrics.js'
import ABTest from '../models/ABTest.js'
import Meme from '../models/Meme.js'
import { logger } from '../utils/logger.js'

/**
 * 記錄推薦指標
 * @route POST /api/analytics/track-recommendation
 * @access Private
 */
export const trackRecommendation = async (req, res) => {
  try {
    // 檢查隱私同意設定
    if (req.skipAnalytics || !req.canTrackAnalytics) {
      logger.debug('跳過 analytics 追蹤：使用者未同意 analytics')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Analytics 追蹤已跳過（隱私設定）',
        skipped: true,
      })
    }

    const {
      meme_id,
      algorithm,
      recommendation_score,
      recommendation_rank,
      ab_test_id,
      ab_test_variant,
      recommendation_context,
      user_features,
    } = req.body

    const userId = req.user._id

    // 驗證必要欄位
    if (!meme_id || !algorithm || !recommendation_score || !recommendation_rank) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '缺少必要欄位',
      })
    }

    // 驗證迷因存在
    const meme = await Meme.findById(meme_id)
    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '迷因不存在',
      })
    }

    // 計算迷因年齡（小時）
    const ageHours = Math.floor((Date.now() - meme.createdAt.getTime()) / (1000 * 60 * 60))

    // 建立推薦指標記錄
    const metrics = new RecommendationMetrics({
      user_id: userId,
      meme_id,
      algorithm,
      recommendation_score,
      recommendation_rank,
      ab_test_id: ab_test_id || null,
      ab_test_variant: ab_test_variant || null,
      recommendation_context: {
        page: recommendation_context?.page || 'home',
        position: recommendation_context?.position || 1,
        session_id: recommendation_context?.session_id || null,
      },
      user_features: {
        is_new_user: user_features?.is_new_user || false,
        user_activity_level: user_features?.user_activity_level || 'low',
        user_preferences: user_features?.user_preferences || {},
      },
      meme_features: {
        type: meme.type,
        tags: meme.tags || [],
        hot_score: meme.hot_score || 0,
        age_hours: ageHours,
      },
    })

    await metrics.save()

    logger.info(`記錄推薦指標: 用戶 ${userId}, 迷因 ${meme_id}, 演算法 ${algorithm}`)

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        metrics_id: metrics._id,
        message: '推薦指標記錄成功',
      },
    })
  } catch (error) {
    logger.error('記錄推薦指標失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 更新推薦互動指標
 * @route PUT /api/analytics/update-interaction
 * @access Private
 */
export const updateInteraction = async (req, res) => {
  try {
    const { metrics_id, interaction_type, view_duration, user_rating } = req.body

    const userId = req.user._id

    // 驗證必要欄位
    if (!metrics_id || !interaction_type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '缺少必要欄位',
      })
    }

    // 查找並更新指標記錄
    const metrics = await RecommendationMetrics.findById(metrics_id)
    if (!metrics) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '指標記錄不存在',
      })
    }

    // 驗證用戶權限
    if (metrics.user_id.toString() !== userId.toString()) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: '無權限更新此記錄',
      })
    }

    // 更新互動指標
    const updateData = {
      interacted_at: new Date(),
    }

    switch (interaction_type) {
      case 'click':
        updateData.is_clicked = true
        break
      case 'like':
        updateData.is_liked = true
        break
      case 'share':
        updateData.is_shared = true
        break
      case 'comment':
        updateData.is_commented = true
        break
      case 'collect':
        updateData.is_collected = true
        break
      case 'dislike':
        updateData.is_disliked = true
        break
      case 'view':
        if (view_duration) {
          updateData.view_duration = view_duration
        }
        break
      case 'rate':
        if (user_rating && user_rating >= 1 && user_rating <= 5) {
          updateData.user_rating = user_rating
        }
        break
      default:
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: '無效的互動類型',
        })
    }

    // 計算互動時間
    if (metrics.recommended_at && !metrics.time_to_interact) {
      updateData.time_to_interact = Math.floor(
        (Date.now() - metrics.recommended_at.getTime()) / 1000,
      )
    }

    await RecommendationMetrics.findByIdAndUpdate(metrics_id, updateData)

    logger.info(`更新互動指標: 記錄 ${metrics_id}, 互動類型 ${interaction_type}`)

    res.json({
      success: true,
      data: {
        message: '互動指標更新成功',
      },
    })
  } catch (error) {
    logger.error('更新互動指標失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 取得推薦演算法統計
 * @route GET /api/analytics/algorithm-stats
 * @access Private
 */
export const getAlgorithmStats = async (req, res) => {
  try {
    const { algorithm, start_date, end_date, group_by = 'day' } = req.query

    // 設定時間範圍
    const startDate = start_date
      ? new Date(start_date)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 預設30天
    const endDate = end_date ? new Date(end_date) : new Date()

    let stats

    if (algorithm) {
      // 特定演算法統計
      stats = await RecommendationMetrics.getAlgorithmStats(algorithm, startDate, endDate)
    } else {
      // 所有演算法統計
      const algorithms = [
        'hot',
        'latest',
        'content-based',
        'collaborative-filtering',
        'social-collaborative-filtering',
        'mixed',
        'tag-based',
        'similar',
        'user-interest',
      ]

      const allStats = await Promise.all(
        algorithms.map(async (algo) => {
          const algoStats = await RecommendationMetrics.getAlgorithmStats(algo, startDate, endDate)
          return {
            algorithm: algo,
            ...algoStats,
          }
        }),
      )

      stats = allStats
    }

    res.json({
      success: true,
      data: {
        stats,
        time_range: {
          start_date: startDate,
          end_date: endDate,
        },
        group_by,
      },
    })
  } catch (error) {
    logger.error('取得演算法統計失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 取得用戶推薦效果分析
 * @route GET /api/analytics/user-effectiveness
 * @access Private
 */
export const getUserEffectiveness = async (req, res) => {
  try {
    const userId = req.user._id
    const { start_date, end_date } = req.query

    // 設定時間範圍
    const startDate = start_date
      ? new Date(start_date)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end_date ? new Date(end_date) : new Date()

    // 取得用戶推薦指標
    const userMetrics = await RecommendationMetrics.find({
      user_id: userId,
      recommended_at: {
        $gte: startDate,
        $lte: endDate,
      },
    }).populate('meme_id', 'title type tags hot_score')

    // 計算統計
    const totalRecommendations = userMetrics.length
    const totalClicks = userMetrics.filter((m) => m.is_clicked).length
    const totalLikes = userMetrics.filter((m) => m.is_liked).length
    const totalShares = userMetrics.filter((m) => m.is_shared).length
    const totalComments = userMetrics.filter((m) => m.is_commented).length
    const totalCollections = userMetrics.filter((m) => m.is_collected).length
    const totalDislikes = userMetrics.filter((m) => m.is_disliked).length

    // 按演算法分組
    const algorithmStats = {}
    userMetrics.forEach((metric) => {
      if (!algorithmStats[metric.algorithm]) {
        algorithmStats[metric.algorithm] = {
          total: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          collections: 0,
          dislikes: 0,
          avg_rating: 0,
          avg_view_duration: 0,
        }
      }

      algorithmStats[metric.algorithm].total++
      if (metric.is_clicked) algorithmStats[metric.algorithm].clicks++
      if (metric.is_liked) algorithmStats[metric.algorithm].likes++
      if (metric.is_shared) algorithmStats[metric.algorithm].shares++
      if (metric.is_commented) algorithmStats[metric.algorithm].comments++
      if (metric.is_collected) algorithmStats[metric.algorithm].collections++
      if (metric.is_disliked) algorithmStats[metric.algorithm].dislikes++

      if (metric.user_rating) {
        algorithmStats[metric.algorithm].avg_rating += metric.user_rating
      }
      if (metric.view_duration) {
        algorithmStats[metric.algorithm].avg_view_duration += metric.view_duration
      }
    })

    // 計算平均值
    Object.keys(algorithmStats).forEach((algo) => {
      const stats = algorithmStats[algo]
      if (stats.total > 0) {
        stats.ctr = stats.clicks / stats.total
        stats.engagement_rate =
          (stats.likes + stats.shares + stats.comments + stats.collections) / (stats.total * 4)
        stats.avg_rating = stats.avg_rating / stats.total
        stats.avg_view_duration = stats.avg_view_duration / stats.total
      }
    })

    res.json({
      success: true,
      data: {
        user_id: userId,
        time_range: {
          start_date: startDate,
          end_date: endDate,
        },
        overall_stats: {
          total_recommendations: totalRecommendations,
          ctr: totalRecommendations > 0 ? totalClicks / totalRecommendations : 0,
          engagement_rate:
            totalRecommendations > 0
              ? (totalLikes + totalShares + totalComments + totalCollections) /
                (totalRecommendations * 4)
              : 0,
          total_likes: totalLikes,
          total_shares: totalShares,
          total_comments: totalComments,
          total_collections: totalCollections,
          total_dislikes: totalDislikes,
        },
        algorithm_stats: algorithmStats,
        recent_recommendations: userMetrics.slice(-10).map((m) => ({
          meme_id: m.meme_id,
          algorithm: m.algorithm,
          recommended_at: m.recommended_at,
          is_clicked: m.is_clicked,
          is_liked: m.is_liked,
          user_rating: m.user_rating,
        })),
      },
    })
  } catch (error) {
    logger.error('取得用戶效果分析失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 建立 A/B 測試
 * @route POST /api/analytics/ab-tests
 * @access Private
 */
export const createABTest = async (req, res) => {
  try {
    const {
      test_id,
      name,
      description,
      test_type,
      primary_metric,
      secondary_metrics,
      variants,
      target_audience,
      start_date,
      end_date,
      statistical_settings,
      automation,
      notifications,
    } = req.body

    const userId = req.user._id

    // 驗證必要欄位
    if (
      !test_id ||
      !name ||
      !test_type ||
      !primary_metric ||
      !variants ||
      !start_date ||
      !end_date
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '缺少必要欄位',
      })
    }

    // 檢查測試 ID 是否已存在
    const existingTest = await ABTest.findOne({ test_id })
    if (existingTest) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        error: '測試 ID 已存在',
      })
    }

    // 建立 A/B 測試
    const abTest = new ABTest({
      test_id,
      name,
      description,
      test_type,
      primary_metric,
      secondary_metrics: secondary_metrics || [],
      variants,
      target_audience: target_audience || {
        user_segments: ['all_users'],
        user_activity_levels: ['low', 'medium', 'high'],
        device_types: ['mobile', 'desktop', 'tablet'],
      },
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      statistical_settings: statistical_settings || {
        confidence_level: 0.95,
        minimum_sample_size: 1000,
        minimum_duration_days: 7,
      },
      automation: automation || {
        auto_stop: true,
        auto_winner_selection: false,
        minimum_improvement: 0.05,
      },
      notifications: notifications || {
        on_start: true,
        on_completion: true,
        on_significant_result: true,
        recipients: [],
      },
      created_by: userId,
    })

    await abTest.save()

    logger.info(`建立 A/B 測試: ${test_id}, 名稱: ${name}`)

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        test_id: abTest.test_id,
        name: abTest.name,
        status: abTest.status,
        message: 'A/B 測試建立成功',
      },
    })
  } catch (error) {
    logger.error('建立 A/B 測試失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 取得 A/B 測試列表
 * @route GET /api/analytics/ab-tests
 * @access Private
 */
export const getABTests = async (req, res) => {
  try {
    const { status, test_type, page = 1, limit = 10 } = req.query
    const userId = req.user._id

    // 建立查詢條件
    const query = { created_by: userId }
    if (status) query.status = status
    if (test_type) query.test_type = test_type

    // 分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const tests = await ABTest.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await ABTest.countDocuments(query)

    res.json({
      success: true,
      data: {
        tests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('取得 A/B 測試列表失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 取得 A/B 測試詳細資訊
 * @route GET /api/analytics/ab-tests/:testId
 * @access Private
 */
export const getABTestDetails = async (req, res) => {
  try {
    const { testId } = req.params
    const userId = req.user._id

    const test = await ABTest.findOne({ test_id: testId, created_by: userId })
    if (!test) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'A/B 測試不存在',
      })
    }

    // 取得測試結果
    const results = await RecommendationMetrics.getABTestResults(
      testId,
      test.start_date,
      test.end_date,
    )

    res.json({
      success: true,
      data: {
        test,
        results,
        is_active: test.is_active,
        is_completed: test.is_completed,
        duration_days: test.duration_days,
      },
    })
  } catch (error) {
    logger.error('取得 A/B 測試詳細資訊失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 更新 A/B 測試狀態
 * @route PUT /api/analytics/ab-tests/:testId/status
 * @access Private
 */
export const updateABTestStatus = async (req, res) => {
  try {
    const { testId } = req.params
    const { status } = req.body
    const userId = req.user._id

    if (!status) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '缺少狀態參數',
      })
    }

    const test = await ABTest.findOne({ test_id: testId, created_by: userId })
    if (!test) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'A/B 測試不存在',
      })
    }

    test.status = status
    await test.save()

    logger.info(`更新 A/B 測試狀態: ${testId}, 新狀態: ${status}`)

    res.json({
      success: true,
      data: {
        test_id: test.test_id,
        status: test.status,
        message: '測試狀態更新成功',
      },
    })
  } catch (error) {
    logger.error('更新 A/B 測試狀態失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}

/**
 * 取得推薦效果儀表板
 * @route GET /api/analytics/dashboard
 * @access Private
 */
export const getAnalyticsDashboard = async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    // 設定時間範圍
    const startDate = start_date
      ? new Date(start_date)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end_date ? new Date(end_date) : new Date()

    // 取得整體統計
    const overallStats = await RecommendationMetrics.aggregate([
      {
        $match: {
          recommended_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total_recommendations: { $sum: 1 },
          total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
          total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
          total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
          total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
          total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
          total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
          avg_view_duration: { $avg: '$view_duration' },
          avg_rating: { $avg: '$user_rating' },
        },
      },
    ])

    // 取得演算法比較
    const algorithmComparison = await RecommendationMetrics.aggregate([
      {
        $match: {
          recommended_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$algorithm',
          total_recommendations: { $sum: 1 },
          total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
          total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
          total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
          total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
          total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
          total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
          avg_view_duration: { $avg: '$view_duration' },
          avg_rating: { $avg: '$user_rating' },
        },
      },
    ])

    // 取得活躍的 A/B 測試
    const activeTests = await ABTest.getActiveTests()

    // 計算演算法效果
    const algorithmStats = algorithmComparison.map((algo) => ({
      algorithm: algo._id,
      total_recommendations: algo.total_recommendations,
      ctr: algo.total_recommendations > 0 ? algo.total_clicks / algo.total_recommendations : 0,
      engagement_rate:
        algo.total_recommendations > 0
          ? (algo.total_likes + algo.total_shares + algo.total_comments + algo.total_collections) /
            (algo.total_recommendations * 4)
          : 0,
      avg_view_duration: algo.avg_view_duration || 0,
      avg_rating: algo.avg_rating || 0,
    }))

    const overall = overallStats[0] || {
      total_recommendations: 0,
      total_clicks: 0,
      total_likes: 0,
      total_shares: 0,
      total_comments: 0,
      total_collections: 0,
      total_dislikes: 0,
      avg_view_duration: 0,
      avg_rating: 0,
    }

    res.json({
      success: true,
      data: {
        time_range: {
          start_date: startDate,
          end_date: endDate,
        },
        overall_stats: {
          total_recommendations: overall.total_recommendations,
          ctr:
            overall.total_recommendations > 0
              ? overall.total_clicks / overall.total_recommendations
              : 0,
          engagement_rate:
            overall.total_recommendations > 0
              ? (overall.total_likes +
                  overall.total_shares +
                  overall.total_comments +
                  overall.total_collections) /
                (overall.total_recommendations * 4)
              : 0,
          avg_view_duration: overall.avg_view_duration || 0,
          avg_rating: overall.avg_rating || 0,
          total_likes: overall.total_likes,
          total_shares: overall.total_shares,
          total_comments: overall.total_comments,
          total_collections: overall.total_collections,
          total_dislikes: overall.total_dislikes,
        },
        algorithm_comparison: algorithmStats,
        active_ab_tests: activeTests.length,
        top_performing_algorithms: algorithmStats
          .sort((a, b) => b.engagement_rate - a.engagement_rate)
          .slice(0, 3),
      },
    })
  } catch (error) {
    logger.error('取得分析儀表板失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
    })
  }
}
