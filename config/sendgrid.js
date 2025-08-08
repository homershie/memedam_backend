import sgMail from '@sendgrid/mail'
import dotenv from 'dotenv'

dotenv.config()

// 設定 SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// 如果需要使用歐盟區域，取消註解下面這行
// sgMail.setDataResidency('eu');

// 預設發送者設定
const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@memedam.com'
const DEFAULT_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'MemeDam'

export { sgMail, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME }
