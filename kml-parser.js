// KML解析器
class KMLParser {
    constructor() {
        this.facilitiesData = [];
    }

    // 解析KML文件
    async parseKMLFile(kmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            // 檢查解析錯誤
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('KML解析錯誤: ' + parseError.textContent);
            }

            this.facilitiesData = [];
            
            // 獲取所有文件夾
            const folders = xmlDoc.querySelectorAll('Folder');
            
            folders.forEach(folder => {
                const folderName = folder.querySelector('name')?.textContent?.trim();
                console.log('處理文件夾:', folderName);
                
                // 獲取文件夾中的所有地標
                const placemarks = folder.querySelectorAll('Placemark');
                
                placemarks.forEach(placemark => {
                    const facility = this.parsePlacemark(placemark, folderName);
                    if (facility) {
                        this.facilitiesData.push(facility);
                    }
                });
            });
            
            console.log('解析完成，共找到', this.facilitiesData.length, '個設施');
            return this.facilitiesData;
            
        } catch (error) {
            console.error('KML解析錯誤:', error);
            throw error;
        }
    }

    // 解析單個地標
    parsePlacemark(placemark, folderName) {
        try {
            const name = placemark.querySelector('name')?.textContent?.trim();
            const description = placemark.querySelector('description')?.textContent?.trim();
            const address = placemark.querySelector('address')?.textContent?.trim();
            
            // 獲取擴展數據
            const extendedData = placemark.querySelector('ExtendedData');
            let category = folderName;
            let note = '';
            let addressData = address;
            
            if (extendedData) {
                const dataElements = extendedData.querySelectorAll('Data');
                dataElements.forEach(data => {
                    const dataName = data.getAttribute('name');
                    const value = data.querySelector('value')?.textContent?.trim();
                    
                    switch (dataName) {
                        case '類別':
                            category = value;
                            break;
                        case '備註':
                            note = value;
                            break;
                        case '地址或google座標':
                            addressData = value;
                            break;
                    }
                });
            }

            // 獲取座標
            const coordinates = this.parseCoordinates(placemark, addressData);
            
            if (!coordinates) {
                console.warn('無法獲取座標:', name);
                return null;
            }

            return {
                name: name || '未命名',
                type: this.normalizeCategory(category),
                address: addressData || address || '',
                note: note || '',
                lat: coordinates.lat,
                lng: coordinates.lng,
                description: description || ''
            };
            
        } catch (error) {
            console.error('解析地標錯誤:', error);
            return null;
        }
    }

    // 解析座標
    parseCoordinates(placemark, addressData) {
        // 先嘗試從Point元素獲取座標
        const point = placemark.querySelector('Point coordinates');
        if (point) {
            const coordText = point.textContent.trim();
            const coords = coordText.split(',');
            if (coords.length >= 2) {
                return {
                    lat: parseFloat(coords[1]),
                    lng: parseFloat(coords[0])
                };
            }
        }

        // 嘗試從地址LINK數據獲取座標
        if (addressData && addressData.includes(',')) {
            const coordMatch = addressData.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
            if (coordMatch) {
                return {
                    lat: parseFloat(coordMatch[1]),
                    lng: parseFloat(coordMatch[2])
                };
            }
        }

        // 嘗試從描述中提取座標
        const description = placemark.querySelector('description')?.textContent;
        if (description) {
            const coordMatch = description.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
            if (coordMatch) {
                return {
                    lat: parseFloat(coordMatch[1]),
                    lng: parseFloat(coordMatch[2])
                };
            }
        }

        return null;
    }

    // 標準化類別名稱
    normalizeCategory(category) {
        if (!category) return '未分類';
        
        // 處理不同的類別名稱變體
        if (category.includes('流動廁所') || category.includes('廁所')) {
            return '流動廁所';
        }
        if (category.includes('沐浴站') || category.includes('沐浴')) {
            return '沐浴站';
        }
        if (category.includes('取水站') || category.includes('加水站') || category.includes('自來水')) {
            return '取水站';
        }
        
        return category;
    }

    // 獲取解析後的數據
    getFacilitiesData() {
        return this.facilitiesData;
    }

    // 按類型獲取統計數據
    getStatsByType() {
        const stats = {};
        
        this.facilitiesData.forEach(facility => {
            const type = facility.type;
            if (!stats[type]) {
                stats[type] = {
                    count: 0,
                    total: 0
                };
            }
            
            stats[type].count++;
            
            // 從備註中提取數量
            const noteText = facility.note;
            const numbers = noteText.match(/\d+/g);
            if (numbers) {
                stats[type].total += parseInt(numbers[0]);
            }
        });
        
        return stats;
    }
}

// 導出解析器類
window.KMLParser = KMLParser;