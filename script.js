const LIFF_ID = '2008914307-JOMdlPxS';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxbFM-b7TCfw7Y5-d0as6BIGUQ42D4Qdq13QTLIKITuIVxjNRskaQZccdh_9UAuN0eULQ/exec';

// === 座標設定 ===
const OFFICE_LAT = 23.107699;
const OFFICE_LNG = 120.292136;
const ALLOWED_DISTANCE = 0.1; // 100公尺


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

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function main() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const now = new Date();
        const totalMinutes = now.getHours() * 60 + now.getMinutes();
        let timeStatus = "";

        if (totalMinutes >= 7 * 60 && totalMinutes <= 12 * 60) {
            timeStatus = (totalMinutes <= 9 * 60 + 5) ? "<span class='success'>☀️ 上午：出席狀態</span>" : "<span class='warning'>⚠️ 上午：遲到狀態</span>";
        } else if (totalMinutes > 12 * 60 && totalMinutes <= 23 * 60 + 59) {
            timeStatus = (totalMinutes <= 13 * 60 + 35) ? "<span class='success'>☕ 下午：出席狀態</span>" : "<span class='warning'>⚠️ 下午：遲到狀態</span>";
        } else {
            document.getElementById('icon').style.display = 'none';
            document.getElementById('status').innerHTML = "<span class='error'>❌ 非簽到時段</span><br>目前時間不在開放範圍內";
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const distance = getDistance(position.coords.latitude, position.coords.longitude, OFFICE_LAT, OFFICE_LNG);
            if (distance <= ALLOWED_DISTANCE) {
                document.getElementById('status').innerHTML = `位置驗證成功...<br>${timeStatus}`;
                submitCheckIn();
            } else {
                document.getElementById('icon').style.display = 'none';
                document.getElementById('status').innerHTML = `<span class="error">❌ 區域限制</span><br>您目前不在工作室範圍內`;
            }
        }, (err) => {
            document.getElementById('icon').style.display = 'none';
            document.getElementById('status').innerHTML = `<span class="error">❌ 無法取得位置</span><br>請開啟 GPS 權限`;
        }, { enableHighAccuracy: true });

    } catch (err) {
        document.getElementById('status').innerText = "初始化失敗: " + err;
    }
}

async function submitCheckIn() {
    const profile = await liff.getProfile();
    const token = generateToken();

    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
            userId: profile.userId,
            userName: profile.displayName,
            token: token
        })
    }).then(() => {
        document.getElementById('icon').style.display = 'none';
        document.getElementById('status').innerHTML = "<h2 style='color: #00B900;'>✅ 簽到資料已傳送</h2><p>系統將自動記錄您的出席狀態</p>";
        setTimeout(() => { liff.closeWindow(); }, 1800);
    });
}

main();
