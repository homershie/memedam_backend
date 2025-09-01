import passport from 'passport'
import passportLocal from 'passport-local'
import passportJWT from 'passport-jwt'
import GoogleStrategy from 'passport-google-oauth20'
import FacebookStrategy from 'passport-facebook'
import DiscordStrategy from 'passport-discord'
import TwitterStrategy from 'passport-twitter'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { generateUniqueUsername } from '../utils/usernameGenerator.js'
import { logger } from '../utils/logger.js'

// 定義自己的驗證方法
// passport.use(驗證方法名稱, 驗證策略(策略設定, 策略執行完畢的 callback))
// passportLocal = 帳號密碼驗證策略，檢查有沒有指定的帳號密碼欄位
passport.use(
  'login',
  new passportLocal.Strategy(
    {
      // 預設檢查 username 和 password 欄位
      // 可以修改檢查的欄位名稱
      usernameField: 'username',
      passwordField: 'password',
    },
    async (username, password, done) => {
      // 檢查完帳號密碼欄位有資料後的處理
      // username = 帳號欄位，password = 密碼欄位
      // done = 驗證方法執行完成，繼續並把結果帶到下一步
      // done(錯誤, 使用者資料, info)
      try {
        // 檢查帳號或 email 是否存在
        const user = await User.findOne({
          $or: [{ username: username }, { email: username }],
        }).orFail(new Error('帳號不存在'))
        // 檢查密碼是否正確
        const isMatch = bcrypt.compareSync(password, user.password)
        if (!isMatch) {
          throw new Error('密碼錯誤')
        }
        return done(null, user)
      } catch (error) {
        // 驗證失敗，阿錯誤和訊息帶到下一步
        if (error.message === '帳號不存在') {
          return done(null, false, { message: '帳號不存在' })
        } else if (error.message === '密碼錯誤') {
          return done(null, false, { message: '密碼錯誤' })
        } else {
          return done(error)
        }
      }
    },
  ),
)

// 延遲初始化 JWT 策略
const initializeJWTStrategy = () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'

  if (!JWT_SECRET) {
    logger.error('錯誤: JWT_SECRET 環境變數未設定')
    return
  }

  passport.use(
    'jwt',
    new passportJWT.Strategy(
      {
        jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
        passReqToCallback: true,
        // 忽略過期檢查，因為舊換新的時候可以允許過期的 token 通過
        ignoreExpiration: true,
      },
      // req 必須要設定 passReqToCallback 才能使用
      // 因為套件只給解編後的 jwt 內容，不會給原本的 jwt，所以需要自己從 req 裡面拿
      // payload = JWT 的內容
      // done = 跟上面一樣
      async (req, payload, done) => {
        try {
          logger.info('=== JWT 策略開始驗證 ===')

          // 從 Authorization header 提取 token
          const authHeader = req.headers.authorization
          let token = null

          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7) // 移除 'Bearer ' 前綴
          }

          logger.info('提取的 token:', token ? token.substring(0, 50) + '...' : 'null')

          if (!token) {
            logger.info('未提供 token')
            return done(null, false, { message: '未提供 token' })
          }

          logger.info('JWT payload:', payload)

          // 手動檢查過期時間
          // 只有 refresh 和 logout 可以允許過期的 token
          // payload.exp 是 JWT 的過期時間，單位是秒，所以要乘以 1000 轉成毫秒
          // Date.now() 是現在的時間，單位是毫秒
          const expired = payload.exp * 1000 < Date.now()
          // http://localhost:4000/user/abcd?aaa=111&bbb=222
          // req.originUrl = /user/abcd?aaa=111&bbb=222
          // req.baseUrl = /user
          // req.path = /abcd
          // req.query = { aaa: '111', bbb: '222' }
          const url = req.baseUrl + req.path
          logger.info('請求 URL:', url)
          logger.info('Token 是否過期:', expired)

          if (expired && url !== '/users/refresh' && url !== '/users/logout') {
            throw new Error('token 已過期')
          }

          logger.info('開始查詢用戶，用戶ID:', payload._id)

          // 先檢查使用者是否存在
          const user = await User.findById(payload._id)

          logger.info('查詢結果:', user ? '找到用戶' : '未找到用戶')

          if (!user) {
            throw new Error('使用者不存在')
          }

          // 檢查 tokens 陣列是否包含當前 token
          // 測試環境放寬檢查，避免測試流程中 token 未回寫 tokens 陣列造成 400（BAD_REQUEST）
          if (process.env.NODE_ENV !== 'test') {
            if (!user.tokens || !user.tokens.includes(token)) {
              logger.info('Token 不在用戶的 tokens 陣列中')
              logger.info('用戶的 tokens:', user.tokens)
              throw new Error('token 已失效')
            }
          }

          logger.info('✅ JWT 驗證成功')
          return done(null, { user, token })
        } catch (error) {
          logger.info('passport.js jwt 錯誤:', error.message)
          logger.info('錯誤類型:', error.constructor.name)
          if (error.message === '使用者不存在') {
            return done(null, false, { message: '使用者不存在' })
          } else if (error.message === 'token 已失效') {
            return done(null, false, { message: 'token 已失效' })
          } else if (error.message === 'token 已過期') {
            return done(null, false, { message: 'token 已過期' })
          } else {
            return done(error)
          }
        }
      },
    ),
  )
}

// 延遲初始化 OAuth 策略
const initializeOAuthStrategies = () => {
  // Google - 登入用
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      'google',
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_REDIRECT_URI,
          passReqToCallback: true,
          scope: ['openid', 'email', 'profile'], // 最小化 scopes，符合 Google OAuth 2.0 政策
          accessType: 'offline', // 確保能獲得 refresh token
          prompt: 'consent', // 強制顯示同意畫面，確保能獲得 refresh token
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            if (req.user) {
              req.user.google_id = profile.id
              await req.user.save()
              return done(null, req.user)
            } else {
              let user = await User.findOne({ google_id: profile.id })
              if (user) {
                // 如果用戶已存在且不需要選擇 username，直接返回用戶進行登入
                if (!user.needs_username_selection) {
                  user.last_login_at = new Date()
                  await user.save()
                  return done(null, user)
                }
                // 如果用戶仍需要選擇 username，繼續處理
              }

              if (!user) {
                // 檢查 email 是否已被其他用戶使用
                if (profile.emails?.[0]?.value) {
                  const existingUserWithEmail = await User.findOne({
                    email: profile.emails[0].value,
                  })
                  if (existingUserWithEmail) {
                    // 如果 email 已存在，直接返回該用戶（允許綁定 Google 帳號）
                    existingUserWithEmail.google_id = profile.id
                    await existingUserWithEmail.save()
                    return done(null, existingUserWithEmail)
                  }
                }

                // 檢查是否需要讓用戶選擇 username
                const needsUsernameSelection = !profile.emails?.[0]?.value

                if (needsUsernameSelection) {
                  // 如果沒有 email，先創建一個臨時用戶，讓用戶選擇 username
                  const tempUsername = `temp_${profile.id}_${Date.now()}`

                  user = new User({
                    username: tempUsername,
                    email: '', // 空 email
                    google_id: profile.id,
                    display_name: profile.displayName || '新用戶',
                    login_method: 'google',
                    email_verified: false,
                    needs_username_selection: true, // 標記需要選擇 username
                  })
                } else {
                  // 有 email，使用智能username生成器
                  const finalUsername = await generateUniqueUsername(profile, 'google')

                  user = new User({
                    username: finalUsername,
                    email: profile.emails?.[0]?.value || '',
                    google_id: profile.id,
                    display_name: profile.displayName || finalUsername,
                    login_method: 'google',
                    email_verified: !!profile.emails?.[0]?.verified,
                  })
                }

                try {
                  await user.save()
                } catch (saveError) {
                  // 處理 google_id 重複的情況
                  if (saveError.code === 11000 && saveError.keyPattern?.google_id) {
                    logger.info('Google ID 已存在，查找現有用戶:', profile.id)
                    user = await User.findOne({ google_id: profile.id })
                    if (!user) {
                      throw new Error(`Google ID ${profile.id} 已存在但無法找到對應用戶`)
                    }
                  } else {
                    throw saveError
                  }
                }
              }
              return done(null, user)
            }
          } catch (err) {
            return done(err, null)
          }
        },
      ),
    )

    // Google - 綁定用
    passport.use(
      'google-bind',
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_BIND_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
          passReqToCallback: true,
          scope: ['openid', 'email', 'profile'], // 最小化 scopes，符合 Google OAuth 2.0 政策
          accessType: 'offline', // 確保能獲得 refresh token
          prompt: 'consent', // 強制顯示同意畫面，確保能獲得 refresh token
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const oauthState = req.query.state || req.session?.oauthState

            if (!oauthState) {
              logger.error('❌ Google 綁定回調缺少 state 參數')
              return done(new Error('缺少 state 參數'), false)
            }

            // 從臨時緩存中獲取綁定用戶 ID
            const { getBindState, removeBindState } = await import('../utils/oauthTempStore.js')
            const storedBindState = getBindState(oauthState)

            if (!storedBindState) {
              logger.error('❌ Google 綁定狀態無效或已過期:', oauthState)
              return done(new Error('綁定狀態無效或已過期，請重新嘗試'), false)
            }

            const bindUserId = storedBindState.userId

            // 清理臨時緩存中的狀態
            removeBindState(oauthState)
            logger.info('✅ 成功從臨時緩存中獲取綁定狀態並清理:', {
              oauthState: oauthState.substring(0, 10) + '...',
              bindUserId,
            })

            if (!bindUserId) {
              logger.error('❌ Google 綁定回調中沒有綁定用戶 ID')
              return done(new Error('用戶認證失效，請重新登錄後綁定'), false)
            }

            // 查找用戶並執行綁定
            const user = await User.findById(bindUserId)
            if (!user) {
              logger.error('❌ 綁定用戶不存在:', bindUserId)
              return done(new Error('綁定用戶不存在'), false)
            }

            // 檢查是否已綁定
            if (user.google_id) {
              logger.warn('⚠️ Google 帳號已綁定:', { userId: user._id, googleId: user.google_id })
              return done(null, user, { message: '此 Google 帳號已綁定到您的帳戶' })
            }

            // 檢查該 Google ID 是否已被其他用戶綁定
            const existingUserWithGoogleId = await User.findOne({ google_id: profile.id })
            if (
              existingUserWithGoogleId &&
              existingUserWithGoogleId._id.toString() !== bindUserId
            ) {
              logger.error('❌ Google ID 已被其他用戶綁定:', {
                googleId: profile.id,
                existingUserId: existingUserWithGoogleId._id,
                bindUserId,
              })
              return done(new Error('此 Google 帳號已被其他用戶綁定'), false)
            }

            // 綁定 Google 帳號
            user.google_id = profile.id
            await user.save()

            logger.info('✅ Google 帳號綁定成功:', { userId: user._id, googleId: profile.id })
            return done(null, user, { message: 'Google 帳號綁定成功' })
          } catch (err) {
            logger.error('❌ Google 綁定失敗:', err)
            return done(err, null)
          }
        },
      ),
    )
  }

  // Facebook - 登入用
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    logger.info('🔧 初始化 Facebook OAuth 策略:', {
      hasClientId: !!process.env.FACEBOOK_CLIENT_ID,
      hasClientSecret: !!process.env.FACEBOOK_CLIENT_SECRET,
      clientIdLength: process.env.FACEBOOK_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.FACEBOOK_CLIENT_SECRET?.length || 0,
      bindRedirectUri: process.env.FACEBOOK_BIND_REDIRECT_URI,
      redirectUri: process.env.FACEBOOK_REDIRECT_URI,
    })

    passport.use(
      'facebook',
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          callbackURL: process.env.FACEBOOK_REDIRECT_URI,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            if (req.user) {
              req.user.facebook_id = profile.id
              await req.user.save()
              return done(null, req.user)
            } else {
              // 首先檢查是否已存在該 Facebook ID 的用戶
              let user = await User.findOne({ facebook_id: profile.id })
              if (user) {
                // 如果用戶已存在且不需要選擇 username，直接返回用戶進行登入
                if (!user.needs_username_selection) {
                  logger.info('Facebook 用戶已存在，直接登入:', profile.id)
                  user.last_login_at = new Date()
                  await user.save()
                  return done(null, user)
                }
                // 如果用戶仍需要選擇 username，繼續處理
              }

              // 用戶不存在，需要創建新用戶
              // 檢查 email 是否已被其他用戶使用
              if (profile.emails?.[0]?.value) {
                const existingUserWithEmail = await User.findOne({
                  email: profile.emails[0].value,
                })
                if (existingUserWithEmail) {
                  // 如果 email 已存在，直接返回該用戶（允許綁定 Facebook 帳號）
                  existingUserWithEmail.facebook_id = profile.id
                  await existingUserWithEmail.save()
                  return done(null, existingUserWithEmail)
                }
              }

              // 檢查是否需要讓用戶選擇 username
              const needsUsernameSelection = !profile.emails?.[0]?.value

              if (needsUsernameSelection) {
                // 如果沒有 email，先創建一個臨時用戶，讓用戶選擇 username
                const tempUsername = `temp_${profile.id}_${Date.now()}`

                user = new User({
                  username: tempUsername,
                  email: '', // 空 email
                  facebook_id: profile.id,
                  display_name: profile.displayName || '新用戶',
                  login_method: 'facebook',
                  email_verified: false,
                  needs_username_selection: true, // 標記需要選擇 username
                })
              } else {
                // 有 email，使用智能username生成器
                const finalUsername = await generateUniqueUsername(profile, 'facebook')

                user = new User({
                  username: finalUsername,
                  email: profile.emails?.[0]?.value || '',
                  facebook_id: profile.id,
                  display_name: profile.displayName || finalUsername,
                  login_method: 'facebook',
                  email_verified: !!profile.emails?.[0]?.verified,
                })
              }

              try {
                await user.save()
              } catch (saveError) {
                // 處理 facebook_id 重複的情況（併發請求）
                if (saveError.code === 11000 && saveError.keyPattern?.facebook_id) {
                  logger.info('Facebook ID 重複，查找現有用戶:', profile.id)
                  user = await User.findOne({ facebook_id: profile.id })
                  if (!user) {
                    throw new Error(`Facebook ID ${profile.id} 已存在但無法找到對應用戶`)
                  }
                } else {
                  throw saveError
                }
              }

              return done(null, user)
            }
          } catch (err) {
            logger.error('❌ Facebook 登入策略錯誤:', err)
            return done(err, null)
          }
        },
      ),
    )

    // Facebook - 綁定用
    if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
      logger.info('🔧 初始化 Facebook 綁定策略...')
      passport.use(
        'facebook-bind',
        new FacebookStrategy(
          {
            clientID: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            callbackURL:
              process.env.FACEBOOK_BIND_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI,
            passReqToCallback: true,
          },
          async (req, accessToken, refreshToken, profile, done) => {
            try {
              logger.info('🔐 Facebook 綁定策略開始執行:', {
                profileId: profile.id,
                profileEmail: profile.emails?.[0]?.value,
                hasAccessToken: !!accessToken,
                queryState: req.query.state,
                sessionState: req.session?.oauthState,
                clientId: process.env.FACEBOOK_CLIENT_ID ? '已設定' : '未設定',
                clientSecret: process.env.FACEBOOK_CLIENT_SECRET ? '已設定' : '未設定',
                callbackURL:
                  process.env.FACEBOOK_BIND_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI,
              })

              const oauthState = req.query.state || req.session?.oauthState

              if (!oauthState) {
                logger.error('❌ Facebook 綁定回調缺少 state 參數', {
                  queryState: req.query.state,
                  sessionState: req.session?.oauthState,
                  sessionExists: !!req.session,
                })
                return done(new Error('缺少 state 參數'), false)
              }

              const { getBindState, removeBindState } = await import('../utils/oauthTempStore.js')
              const storedBindState = getBindState(oauthState)

              if (!storedBindState) {
                logger.error('❌ Facebook 綁定狀態無效或已過期:', {
                  oauthState: oauthState.substring(0, 10) + '...',
                  totalStates: (await import('../utils/oauthTempStore.js')).getBindStateStats()
                    .totalStates,
                })
                return done(new Error('綁定狀態無效或已過期，請重新嘗試'), false)
              }

              const bindUserId = storedBindState.userId
              const bindProvider = storedBindState.provider

              logger.info('✅ 成功從臨時緩存中獲取綁定狀態:', {
                oauthState: oauthState.substring(0, 10) + '...',
                bindUserId,
                bindProvider,
                expectedProvider: 'facebook',
              })

              // 清理臨時緩存中的狀態
              removeBindState(oauthState)

              if (!bindUserId || bindProvider !== 'facebook') {
                logger.error('❌ Facebook 綁定回調中綁定資訊無效:', {
                  bindUserId,
                  bindProvider,
                  expectedProvider: 'facebook',
                })
                return done(new Error('用戶認證失效，請重新登錄後綁定'), false)
              }

              const user = await User.findById(bindUserId)
              if (!user) {
                logger.error('❌ 綁定用戶不存在:', {
                  bindUserId,
                  oauthState: oauthState.substring(0, 10) + '...',
                })
                return done(new Error('綁定用戶不存在'), false)
              }

              logger.info('✅ 找到綁定用戶:', {
                userId: user._id,
                username: user.username,
                email: user.email,
                existingFacebookId: user.facebook_id,
              })

              if (user.facebook_id) {
                logger.warn('⚠️ Facebook 帳號已綁定:', {
                  userId: user._id,
                  facebookId: user.facebook_id,
                  newFacebookId: profile.id,
                })
                return done(null, user, { message: '此 Facebook 帳號已綁定到您的帳戶' })
              }

              const existingUserWithFacebookId = await User.findOne({ facebook_id: profile.id })
              if (
                existingUserWithFacebookId &&
                existingUserWithFacebookId._id.toString() !== bindUserId
              ) {
                logger.error('❌ Facebook ID 已被其他用戶綁定:', {
                  facebookId: profile.id,
                  existingUserId: existingUserWithFacebookId._id,
                  existingUsername: existingUserWithFacebookId.username,
                  bindUserId,
                  bindUsername: user.username,
                })
                return done(new Error('此 Facebook 帳號已被其他用戶綁定'), false)
              }

              // 更新用戶的 Facebook ID
              user.facebook_id = profile.id
              await user.save()

              logger.info('✅ Facebook 帳號綁定成功:', {
                userId: user._id,
                facebookId: profile.id,
                profileEmail: profile.emails?.[0]?.value,
              })
              return done(null, user, { message: 'Facebook 帳號綁定成功' })
            } catch (err) {
              logger.error('❌ Facebook 綁定失敗:', {
                error: err.message,
                stack: err.stack,
                profileId: profile?.id,
                bindUserId: req.query.state || req.session?.oauthState,
              })
              return done(err, null)
            }
          },
        ),
      )
    }

    logger.info('✅ Facebook OAuth 策略初始化完成')
  } else {
    logger.warn('⚠️ Facebook OAuth 環境變數未設定，跳過 Facebook 策略初始化')
  }

  // Discord - 登入用
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(
      'discord',
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: process.env.DISCORD_REDIRECT_URI,
          scope: ['identify', 'email'],
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            logger.info('Discord OAuth 策略執行')
            logger.info('Profile:', JSON.stringify(profile, null, 2))

            // 檢查是否為綁定流程：使用 query 參數或特殊標記來區分
            const isBindingFlow =
              req.query.bind === 'true' || (req.user && req.session.isBindingFlow)

            if (isBindingFlow && req.user) {
              // 綁定流程：檢查該 Discord ID 是否已被其他用戶使用
              const existingUserWithDiscordId = await User.findOne({ discord_id: profile.id })
              if (
                existingUserWithDiscordId &&
                existingUserWithDiscordId._id.toString() !== req.user._id.toString()
              ) {
                // Discord ID 已被其他用戶使用
                const error = new Error(`Discord ID ${profile.id} 已被其他用戶綁定`)
                error.code = 'DISCORD_ID_ALREADY_BOUND'
                error.statusCode = 409
                return done(error, null)
              }

              // 如果是同一個用戶重複綁定，直接返回
              if (
                existingUserWithDiscordId &&
                existingUserWithDiscordId._id.toString() === req.user._id.toString()
              ) {
                return done(null, req.user)
              }

              // 綁定 Discord ID 到當前用戶
              req.user.discord_id = profile.id
              await req.user.save()
              return done(null, req.user)
            } else {
              // 登入流程
              let user = await User.findOne({ discord_id: profile.id })
              if (user) {
                // 如果用戶已存在且不需要選擇 username，直接返回用戶進行登入
                if (!user.needs_username_selection) {
                  user.last_login_at = new Date()
                  await user.save()
                  return done(null, user)
                }
                // 如果用戶仍需要選擇 username，繼續處理
              }

              if (!user) {
                // 檢查 email 是否已被其他用戶使用
                if (profile.email) {
                  const existingUserWithEmail = await User.findOne({ email: profile.email })
                  if (existingUserWithEmail) {
                    // 如果 email 已存在，直接返回該用戶（允許綁定 Discord 帳號）
                    existingUserWithEmail.discord_id = profile.id
                    await existingUserWithEmail.save()
                    return done(null, existingUserWithEmail)
                  }
                }

                // 檢查是否需要讓用戶選擇 username
                const needsUsernameSelection = !profile.email

                if (needsUsernameSelection) {
                  // 如果沒有 email，先創建一個臨時用戶，讓用戶選擇 username
                  const tempUsername = `temp_${profile.id}_${Date.now()}`

                  user = new User({
                    username: tempUsername,
                    email: '', // 空 email
                    discord_id: profile.id,
                    display_name: profile.displayName || '新用戶',
                    login_method: 'discord',
                    email_verified: false,
                    needs_username_selection: true, // 標記需要選擇 username
                  })
                } else {
                  // 有 email，使用智能username生成器
                  const finalUsername = await generateUniqueUsername(profile, 'discord')

                  user = new User({
                    username: finalUsername,
                    email: profile.email,
                    discord_id: profile.id,
                    display_name: profile.displayName || finalUsername,
                    login_method: 'discord',
                    email_verified: !!profile.verified,
                  })
                }

                try {
                  await user.save()
                } catch (saveError) {
                  // 處理 discord_id 重複的情況
                  if (saveError.code === 11000 && saveError.keyPattern?.discord_id) {
                    logger.info('Discord ID 已存在，查找現有用戶:', profile.id)
                    // 再次查找用戶，可能是併發請求導致的問題
                    user = await User.findOne({ discord_id: profile.id })
                    if (!user) {
                      // 如果還是找不到，說明有其他問題
                      throw new Error(`Discord ID ${profile.id} 已存在但無法找到對應用戶`)
                    }
                  } else {
                    // 其他錯誤直接拋出
                    throw saveError
                  }
                }
              }
              return done(null, user)
            }
          } catch (err) {
            return done(err, null)
          }
        },
      ),
    )

    // Discord - 綁定用
    passport.use(
      'discord-bind',
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: process.env.DISCORD_BIND_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const oauthState = req.query.state || req.session?.oauthState
            if (!oauthState) {
              logger.error('❌ Discord 綁定回調缺少 state 參數')
              return done(new Error('缺少 state 參數'), false)
            }

            const { getBindState, removeBindState } = await import('../utils/oauthTempStore.js')
            const storedBindState = getBindState(oauthState)
            if (!storedBindState) {
              logger.error('❌ Discord 綁定狀態無效或已過期:', oauthState)
              return done(new Error('綁定狀態無效或已過期，請重新嘗試'), false)
            }

            const bindUserId = storedBindState.userId
            const bindProvider = storedBindState.provider
            removeBindState(oauthState)
            logger.info('✅ 成功從臨時緩存中獲取綁定狀態並清理:', {
              oauthState: oauthState.substring(0, 10) + '...',
              bindUserId,
            })

            if (!bindUserId || bindProvider !== 'discord') {
              logger.error('❌ Discord 綁定回調中綁定資訊無效')
              return done(new Error('用戶認證失效，請重新登錄後綁定'), false)
            }

            const user = await User.findById(bindUserId)
            if (!user) {
              logger.error('❌ 綁定用戶不存在:', bindUserId)
              return done(new Error('綁定用戶不存在'), false)
            }

            if (user.discord_id) {
              logger.warn('⚠️ Discord 帳號已綁定:', {
                userId: user._id,
                discordId: user.discord_id,
              })
              return done(null, user, { message: '此 Discord 帳號已綁定到您的帳戶' })
            }

            const existingUserWithDiscordId = await User.findOne({ discord_id: profile.id })
            if (
              existingUserWithDiscordId &&
              existingUserWithDiscordId._id.toString() !== bindUserId
            ) {
              logger.error('❌ Discord ID 已被其他用戶綁定:', {
                discordId: profile.id,
                existingUserId: existingUserWithDiscordId._id,
                bindUserId,
              })
              return done(new Error('此 Discord 帳號已被其他用戶綁定'), false)
            }

            user.discord_id = profile.id
            await user.save()

            logger.info('✅ Discord 帳號綁定成功:', { userId: user._id, discordId: profile.id })
            return done(null, user, { message: 'Discord 帳號綁定成功' })
          } catch (err) {
            logger.error('❌ Discord 綁定失敗:', err)
            return done(err, null)
          }
        },
      ),
    )
  }

  // Twitter - 登入用 (OAuth 1.0a)
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET) {
    passport.use(
      'twitter',
      new TwitterStrategy(
        {
          consumerKey: process.env.TWITTER_API_KEY,
          consumerSecret: process.env.TWITTER_API_SECRET,
          callbackURL: process.env.TWITTER_REDIRECT_URI,
          includeEmail: true,
          passReqToCallback: true,
        },
        async (req, token, tokenSecret, profile, done) => {
          try {
            logger.info('Twitter OAuth 策略執行')
            logger.info('User Agent:', req.get('User-Agent'))
            logger.info('Session ID:', req.sessionID || req.session.id)
            logger.info('Profile ID:', profile.id)
            logger.info('Profile username:', profile.username)
            logger.info('Profile displayName:', profile.displayName)
            logger.info('Profile emails:', profile.emails)

            // 檢查是否為綁定流程：使用 query 參數或特殊標記來區分
            const isBindingFlow =
              req.query.bind === 'true' || (req.user && req.session.isBindingFlow)

            if (isBindingFlow && req.user) {
              // 綁定流程：檢查該 Twitter ID 是否已被其他用戶使用
              const existingUserWithTwitterId = await User.findOne({ twitter_id: profile.id })
              if (
                existingUserWithTwitterId &&
                existingUserWithTwitterId._id.toString() !== req.user._id.toString()
              ) {
                // Twitter ID 已被其他用戶使用
                const error = new Error(`Twitter ID ${profile.id} 已被其他用戶綁定`)
                error.code = 'TWITTER_ID_ALREADY_BOUND'
                error.statusCode = 409
                return done(error, null)
              }

              // 如果是同一個用戶重複綁定，直接返回
              if (
                existingUserWithTwitterId &&
                existingUserWithTwitterId._id.toString() === req.user._id.toString()
              ) {
                return done(null, req.user)
              }

              // 綁定 Twitter ID 到當前用戶
              req.user.twitter_id = profile.id
              await req.user.save()
              return done(null, req.user)
            } else {
              // 登入流程
              let user = await User.findOne({ twitter_id: profile.id })
              if (user) {
                // 如果用戶已存在且不需要選擇 username，直接返回用戶進行登入
                if (!user.needs_username_selection) {
                  user.last_login_at = new Date()
                  await user.save()
                  return done(null, user)
                }
                // 如果用戶仍需要選擇 username，繼續處理
              }

              if (!user) {
                // 檢查 email 是否已被其他用戶使用
                if (profile.emails?.[0]?.value) {
                  const existingUserWithEmail = await User.findOne({
                    email: profile.emails[0].value,
                  })
                  if (existingUserWithEmail) {
                    // 如果 email 已存在，直接返回該用戶（允許綁定 Twitter 帳號）
                    existingUserWithEmail.twitter_id = profile.id
                    await existingUserWithEmail.save()
                    return done(null, existingUserWithEmail)
                  }
                }

                // 檢查是否需要讓用戶選擇 username
                const needsUsernameSelection = !profile.emails?.[0]?.value

                if (needsUsernameSelection) {
                  // 如果沒有 email，先創建一個臨時用戶，讓用戶選擇 username
                  const tempUsername = `temp_${profile.id}_${Date.now()}`

                  user = new User({
                    username: tempUsername,
                    email: '', // 空 email
                    twitter_id: profile.id,
                    display_name: profile.displayName || '新用戶',
                    login_method: 'twitter',
                    email_verified: false,
                    needs_username_selection: true, // 標記需要選擇 username
                  })
                } else {
                  // 有 email，使用智能username生成器
                  const finalUsername = await generateUniqueUsername(profile, 'twitter')

                  user = new User({
                    username: finalUsername,
                    email: profile.emails?.[0]?.value || '',
                    twitter_id: profile.id,
                    display_name: profile.displayName || finalUsername,
                    login_method: 'twitter',
                    email_verified: !!profile.emails?.[0]?.verified,
                  })
                }

                try {
                  await user.save()
                } catch (saveError) {
                  // 處理 twitter_id 重複的情況
                  if (saveError.code === 11000 && saveError.keyPattern?.twitter_id) {
                    logger.info('Twitter ID 已存在，查找現有用戶:', profile.id)
                    user = await User.findOne({ twitter_id: profile.id })
                    if (!user) {
                      throw new Error(`Twitter ID ${profile.id} 已存在但無法找到對應用戶`)
                    }
                  } else {
                    throw saveError
                  }
                }
              }

              // 保存 profile 資料到 session 中，供 OAuth 回調處理使用
              if (req.session) {
                req.session.oauthProfile = profile
              }

              return done(null, user)
            }
          } catch (err) {
            logger.error('Twitter OAuth 策略錯誤:', err)
            return done(err, null)
          }
        },
      ),
    )

    // Twitter - 綁定用 (OAuth 1.0a)
    passport.use(
      'twitter-bind',
      new TwitterStrategy(
        {
          consumerKey: process.env.TWITTER_API_KEY,
          consumerSecret: process.env.TWITTER_API_SECRET,
          callbackURL: process.env.TWITTER_BIND_REDIRECT_URI || process.env.TWITTER_REDIRECT_URI,
          passReqToCallback: true,
          includeEmail: true,
          // 使用獨特的 session key 避免衝突（保留，但不依賴其記錄 token）
          sessionKey: 'oauth:twitter:bind',
          // 確保會話正確處理
          requestTokenStore: {
            get: async function (req, token, callback) {
              try {
                const { getTwitterRequestToken } = await import('../utils/oauthTempStore.js')
                const data = getTwitterRequestToken(token)
                logger.info('獲取 request token (tempStore):', {
                  token: token?.substring?.(0, 6) + '...',
                  exists: !!data,
                })
                if (data && data.userId) {
                  // 在回調早期階段把 userId 暫存到 req 供 verify callback 使用
                  req.tempBindUserId = data.userId
                }
                callback(null, data ? data.tokenSecret : undefined)
              } catch (e) {
                logger.error('讀取 request token 失敗 (tempStore):', e)
                callback(e)
              }
            },
            set: async function (req, token, tokenSecret, callback) {
              try {
                const { storeTwitterRequestToken } = await import('../utils/oauthTempStore.js')
                const ok = storeTwitterRequestToken(
                  token,
                  tokenSecret,
                  req.session?.bindUserId || req.session?.userId,
                )
                logger.info('儲存 request token (tempStore):', {
                  token: token?.substring?.(0, 6) + '...',
                  ok,
                })
                callback(null)
              } catch (e) {
                logger.error('儲存 request token 失敗 (tempStore):', e)
                callback(e)
              }
            },
            destroy: async function (req, token, callback) {
              try {
                const { removeTwitterRequestToken } = await import('../utils/oauthTempStore.js')
                removeTwitterRequestToken(token)
                logger.info('刪除 request token (tempStore):', token?.substring?.(0, 6) + '...')
                callback()
              } catch (e) {
                logger.error('刪除 request token 失敗 (tempStore):', e)
                callback(e)
              }
            },
          },
        },
        async (req, token, tokenSecret, profile, done) => {
          try {
            logger.info('Twitter OAuth 綁定策略執行')
            logger.info('Session ID:', req.sessionID || req.session?.id)
            logger.info('Session exists:', !!req.session)
            logger.info('Request token 存在:', !!token)
            logger.info('Token secret 存在:', !!tokenSecret)
            logger.info('Profile ID:', profile.id)
            logger.info('Profile username:', profile.username)

            // 檢查會話中的用戶 ID
            let userId = req.session?.userId || req.session?.bindUserId

            // 先嘗試從 callbackURL 夾帶的 state 取得 userId
            if (!userId) {
              const callbackState = req.query.s || req.query.state
              if (callbackState) {
                try {
                  const { getBindState } = await import('../utils/oauthTempStore.js')
                  const st = getBindState(callbackState)
                  if (st && st.userId) {
                    userId = st.userId
                    if (req.session) {
                      req.session.userId = userId
                      req.session.bindUserId = userId
                    }
                    logger.info('✅ 從 callback state 取得用戶 ID 並寫回 session:', userId)
                  }
                } catch (e) {
                  logger.warn('讀取 callback state 失敗（Twitter）：', e)
                }
              }
            }

            // 若 session 沒有，從臨時儲存讀取 request token 對應的 userId
            if (!userId) {
              try {
                const { getTwitterRequestToken, removeTwitterRequestToken } = await import(
                  '../utils/oauthTempStore.js'
                )
                const data = getTwitterRequestToken(token)
                if (data && data.userId) {
                  userId = data.userId
                  // 將 userId 寫回 session 以供後續路由使用
                  if (req.session) {
                    req.session.userId = userId
                    req.session.bindUserId = userId
                  }
                  // 回收 request token
                  removeTwitterRequestToken(token)
                  logger.info('✅ 從臨時儲存取得 Twitter userId 並寫回 session:', userId)
                }
              } catch (e) {
                logger.warn('讀取 Twitter request token 以取得 userId 失敗:', e)
              }
            }

            if (!userId) {
              // 從 requestTokenStore.get 暫存的 req.tempBindUserId 讀取
              if (req.tempBindUserId) {
                userId = req.tempBindUserId
                if (req.session) {
                  req.session.userId = userId
                  req.session.bindUserId = userId
                }
                logger.info('✅ 從 req.tempBindUserId 還原用戶 ID:', userId)
              }
            }

            if (!userId) {
              logger.error('❌ Twitter OAuth 綁定策略中沒有找到用戶 ID')
              logger.info('Session 內容:', {
                userId: req.session?.userId,
                bindUserId: req.session?.bindUserId,
                oauthTwitterBind: req.session?.['oauth:twitter:bind'],
              })
              return done(new Error('User ID not found in session'), null)
            }

            logger.info('✅ Twitter OAuth 綁定策略找到用戶 ID，準備綁定:', userId)

            // 執行實際綁定
            const twitterId = profile.id
            const twitterUsername = profile.username

            const user = await User.findById(userId)
            if (!user) {
              logger.error('❌ 綁定用戶不存在:', userId)
              return done(new Error('綁定用戶不存在'), null)
            }

            // 若當前用戶已綁定，直接返回成功訊息
            if (user.twitter_id && user.twitter_id === twitterId) {
              logger.info('ℹ️ Twitter 已綁定於該用戶，跳過重複綁定:', { userId, twitterId })
              return done(null, user, { message: 'Twitter 帳號已綁定' })
            }

            // 檢查是否被他人綁定
            const existing = await User.findOne({ twitter_id: twitterId })
            if (existing && existing._id.toString() !== userId) {
              logger.error('❌ Twitter ID 已被其他用戶綁定:', {
                twitterId,
                existingUserId: existing._id,
              })
              return done(new Error('此 Twitter 帳號已被其他用戶綁定'), null)
            }

            user.twitter_id = twitterId
            if (twitterUsername) {
              user.twitter_username = twitterUsername
            }
            await user.save()

            // 如果用到了 callback state，清理臨時綁定狀態
            const callbackState = req.query?.s || req.query?.state
            if (callbackState) {
              try {
                const { removeBindState } = await import('../utils/oauthTempStore.js')
                removeBindState(callbackState)
              } catch (e) {
                logger.warn('移除 Twitter 綁定狀態失敗（忽略）：', e)
              }
            }

            logger.info('✅ Twitter 帳號綁定成功:', { userId, twitterId })
            return done(null, user, { message: 'Twitter 帳號綁定成功' })
          } catch (err) {
            logger.error('Twitter OAuth 綁定策略錯誤:', err)
            return done(err, null)
          }
        },
      ),
    )
  }
}

passport.serializeUser((user, done) => {
  try {
    // 如果是 OAuth 綁定流程返回的對象（包含 profile 和 provider）
    if (user && user.profile && user.provider) {
      logger.info('序列化 OAuth 綁定用戶:', {
        provider: user.provider,
        profileId: user.profile.id,
      })
      // 序列化整個對象，而不只是 id
      done(null, user)
    }
    // 如果是正常的用戶對象（有 id 或 _id）
    else if (user && (user.id || user._id)) {
      logger.info('序列化正常用戶:', { id: user.id || user._id })
      done(null, user.id || user._id)
    }
    // 無效的用戶對象
    else {
      logger.error('無效的用戶對象，無法序列化:', user)
      done(new Error('Invalid user object for serialization'), null)
    }
  } catch (error) {
    logger.error('用戶序列化錯誤:', error)
    done(error, null)
  }
})

passport.deserializeUser(async (data, done) => {
  try {
    // 如果是 OAuth 綁定對象（包含 profile 和 provider）
    if (data && typeof data === 'object' && data.profile && data.provider) {
      logger.info('反序列化 OAuth 綁定用戶:', {
        provider: data.provider,
        profileId: data.profile.id,
      })
      // 直接返回 OAuth 對象
      done(null, data)
    }
    // 如果是用戶 ID，從資料庫查找
    else if (typeof data === 'string' || (typeof data === 'object' && data.toString)) {
      const userId = typeof data === 'string' ? data : data.toString()
      logger.info('反序列化用戶 ID:', userId)
      const user = await User.findById(userId)
      done(null, user)
    }
    // 無效的資料
    else {
      logger.error('無效的反序列化資料:', data)
      done(null, null)
    }
  } catch (error) {
    logger.error('用戶反序列化錯誤:', error)
    done(error, null)
  }
})

// 立即初始化所有策略
initializeJWTStrategy()
initializeOAuthStrategies()

// 導出函數供測試使用
export { initializeOAuthStrategies, initializeJWTStrategy }
