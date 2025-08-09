/**
 * Render API 使用範例
 *
 * 這個範例展示如何使用 Render API 來創建和管理 One-Off Jobs
 */

import RenderAPIClient from '../scripts/render-api-client.js'

// 設置環境變數（在實際使用中應該從 .env 檔案讀取）
const API_KEY = process.env.RENDER_API_KEY
const SERVICE_ID = process.env.RENDER_SERVICE_ID

if (!API_KEY || !SERVICE_ID) {
  console.error('請設置環境變數 RENDER_API_KEY 和 RENDER_SERVICE_ID')
  process.exit(1)
}

const client = new RenderAPIClient(API_KEY, SERVICE_ID)

/**
 * 範例 1: 創建用戶清理提醒任務
 */
async function createCleanupRemindersJob() {
  try {
    console.log('創建用戶清理提醒任務...')
    const job = await client.createJob('node scripts/render-jobs.js cleanup-reminders')
    console.log('任務已創建:', job)
    return job
  } catch (error) {
    console.error('創建任務失敗:', error.message)
  }
}

/**
 * 範例 2: 創建熱門分數更新任務
 */
async function createHotScoresJob() {
  try {
    console.log('創建熱門分數更新任務...')
    const job = await client.createJob('node scripts/render-jobs.js update-hot-scores')
    console.log('任務已創建:', job)
    return job
  } catch (error) {
    console.error('創建任務失敗:', error.message)
  }
}

/**
 * 範例 3: 創建推薦系統更新任務
 */
async function createRecommendationsJob() {
  try {
    console.log('創建推薦系統更新任務...')
    const job = await client.createJob('node scripts/render-jobs.js update-all-recommendations')
    console.log('任務已創建:', job)
    return job
  } catch (error) {
    console.error('創建任務失敗:', error.message)
  }
}

/**
 * 範例 4: 監控任務狀態
 */
async function monitorJobStatus(jobId) {
  try {
    console.log(`監控任務狀態: ${jobId}`)
    const status = await client.getJobStatus(jobId)
    console.log('任務狀態:', status)
    return status
  } catch (error) {
    console.error('獲取狀態失敗:', error.message)
  }
}

/**
 * 範例 5: 列出所有任務
 */
async function listAllJobs() {
  try {
    console.log('列出所有任務...')
    const jobs = await client.listJobs()
    console.log(`找到 ${jobs.length} 個任務:`)
    jobs.forEach((job) => {
      console.log(`  ${job.id} - ${job.startCommand} - ${job.status}`)
    })
    return jobs
  } catch (error) {
    console.error('列出任務失敗:', error.message)
  }
}

/**
 * 範例 6: 批量創建任務
 */
async function createBatchJobs() {
  const tasks = [
    'cleanup-reminders',
    'cleanup-users',
    'hot-content-notifications',
    'update-hot-scores',
    'update-all-recommendations',
  ]

  console.log('批量創建任務...')
  const jobs = []

  for (const task of tasks) {
    try {
      console.log(`創建任務: ${task}`)
      const job = await client.createJob(`node scripts/render-jobs.js ${task}`)
      jobs.push(job)
      console.log(`  - 已創建: ${job.id}`)

      // 添加延遲避免 API 限制
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`創建任務 ${task} 失敗:`, error.message)
    }
  }

  return jobs
}

/**
 * 主函數
 */
async function main() {
  console.log('=== Render API 使用範例 ===\n')

  // 範例 1: 創建單個任務
  console.log('1. 創建用戶清理提醒任務')
  const cleanupJob = await createCleanupRemindersJob()
  console.log('')

  // 範例 2: 創建熱門分數更新任務
  console.log('2. 創建熱門分數更新任務')
  await createHotScoresJob()
  console.log('')

  // 範例 3: 創建推薦系統更新任務
  console.log('3. 創建推薦系統更新任務')
  await createRecommendationsJob()
  console.log('')

  // 範例 4: 監控任務狀態
  if (cleanupJob) {
    console.log('4. 監控任務狀態')
    await monitorJobStatus(cleanupJob.id)
    console.log('')
  }

  // 範例 5: 列出所有任務
  console.log('5. 列出所有任務')
  await listAllJobs()
  console.log('')

  // 範例 6: 批量創建任務（可選）
  console.log('6. 批量創建任務')
  await createBatchJobs()
  console.log('')

  console.log('=== 範例完成 ===')
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export {
  createCleanupRemindersJob,
  createHotScoresJob,
  createRecommendationsJob,
  monitorJobStatus,
  listAllJobs,
  createBatchJobs,
}
