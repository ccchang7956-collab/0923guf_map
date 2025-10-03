// 全局變量
let map;
let markers = {};
let facilitiesData = [];
let currentFilter = 'all';
let kmlParser;
let userLocationMarker = null;
let searchResults = [];
let isSearchActive = false;

// 設施類型配置
const facilityTypes = {
    '流動廁所': {
        color: '#f97316',
        icon: 'fas fa-restroom',
        countElement: 'toilet-count',
        totalElement: 'toilet-total'
    },
    '沐浴站': {
        color: '#10b981',
        icon: 'fas fa-shower',
        countElement: 'shower-count',
        totalElement: 'shower-total'
    },
    '取水站': {
        color: '#06b6d4',
        icon: 'fas fa-tint',
        countElement: 'water-count',
        totalElement: 'water-total'
    },
    '災區醫療站': {
        color: '#dc2626',
        icon: 'fas fa-user-md',
        countElement: 'medical-count',
        totalElement: 'medical-total'
    }
};

// 初始化地圖
function initMap() {
    // 三鄉鎮的中心位置 (光復鄉中心)
    const regionCenter = [23.67, 121.43];
    map = L.map('map').setView(regionCenter, 12);
    
    // 光復鄉、萬榮鄉、鳳林鎮的地理邊界
    const regionBounds = [
        [23.50, 121.35], // 西南角 (涵蓋鳳林鎮南部)
        [23.85, 121.55]  // 東北角 (涵蓋萬榮鄉東部)
    ];
    
    // 設置地圖的最大邊界
    map.setMaxBounds(regionBounds);
    map.options.minZoom = 10;  // 適中的最小縮放級別
    map.options.maxZoom = 18;  // 最大縮放級別
    
    // 添加OpenStreetMap圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | 限制範圍: 光復鄉、萬榮鄉、鳳林鎮',
        bounds: regionBounds
    }).addTo(map);
    
    // 初始化標記圖層組
    Object.keys(facilityTypes).forEach(type => {
        markers[type] = L.layerGroup().addTo(map);
    });
    
    // 當地圖超出邊界時，自動回到範圍內
    map.on('drag', function() {
        map.panInsideBounds(regionBounds, { animate: false });
    });
    
    // 當地圖縮放超出範圍時，自動調整到適當縮放級別
    map.on('zoomend', function() {
        const currentZoom = map.getZoom();
        if (currentZoom < 10) {
            map.setZoom(10);
        }
    });
    
    console.log('地圖初始化完成 - 已限制在光復鄉、萬榮鄉、鳳林鎮範圍內');
}

// 載入並解析KML數據
async function loadKMLData() {
    try {
        // 顯示載入提示
        showLoadingMessage('正在載入KML數據...');
        
        // 載入KML文件
        const response = await fetch('光復災區地圖.kml');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const kmlContent = await response.text();
        
        // 初始化KML解析器
        kmlParser = new KMLParser();
        
        // 解析KML數據
        facilitiesData = await kmlParser.parseKMLFile(kmlContent);
        
        console.log('成功載入', facilitiesData.length, '個設施');
        hideLoadingMessage();
        
        return facilitiesData;
        
    } catch (error) {
        console.error('載入KML數據失敗:', error);
        hideLoadingMessage();
        showErrorMessage('載入數據失敗: ' + error.message);
        
        // 使用備用數據
        return loadFallbackData();
    }
}

// 備用數據（當KML載入失敗時使用）
function loadFallbackData() {
    console.log('使用備用數據');
    facilitiesData = [
        {
            name: '馬太鞍教會',
            type: '流動廁所',
            address: '花蓮縣光復鄉大馬村中山路三段89巷14號',
            note: '4座',
            lat: 23.675444431837576,
            lng: 121.4263233196848
        },
        {
            name: '光復高職',
            type: '流動廁所',
            address: '花蓮縣光復鄉林森路100號',
            note: '11座',
            lat: 23.66736667736868,
            lng: 121.42738942281937
        },
        {
            name: '太巴塱教會',
            type: '沐浴站',
            address: '花蓮縣光復鄉中正路二段90號',
            note: '8間',
            lat: 23.6603,
            lng: 121.4494
        },
        {
            name: '大馬村加水站',
            type: '取水站',
            address: '花蓮縣光復鄉大馬村林森路730號',
            note: '2桶',
            lat: 23.68556550556121,
            lng: 121.40873496485706
        }
    ];
    return facilitiesData;
}

// 顯示載入訊息 (使用toast系統)
function showLoadingMessage(message) {
    showToast(message, 'info', 0); // 持續顯示直到手動移除
}

// 隱藏載入訊息 (使用toast系統)
function hideLoadingMessage() {
    clearAllToasts(); // 清除所有toast
}

// 顯示錯誤訊息 (使用toast系統)
function showErrorMessage(message) {
    showToast(message, 'error', 5000);
}

// 生成Google Maps URL
function generateGoogleMapsUrl(address, lat, lng) {
    // 如果有座標，優先使用座標
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    
    // 否則使用地址搜索
    if (address) {
        const encodedAddress = encodeURIComponent(address);
        return `https://www.google.com/maps/search/${encodedAddress}`;
    }
    
    // 預設回到光復鄉
    return 'https://www.google.com/maps/search/花蓮縣光復鄉';
}

// 搜索功能
function searchFacilities(query) {
    if (!query || query.trim() === '') {
        clearSearch();
        return;
    }
    
    // 顯示搜索中的toast
    showToast('正在搜索設施...', 'info', 1000);
    
    const searchTerm = query.toLowerCase().trim();
    searchResults = facilitiesData.filter(facility => {
        return facility.name.toLowerCase().includes(searchTerm) ||
               facility.address.toLowerCase().includes(searchTerm) ||
               facility.type.toLowerCase().includes(searchTerm) ||
               facility.note.toLowerCase().includes(searchTerm);
    });
    
    displaySearchResults();
    highlightSearchResults();
    isSearchActive = true;
    
    // 顯示搜索結果toast
    if (searchResults.length > 0) {
        showToast(`找到 ${searchResults.length} 個相關設施`, 'success', 2000);
    } else {
        showToast('未找到相關設施，請嘗試其他關鍵字', 'warning', 3000);
    }
}

// 顯示搜索結果
function displaySearchResults() {
    const resultsContainer = document.getElementById('search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (searchResults.length === 0) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    resultsContainer.classList.remove('hidden');
    resultsList.innerHTML = '';
    
    searchResults.slice(0, 5).forEach((facility, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors';
        resultItem.innerHTML = `
            <div class="flex items-center flex-1">
                <i class="${facilityTypes[facility.type]?.icon || 'fas fa-map-marker'}" 
                   style="color: ${facilityTypes[facility.type]?.color || '#gray'}; margin-right: 8px;"></i>
                <div class="flex-1">
                    <div class="font-medium text-sm">${facility.name}</div>
                    <div class="text-xs text-gray-600">${facility.type} - ${facility.address}</div>
                </div>
            </div>
            <button class="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded">
                <i class="fas fa-crosshairs mr-1"></i>定位
            </button>
        `;
        
        resultItem.addEventListener('click', () => {
            focusOnFacility(facility);
        });
        
        resultsList.appendChild(resultItem);
    });
    
    if (searchResults.length > 5) {
        const moreResults = document.createElement('div');
        moreResults.className = 'text-xs text-gray-500 p-2 text-center';
        moreResults.textContent = `還有 ${searchResults.length - 5} 個結果...`;
        resultsList.appendChild(moreResults);
    }
}

// 高亮搜索結果
function highlightSearchResults() {
    // 隱藏所有標記
    Object.values(markers).forEach(layerGroup => {
        map.removeLayer(layerGroup);
    });
    
    // 只顯示搜索結果的標記
    searchResults.forEach(facility => {
        const marker = createCustomMarker(facility);
        if (marker && markers[facility.type]) {
            markers[facility.type].addLayer(marker);
            map.addLayer(markers[facility.type]);
        }
    });
    
    // 如果有結果，調整地圖視野以包含所有結果
    if (searchResults.length > 0) {
        const group = new L.featureGroup();
        searchResults.forEach(facility => {
            if (facility.lat && facility.lng) {
                group.addLayer(L.marker([facility.lat, facility.lng]));
            }
        });
        
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    }
}

// 聚焦到特定設施
function focusOnFacility(facility) {
    if (facility.lat && facility.lng) {
        // 顯示定位toast
        showToast(`正在定位到 ${facility.name}`, 'info', 1500);
        
        map.setView([facility.lat, facility.lng], 16);
        
        // 找到對應的標記並打開彈出窗口
        setTimeout(() => {
            const layerGroup = markers[facility.type];
            if (layerGroup) {
                layerGroup.eachLayer(marker => {
                    const markerPos = marker.getLatLng();
                    if (Math.abs(markerPos.lat - facility.lat) < 0.0001 && 
                        Math.abs(markerPos.lng - facility.lng) < 0.0001) {
                        marker.openPopup();
                        // 顯示成功定位toast
                        showToast(`已定位到 ${facility.name}`, 'success', 2000);
                    }
                });
            }
        }, 500);
    } else {
        showToast('無法定位此設施，座標資訊不完整', 'warning', 3000);
    }
}

// 清除搜索
function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').classList.add('hidden');
    searchResults = [];
    isSearchActive = false;
    
    // 顯示清除toast
    showToast('搜索已清除', 'info', 1500);
    
    // 恢復正常的篩選顯示
    filterFacilities(currentFilter);
}

// 用戶定位功能
function locateUser() {
    if (!navigator.geolocation) {
        showToast('您的瀏覽器不支援地理定位功能', 'error', 4000);
        return;
    }
    
    // 顯示定位中提示
    showToast('正在獲取您的位置...', 'info', 0); // 持續顯示直到手動移除
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5分鐘緩存
    };
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            clearAllToasts(); // 清除載入中的toast
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log(`用戶位置: ${lat}, ${lng} (精度: ${accuracy}米)`);
            
            // 檢查是否在光復鄉、萬榮鄉、鳳林鎮範圍內
            if (lat < 23.50 || lat > 23.85 || lng < 121.35 || lng > 121.55) {
                // 檢查是否至少在花蓮縣範圍內
                if (lat < 22.7 || lat > 24.5 || lng < 120.8 || lng > 122.0) {
                    showToast('您似乎不在花蓮縣範圍內，將顯示光復鄉中心位置', 'warning', 4000);
                } else {
                    showToast('您不在光復鄉、萬榮鄉、鳳林鎮範圍內，將顯示光復鄉位置', 'info', 4000);
                }
                map.setView([23.67, 121.43], 12);
                return;
            }
            
            // 移除舊的用戶位置標記
            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }
            
            // 創建用戶位置標記
            const userIcon = L.divIcon({
                html: `
                    <div style="
                        background-color: #3b82f6;
                        border: 3px solid white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                        animation: pulse 2s infinite;
                    "></div>
                    <style>
                        @keyframes pulse {
                            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                            70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                        }
                    </style>
                `,
                className: 'user-location-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            userLocationMarker = L.marker([lat, lng], { icon: userIcon });
            userLocationMarker.bindPopup(`
                <div class="p-2">
                    <h3 class="font-bold text-lg flex items-center">
                        <i class="fas fa-location-arrow text-blue-600 mr-2"></i>
                        您的位置
                    </h3>
                    <p class="text-sm text-gray-600 mb-1">
                        <i class="fas fa-map-marker-alt mr-1"></i>
                        緯度: ${lat.toFixed(6)}
                    </p>
                    <p class="text-sm text-gray-600 mb-1">
                        <i class="fas fa-map-marker-alt mr-1"></i>
                        經度: ${lng.toFixed(6)}
                    </p>
                    <p class="text-sm text-gray-500">
                        <i class="fas fa-bullseye mr-1"></i>
                        精度: 約 ${Math.round(accuracy)} 米
                    </p>
                </div>
            `);
            
            userLocationMarker.addTo(map);
            
            // 移動地圖到用戶位置
            map.setView([lat, lng], 15);
            
            // 3秒後自動打開彈出窗口
            setTimeout(() => {
                userLocationMarker.openPopup();
            }, 1000);
            
            // 尋找附近的設施
            findNearbyFacilities(lat, lng);
            
            showToast(`定位成功！精度約 ${Math.round(accuracy)} 米`, 'success', 3000);
        },
        (error) => {
            clearAllToasts(); // 清除載入中的toast
            let errorMsg = '定位失敗: ';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg += '您拒絕了位置權限請求';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg += '位置信息不可用';
                    break;
                case error.TIMEOUT:
                    errorMsg += '定位請求超時，請檢查網路連線';
                    break;
                default:
                    errorMsg += '未知錯誤';
            }
            
            showToast(errorMsg, 'error', 5000);
            console.error('定位錯誤:', error);
        },
        options
    );
}

// 尋找附近設施
function findNearbyFacilities(userLat, userLng, radiusKm = 5) {
    const nearbyFacilities = facilitiesData.filter(facility => {
        if (!facility.lat || !facility.lng) return false;
        
        const distance = calculateDistance(userLat, userLng, facility.lat, facility.lng);
        return distance <= radiusKm;
    });
    
    if (nearbyFacilities.length > 0) {
        // 按距離排序
        nearbyFacilities.sort((a, b) => {
            const distA = calculateDistance(userLat, userLng, a.lat, a.lng);
            const distB = calculateDistance(userLat, userLng, b.lat, b.lng);
            return distA - distB;
        });
        
        console.log(`找到 ${nearbyFacilities.length} 個附近設施`);
        
        // 顯示附近設施toast
        const closestDistance = calculateDistance(userLat, userLng, nearbyFacilities[0].lat, nearbyFacilities[0].lng);
        showToast(`找到 ${nearbyFacilities.length} 個附近設施，最近距離 ${closestDistance.toFixed(1)}km`, 'info', 4000);
        
        // 顯示附近設施資訊
        showNearbyFacilitiesInfo(nearbyFacilities, userLat, userLng);
    } else {
        showToast(`周圍 ${radiusKm}km 內沒有找到設施`, 'warning', 3000);
    }
}

// 計算兩點間距離（公里）
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 顯示附近設施信息
function showNearbyFacilitiesInfo(nearbyFacilities, userLat, userLng) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50 border-l-4 border-green-500';
    infoDiv.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <h4 class="font-bold text-sm flex items-center">
                <i class="fas fa-map-marker-alt text-green-500 mr-2"></i>
                附近設施 (${nearbyFacilities.length}個)
            </h4>
            <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="space-y-1 max-h-32 overflow-y-auto">
            ${nearbyFacilities.slice(0, 3).map(facility => {
                const distance = calculateDistance(userLat, userLng, facility.lat, facility.lng);
                return `
                    <div class="text-xs p-1 bg-gray-50 rounded cursor-pointer hover:bg-gray-100" 
                         onclick="focusOnFacilityFromNearby('${facility.name}')">
                        <div class="font-medium">${facility.name}</div>
                        <div class="text-gray-600">${facility.type} - ${distance.toFixed(1)}km</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.body.appendChild(infoDiv);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (infoDiv.parentNode) {
            infoDiv.remove();
        }
    }, 8000);
}

// 從附近設施點擊聚焦
function focusOnFacilityFromNearby(facilityName) {
    const facility = facilitiesData.find(f => f.name === facilityName);
    if (facility) {
        focusOnFacility(facility);
    }
}

// 顯示成功訊息
function showSuccessMessage(message) {
    showToast(message, 'success');
}

// Toast通知系統
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = getToastContainer();
    
    const toast = document.createElement('div');
    const typeConfig = {
        success: {
            bgColor: 'bg-green-500',
            icon: 'fas fa-check-circle',
            borderColor: 'border-green-600'
        },
        error: {
            bgColor: 'bg-red-500',
            icon: 'fas fa-exclamation-circle',
            borderColor: 'border-red-600'
        },
        info: {
            bgColor: 'bg-blue-500',
            icon: 'fas fa-info-circle',
            borderColor: 'border-blue-600'
        },
        warning: {
            bgColor: 'bg-yellow-500',
            icon: 'fas fa-exclamation-triangle',
            borderColor: 'border-yellow-600'
        }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    toast.className = `${config.bgColor} text-white px-4 py-3 rounded-lg shadow-lg mb-2 border-l-4 ${config.borderColor} transform transition-all duration-300 ease-in-out translate-x-full opacity-0`;
    toast.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <i class="${config.icon} mr-2"></i>
                <span class="text-sm font-medium">${message}</span>
            </div>
            <button onclick="removeToast(this.parentElement.parentElement)" class="ml-3 text-white hover:text-gray-200 focus:outline-none">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // 觸發動畫
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 10);
    
    // 自動移除
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }
    
    return toast;
}

// 獲取或創建toast容器
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 max-w-sm w-full';
        document.body.appendChild(container);
    }
    return container;
}

// 移除toast
function removeToast(toast) {
    if (toast && toast.parentNode) {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }
}

// 清除所有toast
function clearAllToasts() {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerHTML = '';
    }
}

// 創建自定義標記
function createCustomMarker(facility) {
    const config = facilityTypes[facility.type];
    if (!config) return null;
    
    // 創建自定義HTML標記
    const customIcon = L.divIcon({
        html: `
            <div style="
                background-color: ${config.color};
                border: 2px solid white;
                border-radius: 50%;
                width: 35px;
                height: 35px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <i class="${config.icon}" style="font-size: 14px;"></i>
            </div>
        `,
        className: 'custom-div-icon',
        iconSize: [35, 35],
        iconAnchor: [17.5, 17.5]
    });
    
    const marker = L.marker([facility.lat, facility.lng], { icon: customIcon });
    
    // 添加彈出窗口
    const googleMapsUrl = generateGoogleMapsUrl(facility.address, facility.lat, facility.lng);
    const typeIcon = config.icon;
    marker.bindPopup(`
        <div class="p-3 min-w-60">
            <h3 class="font-bold text-lg mb-2 flex items-center">
                <i class="${typeIcon}" style="color: ${config.color}; margin-right: 8px;"></i>
                ${facility.name}
            </h3>
            <p class="text-sm text-gray-600 mb-2 flex items-center">
                <i class="fas fa-tags mr-2 text-gray-500"></i>
                ${facility.type}
            </p>
            <p class="text-sm mb-2 flex items-center">
                <i class="fas fa-map-marker-alt mr-2 text-blue-500"></i>
                <a href="${googleMapsUrl}" target="_blank" 
                   class="text-blue-600 hover:text-blue-800 underline cursor-pointer flex-1"
                   title="在Google Maps中開啟">
                    ${facility.address}
                    <i class="fas fa-external-link-alt ml-1 text-xs"></i>
                </a>
            </p>
            <p class="text-sm font-medium flex items-center">
                <i class="fas fa-info-circle mr-2 text-green-500"></i>
                ${facility.note}
            </p>
        </div>
    `);
    
    return marker;
}

// 添加標記到地圖
function addMarkersToMap() {
    facilitiesData.forEach(facility => {
        const marker = createCustomMarker(facility);
        if (marker && markers[facility.type]) {
            markers[facility.type].addLayer(marker);
        }
    });
}

// 更新統計數據
function updateStats() {
    Object.keys(facilityTypes).forEach(type => {
        const facilities = facilitiesData.filter(f => f.type === type);
        const config = facilityTypes[type];
        
        // 更新數量
        document.getElementById(config.countElement).textContent = facilities.length;
        
        // 計算總數
        let total = 0;
        facilities.forEach(facility => {
            const noteText = facility.note;
            const numbers = noteText.match(/\d+/g);
            if (numbers) {
                total += parseInt(numbers[0]);
            }
        });
        document.getElementById(config.totalElement).textContent = total;
    });
}

// 更新表格
function updateTable(filter = 'all') {
    const tableBody = document.getElementById('facilities-table');
    tableBody.innerHTML = '';
    
    let filteredData = facilitiesData;
    if (filter !== 'all') {
        filteredData = facilitiesData.filter(f => f.type === filter);
    }
    
    filteredData.forEach(facility => {
        const googleMapsUrl = generateGoogleMapsUrl(facility.address, facility.lat, facility.lng);
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-4 py-2 font-medium">${facility.name}</td>
            <td class="px-4 py-2">
                <span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${facilityTypes[facility.type]?.color || '#gray'}"></span>
                ${facility.type}
            </td>
            <td class="px-4 py-2 text-sm">
                <a href="${googleMapsUrl}" target="_blank" 
                   class="text-blue-600 hover:text-blue-800 underline cursor-pointer flex items-center"
                   title="在Google Maps中開啟">
                    <i class="fas fa-map-marker-alt mr-2"></i>
                    ${facility.address}
                    <i class="fas fa-external-link-alt ml-2 text-xs"></i>
                </a>
            </td>
            <td class="px-4 py-2 text-sm font-medium">${facility.note}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 篩選功能
function filterFacilities(type) {
    currentFilter = type;
    
    // 如果正在搜索，清除搜索狀態
    if (isSearchActive) {
        isSearchActive = false;
        document.getElementById('search-results').classList.add('hidden');
    }
    
    // 更新儀表板卡片狀態
    updateDashboardCardStates(type);
    
    // 更新下拉選單狀態
    const tableFilter = document.getElementById('table-filter');
    if (tableFilter) {
        tableFilter.value = type;
    }
    
    // 顯示/隱藏標記
    Object.keys(markers).forEach(markerType => {
        if (type === 'all' || type === markerType) {
            map.addLayer(markers[markerType]);
        } else {
            map.removeLayer(markers[markerType]);
        }
    });
    
    // 更新表格
    updateTable(type === 'all' ? 'all' : type);
    
    // 顯示篩選toast
    const typeNames = {
        'all': '全部設施',
        '流動廁所': '流動廁所',
        '沐浴站': '沐浴站',
        '取水站': '取水站',
        '災區醫療站': '災區醫療站'
    };
    
    const typeName = typeNames[type] || type;
    const filteredCount = type === 'all' ? facilitiesData.length : facilitiesData.filter(f => f.type === type).length;
    
    showToast(`已篩選 ${typeName}，共 ${filteredCount} 個設施`, 'info', 2000);
}

// 切換篩選功能 (儀表板卡片)
function toggleFilter(type, cardClass) {
    if (currentFilter === type) {
        // 如果已經選中，則取消篩選，顯示全部
        filterFacilities('all');
    } else {
        // 否則篩選該類型
        filterFacilities(type);
    }
}

// 更新儀表板卡片狀態
function updateDashboardCardStates(type) {
    // 重置所有卡片
    document.querySelectorAll('.dashboard-card').forEach(card => {
        card.classList.remove('selected', 'toilets', 'showers', 'water');
    });
    
    // 設置選中的卡片
    if (type !== 'all') {
        const cardMap = {
            '流動廁所': { id: 'card-toilets', class: 'toilets' },
            '沐浴站': { id: 'card-showers', class: 'showers' },
            '取水站': { id: 'card-water', class: 'water' },
            '災區醫療站': { id: 'card-medical', class: 'medical' }
        };
        
        const cardInfo = cardMap[type];
        if (cardInfo) {
            const card = document.getElementById(cardInfo.id);
            if (card) {
                card.classList.add('selected', cardInfo.class);
            }
        }
    }
}


// 事件監聽器
function setupEventListeners() {
    // 儀表板卡片點擊事件
    document.getElementById('card-toilets').addEventListener('click', () => toggleFilter('流動廁所', 'toilets'));
    document.getElementById('card-showers').addEventListener('click', () => toggleFilter('沐浴站', 'showers'));
    document.getElementById('card-water').addEventListener('click', () => toggleFilter('取水站', 'water'));
    document.getElementById('card-medical').addEventListener('click', () => toggleFilter('災區醫療站', 'medical'));
    
    // 搜索功能
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.trim() === '') {
            clearSearch();
        } else {
            // 延遲搜索以避免過於頻繁的API調用
            clearTimeout(searchInput.searchTimeout);
            searchInput.searchTimeout = setTimeout(() => {
                searchFacilities(query);
            }, 300);
        }
    });
    
    // Enter鍵搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchInput.searchTimeout);
            searchFacilities(e.target.value);
        }
    });
    
    // 清除搜索按鈕
    document.getElementById('clear-search').addEventListener('click', () => {
        clearSearch();
    });
    
    // 定位按鈕
    document.getElementById('locate-user').addEventListener('click', () => {
        locateUser();
    });
    
    // 表格篩選下拉選單
    document.getElementById('table-filter').addEventListener('change', (e) => {
        const selectedFilter = e.target.value;
        
        // 如果正在搜索，先清除搜索
        if (isSearchActive) {
            clearSearch();
        }
        
        updateTable(selectedFilter);
        
        // 同步更新地圖篩選
        filterFacilities(selectedFilter);
    });
    
    // 地圖控制按鈕
    document.getElementById('zoom-in').addEventListener('click', () => {
        map.zoomIn();
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
        map.zoomOut();
    });
    
    // ESC鍵清除搜索
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isSearchActive) {
            clearSearch();
        }
    });
    
    // 詳細資料表格收合展開功能
    document.getElementById('toggle-table').addEventListener('click', () => {
        toggleTableVisibility();
    });
}

// 切換表格顯示/隱藏
function toggleTableVisibility() {
    const tableContent = document.getElementById('table-content');
    const tableControls = document.getElementById('table-controls');
    const toggleIcon = document.getElementById('toggle-icon');
    const isHidden = tableContent.classList.contains('hidden');
    
    if (isHidden) {
        // 展開
        tableContent.classList.remove('hidden');
        tableControls.classList.remove('hidden');
        toggleIcon.classList.remove('fa-chevron-down');
        toggleIcon.classList.add('fa-chevron-up');
        toggleIcon.style.transform = 'rotate(180deg)';
        showToast('設施詳細資料已展開', 'info', 1500);
    } else {
        // 收合
        tableContent.classList.add('hidden');
        tableControls.classList.add('hidden');
        toggleIcon.classList.remove('fa-chevron-up');
        toggleIcon.classList.add('fa-chevron-down');
        toggleIcon.style.transform = 'rotate(0deg)';
        showToast('設施詳細資料已收合', 'info', 1500);
    }
}

// 初始化應用
async function init() {
    try {
        initMap();
        setupEventListeners();
        
        // 載入KML數據
        await loadKMLData();
        
        // 添加標記到地圖
        addMarkersToMap();
        
        // 更新統計和表格
        updateStats();
        updateTable();
        
        // 設置默認篩選為全部顯示
        filterFacilities('all');
        
        console.log('應用初始化完成');
        
    } catch (error) {
        console.error('應用初始化失敗:', error);
        showErrorMessage('應用初始化失敗: ' + error.message);
    }
}

// 頁面加載完成後初始化
document.addEventListener('DOMContentLoaded', init);