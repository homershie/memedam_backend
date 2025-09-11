import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // 測試環境
    environment: 'node',

    // 包含所有測試檔案，排除 legacy 與示例測試
    include: [
      'test/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/unit/**/*-test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/integration/**/*-test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/e2e/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/e2e/**/*-test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // 包含診斷腳本
      'scripts/diagnostics/**/*diagnose*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'test/legacy/**',
      'test/vitest-examples/**',
    ],

    // 全局設置
    globals: true,
    restoreMocks: true,
    clearMocks: true,

    // 測試超時 - 診斷腳本需要更長的時間
    testTimeout: 30000,

    // 串行執行以確保資料庫連接穩定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        useAtomics: false,
      },
    },

    // 覆蓋率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.js',
        '**/*.config.mjs',
        'scripts/maintenance/',
        'scripts/data/',
        'scripts/runners/',
        'docs/',
      ],
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
      '@services': resolve(__dirname, './services'),
    },
  },
})
