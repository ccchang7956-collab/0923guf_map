# Google Apps Script 部署指南

這個指南將協助您將光復災區地圖API部署到Google Apps Script上。

## 📋 部署步驟

### 1. 建立 Google Apps Script 專案

1. 前往 [Google Apps Script](https://script.google.com)
2. 點擊「新專案」
3. 將專案重新命名為「光復災區地圖API」

### 2. 部署程式碼

1. 刪除預設的 `Code.gs` 檔案內容
2. 將 `gas-api.js` 的內容完整複製到 `Code.gs` 檔案中
3. 點擊「儲存」按鈕（Ctrl+S）

### 3. 設定網頁應用程式

1. 點擊右上角的「部署」按鈕
2. 選擇「新部署」
3. 點擊齒輪圖示，選擇「網頁應用程式」
4. 設定如下：
   - **說明**：光復災區地圖RESTful API v1.0
   - **執行身分**：我
   - **具備存取權的使用者**：任何人
5. 點擊「部署」
6. 授權應用程式（第一次部署時需要）
7. 複製提供的「網頁應用程式」URL

### 4. 測試部署

1. 在瀏覽器中開啟您的網頁應用程式URL
2. 您應該會看到API資訊的JSON回應
3. 測試其他端點：
   - `YOUR_URL?path=facilities` - 獲取所有設施
   - `YOUR_URL?path=stats` - 獲取統計資料
   - `YOUR_URL?path=types` - 獲取設施類型

## 🔧 API 使用方法

### 基本 URL 格式
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 可用端點

#### 1. 獲取API資訊
```
GET /
```

#### 2. 獲取所有設施
```
GET /?path=facilities
```
**參數：**
- `type` (可選) - 設施類型篩選
- `search` (可選) - 搜索關鍵字
- `page` (可選) - 頁數，預設為1
- `limit` (可選) - 每頁數量，預設為50

**範例：**
```
GET /?path=facilities&type=流動廁所&page=1&limit=10
```

#### 3. 搜索設施
```
GET /?path=search&q={query}
```
**參數：**
- `q` (必需) - 搜索關鍵字

**範例：**
```
GET /?path=search&q=光復
```

#### 4. 獲取統計資料
```
GET /?path=stats
```

#### 5. 獲取設施類型
```
GET /?path=types
```

#### 6. 獲取附近設施
```
GET /?path=nearby&lat={latitude}&lng={longitude}&radius={radius}
```
**參數：**
- `lat` (必需) - 緯度
- `lng` (必需) - 經度
- `radius` (可選) - 搜索半徑（公里），預設為5

**範例：**
```
GET /?path=nearby&lat=23.652&lng=121.411&radius=10
```

### JSONP 支援

API支援JSONP格式，適用於跨域請求：

```
GET /?path=facilities&callback=myCallback
```

回應格式：
```javascript
myCallback({"success":true,"data":[...]});
```

## 📱 使用 HTML 客戶端

1. 開啟 `api-client.html` 檔案
2. 在「API URL」欄位中輸入您的Google Apps Script網頁應用程式URL
3. 點擊「測試連接」
4. 如果連接成功，您就可以開始使用所有功能了

### 客戶端功能

- **即時資料載入** - 直接從Google我的地圖載入最新資料
- **互動式地圖** - 顯示所有設施位置
- **搜索功能** - 快速尋找特定設施
- **類型篩選** - 按設施類型篩選顯示
- **定位服務** - 找到附近的設施
- **統計儀表板** - 顯示各類設施統計
- **API回應查看** - 即時查看API回應內容

## 🔄 更新部署

當您需要更新程式碼時：

1. 在Google Apps Script中修改程式碼
2. 點擊「儲存」
3. 點擊「部署」→「管理部署」
4. 點擊編輯圖示（鉛筆）
5. 選擇「新版本」
6. 點擊「部署」

**注意：** URL不會改變，但您需要等待幾分鐘讓更新生效。

## 🚀 進階設定

### 快取設定

為了提高效能，您可以修改程式碼添加快取機制：

```javascript
// 在 getKMLData() 函數中添加
const cache = CacheService.getScriptCache();
const cacheKey = 'kml_data';
const cachedData = cache.get(cacheKey);

if (cachedData) {
  return JSON.parse(cachedData);
}

// ... 原有的資料獲取邏輯 ...

// 快取資料30分鐘
cache.put(cacheKey, JSON.stringify(facilities), 1800);
```

### 錯誤監控

添加更詳細的錯誤記錄：

```javascript
// 在 doGet() 函數的 catch 區塊中添加
console.error('API錯誤詳情:', {
  error: error.toString(),
  stack: error.stack,
  parameters: e.parameter,
  timestamp: new Date().toISOString()
});
```

### 安全性設定

如果您需要限制存取：

1. 將「具備存取權的使用者」改為「僅限我」或「僅限網域內的使用者」
2. 在程式碼中添加API金鑰驗證：

```javascript
function doGet(e) {
  const apiKey = e.parameter.key;
  const validKeys = ['your-secret-key-1', 'your-secret-key-2'];
  
  if (!validKeys.includes(apiKey)) {
    return ContentService.createTextOutput(
      JSON.stringify({success: false, error: '無效的API金鑰'})
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ... 原有的程式邏輯 ...
}
```

## 🐛 故障排除

### 常見問題

#### 1. 「授權錯誤」
**解決方案：** 確認您已經授權應用程式存取您的Google帳戶。

#### 2. 「KML載入失敗」
**可能原因：**
- Google我的地圖URL不正確
- 地圖不是公開的
- 網路連線問題

**解決方案：**
- 確認地圖設定為「公開」或「知道連結的使用者」
- 檢查URL是否正確
- 在瀏覽器中直接存取KML URL測試

#### 3. 「CORS錯誤」
**解決方案：** 使用JSONP模式或確保正確設定了CORS標頭。

#### 4. 「執行超時」
**解決方案：** 
- 添加快取機制
- 優化KML解析邏輯
- 分批處理大量資料

### 除錯技巧

1. **查看執行日誌：**
   - 在Google Apps Script中點擊「執行」→「查看執行記錄」

2. **本地測試：**
   - 使用瀏覽器開發者工具檢查API回應
   - 檢查網路標籤中的請求詳情

3. **逐步測試：**
   - 先測試基本的API資訊端點
   - 再測試資料載入端點
   - 最後測試複雜的搜索和篩選功能

## 📈 效能優化

### 建議的優化方案

1. **實作快取機制** - 避免重複載入相同資料
2. **分頁載入** - 大量資料分批載入
3. **壓縮回應** - 減少不必要的資料欄位
4. **索引建立** - 為常用搜索欄位建立索引
5. **CDN使用** - 對於靜態資源使用CDN

## 📊 監控和分析

您可以添加基本的使用統計：

```javascript
// 在 doGet() 開始時添加
const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getActiveSheet();
sheet.appendRow([
  new Date(),
  e.parameter.path || 'info',
  JSON.stringify(e.parameter),
  Session.getActiveUser().getEmail()
]);
```

## 🔗 相關資源

- [Google Apps Script 文件](https://developers.google.com/apps-script)
- [Google我的地圖說明](https://support.google.com/mymaps)
- [KML參考文件](https://developers.google.com/kml/documentation)
- [Leaflet.js文件](https://leafletjs.com/reference.html)

## 📞 支援

如果您遇到問題：

1. 檢查這個指南的故障排除章節
2. 查看Google Apps Script的執行日誌
3. 確認您的Google我的地圖設定正確
4. 測試API端點是否正常運作

---

**完成部署後，您的光復災區地圖API就可以提供即時的設施資訊服務了！** 🎉