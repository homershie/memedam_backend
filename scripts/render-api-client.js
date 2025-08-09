#!/usr/bin/env node

/**
 * Render API 客戶端
 * 用於創建和管理 One-Off Jobs
 */

import fetch from 'node-fetch'
import { config } from 'dotenv'

// 載入環境變數
config()

class RenderAPIClient {
  constructor(apiKey, serviceId) {
    this.apiKey = apiKey
    this.serviceId = serviceId
    this.baseURL = 'https://api.render.com/v1/services'
  }

  /**
   * 創建 One-Off Job
   * @param {string} startCommand - 要執行的命令
   * @param {string} planId - 可選的實例類型 ID
   * @returns {Promise<Object>} Job 資訊
   */
  async createJob(startCommand, planId = null) {
    const url = `${this.baseURL}/${this.serviceId}/jobs`
    const payload = { startCommand }

    if (planId) {
      payload.planId = planId
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('創建 Job 失敗:', error.message)
      throw error
    }
  }

  /**
   * 獲取 Job 狀態
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job 狀態
   */
  async getJobStatus(jobId) {
    const url = `${this.baseURL}/${this.serviceId}/jobs/${jobId}`

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('獲取 Job 狀態失敗:', error.message)
      throw error
    }
  }

  /**
   * 列出所有 Jobs
   * @returns {Promise<Array>} Jobs 列表
   */
  async listJobs() {
    const url = `${this.baseURL}/${this.serviceId}/jobs`

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      // 處理分頁回應格式
      if (Array.isArray(data)) {
        return data
      } else if (data.job) {
        // 單個 job 回應
        return [data.job]
      } else if (data.jobs) {
        // 多個 jobs 回應
        return data.jobs
      } else {
        return []
      }
    } catch (error) {
      console.error('獲取 Jobs 列表失敗:', error.message)
      throw error
    }
  }

  /**
   * 取消運行中的 Job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} 取消結果
   */
  async cancelJob(jobId) {
    const url = `${this.baseURL}/${this.serviceId}/jobs/${jobId}/cancel`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('取消 Job 失敗:', error.message)
      throw error
    }
  }
}

// 命令行介面
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  // 檢查環境變數
  const apiKey = process.env.RENDER_API_KEY
  const serviceId = process.env.RENDER_SERVICE_ID

  if (!apiKey || !serviceId) {
    console.error('請設置環境變數:')
    console.error('  RENDER_API_KEY - Render API Key')
    console.error('  RENDER_SERVICE_ID - Render Service ID')
    process.exit(1)
  }

  const client = new RenderAPIClient(apiKey, serviceId)

  try {
    switch (command) {
      case 'create': {
        if (!args[1]) {
          console.error('使用方法: node render-api-client.js create <task-name>')
          console.error('範例: node render-api-client.js create cleanup-reminders')
          process.exit(1)
        }

        const taskName = args[1]
        // 使用絕對路徑或相對路徑，確保在 Render 環境中也能正常工作
        const startCommand = `cd /opt/render/project/src && node scripts/render-jobs.js ${taskName}`

        console.log(`創建任務: ${taskName}`)
        const job = await client.createJob(startCommand)
        console.log('任務已創建:')
        console.log(`  Job ID: ${job.id}`)
        console.log(`  命令: ${job.startCommand}`)
        console.log(`  創建時間: ${job.createdAt}`)
        break
      }

      case 'status': {
        if (!args[1]) {
          console.error('使用方法: node render-api-client.js status <job-id>')
          process.exit(1)
        }

        const jobId = args[1]
        console.log(`獲取 Job 狀態: ${jobId}`)
        const status = await client.getJobStatus(jobId)
        console.log('Job 狀態:')
        console.log(`  ID: ${status.id}`)
        console.log(`  狀態: ${status.status}`)
        console.log(`  創建時間: ${status.createdAt}`)
        if (status.startedAt) console.log(`  開始時間: ${status.startedAt}`)
        if (status.finishedAt) console.log(`  完成時間: ${status.finishedAt}`)
        break
      }

      case 'list': {
        console.log('獲取 Jobs 列表...')
        const response = await client.listJobs()

        // API 回應格式是陣列，每個元素都有 { cursor, job }
        const jobs = Array.isArray(response) ? response.map((item) => item.job).filter(Boolean) : []

        console.log(`找到 ${jobs.length} 個 Jobs`)
        jobs.forEach((job) => {
          if (job) {
            console.log(`  ID: ${job.id}`)
            console.log(`  命令: ${job.startCommand}`)
            console.log(`  狀態: ${job.status}`)
            console.log(`  創建時間: ${job.createdAt}`)
            console.log('  ---')
          }
        })
        break
      }

      case 'cancel': {
        if (!args[1]) {
          console.error('使用方法: node render-api-client.js cancel <job-id>')
          process.exit(1)
        }

        const cancelJobId = args[1]
        console.log(`取消 Job: ${cancelJobId}`)
        const result = await client.cancelJob(cancelJobId)
        console.log('Job 已取消:', result)
        break
      }

      default:
        console.log(`
Render API 客戶端

使用方法:
  node render-api-client.js <command> [options]

命令:
  create <task-name>     - 創建新的 One-Off Job
  status <job-id>        - 獲取 Job 狀態
  list                   - 列出所有 Jobs
  cancel <job-id>        - 取消運行中的 Job

範例:
  node render-api-client.js create cleanup-reminders
  node render-api-client.js status job-c3rfdgg6n88pa7t3a6ag
  node render-api-client.js list
  node render-api-client.js cancel job-c3rfdgg6n88pa7t3a6ag

環境變數:
  RENDER_API_KEY         - Render API Key
  RENDER_SERVICE_ID      - Render Service ID
        `)
    }
  } catch (error) {
    console.error('錯誤:', error.message)
    process.exit(1)
  }
}

// 如果直接執行此腳本
if (process.argv[1] && process.argv[1].endsWith('render-api-client.js')) {
  main().catch((error) => {
    console.error('執行錯誤:', error)
    process.exit(1)
  })
}

export default RenderAPIClient
