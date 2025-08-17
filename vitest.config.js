import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // 測試環境
    environment: 'node',

    // 測試文件模式：支援新結構 (unit/integration/e2e/vitest-examples) 與舊測試 (legacy)
    include: [
      'test/{unit,integration,e2e,vitest-examples,legacy}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/{unit,integration,e2e,vitest-examples,legacy}/**/*-test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // 全局設置
    globals: true,
    restoreMocks: true,
    clearMocks: true,

    // 測試超時
    testTimeout: 10000,

    // 並行執行
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // 覆蓋率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', '**/*.config.js', '**/*.config.mjs', 'scripts/', 'docs/'],
    },

    // 設置文件
    setupFiles: ['./test/setup.js'],

    // 環境變數
    env: {
      NODE_ENV: 'test',
    },
  },

  // 路徑別名
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@test': resolve(__dirname, './test'),
      '@utils': resolve(__dirname, './utils'),
      '@models': resolve(__dirname, './models'),
      '@controllers': resolve(__dirname, './controllers'),
      '@middleware': resolve(__dirname, './middleware'),
      '@routes': resolve(__dirname, './routes'),
      '@config': resolve(__dirname, './config'),
    },
  },
})
