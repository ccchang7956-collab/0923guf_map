// Google Apps Script API 服務 - 正式版本
// 用於即時解析Google我的地圖KML資料並提供RESTful API

/**
 * 主要的doGet函數 - 處理所有GET請求
 */
function doGet(e) {
  try {
    // 確保參數安全
    e = e || {};
    e.parameter = e.parameter || {};
    
    const path = e.parameter.path || '';
    const callback = e.parameter.callback;
    
    let response;
    
    switch(path) {
      case 'facilities':
        response = getFacilities(e.parameter);
        break;
      case 'facility':
        response = getFacility(e.parameter.id || '');
        break;
      case 'stats':
        response = getStats();
        break;
      case 'types':
        response = getFacilityTypes();
        break;
      case 'search':
        response = searchFacilities(e.parameter.q || '');
        break;
      case 'nearby':
        response = getNearbyFacilities(e.parameter.lat || '', e.parameter.lng || '', e.parameter.radius || '');
        break;
      case 'test':
        response = { success: true, message: '測試成功！', timestamp: new Date().toISOString() };
        break;
      default:
        response = getApiInfo();
    }
    
    // 設置回應
    const output = ContentService.createTextOutput();
    
    if (callback) {
      // JSONP支援
      output.setContent(callback + '(' + JSON.stringify(response) + ');');
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      // 標準JSON回應
      output.setContent(JSON.stringify(response, null, 2));
      output.setMimeType(ContentService.MimeType.JSON);
    }
    
    return output;
    
  } catch (error) {
    console.error('API錯誤詳情:', {
      error: error.toString(),
      stack: error.stack,
      parameters: e.parameter,
      path: e.parameter.path,
      timestamp: new Date().toISOString()
    });
    
    const errorResponse = {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    const output = ContentService.createTextOutput(JSON.stringify(errorResponse));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
}

/**
 * 從Google我的地圖獲取並解析KML資料
 */
function getKMLData() {
  const KML_URL = 'https://www.google.com/maps/d/kml?mid=1euJJbnUwI0z0SNe4cWVcqzIDT6MMCrM';
  
  try {
    // 檢查快取
    const cache = CacheService.getScriptCache();
    const cacheKey = 'kml_facilities_data';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('使用快取資料');
      return JSON.parse(cachedData);
    }
    
    console.log('獲取新的KML資料');
    
    // 使用UrlFetchApp獲取KML資料
    const response = UrlFetchApp.fetch(KML_URL, {
      method: 'GET',
      followRedirects: true,
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }
    
    // Google我的地圖回傳KMZ檔案
    const blob = response.getBlob();
    const bytes = blob.getBytes();
    
    let kmlContent = null;
    
    // ZIP檔案檢測與解壓縮
    if (bytes[0] === 80 && bytes[1] === 75) {
      try {
        // 嘗試重新建立 Blob 並解壓縮
        const newBlob = Utilities.newBlob(bytes, 'application/zip', 'temp.kmz');
        const zipBlob = Utilities.unzip(newBlob);
        
        // 尋找KML檔案
        for (let i = 0; i < zipBlob.length; i++) {
          const fileName = zipBlob[i].getName();
          if (fileName.toLowerCase().endsWith('.kml') || fileName === 'doc.kml') {
            kmlContent = zipBlob[i].getDataAsString('UTF-8');
            break;
          }
        }
      } catch (unzipError) {
        throw new Error('KMZ檔案解壓縮失敗: ' + unzipError.toString());
      }
    } else {
      kmlContent = blob.getDataAsString('UTF-8');
    }
    
    if (!kmlContent) {
      throw new Error('找不到KML內容');
    }
    
    const facilities = parseKMLContent(kmlContent);
    
    // 快取30分鐘
    cache.put(cacheKey, JSON.stringify(facilities), 1800);
    
    return facilities;
    
  } catch (error) {
    console.error('獲取KML資料錯誤:', error);
    throw new Error('無法獲取KML資料: ' + error.toString());
  }
}

/**
 * 解析KML內容
 */
function parseKMLContent(kmlContent) {
  try {
    // 清理內容
    kmlContent = kmlContent.trim();
    if (kmlContent.charCodeAt(0) === 0xFEFF) {
      kmlContent = kmlContent.substring(1);
    }
    
    const xmlDoc = XmlService.parse(kmlContent);
    const root = xmlDoc.getRootElement();
    
    let kmlNamespace = null;
    try {
      kmlNamespace = XmlService.getNamespace('http://www.opengis.net/kml/2.2');
    } catch (e) {
      kmlNamespace = null;
    }
    
    const facilities = [];
    
    // 獲取所有 Placemark 元素
    const allPlacemarks = root.getDescendants().filter(function(element) {
      return element.getName && element.getName() === 'Placemark';
    });
    
    console.log('找到 Placemark 數量:', allPlacemarks.length);
    
    for (let i = 0; i < allPlacemarks.length; i++) {
      const placemark = allPlacemarks[i];
      const facility = parsePlacemark(placemark, kmlNamespace, i);
      if (facility) {
        facilities.push(facility);
      }
    }
    
    console.log('🎯 解析完成統計:');
    console.log('  - 總 Placemark 數量:', allPlacemarks.length);
    console.log('  - 成功解析設施數量:', facilities.length);
    console.log('  - 解析成功率:', ((facilities.length / allPlacemarks.length) * 100).toFixed(1) + '%');
    
    // 按類型統計
    const typeStats = {};
    facilities.forEach(f => {
      typeStats[f.type] = (typeStats[f.type] || 0) + 1;
    });
    console.log('  - 設施類型統計:', JSON.stringify(typeStats));
    
    return facilities;
    
  } catch (error) {
    console.error('KML解析錯誤:', error);
    throw new Error('KML解析失敗: ' + error.toString());
  }
}

/**
 * 解析單個地標
 */
function parsePlacemark(placemark, kmlNamespace, index) {
  try {
    // 獲取名稱
    let name = '未命名';
    try {
      name = placemark.getChild('name', kmlNamespace)?.getText() || 
             placemark.getChild('name')?.getText() || '未命名';
    } catch (e) {
      name = '未命名_' + index;
    }
    
    // 獲取地址標籤
    let address = '';
    try {
      address = placemark.getChild('address', kmlNamespace)?.getText() || 
               placemark.getChild('address')?.getText() || '';
    } catch (e) {
      address = '';
    }
    
    // 獲取描述
    let description = '';
    try {
      description = placemark.getChild('description', kmlNamespace)?.getText() || 
                   placemark.getChild('description')?.getText() || '';
    } catch (e) {
      description = '';
    }
    
    // 解析 ExtendedData 中的結構化資料
    const extendedData = parseExtendedData(placemark, kmlNamespace);
    
    // 優先使用 ExtendedData 中的資料，然後才是其他來源
    const facilityType = extendedData.category || '未分類';
    const facilityAddress = extendedData.address || address || '';
    const facilityNote = extendedData.note || '';
    const coordinatesLink = extendedData.coordinatesLink || '';
    
    // 解析座標 - 優先使用 ExtendedData 中的 "地址LINK"
    let coordinates = null;
    if (coordinatesLink) {
      coordinates = parseCoordinatesFromLink(coordinatesLink);
    }
    
    // 如果沒有座標LINK或解析失敗，嘗試其他方法
    if (!coordinates) {
      coordinates = getCoordinatesFromPoint(placemark, kmlNamespace);
    }
    
    // 最後的備選方案：使用地址進行地理編碼
    if (!coordinates && facilityAddress) {
      coordinates = geocodeAddress(facilityAddress);
    }
    
    // 手動修正：為特定無座標的設施添加已知座標
    if (!coordinates) {
      coordinates = getManualCoordinates(name, facilityAddress);
    }
    
    if (!coordinates) {
      console.warn('❌ 無法獲取座標:', name, '地址LINK:', coordinatesLink, '地址:', facilityAddress);
      // 記錄無法解析的設施資訊用於除錯
      console.log('📋 未解析設施 - 名稱:', name, '類型:', facilityType, '地址:', facilityAddress, '備註:', facilityNote);
      return null;
    }
    
    return {
      id: Utilities.getUuid(),
      name: name.trim(),
      type: normalizeCategory(facilityType),
      address: facilityAddress,
      note: facilityNote,
      lat: coordinates.lat,
      lng: coordinates.lng,
      description: description,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('解析地標錯誤:', error);
    return null;
  }
}

/**
 * 解析 ExtendedData 元素中的結構化資料
 */
function parseExtendedData(placemark, kmlNamespace) {
  const data = {
    category: '',
    address: '',
    note: '',
    coordinatesLink: ''
  };
  
  try {
    // 獲取 ExtendedData 元素
    const extendedData = placemark.getChild('ExtendedData', kmlNamespace) || 
                        placemark.getChild('ExtendedData');
    
    if (!extendedData) {
      console.log('沒有找到 ExtendedData 元素');
      return data;
    }
    
    // 獲取所有 Data 元素
    const dataElements = extendedData.getChildren('Data', kmlNamespace) || 
                        extendedData.getChildren('Data');
    
    console.log('找到', dataElements.length, '個 Data 元素');
    
    for (let i = 0; i < dataElements.length; i++) {
      const dataElement = dataElements[i];
      
      try {
        // 獲取 name 屬性
        const nameAttr = dataElement.getAttribute('name');
        const dataName = nameAttr ? nameAttr.getValue() : '';
        
        // 獲取 value 子元素
        const valueElement = dataElement.getChild('value', kmlNamespace) || 
                            dataElement.getChild('value');
        const value = valueElement ? valueElement.getText() : '';
        
        console.log('Data 元素:', dataName, '=', value);
        
        // 根據 name 屬性分配到對應欄位
        switch (dataName) {
          case '類別':
            data.category = value;
            break;
          case '地址或google座標':
            data.address = value;
            break;
          case '備註':
            data.note = value;
            break;
          case '地址LINK':
            data.coordinatesLink = value;
            break;
        }
        
      } catch (dataError) {
        console.warn('解析 Data 元素失敗:', dataError);
      }
    }
    
  } catch (error) {
    console.error('解析 ExtendedData 失敗:', error);
  }
  
  return data;
}

/**
 * 從地址LINK中解析座標
 */
function parseCoordinatesFromLink(coordinatesLink) {
  try {
    if (!coordinatesLink || coordinatesLink.trim() === '') {
      return null;
    }
    
    console.log('解析座標LINK:', coordinatesLink);
    
    const cleanLink = coordinatesLink.trim();
    
    // 1. 標準座標格式 (lat, lng)
    const coordMatch = cleanLink.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log('成功解析標準座標:', lat, lng);
        return { lat: lat, lng: lng };
      }
    }
    
    // 2. Google Maps 分享連結格式
    if (cleanLink.includes('maps.app.goo.gl') || cleanLink.includes('google.com/maps')) {
      console.log('檢測到Google Maps連結，嘗試解析');
      
      // 從URL中提取座標 (通常在 @lat,lng 格式)
      const urlCoordMatch = cleanLink.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (urlCoordMatch) {
        const lat = parseFloat(urlCoordMatch[1]);
        const lng = parseFloat(urlCoordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log('從Google Maps URL解析座標:', lat, lng);
          return { lat: lat, lng: lng };
        }
      }
      
      // 其他Google Maps URL格式
      const altCoordMatch = cleanLink.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (altCoordMatch) {
        const lat = parseFloat(altCoordMatch[1]);
        const lng = parseFloat(altCoordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log('從Google Maps URL (ll參數)解析座標:', lat, lng);
          return { lat: lat, lng: lng };
        }
      }
    }
    
    // 3. URL編碼的座標格式 (如虎爺溫泉的情況)
    if (cleanLink.includes('%2C')) {
      const decodedLink = decodeURIComponent(cleanLink);
      console.log('URL解碼後:', decodedLink);
      
      const decodedCoordMatch = decodedLink.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (decodedCoordMatch) {
        const lat = parseFloat(decodedCoordMatch[1]);
        const lng = parseFloat(decodedCoordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log('從URL解碼座標解析:', lat, lng);
          return { lat: lat, lng: lng };
        }
      }
    }
    
    console.log('無法解析座標格式:', coordinatesLink);
    return null;
    
  } catch (error) {
    console.error('座標解析錯誤:', error);
    return null;
  }
}

/**
 * 使用Google Maps Geocoding API 解析地址為座標
 */
function geocodeAddress(address) {
  try {
    // 如果地址中已包含座標格式，直接解析
    const coordMatch = address.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log('從地址中直接解析座標:', address, '=>', lat, lng);
        return { lat: lat, lng: lng };
      }
    }
    
    // 使用Google Maps Geocoding API
    const geocodingUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      address: address,
      region: 'tw', // 台灣地區
      // 注意：實際部署時需要 API Key
      // key: 'YOUR_GOOGLE_MAPS_API_KEY'
    };
    
    // 建構查詢URL
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const fullUrl = `${geocodingUrl}?${queryString}`;
    
    console.log('嘗試地址解析:', address);
    
    // 暫時返回台灣花蓮縣光復鄉的大概座標作為示例
    // 實際應用中需要真正的 Geocoding API 呼叫
    const response = UrlFetchApp.fetch(fullUrl, {
      method: 'GET',
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        console.log('地址解析成功:', address, '=>', location.lat, location.lng);
        return {
          lat: location.lat,
          lng: location.lng
        };
      } else {
        console.log('Geocoding API 回應錯誤:', data.status);
      }
    } else {
      console.log('Geocoding API 請求失敗:', response.getResponseCode());
    }
    
    // API 失敗時的後備方案：根據花蓮縣光復鄉地址推估座標
    return estimateCoordinatesFromAddress(address);
    
  } catch (error) {
    console.error('地址解析錯誤:', error);
    return estimateCoordinatesFromAddress(address);
  }
}

/**
 * 根據地址推估座標（後備方案）
 */
function estimateCoordinatesFromAddress(address) {
  try {
    // 光復鄉的大致範圍
    const guangfuCenter = { lat: 23.6577, lng: 121.4269 };
    const addressLower = address.toLowerCase();
    
    // 根據地址關鍵字進行簡單的區域劃分
    let estimatedCoords = { ...guangfuCenter };
    
    if (addressLower.includes('太巴塱') || addressLower.includes('tabalong')) {
      estimatedCoords = { lat: 23.6650, lng: 121.4180 };
    } else if (addressLower.includes('馬太鞍') || addressLower.includes('馬佛')) {
      estimatedCoords = { lat: 23.6380, lng: 121.4380 };
    } else if (addressLower.includes('大同') || addressLower.includes('復興')) {
      estimatedCoords = { lat: 23.6720, lng: 121.4120 };
    } else if (addressLower.includes('大進') || addressLower.includes('大全')) {
      estimatedCoords = { lat: 23.6450, lng: 121.4450 };
    } else if (addressLower.includes('砂荖') || addressLower.includes('加里洞')) {
      estimatedCoords = { lat: 23.6280, lng: 121.4580 };
    }
    
    // 添加隨機偏移避免重疊（約100-200公尺範圍）
    const offsetRange = 0.002; // 約200公尺
    estimatedCoords.lat += (Math.random() - 0.5) * offsetRange;
    estimatedCoords.lng += (Math.random() - 0.5) * offsetRange;
    
    console.log('使用推估座標:', address, '=>', estimatedCoords.lat, estimatedCoords.lng);
    return estimatedCoords;
    
  } catch (error) {
    console.error('座標推估錯誤:', error);
    // 最後的後備方案：光復鄉中心點
    return { lat: 23.6577, lng: 121.4269 };
  }
}

/**
 * 從Point元素獲取座標（後備方法）
 */
function getCoordinatesFromPoint(placemark, kmlNamespace) {
  try {
    const point = placemark.getChild('Point', kmlNamespace) || placemark.getChild('Point');
    if (point) {
      const coordElement = point.getChild('coordinates', kmlNamespace) || point.getChild('coordinates');
      if (coordElement) {
        const coordText = coordElement.getText().trim();
        const coords = coordText.split(',');
        if (coords.length >= 2) {
          const lng = parseFloat(coords[0]);
          const lat = parseFloat(coords[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            console.log('從Point元素獲取座標:', lat, lng);
            return { lat: lat, lng: lng };
          }
        }
      }
    }
  } catch (e) {
    console.log('Point座標獲取失敗:', e);
  }
  
  return null;
}

/**
 * 標準化類別名稱
 */
function normalizeCategory(category) {
  if (!category) return '未分類';
  
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('流動廁所') || categoryLower.includes('廁所')) {
    return '流動廁所';
  }
  if (categoryLower.includes('沐浴站') || categoryLower.includes('沐浴')) {
    return '沐浴站';
  }
  if (categoryLower.includes('取水站') || categoryLower.includes('加水站') || categoryLower.includes('自來水')) {
    return '取水站';
  }
  
  return category;
}

/**
 * API端點：獲取所有設施
 */
function getFacilities(params) {
  const facilities = getKMLData();
  
  // 篩選參數
  let filteredFacilities = facilities;
  
  if (params.type) {
    filteredFacilities = filteredFacilities.filter(f => f.type === params.type);
  }
  
  if (params.search) {
    const searchTerm = params.search.toLowerCase();
    filteredFacilities = filteredFacilities.filter(f => 
      f.name.toLowerCase().includes(searchTerm) ||
      f.address.toLowerCase().includes(searchTerm) ||
      f.type.toLowerCase().includes(searchTerm) ||
      f.note.toLowerCase().includes(searchTerm)
    );
  }
  
  // 分頁
  const page = parseInt(params.page) || 1;
  const limit = parseInt(params.limit) || 50;
  const offset = (page - 1) * limit;
  
  const paginatedFacilities = filteredFacilities.slice(offset, offset + limit);
  
  return {
    success: true,
    data: paginatedFacilities,
    pagination: {
      page: page,
      limit: limit,
      total: filteredFacilities.length,
      totalPages: Math.ceil(filteredFacilities.length / limit)
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * API端點：獲取單個設施
 */
function getFacility(id) {
  const facilities = getKMLData();
  const facility = facilities.find(f => f.id === id);
  
  if (!facility) {
    return {
      success: false,
      error: '找不到指定的設施',
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    success: true,
    data: facility,
    timestamp: new Date().toISOString()
  };
}

/**
 * API端點：獲取統計資料
 */
function getStats() {
  const facilities = getKMLData();
  const stats = {};
  
  facilities.forEach(facility => {
    const type = facility.type;
    if (!stats[type]) {
      stats[type] = {
        count: 0,
        total: 0,
        facilities: []
      };
    }
    
    stats[type].count++;
    stats[type].facilities.push({
      id: facility.id,
      name: facility.name,
      address: facility.address
    });
    
    // 從備註中提取數量
    const noteText = facility.note;
    const numbers = noteText.match(/\d+/g);
    if (numbers) {
      stats[type].total += parseInt(numbers[0]);
    }
  });
  
  return {
    success: true,
    data: {
      totalFacilities: facilities.length,
      byType: stats
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * API端點：獲取設施類型
 */
function getFacilityTypes() {
  const facilities = getKMLData();
  const types = [...new Set(facilities.map(f => f.type))];
  
  return {
    success: true,
    data: types,
    timestamp: new Date().toISOString()
  };
}

/**
 * API端點：搜索設施
 */
function searchFacilities(query) {
  if (!query) {
    return {
      success: false,
      error: '搜索查詢不能為空',
      timestamp: new Date().toISOString()
    };
  }
  
  const facilities = getKMLData();
  const searchTerm = query.toLowerCase();
  
  const results = facilities.filter(facility => 
    facility.name.toLowerCase().includes(searchTerm) ||
    facility.address.toLowerCase().includes(searchTerm) ||
    facility.type.toLowerCase().includes(searchTerm) ||
    facility.note.toLowerCase().includes(searchTerm)
  );
  
  return {
    success: true,
    data: results,
    query: query,
    timestamp: new Date().toISOString()
  };
}

/**
 * API端點：獲取附近設施
 */
function getNearbyFacilities(lat, lng, radius) {
  if (!lat || !lng) {
    return {
      success: false,
      error: '緯度和經度參數是必需的',
      timestamp: new Date().toISOString()
    };
  }
  
  const facilities = getKMLData();
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const searchRadius = parseFloat(radius) || 5; // 默認5公里
  
  const nearbyFacilities = facilities.map(facility => {
    const distance = calculateDistance(userLat, userLng, facility.lat, facility.lng);
    return {
      ...facility,
      distance: distance
    };
  }).filter(facility => facility.distance <= searchRadius)
    .sort((a, b) => a.distance - b.distance);
  
  return {
    success: true,
    data: nearbyFacilities,
    searchCenter: { lat: userLat, lng: userLng },
    searchRadius: searchRadius,
    timestamp: new Date().toISOString()
  };
}

/**
 * 手動提供特定設施的座標（修正無法自動解析的設施）
 */
function getManualCoordinates(name, address) {
  try {
    // 根據設施名稱和地址提供手動座標
    const manualCoordinates = {
      // 流動廁所設施
      '光復國中': { lat: 23.670744817168, lng: 121.424612054950, source: '花蓮縣光復鄉林森路200號' },
      '花蓮縣光復鄉公所': { lat: 23.672128822372, lng: 121.425962653936, source: '花蓮縣光復鄉中華路257號' },
      
      // 沐浴站設施  
      '太巴塱教會': { lat: 23.656125191784, lng: 121.448685869841, source: '花蓮縣光復鄉中正路二段90號' },
      '光復國小': { lat: 23.673782831711, lng: 121.427167314022, source: '花蓮縣光復鄉中山路三段75號' },
      
      // 醫療站設施
      '虎爺溫泉醫療站': { lat: 23.500648786750, lng: 121.360855764468, source: '花蓮縣瑞穗鄉祥北路二段101-5號' }
    };
    
    // 檢查是否有匹配的設施
    if (manualCoordinates[name]) {
      const coords = manualCoordinates[name];
      console.log('✅ 使用手動座標:', name, 'at', coords.lat, coords.lng, '(來源:', coords.source, ')');
      return { lat: coords.lat, lng: coords.lng };
    }
    
    // 如果名稱不完全匹配，嘗試部分匹配
    for (const facilityName in manualCoordinates) {
      if (name.includes(facilityName) || facilityName.includes(name)) {
        const coords = manualCoordinates[facilityName];
        console.log('✅ 使用手動座標(部分匹配):', name, '=>', facilityName, 'at', coords.lat, coords.lng);
        return { lat: coords.lat, lng: coords.lng };
      }
    }
    
    // 根據地址關鍵字推估座標
    if (address) {
      const addressLower = address.toLowerCase();
      
      // 光復鄉內的地址推估
      if (addressLower.includes('林森路200號')) {
        console.log('✅ 根據地址推估座標(光復國中):', name);
        return { lat: 23.670744817168, lng: 121.424612054950 };
      }
      
      if (addressLower.includes('中華路257號')) {
        console.log('✅ 根據地址推估座標(鄉公所):', name);
        return { lat: 23.672128822372, lng: 121.425962653936 };
      }
      
      if (addressLower.includes('中正路二段90號')) {
        console.log('✅ 根據地址推估座標(太巴塱教會):', name);
        return { lat: 23.656125191784, lng: 121.448685869841 };
      }
      
      if (addressLower.includes('中山路三段75號')) {
        console.log('✅ 根據地址推估座標(光復國小):', name);
        return { lat: 23.673782831711, lng: 121.427167314022 };
      }
      
      if (addressLower.includes('瑞穗鄉祥北路二段101-5號')) {
        console.log('✅ 根據地址推估座標(虎爺溫泉):', name);
        return { lat: 23.500648786750, lng: 121.360855764468 };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('手動座標獲取錯誤:', error);
    return null;
  }
}

/**
 * 計算兩點間距離（公里）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半徑（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * API資訊端點
 */
function getApiInfo() {
  return {
    success: true,
    name: '光復災區地圖 RESTful API',
    version: '1.0.0',
    description: '即時解析Google我的地圖KML資料並提供RESTful API服務',
    endpoints: {
      '/': 'API資訊',
      '/?path=facilities': '獲取所有設施',
      '/?path=facility&id={id}': '獲取單個設施',
      '/?path=stats': '獲取統計資料',
      '/?path=types': '獲取設施類型',
      '/?path=search&q={query}': '搜索設施',
      '/?path=nearby&lat={lat}&lng={lng}&radius={radius}': '獲取附近設施'
    },
    parameters: {
      facilities: {
        type: '設施類型篩選',
        search: '搜索關鍵字',
        page: '頁數（默認1）',
        limit: '每頁數量（默認50）'
      }
    },
    timestamp: new Date().toISOString()
  };
}