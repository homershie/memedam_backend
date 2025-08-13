## OAuth 綁定/登入問題修正總結（兩日排查紀錄）

### 問題摘要

- Google：小窗授權報錯「Access blocked: Authorization Error / 400 invalid_request」，並偶發小窗顯示 bind_failed、主窗顯示成功不同步。
- Twitter：小窗回調提示 `auth_required`，綁定無法完成（OAuth 1.0a 受 session 影響）。
- Discord / Facebook：小窗回調顯示 `bind_failed`，實際未完成綁定。
- 其他：開發環境日誌偶現 `DOMException [DataCloneError]`（pino-pretty 自定義格式化與 worker 衝突）。

### 根本原因

- 小窗流程容易因瀏覽器阻擋第三方 Cookie 而「不共用 session」，導致 Passport 在回調階段取得不到 session 內的使用者資訊或 state。
- 原本所有 provider 共用單一回調邏輯，對於各家策略（尤其 Twitter OAuth 1.0a）細節不一致，易造成誤判（如 `bind_failed` 或 `auth_required`）。
- Google 要求過多 scopes 會觸發驗證要求與政策限制，造成 400 invalid_request。

### 最終解法總覽

- 新增臨時儲存 `utils/oauthTempStore.js`（以 Map 實作，TTL 5 分鐘、自動清理）：
  - `storeBindState/getBindState/removeBindState`：以 `state` 暫存綁定用 `userId` 與 `provider`。
  - `storeTwitterRequestToken/getTwitterRequestToken/removeTwitterRequestToken`：對應 Twitter OAuth 1.0a 的 request token/secret 與 `userId` 關聯。
- 各策略在 Passport 端完成真正綁定（避免路由層多次解讀造成誤導）：
  - Google：最小化 scopes `['openid','email','profile']`，並加上 `accessType: 'offline'`、`prompt: 'consent'`；`google-bind` 直接由 `oauthTempStore` 取回 `userId` 完成 `google_id` 寫入；路由於成功後直接重定向 `settings?success=...`。
  - Twitter（OAuth 1.0a）：初始化時將 `state` 以 `?s=` 夾帶到 `callbackURL`；`requestTokenStore` 使用 `oauthTempStore` 管理 token/secret 與 `userId`；verify callback 依序嘗試從 `s/state` → 臨時 token store → `req.tempBindUserId` 還原 `userId`，於策略內完成 `twitter_id` 綁定並清理臨時 state，路由統一重定向成功。
  - Facebook / Discord：新增 `facebook-bind`、`discord-bind` 策略，回調中以 `state` 從 `oauthTempStore` 取回 `userId`，完成 `facebook_id`/`discord_id` 綁定與重複/衝突檢查，路由直接重定向成功。
- 路由 `routes/userRoutes.js` 調整：
  - `/bind-auth/:provider/init`：不再強制依賴 session；若 query 帶 `token`，先以 DB `tokens` 尋找用戶，取到 `bindUserId` 後寫入 `oauthTempStore`，再觸發各家 Passport 流程。Twitter 於 `callbackURL` 夾帶 `?s=state`。
  - 各 provider 綁定回調：成功一律重定向 `settings?success=bind_success&provider=...`；失敗才帶 `error`，避免小窗/主窗顯示不一致。
- 前端：
  - `OAuthBindingDialog.vue`：正確拼接初始化 URL 與 `token`（支援有無 query 的 `?`/`&`），token 取得順序為 Pinia 的 `userStore` → `localStorage` → `sessionStorage`。
  - `settings.vue`：頁面載入時解析 URL 參數，顯示成功/錯誤 toast，與小窗結果同步。
  - `OAuthDebugDialog.vue`：將 `/api/...` 視為合法初始化端點，方便測試。
- 日誌：`utils/logger.js` 移除 `customPrettifiers` 以避免 worker 無法序列化函式的 `DataCloneError`。

### 錯誤 → 修正對照

- Google「400 invalid_request」→ 最小化 scopes 並設定 `accessType/prompt`；`google-bind` 依 `oauthTempStore` 綁定；回調路由直接 success 重定向。
- 小窗顯示 `bind_failed`、主窗顯示成功不同步 → 回調不再走通用 handler，改由各策略於 Passport 端完成綁定並回傳成功，路由單純做成功重定向。
- Twitter `auth_required` → 導入 `oauthTempStore` 管理 OAuth 1.0a request token 與 `userId`，`callbackURL` 攜帶 `s=state`，verify callback 多來源還原 `userId` 並在策略內完成綁定。
- Discord/Facebook `bind_failed` → 新增對應綁定策略，回調從 `state` 取回 `userId` 並完成綁定、重複/衝突檢查，路由直接成功重定向。
- 日誌 `DataCloneError` → 移除 `customPrettifiers`。

### 重要程式檔案

- `config/passport.js`
  - Google/Twitter/Facebook/Discord 綁定策略調整與綁定邏輯（Google/Twitter 另含策略細節優化）。
- `routes/userRoutes.js`
  - `/bind-auth/:provider/init` 初始化流程優化（query token 辨識用戶、寫入臨時 state、Twitter 回調傳遞 `s`）。
  - 各綁定回調路由統一改為成功即重定向 `settings?success=...`。
- `utils/oauthTempStore.js`
  - 綁定用 state 與 Twitter OAuth 1.0a request token 的臨時存放。
- 前端 `memedam/src/components/OAuthBindingDialog.vue`、`memedam/src/pages/settings.vue`、`memedam/src/components/OAuthDebugDialog.vue`
  - 綁定初始化 URL、token 拼接、回調訊息顯示與測試輔助。
- `utils/logger.js`
  - pino-pretty 設定調整，避免 `DataCloneError`。

### Provider 設定與範例

- Scopes（登入/綁定最小權限）：
  - Google：`['openid','email','profile']`，並加入 `accessType: 'offline'`、`prompt: 'consent'`。
  - Discord：`['identify','email']`
  - Facebook：`['email']`
  - Twitter（OAuth 1.0a）：無 scopes，使用 request token 流程。
- 環境變數與回調 URL：
  - `GOOGLE_REDIRECT_URI`、`GOOGLE_BIND_REDIRECT_URI`
  - `DISCORD_REDIRECT_URI`、`DISCORD_BIND_REDIRECT_URI`
  - `FACEBOOK_REDIRECT_URI`、`FACEBOOK_BIND_REDIRECT_URI`
  - `TWITTER_REDIRECT_URI`、`TWITTER_BIND_REDIRECT_URI`（Twitter 綁定回調會自動加上 `?s=state`）

### 驗證步驟（建議）

1. 前端 `設定 > 帳號綁定` 逐一測試 Google / Twitter / Discord / Facebook。
2. 觀察小窗關閉後主視窗 toast 是否顯示 success 並即時更新綁定狀態。
3. 測試「重複綁定」與「被他人佔用的 ID」情況，應返回清楚的錯誤訊息。
4. 於瀏覽器關閉第三方 Cookie 的情況下重試，應仍可成功（因已改為臨時儲存+策略內綁定）。

### Git 變更摘要（英文建議稿）

- feat(oauth): add ephemeral oauthTempStore for bind state and Twitter request tokens; 5m TTL with cleanup
- feat(google): minimize scopes to openid email profile; add accessType=offline and prompt=consent
- feat(google-bind): bind inside strategy using state from oauthTempStore; callback redirects success
- feat(twitter-bind): OAuth 1.0a flow with requestTokenStore backed by oauthTempStore; pass state via ?s=; restore userId from state/requestToken/req.tempBindUserId; perform binding in strategy
- feat(facebook/discord-bind): implement bind strategies using oauthTempStore state and duplicate checks; callback redirects success
- feat(routes): rework /bind-auth/:provider/init to accept query token, resolve userId via DB, and store state; add provider-specific callback behavior
- fix(frontend): OAuthBindingDialog token propagation and URL building; settings page handles callback params; debug dialog accepts /api/\* init URLs
- fix(logger): remove customPrettifiers to avoid DataCloneError with worker transport

完成後，四個 provider 之綁定皆已於小窗與主窗同步顯示成功，Twitter 亦不再出現 `auth_required`，整體流程在禁用第三方 Cookie 的情境下也能穩定運作。
