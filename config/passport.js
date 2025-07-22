import passport from 'passport'
import passportLocal from 'passport-local'
import passportJWT from 'passport-jwt'
import GoogleStrategy from 'passport-google-oauth20'
import FacebookStrategy from 'passport-facebook'
import DiscordStrategy from 'passport-discord'
import TwitterStrategy from '@superfaceai/passport-twitter-oauth2'
import bcrypt from 'bcrypt'
import User from '../models/User.js'

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

passport.use(
  'jwt',
  new passportJWT.Strategy(
    {
      jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
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
        // const token = req.headers.authorization.split(' ')[1]
        const token = passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken()(req)

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
        if (expired && url !== '/users/refresh' && url !== '/users/logout') {
          throw new Error('token 已過期')
        }
        // 修正：檢查使用者是否存在，並且 tokens 陣列裡面有這個 token
        const user = await User.findOne({
          _id: payload._id,
          tokens: token, // 修正：使用 tokens 陣列查詢
        }).orFail(new Error('使用者不存在'))
        return done(null, { user, token })
      } catch (error) {
        console.log('passport.js jwt')
        console.error(error)
        if (error.message === '使用者不存在') {
          return done(null, false, { message: '使用者不存在或 token 已失效' })
        } else if (error.message === 'token 已過期') {
          return done(null, false, { message: 'token 已過期' })
        } else {
          return done(error)
        }
      }
    },
  ),
)

// Google
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI, // 改為用環境變數
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          req.user.google_id = profile.id
          await req.user.save()
          return done(null, req.user)
        } else {
          let user = await User.findOne({ google_id: profile.id })
          if (!user) {
            user = new User({
              username: profile.emails?.[0]?.value || profile.id,
              email: profile.emails?.[0]?.value || '',
              google_id: profile.id,
              display_name: profile.displayName,
            })
            await user.save()
          }
          return done(null, user)
        }
      } catch (err) {
        return done(err, null)
      }
    },
  ),
)

// Facebook
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI, // 改為用環境變數
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          req.user.facebook_id = profile.id
          await req.user.save()
          return done(null, req.user)
        } else {
          let user = await User.findOne({ facebook_id: profile.id })
          if (!user) {
            user = new User({
              username: profile.emails?.[0]?.value || profile.id,
              email: profile.emails?.[0]?.value || '',
              facebook_id: profile.id,
              display_name: profile.displayName,
            })
            await user.save()
          }
          return done(null, user)
        }
      } catch (err) {
        return done(err, null)
      }
    },
  ),
)

// Discord
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_REDIRECT_URI, // 改為用環境變數
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          req.user.discord_id = profile.id
          await req.user.save()
          return done(null, req.user)
        } else {
          let user = await User.findOne({ discord_id: profile.id })
          if (!user) {
            user = new User({
              username: profile.emails?.[0]?.value || profile.id,
              email: profile.emails?.[0]?.value || '',
              discord_id: profile.id,
              display_name: profile.displayName,
            })
            await user.save()
          }
          return done(null, user)
        }
      } catch (err) {
        return done(err, null)
      }
    },
  ),
)

// Twitter
passport.use(
  new TwitterStrategy(
    {
      clientID: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      callbackURL: process.env.TWITTER_REDIRECT_URI, // 改為用環境變數
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (req.user) {
          req.user.twitter_id = profile.id
          await req.user.save()
          return done(null, req.user)
        } else {
          let user = await User.findOne({ twitter_id: profile.id })
          if (!user) {
            user = new User({
              username: profile.username || profile.id,
              email: profile.emails?.[0]?.value || '',
              twitter_id: profile.id,
              display_name: profile.displayName,
            })
            await user.save()
          }
          return done(null, user)
        }
      } catch (err) {
        return done(err, null)
      }
    },
  ),
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id)
  done(null, user)
})
