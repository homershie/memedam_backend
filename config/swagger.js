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
        email: 'support@memedex.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: '開發環境',
      },
      {
        url: 'https://api.memedex.com',
        description: '生產環境',
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
