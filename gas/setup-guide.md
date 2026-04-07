# 美食地圖 GAS 部署指南

## 第一步：建立 Google Sheets

1. 開啟 [Google Sheets](https://sheets.google.com)，新建一份試算表
2. 命名為「美食地圖資料」
3. 複製試算表 URL 中的 ID（`/d/` 後面到 `/edit` 之前的字串）

## 第二步：申請 Google Maps API Key

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案（或使用現有專案）
3. 啟用以下 API：
   - **Maps JavaScript API**
   - **Places API (New)**
4. 建立 API Key（建議限制 HTTP 參照網址）
5. 建立 **Map ID**（選用，但 Advanced Marker 需要）：
   - 側欄 → Google Maps Platform → Map Management → 建立 Map ID
   - 地圖類型選「JavaScript」，勾選「Advanced Markers」

## 第三步：申請 Claude API Key

1. 開啟 [Anthropic Console](https://console.anthropic.com/)
2. 建立 API Key
3. **此 Key 只存放在 GAS Script Properties，不放前端**

## 第四步：建立 Drive 資料夾（頭像用，可選）

1. 開啟 Google Drive，建立一個資料夾「美食地圖頭像」
2. 複製資料夾 URL 中的 ID

## 第五步：部署 GAS

1. 開啟 [Google Apps Script](https://script.google.com/)，建立新專案
2. 將 `gas/` 目錄下的所有 `.gs` 檔案複製到 GAS 編輯器
   - 每個 `.gs` 檔案對應一個 GAS 編輯器的檔案
3. 設定 Script Properties（「專案設定」→「指令碼屬性」）：

| 屬性名稱 | 值 |
|---------|-----|
| `SPREADSHEET_ID` | 第一步複製的 Sheets ID |
| `DRIVE_FOLDER_ID` | 第四步的資料夾 ID（沒有就留空） |
| `CLAUDE_API_KEY` | 第三步的 API Key |

4. 執行 `initAllSheets()` 初始化資料表
5. 點「部署」→「新部署」：
   - 類型：Web App
   - 執行身分：我（帳號擁有者）
   - 存取權：**任何人**
6. 複製部署後的 URL

## 第六步：設定前端

1. 用瀏覽器開啟 `index.html`
2. 選擇豬豬或滾滾登入
3. 切換到「設定」頁，填入：
   - **Google Maps API Key**（第二步取得）
   - **GAS Web App URL**（第五步複製）
   - **Map ID**（第二步建立，可選）
4. 回到「地圖」頁，允許位置存取，開始使用！

## 注意事項

- Google Maps Platform 有每月 $200 USD 免費額度，一般家庭用量不會超過
- Claude API 分類是按需呼叫（新餐廳才呼叫），費用很低
- 如果 Claude API Key 未設定，會自動使用規則式分類（免費）
- 所有 API Key 都存在 localStorage，不會上傳到 GAS 的 CLAUDE_API_KEY 以外
