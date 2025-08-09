import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '迷因典 API 文檔',
      version: '1.0.0',
      description: '迷因典後端API的完整文檔，包含所有端點的詳細說明',
      contact: {
        name: '迷因典開發團隊',
        email: 'support@memedam.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production'
            ? 'https://api.memedam.com'
            : 'http://localhost:4000',
        description: process.env.NODE_ENV === 'production' ? '生產環境' : '開發環境',
      },
      {
        url: 'https://api.memedam.com',
        description: '生產環境',
      },
    ],
    tags: [
      {
        name: 'Users',
        description: '用戶相關操作',
      },
      {
        name: 'Memes',
        description: '迷因相關操作',
      },
      {
        name: 'Likes',
        description: '讚功能相關操作',
      },
      {
        name: 'Dislikes',
        description: '噓功能相關操作',
      },
      {
        name: 'Comments',
        description: '留言相關操作',
      },
      {
        name: 'Shares',
        description: '分享相關操作',
      },
      {
        name: 'Collections',
        description: '收藏相關操作',
      },
      {
        name: 'Views',
        description: '瀏覽相關操作',
      },
      {
        name: 'Follows',
        description: '追隨相關操作',
      },
      {
        name: 'Tags',
        description: '標籤相關操作',
      },
      {
        name: 'MemeTags',
        description: '迷因標籤關聯相關操作',
      },
      {
        name: 'Notifications',
        description: '通知相關操作',
      },
      {
        name: 'Reports',
        description: '舉報相關操作',
      },
      {
        name: 'MemeVersions',
        description: '迷因版本相關操作',
      },
      {
        name: 'Announcements',
        description: '公告相關操作',
      },
      {
        name: 'Sponsors',
        description: '贊助相關操作',
      },
      {
        name: 'Upload',
        description: '檔案上傳相關操作',
      },
      {
        name: 'Recommendations',
        description: '推薦系統相關操作',
      },
      {
        name: 'Admin',
        description: '管理員功能相關操作',
      },
      {
        name: 'Analytics',
        description: '分析統計相關操作',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Token認證',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: '錯誤訊息',
            },
            status: {
              type: 'integer',
              description: 'HTTP狀態碼',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: '成功訊息',
            },
            data: {
              type: 'object',
              description: '回應數據',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js', './models/*.js'],
}

const specs = swaggerJsdoc(options)

export default specs
