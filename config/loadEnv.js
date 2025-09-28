import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const loadEnv = () => {
  dotenv.config({ path: path.join(__dirname, '../.env') })
}

// 自動載入環境變數（為了向後兼容）
loadEnv()

export { loadEnv }
