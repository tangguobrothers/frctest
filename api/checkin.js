import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // 檢查 req.body 是否已經是物件，如果不是才解析
  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { userId, userName, type, token } = data;

  if (!userId || !type) {
    return res.status(400).send("Bad Request: Missing required fields");
  }

  const sql = neon(process.env.DATABASE_URL);
  const { userId, userName, type, token } = JSON.parse(req.body);

  // 1. 驗證 LINE ID 格式
  const lineIdPattern = /^U[0-9a-f]{32}$/;
  if (!lineIdPattern.test(userId)) return res.status(400).send("Identity Verification Failed");

  try {
    const now = new Date();
    // 轉為台灣時間
    const taipeiTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
    
    // 換日邏輯 (早上 5 點為分界)
    const logDate = new Date(taipeiTime);
    if (taipeiTime.getHours() < 5) logDate.setDate(taipeiTime.getDate() - 1);
    
    const dateKey = logDate.toISOString().split('T')[0]; // yyyy-mm-dd
    const timeStr = taipeiTime.toTimeString().split(' ')[0]; // HH:mm:ss
    const hhmm = taipeiTime.getHours() * 100 + taipeiTime.getMinutes();

    // 系統結算限制
    if (type === "IN" && (hhmm >= 500 && hhmm < 600)) {
      return res.status(200).send("系統結算中 (05:00-06:00)");
    }

    // 計算狀態 (遲到判定)
    let status = "完成";
    if (type === "IN") {
      if ((hhmm > 905 && hhmm < 1200) || (hhmm > 1335 && hhmm < 2359)) status = "遲到";
    }

    // 寫入資料庫：如果當天已有紀錄則更新，沒有則新增 (Upsert)
    // 欄位對應：user_id, user_name, log_date, check_in_time, check_out_time, status
    if (type === "IN") {
      // 簽到逻辑：已有資料則不覆寫，除非是全新的
      await sql`
        INSERT INTO checkins (user_id, user_name, log_date, check_in_time, status)
        VALUES (${userId}, ${userName}, ${dateKey}, ${timeStr}, ${status})
        ON CONFLICT (user_id, log_date) DO NOTHING;
      `;
    } else {
      // 簽退逻辑：直接更新 check_out_time
      await sql`
        UPDATE checkins 
        SET check_out_time = ${timeStr}
        WHERE user_id = ${userId} AND log_date = ${dateKey};
      `;
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error(err);
    return res.status(500).send("System Error: " + err.message);
  }
}
