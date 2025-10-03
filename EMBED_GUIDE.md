# 光復災害地圖 - 嵌入使用指南

## 🌐 網頁嵌入方法

### 基本嵌入代碼

```html
<iframe 
    src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
    width="100%" 
    height="600" 
    frameborder="0" 
    allowfullscreen
    title="光復災害地圖">
</iframe>
```

### 響應式嵌入

```html
<div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
    <iframe 
        src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        frameborder="0" 
        allowfullscreen
        title="光復災害地圖">
    </iframe>
</div>
```

### 自定義尺寸嵌入

```html
<!-- 小尺寸嵌入 (適合側邊欄) -->
<iframe 
    src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
    width="350" 
    height="400" 
    frameborder="0"
    title="光復災害地圖">
</iframe>

<!-- 大尺寸嵌入 (適合主要內容區) -->
<iframe 
    src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
    width="100%" 
    height="800" 
    frameborder="0" 
    allowfullscreen
    title="光復災害地圖">
</iframe>
```

## 🎨 樣式自定義

### 帶邊框和陰影

```html
<iframe 
    src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
    width="100%" 
    height="600" 
    frameborder="0"
    style="border: 2px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
    title="光復災害地圖">
</iframe>
```

### 帶標題的嵌入

```html
<div style="margin: 20px 0;">
    <h3 style="margin-bottom: 10px; font-size: 1.5em; color: #374151;">
        光復災害地圖
    </h3>
    <p style="margin-bottom: 15px; color: #6b7280; font-size: 0.9em;">
        花蓮縣光復鄉、萬榮鄉、鳳林鎮災害應急設施地圖
    </p>
    <iframe 
        src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
        width="100%" 
        height="600" 
        frameborder="0"
        style="border: 1px solid #d1d5db; border-radius: 6px;"
        title="光復災害地圖">
    </iframe>
</div>
```

## 📱 WordPress 使用方法

### 方法1: 直接HTML
1. 編輯文章或頁面
2. 切換到「HTML」或「程式碼」模式
3. 貼上嵌入代碼

### 方法2: 自訂HTML區塊
1. 新增「自訂HTML」區塊
2. 貼上嵌入代碼

### 方法3: 使用簡碼 (需要自定義)
```php
// 在functions.php中添加
function disaster_map_shortcode($atts) {
    $atts = shortcode_atts(array(
        'width' => '100%',
        'height' => '600',
    ), $atts);
    
    return '<iframe src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" width="' . $atts['width'] . '" height="' . $atts['height'] . '" frameborder="0" allowfullscreen title="光復災害地圖"></iframe>';
}
add_shortcode('disaster_map', 'disaster_map_shortcode');
```

使用簡碼：
```
[disaster_map width="100%" height="600"]
```

## 🔧 技術說明

### 支援的功能
- ✅ 完整的地圖功能
- ✅ 設施搜索和篩選
- ✅ 用戶定位
- ✅ 響應式設計
- ✅ 觸控支援

### 安全設置
- 設置了適當的CORS headers
- 允許iframe嵌入
- 支援HTTPS

### 瀏覽器支援
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📋 使用範例

### 政府網站嵌入
```html
<section class="disaster-info">
    <h2>災害應急設施查詢</h2>
    <p>點擊地圖查看光復鄉、萬榮鄉、鳳林鎮的災害應急設施位置</p>
    <iframe 
        src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
        width="100%" 
        height="700" 
        frameborder="0" 
        allowfullscreen
        title="光復災害地圖">
    </iframe>
</section>
```

### 部落格文章嵌入
```html
<p>以下是光復地區的災害應急設施分布圖：</p>

<iframe 
    src="https://[您的GitHub用戶名].github.io/[儲存庫名稱]/" 
    width="100%" 
    height="500" 
    frameborder="0"
    style="margin: 20px 0; border: 1px solid #ccc;"
    title="光復災害地圖">
</iframe>

<p><em>地圖包含流動廁所、沐浴站、取水站、災區醫療站等設施資訊</em></p>
```

### 社群網站分享
```html
<!-- Facebook、LINE等社群媒體會自動抓取Open Graph資料 -->
<!-- 直接分享網址即可：https://[您的GitHub用戶名].github.io/[儲存庫名稱]/ -->
```

## ⚠️ 注意事項

1. **請替換URL**: 將 `[您的GitHub用戶名]` 和 `[儲存庫名稱]` 替換為實際值
2. **HTTPS要求**: 確保您的網站使用HTTPS，以支援地理定位功能
3. **尺寸建議**: 
   - 最小寸：300x400px
   - 建議尺寸：100%x600px
   - 全屏顯示：100%x800px
4. **載入時間**: 首次載入可能需要幾秒鐘
5. **行動裝置**: 在手機上建議高度至少400px

## 📞 支援

如有嵌入使用問題，請在GitHub儲存庫中建立Issue。