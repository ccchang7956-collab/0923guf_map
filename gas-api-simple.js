// 簡化版本的 Google Apps Script API - 用於初步測試

/**
 * 主要的doGet函數 - 處理所有GET請求
 */
function doGet(e) {
  try {
    // 基本測試 - 確保函數可以執行
    console.log('doGet 被呼叫');
    
    // 確保參數安全
    e = e || {};
    e.parameter = e.parameter || {};
    
    console.log('參數:', JSON.stringify(e.parameter));
    
    const path = e.parameter.path || '';
    const callback = e.parameter.callback;
    
    console.log('處理路徑:', path);
    
    let response;
    
    // 簡化的路由處理
    if (path === 'test') {
      response = {
        success: true,
        message: '測試成功！',
        timestamp: new Date().toISOString()
      };
    } else if (path === 'facilities') {
      response = testGetFacilities();
    } else {
      response = getApiInfo();
    }
    
    console.log('回應準備完成');
    
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
    
    console.log('回應設置完成');
    return output;
    
  } catch (error) {
    console.error('doGet 錯誤:', error);
    console.error('錯誤堆疊:', error.stack);
    
    const errorResponse = {
      success: false,
      error: error.toString(),
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    const output = ContentService.createTextOutput(JSON.stringify(errorResponse));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
}

/**
 * 測試 KML 資料獲取
 */
function testGetFacilities() {
  try {
    console.log('開始測試 KML 資料獲取');
    
    const KML_URL = 'https://www.google.com/maps/d/kml?mid=1euJJbnUwI0z0SNe4cWVcqzIDT6MMCrM';
    
    console.log('嘗試獲取 KML:', KML_URL);
    
    // 使用UrlFetchApp獲取KML資料
    const response = UrlFetchApp.fetch(KML_URL, {
      method: 'GET',
      followRedirects: true,
      muteHttpExceptions: true
    });
    
    console.log('HTTP 狀態碼:', response.getResponseCode());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }
    
    // 獲取回應內容
    const blob = response.getBlob();
    console.log('取得 blob, 大小:', blob.getBytes().length);
    
    // Google我的地圖回傳的是KMZ檔案（ZIP格式）
    let kmlContent = null;
    
    try {
      // 檢查前幾個字節是否為ZIP檔案標誌
      const bytes = blob.getBytes();
      console.log('檔案前4個字節:', bytes.slice(0, 4));
      console.log('檔案大小:', bytes.length);
      
      // ZIP檔案通常以 PK 開頭（50 4B = 0x504B）
      if (bytes[0] === 80 && bytes[1] === 75) {
        console.log('檢測到ZIP檔案，嘗試多種解壓縮方法');
        
        // 方法1: 嘗試標準 unzip
        try {
          const zipBlob = Utilities.unzip(blob);
          console.log('標準解壓縮成功，檔案數量:', zipBlob.length);
          
          // 尋找KML檔案
          for (let i = 0; i < zipBlob.length; i++) {
            const fileName = zipBlob[i].getName();
            console.log('檔案', i, ':', fileName);
            if (fileName.toLowerCase().endsWith('.kml') || fileName === 'doc.kml') {
              kmlContent = zipBlob[i].getDataAsString('UTF-8');
              console.log('找到 KML 檔案:', fileName, '大小:', kmlContent.length);
              break;
            }
          }
          
          // 如果沒找到.kml檔案，嘗試第一個檔案
          if (!kmlContent && zipBlob.length > 0) {
            console.log('未找到.kml檔案，嘗試第一個檔案:', zipBlob[0].getName());
            kmlContent = zipBlob[0].getDataAsString('UTF-8');
          }
          
        } catch (unzipError) {
          console.log('標準解壓縮失敗:', unzipError.toString());
          
          // 方法2: 嘗試建立新的 Blob 並解壓縮
          try {
            console.log('嘗試重新建立 Blob');
            const newBlob = Utilities.newBlob(bytes, 'application/zip', 'temp.kmz');
            const zipBlob2 = Utilities.unzip(newBlob);
            console.log('重新建立 Blob 解壓縮成功，檔案數量:', zipBlob2.length);
            
            for (let i = 0; i < zipBlob2.length; i++) {
              const fileName = zipBlob2[i].getName();
              console.log('檔案', i, ':', fileName);
              if (fileName.toLowerCase().endsWith('.kml') || fileName === 'doc.kml') {
                kmlContent = zipBlob2[i].getDataAsString('UTF-8');
                console.log('找到 KML 檔案:', fileName, '大小:', kmlContent.length);
                break;
              }
            }
            
          } catch (unzipError2) {
            console.log('重新建立 Blob 也失敗:', unzipError2.toString());
            
            // 方法3: 嘗試手動解析ZIP結構（簡化版）
            try {
              console.log('嘗試手動解析ZIP結構');
              kmlContent = extractKMLFromZip(bytes);
              if (kmlContent) {
                console.log('手動解析成功，KML大小:', kmlContent.length);
              }
            } catch (manualError) {
              console.log('手動解析也失敗:', manualError.toString());
            }
          }
        }
        
      } else {
        console.log('不是ZIP檔案，嘗試直接解析');
        kmlContent = blob.getDataAsString('UTF-8');
      }
      
    } catch (error) {
      console.log('整體處理失敗:', error.toString());
      // 最後嘗試直接當作文字處理
      kmlContent = blob.getDataAsString('UTF-8');
    }
    
    if (!kmlContent) {
      throw new Error('找不到 KML 內容');
    }
    
    console.log('KML 內容前 200 字符:', kmlContent.substring(0, 200));
    
    // 簡單解析測試
    const facilities = parseKMLContent(kmlContent);
    
    return {
      success: true,
      message: 'KML 資料獲取成功',
      data: facilities.slice(0, 5), // 只返回前5筆作為測試
      total: facilities.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('KML 獲取錯誤:', error);
    return {
      success: false,
      error: 'KML 資料獲取失敗: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 簡化的 KML 解析
 */
function parseKMLContent(kmlContent) {
  try {
    console.log('開始解析 KML，內容長度:', kmlContent.length);
    console.log('KML 開頭:', kmlContent.substring(0, 100));
    
    // 清理可能的BOM和空白字符
    kmlContent = kmlContent.trim();
    if (kmlContent.charCodeAt(0) === 0xFEFF) {
      kmlContent = kmlContent.substring(1);
    }
    
    const xmlDoc = XmlService.parse(kmlContent);
    const root = xmlDoc.getRootElement();
    
    console.log('XML 解析成功，根元素:', root.getName());
    
    // 嘗試不同的命名空間
    let kmlNamespace = null;
    try {
      kmlNamespace = XmlService.getNamespace('http://www.opengis.net/kml/2.2');
    } catch (e) {
      console.log('使用預設命名空間');
      kmlNamespace = null;
    }
    
    const facilities = [];
    
    // 獲取所有 Placemark 元素
    let allPlacemarks = [];
    try {
      if (kmlNamespace) {
        allPlacemarks = root.getDescendants().filter(function(element) {
          return element.getName && element.getName() === 'Placemark';
        });
      } else {
        // 沒有命名空間的情況
        allPlacemarks = root.getDescendants().filter(function(element) {
          return element.getName && element.getName() === 'Placemark';
        });
      }
    } catch (e) {
      console.log('使用替代方法搜尋 Placemark');
      allPlacemarks = searchPlacemarks(root);
    }
    
    console.log('找到 Placemark 數量:', allPlacemarks.length);
    
    for (let i = 0; i < allPlacemarks.length; i++) { // 處理所有設施，不限制數量
      const placemark = allPlacemarks[i];
      
      try {
        // 獲取名稱
        let name = '未命名';
        try {
          name = placemark.getChild('name', kmlNamespace)?.getText() || 
                 placemark.getChild('name')?.getText() || '未命名';
        } catch (e) {
          name = '未命名_' + i;
        }
        
        // 獲取地址
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
        
        // 解析 ExtendedData
        const extendedData = parseExtendedDataSimple(placemark, kmlNamespace);
        
        // 優先使用 ExtendedData 中的資料
        const facilityType = extendedData.category || '未分類';
        const facilityAddress = extendedData.address || address || '';
        const facilityNote = extendedData.note || '';
        const coordinatesLink = extendedData.coordinatesLink || '';
        
        // 解析座標 - 優先使用 ExtendedData 中的 "地址LINK"
        let lat = null, lng = null;
        
        if (coordinatesLink) {
          const coordMatch = coordinatesLink.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
          if (coordMatch) {
            lat = parseFloat(coordMatch[1]);
            lng = parseFloat(coordMatch[2]);
            console.log('從地址LINK獲取座標:', name, lat, lng);
          }
        }
        
        // 如果沒有地址LINK座標，嘗試從Point元素獲取
        if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
          try {
            const point = placemark.getChild('Point', kmlNamespace) || placemark.getChild('Point');
            if (point) {
              const coordElement = point.getChild('coordinates', kmlNamespace) || point.getChild('coordinates');
              if (coordElement) {
                const coordText = coordElement.getText().trim();
                const coords = coordText.split(',');
                if (coords.length >= 2) {
                  lng = parseFloat(coords[0]);
                  lat = parseFloat(coords[1]);
                  console.log('從Point元素獲取座標:', name, lat, lng);
                }
              }
            }
          } catch (e) {
            console.log('Point座標獲取失敗:', e);
          }
        }
        
        // 如果還是沒有座標，嘗試手動修正
        if ((lat === null || lng === null || isNaN(lat) || isNaN(lng))) {
          const manualCoords = getManualCoordinatesSimple(name, facilityAddress);
          if (manualCoords) {
            lat = manualCoords.lat;
            lng = manualCoords.lng;
            console.log('✅ 使用手動修正座標:', name, 'at', lat, lng);
          }
        }
        
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          facilities.push({
            id: 'test_' + i,
            name: name,
            type: facilityType,
            address: facilityAddress,
            note: facilityNote,
            lat: lat,
            lng: lng,
            description: description,
            lastUpdated: new Date().toISOString()
          });
          console.log('✅ 成功解析設施:', name, 'at', lat, lng, '類型:', facilityType);
        } else {
          console.log('❌ 無法獲取有效座標:', name, '地址LINK:', coordinatesLink, '地址:', facilityAddress);
          
          // 即使沒有座標，也記錄設施資訊（用於除錯）
          if (name && name !== '未命名') {
            console.log('📋 設施資訊 - 名稱:', name, '類型:', facilityType, '地址:', facilityAddress, '備註:', facilityNote);
          }
        }
        
      } catch (parseError) {
        console.warn('解析第', i, '個 Placemark 時出錯:', parseError);
      }
    }
    
    // 簡化版手動座標函數
    function getManualCoordinatesSimple(name, address) {
      const manualCoordinates = {
        // 流動廁所設施
        '光復國中': { lat: 23.670744817168, lng: 121.424612054950 },
        '花蓮縣光復鄉公所': { lat: 23.672128822372, lng: 121.425962653936 },
        
        // 沐浴站設施  
        '太巴塱教會': { lat: 23.656125191784, lng: 121.448685869841 },
        '光復國小': { lat: 23.673782831711, lng: 121.427167314022 },
        
        // 醫療站設施
        '虎爺溫泉醫療站': { lat: 23.500648786750, lng: 121.360855764468 }
      };
      
      // 檢查完全匹配
      if (manualCoordinates[name]) {
        return manualCoordinates[name];
      }
      
      // 檢查部分匹配
      for (const facilityName in manualCoordinates) {
        if (name.includes(facilityName) || facilityName.includes(name)) {
          return manualCoordinates[facilityName];
        }
      }
      
      // 根據地址匹配
      if (address) {
        const addressLower = address.toLowerCase();
        
        if (addressLower.includes('林森路200號')) return { lat: 23.670744817168, lng: 121.424612054950 };
        if (addressLower.includes('中華路257號')) return { lat: 23.672128822372, lng: 121.425962653936 };
        if (addressLower.includes('中正路二段90號')) return { lat: 23.656125191784, lng: 121.448685869841 };
        if (addressLower.includes('中山路三段75號')) return { lat: 23.673782831711, lng: 121.427167314022 };
        if (addressLower.includes('瑞穗鄉祥北路二段101-5號')) return { lat: 23.500648786750, lng: 121.360855764468 };
      }
      
      return null;
    }
    
    // 簡化版 ExtendedData 解析函數
    function parseExtendedDataSimple(placemark, kmlNamespace) {
      const data = {
        category: '',
        address: '',
        note: '',
        coordinatesLink: ''
      };
      
      try {
        const extendedData = placemark.getChild('ExtendedData', kmlNamespace) || 
                            placemark.getChild('ExtendedData');
        
        if (!extendedData) return data;
        
        const dataElements = extendedData.getChildren('Data', kmlNamespace) || 
                            extendedData.getChildren('Data');
        
        for (let j = 0; j < dataElements.length; j++) {
          const dataElement = dataElements[j];
          try {
            const nameAttr = dataElement.getAttribute('name');
            const dataName = nameAttr ? nameAttr.getValue() : '';
            const valueElement = dataElement.getChild('value', kmlNamespace) || 
                                dataElement.getChild('value');
            const value = valueElement ? valueElement.getText() : '';
            
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
          } catch (e) {
            // 忽略單個Data元素的錯誤
          }
        }
      } catch (e) {
        // 忽略ExtendedData解析錯誤
      }
      
      return data;
    }
    
    console.log('解析完成，設施數量:', facilities.length);
    return facilities;
    
  } catch (error) {
    console.error('KML解析錯誤:', error);
    throw new Error('KML解析失敗: ' + error.toString());
  }
}

/**
 * API資訊端點
 */
function getApiInfo() {
  return {
    success: true,
    name: '光復災區地圖 RESTful API (簡化測試版)',
    version: '1.0.0-test',
    description: '即時解析Google我的地圖KML資料並提供RESTful API服務',
    endpoints: {
      '/': 'API資訊',
      '/?path=test': '基本測試',
      '/?path=facilities': '測試設施資料獲取'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 手動從ZIP字節陣列中提取KML內容（簡化版）
 */
function extractKMLFromZip(bytes) {
  try {
    // 這是一個簡化的ZIP解析器，專門用於提取KML
    console.log('開始手動ZIP解析，總大小:', bytes.length);
    
    // 尋找 "doc.kml" 或 ".kml" 檔案的位置
    const searchStrings = ['doc.kml', '.kml'];
    let kmlStartPos = -1;
    let kmlSize = 0;
    
    // 簡單搜尋檔案名
    for (let searchStr of searchStrings) {
      const searchBytes = [];
      for (let i = 0; i < searchStr.length; i++) {
        searchBytes.push(searchStr.charCodeAt(i));
      }
      
      for (let i = 0; i < bytes.length - searchBytes.length; i++) {
        let match = true;
        for (let j = 0; j < searchBytes.length; j++) {
          if (bytes[i + j] !== searchBytes[j]) {
            match = false;
            break;
          }
        }
        
        if (match) {
          console.log('找到檔案名:', searchStr, '在位置:', i);
          
          // 嘗試從這個位置往前找到ZIP記錄的開始
          // ZIP本地檔案頭的簽名是 0x04034b50
          for (let k = Math.max(0, i - 100); k < i; k++) {
            if (bytes[k] === 0x50 && bytes[k+1] === 0x4b && 
                bytes[k+2] === 0x03 && bytes[k+3] === 0x04) {
              console.log('找到本地檔案頭在位置:', k);
              
              // 讀取壓縮大小（位置 k+18 開始的4個字節，小端序）
              const compressedSize = bytes[k+18] | (bytes[k+19] << 8) | 
                                   (bytes[k+20] << 16) | (bytes[k+21] << 24);
              
              // 讀取檔名長度（位置 k+26 開始的2個字節）
              const fileNameLength = bytes[k+26] | (bytes[k+27] << 8);
              
              // 讀取額外欄位長度（位置 k+28 開始的2個字節）
              const extraFieldLength = bytes[k+28] | (bytes[k+29] << 8);
              
              console.log('壓縮大小:', compressedSize, '檔名長度:', fileNameLength, '額外欄位長度:', extraFieldLength);
              
              // 計算資料開始位置
              const dataStart = k + 30 + fileNameLength + extraFieldLength;
              
              if (dataStart < bytes.length && dataStart + compressedSize <= bytes.length) {
                console.log('資料開始位置:', dataStart, '資料結束位置:', dataStart + compressedSize);
                
                // 提取壓縮的資料
                const compressedData = bytes.slice(dataStart, dataStart + compressedSize);
                
                // 嘗試解壓縮（如果是儲存模式，compression method = 0）
                const compressionMethod = bytes[k+8] | (bytes[k+9] << 8);
                console.log('壓縮方法:', compressionMethod);
                
                if (compressionMethod === 0) {
                  // 儲存模式，沒有壓縮
                  console.log('檔案未壓縮，直接讀取');
                  const kmlBytes = compressedData;
                  let kmlContent = '';
                  for (let b of kmlBytes) {
                    kmlContent += String.fromCharCode(b);
                  }
                  return kmlContent;
                } else {
                  console.log('檔案已壓縮，無法在此簡化版本中處理');
                  return null;
                }
              }
            }
          }
        }
      }
    }
    
    console.log('手動ZIP解析未找到KML檔案');
    return null;
    
  } catch (error) {
    console.log('手動ZIP解析錯誤:', error.toString());
    return null;
  }
}

/**
 * 替代方法搜尋 Placemark 元素
 */
function searchPlacemarks(element) {
  const placemarks = [];
  
  try {
    if (element.getName && element.getName() === 'Placemark') {
      placemarks.push(element);
    }
    
    const children = element.getChildren();
    for (let i = 0; i < children.length; i++) {
      const childPlacemarks = searchPlacemarks(children[i]);
      placemarks.push(...childPlacemarks);
    }
  } catch (e) {
    // 忽略錯誤，繼續搜尋
  }
  
  return placemarks;
}

/**
 * 手動測試函數 - 可以在 Google Apps Script 編輯器中直接執行
 */
function manualTest() {
  console.log('=== 手動測試開始 ===');
  
  try {
    // 測試基本 doGet
    console.log('1. 測試基本 doGet');
    const result1 = doGet();
    console.log('基本測試結果:', JSON.stringify(result1.getContent()));
    
    // 測試帶參數的 doGet
    console.log('2. 測試帶參數的 doGet');
    const result2 = doGet({
      parameter: {
        path: 'test'
      }
    });
    console.log('參數測試結果:', JSON.stringify(result2.getContent()));
    
    // 測試 KML 獲取
    console.log('3. 測試 KML 獲取');
    const result3 = doGet({
      parameter: {
        path: 'facilities'
      }
    });
    console.log('KML 測試結果:', JSON.stringify(result3.getContent()));
    
    console.log('=== 手動測試完成 ===');
    
  } catch (error) {
    console.error('手動測試錯誤:', error);
  }
}