// === 設定區 ===
const LIFF_ID = '2008914307-JOMdlPxS';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxv_c6BlfzbApgYkvnvinMAAUOkw1YHVKSNKyP5KTnGONCcWcbA2-KBMLX6E05KdauRzg/exec';

const OFFICE_LAT = 23.107699; // 工作室緯度
const OFFICE_LNG = 120.292136; // 工作室經度
const ALLOWED_DISTANCE = 0.1; // 允許距離 (公里)，0.1 = 100公尺

// === 1. 初始化與主流程 ===
async function main() {
    const statusEl = document.getElementById('status');
    const iconEl = document.getElementById('icon');

    try {
        // LIFF 初始化
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        // 時間檢查
        const now = new Date();
        const hour = now.getHours();
        const min = now.getMinutes();
        const totalMinutes = hour * 60 + min;
        let timeStatusHtml = "";

        // 判定時段 (與後端邏輯一致)
        if (totalMinutes >= 7 * 60 && totalMinutes <= 12 * 60) {
            const isLate = totalMinutes > 9 * 60 + 5;
            timeStatusHtml = isLate ? 
                "<span style='color:#e67e22;'>⚠️ 上午：遲到狀態</span>" : 
                "<span style='color:#27ae60;'>☀️ 上午：出席狀態</span>";
        } else if (totalMinutes > 12 * 60 && totalMinutes <= 23 * 60 + 59) {
            const isLate = totalMinutes > 13 * 60 + 35;
            timeStatusHtml = isLate ? 
                "<span style='color:#e67e22;'>⚠️ 下午：遲到狀態</span>" : 
                "<span style='color:#27ae60;'>☕ 下午：出席狀態</span>";
        } else {
            iconEl.style.display = 'none';
            statusEl.innerHTML = "<b style='color:#e74c3c;'>❌ 非簽到時段</b><br>目前不在開放時間內";
            return;
        }

        // 地理位置檢查
        statusEl.innerHTML = "正在獲取 GPS 位置...";
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const distance = getDistance(
                    position.coords.latitude, 
                    position.coords.longitude, 
                    OFFICE_LAT, 
                    OFFICE_LNG
                );

                if (distance <= ALLOWED_DISTANCE) {
                    statusEl.innerHTML = `位置驗證成功<br>${timeStatusHtml}<br><br><b>正在連線中...</b>`;
                    submitCheckIn(); // 執行簽到
                } else {
                    iconEl.style.display = 'none';
                    statusEl.innerHTML = `
                        <b style='color:#e74c3c;'>❌ 區域限制</b><br>
                        您目前不在工作室範圍內<br>
                        <small>(距離: ${(distance * 1000).toFixed(0)}公尺)</small>
                    `;
                }
            }, 
            (err) => {
                iconEl.style.display = 'none';
                statusEl.innerHTML = "<b style='color:#e74c3c;'>❌ 無法取得位置</b><br>請開啟 GPS 權限並重新整理";
            }, 
            { enableHighAccuracy: true, timeout: 10000 }
        );

    } catch (err) {
        statusEl.innerText = "初始化失敗: " + err;
    }
}

// === 2. 傳送資料到 GAS ===
async function submitCheckIn() {
    const statusEl = document.getElementById('status');
    const iconEl = document.getElementById('icon');
    
    try {
        const profile = await liff.getProfile();
        const token = generateToken();

        // 顯示排隊提示
        statusEl.innerHTML += "<div class='loader'></div><p style='font-size:0.8em; color:gray;'>伺服器處理中，請稍候...</p>";

        // 設定 25 秒超時限制 (因為 GAS 鎖定最長等待 30 秒)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // 使用 no-cors 模式發送
            body: JSON.stringify({
                userId: profile.userId,
                userName: profile.displayName,
                token: token
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 成功顯示
        iconEl.style.display = 'none';
        statusEl.innerHTML = `
            <h2 style="color: #27ae60;">✅ 簽到完成</h2>
            <p>系統已接收您的請求</p>
            <p style="font-size:0.9em; color:#7f8c8d;">視窗即將自動關閉</p>
        `;

        // 成功後停留 2.5 秒關閉
        setTimeout(() => { liff.closeWindow(); }, 2500);

    } catch (err) {
        iconEl.style.display = 'none';
        if (err.name === 'AbortError') {
            statusEl.innerHTML = "<b style='color:#e74c3c;'>❌ 伺服器回應逾時</b><br>可能因同時簽到人數過多，請稍後重試。";
        } else {
            statusEl.innerHTML = "<b style='color:#e74c3c;'>❌ 傳送失敗</b><br>網路連線異常，請檢查網路。";
        }
    }
}

// === 輔助函式：計算距離 ===
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半徑 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// === 輔助函式：產生驗證 Token ===
function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const makeRandom = (len) => Array.from({ length: len }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const timeStr = mm + dd + hh;

    return makeRandom(20) + timeStr + makeRandom(24);
}

// 啟動程式
main();
