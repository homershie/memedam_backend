/**
 * SEO 測試助手函數
 * 提供測試用的模擬數據和助手函數
 */

import jwt from 'jsonwebtoken'

// JWT 測試令牌
export const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

/**
 * 生成測試用的 JWT 令牌
 */
export function generateTestToken(userData = {}) {
  const defaultUser = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
  }

  return jwt.sign({ ...defaultUser, ...userData }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

/**
 * 生成無效的測試令牌
 */
export function generateInvalidToken() {
  return 'invalid.jwt.token'
}

/**
 * 生成過期的測試令牌
 */
export function generateExpiredToken() {
  return jwt.sign(
    { id: 'test-user-id', username: 'testuser' },
    TEST_JWT_SECRET,
    { expiresIn: '-1h' }, // 已過期
  )
}

// 模擬 SEO 監控狀態數據
export const mockMonitoringStatus = {
  is_monitoring: true,
  metrics_count: 4,
  cache_prefix: 'seo:',
  last_update: '2024-01-15T10:30:00.000Z',
  alert_thresholds: {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    metaTagsScore: 80,
    structuredDataScore: 70,
    mobileFriendliness: 85,
    indexingRate: 95,
  },
}

// 模擬 SEO 指標數據
export const mockSEOMetrics = {
  performance: {
    lcp: 2000,
    fid: 50,
    cls: 0.05,
    ttfb: 300,
    pageLoadTime: 1800,
    domContentLoaded: 1200,
    firstPaint: 800,
    timestamp: '2024-01-15T10:30:00.000Z',
  },
  seo_health: {
    metaTagsScore: 85,
    structuredDataScore: 80,
    mobileFriendliness: 90,
    pageSpeedScore: 88,
    accessibilityScore: 92,
    canonicalUrlsValid: true,
    duplicateContentRatio: 1.5,
    timestamp: '2024-01-15T10:30:00.000Z',
  },
  search_engine: {
    indexedPages: 5500,
    crawledPages: 4800,
    indexingErrors: 3,
    crawlErrors: 8,
    sitemapStatus: 'valid',
    indexingRate: 96.5,
    timestamp: '2024-01-15T10:30:00.000Z',
  },
  userExperience: {
    bounceRate: [0.25, 0.22, 0.28, 0.24, 0.26],
    sessionDuration: [180, 195, 170, 185, 190],
    pageViews: [1250, 1300, 1180, 1320, 1280],
    uniqueVisitors: [850, 880, 820, 890, 860],
  },
  timestamp: '2024-01-15T10:30:00.000Z',
}

// 模擬 SEO 報告數據
export const mockSEOReport = {
  date: '2024-01-15',
  timestamp: '2024-01-15T10:30:00.000Z',
  summary: {
    overall_score: 87,
    performance_trend: 'improving',
    seo_health: 'good',
    indexing_status: 'excellent',
    alerts_count: 2,
    recommendations_count: 5,
  },
  performance: {
    lcp: {
      current: 2000,
      average: 2100,
      trend: 'decreasing',
      status: 'good',
    },
    fid: {
      current: 50,
      average: 55,
      trend: 'stable',
      status: 'good',
    },
    cls: {
      current: 0.05,
      average: 0.06,
      trend: 'stable',
      status: 'good',
    },
    ttfb: {
      current: 300,
      average: 320,
      trend: 'decreasing',
      status: 'good',
    },
  },
  seo: {
    meta_tags: {
      score: 85,
      average: 83,
      trend: 'improving',
      status: 'good',
    },
    structured_data: {
      score: 80,
      average: 78,
      trend: 'improving',
      status: 'good',
    },
    mobile_friendly: {
      score: 90,
      average: 88,
      trend: 'stable',
      status: 'good',
    },
    accessibility: {
      score: 92,
      average: 90,
      trend: 'improving',
      status: 'good',
    },
  },
  searchEngine: {
    indexed_pages: 5500,
    crawled_pages: 4800,
    indexing_rate: 96.5,
    crawl_errors: 8,
    indexing_errors: 3,
    sitemap_status: 'valid',
    coverage_status: 'good',
  },
  alerts: [
    {
      id: 'alert_001',
      type: 'performance',
      severity: 'medium',
      title: 'LCP 輕微超標',
      message: 'LCP 為 2000ms，接近閾值 2500ms',
      timestamp: '2024-01-15T09:15:00.000Z',
      resolved: false,
    },
    {
      id: 'alert_002',
      type: 'seo',
      severity: 'low',
      title: 'Meta 描述長度',
      message: '部分頁面的 Meta 描述過短',
      timestamp: '2024-01-15T08:45:00.000Z',
      resolved: false,
    },
  ],
  recommendations: [
    {
      id: 'rec_001',
      type: 'performance',
      priority: 'high',
      title: '優化圖片載入',
      description: '圖片載入時間影響 LCP，建議使用 WebP 格式並啟用壓縮',
      impact: 'high',
      effort: 'medium',
      actions: ['將 JPEG/PNG 轉換為 WebP 格式', '啟用圖片壓縮', '實施懶載入', '使用 CDN 加速'],
    },
    {
      id: 'rec_002',
      type: 'seo',
      priority: 'medium',
      title: '完善 Meta 標籤',
      description: '部分頁面缺少完整的 Meta 標籤，影響搜尋引擎理解',
      impact: 'medium',
      effort: 'low',
      actions: [
        '為所有頁面添加唯一的 title',
        '完善 description 標籤',
        '添加適當的 Open Graph 標籤',
        '驗證 canonical URL',
      ],
    },
    {
      id: 'rec_003',
      type: 'technical',
      priority: 'medium',
      title: '改善移動端體驗',
      description: '移動端載入速度可以進一步優化',
      impact: 'medium',
      effort: 'medium',
      actions: ['優化字體載入', '減少不必要的 JavaScript', '改善觸控目標大小', '測試不同螢幕尺寸'],
    },
  ],
}

// 模擬警報數據
export const mockSEOAlerts = [
  {
    id: 'alert_001',
    type: 'performance',
    metric: 'lcp',
    value: 2800,
    threshold: 2500,
    severity: 'high',
    title: 'LCP 嚴重超標',
    message: 'LCP 為 2800ms，超過閾值 2500ms',
    timestamp: '2024-01-15T10:15:00.000Z',
    affected_pages: ['/home', '/products'],
    resolved: false,
    resolution_note: null,
  },
  {
    id: 'alert_002',
    type: 'seo',
    metric: 'metaTagsScore',
    value: 65,
    threshold: 80,
    severity: 'medium',
    title: 'Meta 標籤分數過低',
    message: 'Meta 標籤完整性分數為 65，低於閾值 80',
    timestamp: '2024-01-15T09:45:00.000Z',
    affected_pages: ['/about', '/contact'],
    resolved: false,
    resolution_note: null,
  },
  {
    id: 'alert_003',
    type: 'search_engine',
    metric: 'indexingRate',
    value: 88,
    threshold: 95,
    severity: 'high',
    title: '索引覆蓋率過低',
    message: '索引覆蓋率為 88%，低於目標 95%',
    timestamp: '2024-01-15T09:00:00.000Z',
    affected_pages: [],
    resolved: false,
    resolution_note: null,
  },
]

// 模擬建議數據
export const mockSEORecommendations = [
  {
    id: 'rec_001',
    category: 'performance',
    priority: 'high',
    title: '優化 Largest Contentful Paint (LCP)',
    description: 'LCP 指標需要改善以提升使用者體驗',
    impact: 'high',
    effort: 'medium',
    affected_pages: ['/', '/products', '/blog'],
    implementation_steps: [
      '優化最大內容圖片的載入',
      '移除阻塞渲染的資源',
      '使用 CDN 加速靜態資源',
      '實施資源預載入',
    ],
    created_at: '2024-01-15T08:00:00.000Z',
  },
  {
    id: 'rec_002',
    category: 'content',
    priority: 'medium',
    title: '改善內容結構',
    description: '內容結構可以進一步優化以提升 SEO 表現',
    impact: 'medium',
    effort: 'low',
    affected_pages: ['/blog/*', '/articles/*'],
    implementation_steps: [
      '使用適當的標題層次結構 (H1-H6)',
      '添加目錄和錨點連結',
      '改善內容可讀性',
      '添加相關的內部連結',
    ],
    created_at: '2024-01-15T08:15:00.000Z',
  },
  {
    id: 'rec_003',
    category: 'technical',
    priority: 'medium',
    title: '實施結構化資料',
    description: '添加結構化資料可以幫助搜尋引擎更好地理解內容',
    impact: 'medium',
    effort: 'medium',
    affected_pages: ['/', '/products/*', '/blog/*'],
    implementation_steps: [
      '添加 JSON-LD 結構化資料',
      '實施 Breadcrumb 導航',
      '添加產品結構化資料',
      '添加文章結構化資料',
    ],
    created_at: '2024-01-15T08:30:00.000Z',
  },
  {
    id: 'rec_004',
    category: 'mobile',
    priority: 'low',
    title: '優化移動端體驗',
    description: '確保在所有裝置上都有良好的使用者體驗',
    impact: 'low',
    effort: 'low',
    affected_pages: ['/*'],
    implementation_steps: [
      '測試響應式設計',
      '優化觸控目標',
      '改善移動端載入速度',
      '測試不同瀏覽器相容性',
    ],
    created_at: '2024-01-15T08:45:00.000Z',
  },
  {
    id: 'rec_005',
    category: 'security',
    priority: 'high',
    title: '實施 HTTPS 和安全標頭',
    description: '確保網站安全性和使用者信任',
    impact: 'high',
    effort: 'medium',
    affected_pages: ['/*'],
    implementation_steps: [
      '實施 HTTPS 憑證',
      '添加安全標頭 (CSP, HSTS)',
      '定期更新依賴套件',
      '實施內容安全政策',
    ],
    created_at: '2024-01-15T09:00:00.000Z',
  },
]

// 模擬儀表板數據
export const mockSEODashboard = {
  monitoring_status: mockMonitoringStatus,
  latest_metrics: mockSEOMetrics,
  active_alerts: mockSEOAlerts.slice(0, 3), // 只顯示前3個
  recent_reports: [
    {
      date: '2024-01-15',
      overall_score: 87,
      performance_trend: 'improving',
      seo_health: 'good',
    },
    {
      date: '2024-01-14',
      overall_score: 84,
      performance_trend: 'stable',
      seo_health: 'good',
    },
    {
      date: '2024-01-13',
      overall_score: 82,
      performance_trend: 'improving',
      seo_health: 'fair',
    },
  ],
  recommendations_summary: {
    total: 5,
    by_priority: {
      high: 2,
      medium: 2,
      low: 1,
    },
    by_category: {
      performance: 1,
      content: 1,
      technical: 1,
      mobile: 1,
      security: 1,
    },
  },
  last_updated: '2024-01-15T10:30:00.000Z',
}

// 測試用的 Redis 模擬數據
export const mockRedisData = {
  'seo:active_alerts': ['alert_001', 'alert_002', 'alert_003'],
  'seo:reports': ['2024-01-15', '2024-01-14', '2024-01-13', '2024-01-12', '2024-01-11'],
  'seo:alert:alert_001': JSON.stringify(mockSEOAlerts[0]),
  'seo:alert:alert_002': JSON.stringify(mockSEOAlerts[1]),
  'seo:alert:alert_003': JSON.stringify(mockSEOAlerts[2]),
  'seo:report:2024-01-15': JSON.stringify(mockSEOReport),
  'seo:performance_latest': JSON.stringify(mockSEOMetrics.performance),
  'seo:seo_health_latest': JSON.stringify(mockSEOMetrics.seo_health),
  'seo:search_engine_latest': JSON.stringify(mockSEOMetrics.search_engine),
}

// 測試助手函數
export class SEOTestHelper {
  /**
   * 設置 Redis 模擬數據
   */
  static setupRedisMock(redisMock, data = mockRedisData) {
    // 設置所有模擬數據
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes(':active_alerts') || key.includes(':reports')) {
        redisMock.smembers.mockImplementation((redisKey) => {
          if (redisKey === key) {
            return Promise.resolve(value)
          }
          return Promise.resolve([])
        })
      } else {
        redisMock.get.mockImplementation((redisKey) => {
          if (redisKey === key) {
            return Promise.resolve(value)
          }
          return Promise.resolve(null)
        })
      }
    })

    // 設置其他操作的模擬
    redisMock.set.mockResolvedValue('OK')
    redisMock.sadd.mockResolvedValue(1)
    redisMock.srem.mockResolvedValue(1)
    redisMock.scard.mockResolvedValue(3)
    redisMock.del.mockResolvedValue(1)
  }

  /**
   * 重置 Redis 模擬
   */
  static resetRedisMock(redisMock) {
    redisMock.get.mockReset()
    redisMock.set.mockReset()
    redisMock.sadd.mockReset()
    redisMock.smembers.mockReset()
    redisMock.srem.mockReset()
    redisMock.scard.mockReset()
    redisMock.del.mockReset()
  }

  /**
   * 設置 SEO Monitor 模擬
   */
  static setupSEOMonitorMock(seoMonitorMock) {
    seoMonitorMock.getMonitoringStatus.mockReturnValue(mockMonitoringStatus)
    seoMonitorMock.getLatestMetrics.mockResolvedValue(mockSEOMetrics)
    seoMonitorMock.generateDailyReport.mockResolvedValue()
    seoMonitorMock.generateRecommendations.mockResolvedValue(mockSEORecommendations)
    seoMonitorMock.checkSEOHealth.mockResolvedValue()
    seoMonitorMock.startMonitoring.mockResolvedValue()
    seoMonitorMock.stopMonitoring.mockResolvedValue()
  }

  /**
   * 生成隨機測試數據
   */
  static generateRandomSEOData(count = 1) {
    const data = []

    for (let i = 0; i < count; i++) {
      data.push({
        id: `test_${i + 1}`,
        score: Math.floor(Math.random() * 100),
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        trend: ['improving', 'declining', 'stable'][Math.floor(Math.random() * 3)],
        status: ['good', 'fair', 'poor'][Math.floor(Math.random() * 3)],
      })
    }

    return count === 1 ? data[0] : data
  }

  /**
   * 驗證 API 響應格式
   */
  static validateAPIResponse(response, expectedSuccess = true) {
    expect(response.status).toBeDefined()
    expect(response.body).toBeDefined()
    expect(typeof response.body.success).toBe('boolean')
    expect(response.body.success).toBe(expectedSuccess)

    if (expectedSuccess) {
      expect(response.body.data).toBeDefined()
    } else {
      expect(response.body.error || response.body.message).toBeDefined()
    }

    return response.body
  }

  /**
   * 驗證 SEO 指標數據結構
   */
  static validateSEOMetrics(metrics) {
    expect(metrics).toHaveProperty('performance')
    expect(metrics).toHaveProperty('seo_health')
    expect(metrics).toHaveProperty('search_engine')
    expect(metrics).toHaveProperty('timestamp')

    // 驗證性能指標
    const perf = metrics.performance
    expect(perf).toHaveProperty('lcp')
    expect(perf).toHaveProperty('fid')
    expect(perf).toHaveProperty('cls')
    expect(typeof perf.lcp).toBe('number')
    expect(typeof perf.fid).toBe('number')
    expect(typeof perf.cls).toBe('number')

    // 驗證 SEO 健康指標
    const seo = metrics.seo_health
    expect(seo).toHaveProperty('metaTagsScore')
    expect(seo).toHaveProperty('structuredDataScore')
    expect(seo).toHaveProperty('mobileFriendliness')
    expect(typeof seo.metaTagsScore).toBe('number')
    expect(typeof seo.structuredDataScore).toBe('number')
    expect(typeof seo.mobileFriendliness).toBe('number')

    // 驗證搜尋引擎指標
    const search = metrics.search_engine
    expect(search).toHaveProperty('indexedPages')
    expect(search).toHaveProperty('crawledPages')
    expect(search).toHaveProperty('indexingRate')
    expect(typeof search.indexedPages).toBe('number')
    expect(typeof search.crawledPages).toBe('number')
    expect(typeof search.indexingRate).toBe('number')
  }

  /**
   * 驗證警報數據結構
   */
  static validateSEOAlert(alert) {
    expect(alert).toHaveProperty('id')
    expect(alert).toHaveProperty('type')
    expect(alert).toHaveProperty('severity')
    expect(alert).toHaveProperty('message')
    expect(alert).toHaveProperty('timestamp')

    expect(['performance', 'seo', 'search_engine', 'security', 'content', 'technical']).toContain(
      alert.type,
    )
    expect(['critical', 'high', 'medium', 'low', 'info']).toContain(alert.severity)
    expect(typeof alert.message).toBe('string')
    expect(typeof alert.timestamp).toBe('string')
  }

  /**
   * 驗證建議數據結構
   */
  static validateSEORecommendation(recommendation) {
    expect(recommendation).toHaveProperty('id')
    expect(recommendation).toHaveProperty('type')
    expect(recommendation).toHaveProperty('priority')
    expect(recommendation).toHaveProperty('title')
    expect(recommendation).toHaveProperty('description')

    expect(['performance', 'content', 'technical', 'mobile', 'security']).toContain(
      recommendation.type,
    )
    expect(['high', 'medium', 'low']).toContain(recommendation.priority)
    expect(typeof recommendation.title).toBe('string')
    expect(typeof recommendation.description).toBe('string')
  }
}

// 導出所有模擬數據和助手函數
export {
  mockMonitoringStatus,
  mockSEOMetrics,
  mockSEOReport,
  mockSEOAlerts,
  mockSEORecommendations,
  mockSEODashboard,
  mockRedisData,
}
