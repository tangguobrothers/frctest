// api/checkin.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const sql = neon(process.env.DATABASE_URL);
  const data = JSON.parse(req.body);
  const { userId, userName, type, token } = data;

  // 1. 安全驗證 (模擬原本 validateToken)
  const lineIdPattern = /^U[0-9a-f]{32}$/;
  if (!lineIdPattern.test(userId)) return res.status(400).send("Identity Verification Failed");

  try {
    const now = new Date();
    // 換日邏輯 (05:00 分界)
    const logDate = new Date(now);
    if (now.getHours() < 5) logDate.setDate(now.getDate() - 1);
    
    const dateKey = logDate.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
    const timeStr = now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    const hhmm = now.getHours() * 100 + now.getMinutes();

    if (type === "IN" && (hhmm >= 500 && hhmm < 600)) {
        return res.status(200).send("系統結算中 (05:00-06:00)");
    }

    // 2. 寫入資料庫 (維持類似 Sheets 的橫向格式需要設計 Table)
    // 建議 Table 結構：user_id, user_name, log_date, check_in_time, check_out_time, status
    await sql`
      INSERT INTO checkins (user_id, user_name, log_date, ${type === 'IN' ? sql`check_in` : sql`check_out` })
      VALUES (${userId}, ${userName}, ${dateKey}, ${timeStr})
      ON CONFLICT (user_id, log_date) 
      DO UPDATE SET ${type === 'IN' ? sql`check_in` : sql`check_out` } = ${timeStr};
    `;

    return res.status(200).send("Success");
  } catch (err) {
    return res.status(500).send("System Error: " + err.message);
  }
}
