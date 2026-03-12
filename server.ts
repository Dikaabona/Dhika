import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/api/test", (req, res) => {
  res.send("🚀 API Server HR Visibel is ONLINE!");
});

// Initialize Supabase safely
let supabase: any;
try {
  // Use environment variables if available, otherwise fallback to hardcoded keys
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
  // Using service_role key for backend operations to bypass RLS
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';
  
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log("Supabase initialized successfully with service_role");
} catch (err) {
  console.error("Error initializing Supabase:", err);
}

// Global variable to store recent logs (in-memory for debugging)
let wahaLogs: any[] = [];
function addWahaLog(type: string, data: any) {
  wahaLogs.unshift({
    timestamp: new Date().toISOString(),
    type,
    data
  });
  if (wahaLogs.length > 50) wahaLogs.pop();
}

// Helper to get WAHA settings for a company
async function getWahaSettings(company: string) {
  // First check environment variables (as default/global)
  const envUrl = process.env.WAHA_API_URL;
  const envKey = process.env.WAHA_API_KEY;
  const envSession = process.env.WAHA_SESSION_NAME || 'default';

  if (envUrl) {
    let apiUrl = envUrl;
    if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    return { apiUrl, apiKey: envKey, sessionName: envSession };
  }

  // Otherwise fetch from Supabase
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `waha_settings_${company}`)
      .single();
    
    if (data && data.value) {
      const settings = data.value as { apiUrl: string; apiKey: string; sessionName: string };
      let apiUrl = settings.apiUrl;
      if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      return { ...settings, apiUrl };
    }
  } catch (err) {
    // Fallback to default if no company settings
  }

  return null;
}

// Helper to send WAHA message
async function sendWahaMessage(to: string, message: string, company: string = 'Visibel') {
  const settings = await getWahaSettings(company);

  if (!settings || !settings.apiUrl) {
    console.warn(`WAHA not configured for company: ${company}`);
    return;
  }

  const { apiUrl, apiKey, sessionName } = settings;

  // Format number: remove +, ensure it ends with @c.us
  let chatId = to.replace(/\+/g, '').replace(/\s/g, '');
  if (!chatId.includes('@')) {
    chatId = `${chatId}@c.us`;
  }

  try {
    await axios.post(`${apiUrl}/api/sendText`, {
      chatId,
      text: message,
      session: sessionName
    }, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log(`WAHA message sent to ${chatId} (${company})`);
  } catch (err: any) {
    console.error(`Error sending WAHA message (${company}):`, err.response?.data || err.message);
  }
}

// WAHA Webhook Endpoint
app.all("/api/webhook/waha", async (req, res) => {
  // Log every request that hits this endpoint
  addWahaLog('WEBHOOK_HIT', { 
    method: req.method,
    url: req.originalUrl,
    body: req.body
  });

  if (req.method === 'GET') {
    return res.send("✅ Webhook endpoint is ACTIVE and reachable. Please use POST for actual WAHA data.");
  }

  const { event, payload } = req.body;
  console.log(`[WAHA Webhook] Event: ${event}`);

  if (event === 'message.upsert' || event === 'message') {
    const message = payload.body || payload.content || payload.text;
    const from = payload.from || payload.chatId; // e.g. 628123456789@c.us
    
    if (!message || !from) {
      console.warn("[WAHA Webhook] Missing message body or sender info", payload);
      return res.status(200).json({ status: "ignored_missing_data" });
    }

    // --- RESTRICTION: Only reply to employees in database ---
    const phoneDigits = from.split('@')[0].replace(/\D/g, '');
    const last10 = phoneDigits.slice(-10);
    
    const { data: emps, error: empError } = await supabase.from('employees').select('*');
    if (empError) {
      console.error("[WAHA Webhook] Supabase error fetching employees:", empError);
      return res.status(200).json({ status: "error" });
    }

    const emp = emps?.find((e: any) => (e.noHandphone || '').replace(/\D/g, '').endsWith(last10));

    if (!emp) {
      console.log(`[WAHA Webhook] Ignoring message from non-employee: ${from}`);
      addWahaLog('UNAUTHORIZED_ACCESS', { from, last10 });
      // We don't reply at all to non-employees as requested
      return res.status(200).json({ status: "ignored_unauthorized" });
    }
    // -------------------------------------------------------

    console.log(`[WAHA Webhook] Message from ${emp.nama} (${from}): ${message}`);
    const lowerMsg = message.toLowerCase().trim();

    if (lowerMsg === '!menu' || lowerMsg === '!help' || lowerMsg === 'p' || lowerMsg === 'halo') {
      const menu = `🤖 *VISIBEL HR BOT MENU* 🤖\n\nHalo ${emp.nama},\n\nBerikut adalah perintah yang bisa Anda gunakan:\n\n` +
        `1️⃣ *!jadwal* - Cek jadwal shift Anda hari ini\n` +
        `2️⃣ *!konten* - Cek jadwal posting konten Anda hari ini\n` +
        `3️⃣ *!absen* - Cek status absensi Anda hari ini\n` +
        `4️⃣ *!layanan* - Info layanan Visibel Agency\n` +
        `5️⃣ *!live* - Jadwal live streaming Visibel\n` +
        `6️⃣ *!libur* - Cek siapa saja yang libur hari ini\n` +
        `7️⃣ *!menu* - Menampilkan menu ini\n\n` +
        `Silakan ketik perintah di atas untuk mendapatkan informasi.`;
      await sendWahaMessage(from, menu, emp.company);
      return res.status(200).json({ status: "received" });
    }

    if (lowerMsg === '!libur') {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Get all employees
      const { data: allEmployees, error: empErr } = await supabase.from('employees').select('id, nama').eq('company', emp.company);
      if (empErr) {
        await sendWahaMessage(from, "Terjadi kesalahan saat mengambil data karyawan.", emp.company);
        return res.status(200).json({ status: "error" });
      }

      // 2. Get all shift assignments for today
      const { data: assignments, error: assignErr } = await supabase
        .from('shift_assignments')
        .select('employeeId, shiftId')
        .eq('date', today)
        .eq('company', emp.company);
      
      if (assignErr) {
        await sendWahaMessage(from, "Terjadi kesalahan saat mengambil data jadwal.", emp.company);
        return res.status(200).json({ status: "error" });
      }

      // 3. Identify who is off
      // An employee is off if they have NO assignment OR their assignment is an "Off" shift (if we can identify it)
      // For now, let's assume no assignment = off
      const assignedEmpIds = new Set(assignments?.map((a: any) => a.employeeId) || []);
      const offEmployees = allEmployees?.filter((e: any) => !assignedEmpIds.has(e.id)) || [];

      let reply = `🏖️ *KARYAWAN LIBUR HARI INI* 🏖️\n\nTanggal: ${today}\n\n`;
      if (offEmployees.length > 0) {
        offEmployees.forEach((e: any, index: number) => {
          reply += `${index + 1}. ${e.nama}\n`;
        });
      } else {
        reply += `Semua karyawan memiliki jadwal hari ini.`;
      }

      await sendWahaMessage(from, reply, emp.company);
      return res.status(200).json({ status: "received" });
    }

    if (lowerMsg === '!layanan') {
      const reply = "Visibel menyediakan:\n• Live Streaming\n• Short Video\n• TikTok Ads\n• Social Media Management";
      await sendWahaMessage(from, reply, emp.company);
      return res.status(200).json({ status: "received" });
    }

    if (lowerMsg === '!live') {
      const reply = "Jadwal live Visibel minggu ini:\nSenin - Jumat\n19.00 - 23.00 WIB";
      await sendWahaMessage(from, reply, emp.company);
      return res.status(200).json({ status: "received" });
    }

    if (lowerMsg === '!jadwal' || lowerMsg === '!konten' || lowerMsg === '!absen') {
      addWahaLog('EMPLOYEE_COMMAND', { name: emp.nama, command: lowerMsg });
      const today = new Date().toISOString().split('T')[0];
      
      if (lowerMsg === '!jadwal') {
        const { data: shiftAssignments, error: shiftError } = await supabase
          .from('shift_assignments')
          .select('*, shifts(*)')
          .eq('employeeId', emp.id)
          .eq('date', today);

        if (shiftError) {
          console.error("[WAHA Webhook] Error fetching shifts:", shiftError);
          await sendWahaMessage(from, "Maaf, terjadi kesalahan saat mengambil jadwal shift Anda.", emp.company);
          return res.status(200).json({ status: "error" });
        }

        if (shiftAssignments && shiftAssignments.length > 0) {
          let reply = `📅 *JADWAL SHIFT HARI INI* 📅\n\nHalo ${emp.nama},\n\n`;
          shiftAssignments.forEach((a: any) => {
            const shiftName = a.shifts?.name || 'Shift Tidak Diketahui';
            const startTime = a.shifts?.startTime || '-';
            const endTime = a.shifts?.endTime || '-';
            reply += `🔹 *${shiftName}*\n⏰ ${startTime} - ${endTime}\n`;
          });
          await sendWahaMessage(from, reply, emp.company);
        } else {
          await sendWahaMessage(from, `Halo ${emp.nama}, Anda tidak memiliki jadwal shift hari ini (${today}).`, emp.company);
        }
      } 
      else if (lowerMsg === '!konten') {
        const { data: contentPlans, error: contentError } = await supabase
          .from('content_plans')
          .select('*')
          .eq('creatorId', emp.id)
          .eq('postingDate', today);

        if (contentError) {
          console.error("[WAHA Webhook] Error fetching content plans:", contentError);
          await sendWahaMessage(from, "Maaf, terjadi kesalahan saat mengambil jadwal konten Anda.", emp.company);
          return res.status(200).json({ status: "error" });
        }

        if (contentPlans && contentPlans.length > 0) {
          let reply = `🎬 *JADWAL KONTEN HARI INI* 📅\n\nHalo ${emp.nama},\n\n`;
          contentPlans.forEach((p: any) => {
            reply += `📌 *${p.title}*\n📱 Platform: ${p.platform}\n⏰ Jam: ${p.jamUpload || '-'}\n\n`;
          });
          await sendWahaMessage(from, reply, emp.company);
        } else {
          await sendWahaMessage(from, `Halo ${emp.nama}, Anda tidak memiliki jadwal posting konten hari ini (${today}).`, emp.company);
        }
      }
      else if (lowerMsg === '!absen') {
        const { data: attendance, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .eq('employeeId', emp.id)
          .eq('date', today)
          .maybeSingle();

        if (attError) {
          console.error("[WAHA Webhook] Error fetching attendance:", attError);
          await sendWahaMessage(from, "Maaf, terjadi kesalahan saat mengambil data absensi Anda.", emp.company);
          return res.status(200).json({ status: "error" });
        }

        if (attendance) {
          const reply = `✅ *STATUS ABSENSI HARI INI* ✅\n\nHalo ${emp.nama},\n\n` +
            `📍 Status: ${attendance.status}\n` +
            `🕒 Masuk: ${attendance.clockIn || '-'}\n` +
            `🕒 Pulang: ${attendance.clockOut || '-'}\n` +
            `📝 Catatan: ${attendance.notes || '-'}`;
          await sendWahaMessage(from, reply, emp.company);
        } else {
          await sendWahaMessage(from, `Halo ${emp.nama}, Anda belum melakukan absensi hari ini (${today}). Jangan lupa absen ya!`, emp.company);
        }
      }
    } else {
      // Fallback for debugging: if message is received but no command matched
      console.log(`[WAHA Webhook] No command matched for: ${lowerMsg}`);
      if (lowerMsg.startsWith('!')) {
        await sendWahaMessage(from, "Perintah tidak dikenal. Ketik !menu untuk melihat daftar perintah.");
      }
    }
  }

  res.status(200).json({ status: "received" });
});

// API to test WAHA connection from backend (to avoid CORS)
app.post("/api/waha/test", async (req, res) => {
  const { apiUrl, apiKey } = req.body;
  
  if (!apiUrl) return res.status(400).json({ error: "URL is required" });

  try {
    const response = await axios.get(`${apiUrl}/api/sessions`, {
      headers: { 'X-Api-Key': apiKey }
    });
    res.status(200).json({ status: "ok", data: response.data });
  } catch (err: any) {
    console.error("WAHA Test Error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

// API to manually send weekly schedule to a phone number
app.get("/api/waha/send-weekly-schedule", async (req, res) => {
  const phone = req.query.phone as string;
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  try {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const { data: emps } = await supabase.from('employees').select('*');
    const emp = emps?.find((e: any) => (e.noHandphone || '').replace(/\D/g, '').endsWith(last10));

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    // Use Asia/Jakarta for consistency
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const dateMap: any = {};
    parts.forEach(p => dateMap[p.type] = p.value);
    const todayStr = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(nextWeek);
    const nwMap: any = {};
    nextWeekParts.forEach(p => nwMap[p.type] = p.value);
    const nextWeekStr = `${nwMap.year}-${nwMap.month}-${nwMap.day}`;

    // Fetch assignments and shifts separately to avoid relationship error
    const { data: assignments, error: shiftError } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('employeeId', emp.id)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true });

    if (shiftError) throw shiftError;

    console.log(`[WAHA API] Found ${assignments?.length || 0} assignments for ${emp.nama} between ${todayStr} and ${nextWeekStr}`);

    const { data: allShifts } = await supabase.from('shifts').select('*');

    let reply = `📅 *JADWAL SHIFT 1 MINGGU KE DEPAN* 📅\n\nHalo ${emp.nama},\n\n`;
    if (assignments && assignments.length > 0) {
      assignments.forEach((s: any) => {
        const dateStr = new Date(s.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        const shift = allShifts?.find((sh: any) => sh.id === s.shiftId);
        const shiftName = shift?.name || 'Off';
        const time = shift ? `${shift.startTime} - ${shift.endTime}` : 'Libur';
        reply += `🔹 *${dateStr}*\n   ${shiftName} (${time})\n\n`;
      });
    } else {
      reply += `Maaf, belum ada jadwal shift yang terinput untuk 1 minggu ke depan (${todayStr} s/d ${nextWeekStr}).`;
    }

    await sendWahaMessage(phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`, reply, emp.company);
    res.json({ status: "ok", message: "Schedule sent", reply });
  } catch (err: any) {
    console.error("[WAHA API] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// API to check WAHA configuration status
app.get("/api/waha/status", async (req, res) => {
  const company = (req.query.company as string) || 'Visibel';
  const settings = await getWahaSettings(company);
  
  res.json({
    configured: !!settings?.apiUrl,
    apiUrl: settings?.apiUrl ? `${settings.apiUrl.substring(0, 15)}...` : null,
    hasApiKey: !!settings?.apiKey,
    sessionName: settings?.sessionName || 'not set',
    webhookUrl: `${process.env.APP_URL || 'https://' + req.get('host')}/api/webhook/waha`
  });
});

// API to view WAHA logs
app.get("/api/waha/logs", (req, res) => {
  res.json(wahaLogs);
});

// API to automatically register webhook in WAHA
app.get("/api/waha/setup-webhook", async (req, res) => {
  const company = (req.query.company as string) || 'Visibel';
  const settings = await getWahaSettings(company);
  
  if (!settings?.apiUrl) return res.status(400).json({ error: "WAHA not configured yet" });

  const webhookUrl = `${process.env.APP_URL || 'https://' + req.get('host')}/api/webhook/waha`;

  try {
    // WAHA API to create/update webhook
    // Documentation: https://waha.dev/docs/how-to/webhooks/
    const response = await axios.post(`${settings.apiUrl}/api/webhooks`, {
      url: webhookUrl,
      events: ["message", "message.upsert"],
      enabled: true,
      session: settings.sessionName || "default"
    }, {
      headers: { 'X-Api-Key': settings.apiKey }
    });

    res.json({ 
      status: "success", 
      message: "Webhook berhasil didaftarkan otomatis ke server WAHA!",
      data: response.data 
    });
  } catch (err: any) {
    console.error("WAHA Setup Error:", err.response?.data || err.message);
    res.status(500).json({ 
      status: "error", 
      message: "Gagal mendaftarkan webhook otomatis. Silakan lakukan manual di dashboard WAHA.",
      error: err.response?.data || err.message 
    });
  }
});

// API to manually test sending a message
app.get("/api/waha/send-test", async (req, res) => {
  const to = req.query.to as string;
  const msg = (req.query.msg as string) || "Tes pesan dari sistem HR Visibel";
  const company = (req.query.company as string) || 'Visibel';

  if (!to) return res.status(400).json({ error: "Parameter 'to' (nomor HP) diperlukan. Contoh: ?to=628123456789" });

  try {
    await sendWahaMessage(to, msg, company);
    res.json({ status: "success", message: `Pesan sedang dikirim ke ${to}` });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Cron Job for Reminders (Runs every 15 minutes)
// Initialize Resend lazily to avoid crashes on startup and better handle serverless environments
let resendClient: Resend | null = null;

function getResendClient() {
  if (resendClient) return resendClient;
  
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not found in environment variables");
    return null;
  }

  try {
    resendClient = new Resend(apiKey);
    console.log("Resend client initialized");
    return resendClient;
  } catch (e) {
    console.error("Error initializing Resend:", e);
    return null;
  }
}

// API Route to send email
app.post("/api/send-email", async (req, res) => {
  const { to, subject, html, from, attachments } = req.body;
  console.log(`API Request: Send email to ${to}`);

  const resend = getResendClient();
  if (!resend) {
    const msg = "Email service not configured. Please ensure RESEND_API_KEY is set in environment variables.";
    console.error(msg);
    return res.status(500).json({ error: msg });
  }

  try {
    let processedAttachments: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      processedAttachments = attachments.map((att: any) => {
        const contentBuffer = typeof att.content === 'string' 
          ? Buffer.from(att.content, 'base64') 
          : att.content;

        return {
          filename: att.filename || 'attachment.png',
          content: contentBuffer,
          contentType: att.contentType,
          contentId: att.cid || att.contentId
        };
      });
    }

    const { data, error } = await resend.emails.send({
      from: from || "admin@visibel.agency",
      to: [to],
      subject: subject,
      html: html,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return res.status(400).json(error);
    }

    res.status(200).json(data);
  } catch (err: any) {
    console.error("Server Error sending email:", err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to check assignments
app.get("/api/debug/inspect-assignments", async (req, res) => {
  const phone = req.query.phone as string;
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  try {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const { data: emps } = await supabase.from('employees').select('*');
    const emp = emps?.find((e: any) => (e.noHandphone || '').replace(/\D/g, '').endsWith(last10));

    if (!emp) return res.status(404).json({ error: "Employee not found", last10 });

    const { data: allAssignments } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('employeeId', emp.id);

    res.json({
      emp: { id: emp.id, nama: emp.nama, noHandphone: emp.noHandphone },
      assignmentCount: allAssignments?.length || 0,
      allAssignments: allAssignments?.slice(0, 20), // Show first 20
      serverTime: new Date().toISOString(),
      jakartaTime: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;
  // In Vercel, we don't need to serve static files from Express as Vercel handles it
  // and we definitely don't want to start Vite.
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production" || isVercel;

  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode (Vercel: ${isVercel})...`);

  if (!isProd) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.includes('.')) return next();
        
        try {
          let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (err) {
      console.error("Vite initialization failed, falling back to static:", err);
    }
  } else if (!isVercel) {
    // Only serve static files if we are in a traditional production environment (not Vercel)
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  // Start listening only if not in Vercel
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

// --- SCHEDULED NOTIFICATIONS ---
async function checkAndSendNotifications() {
  // Use Asia/Jakarta (WIB) for comparison as the app is for Indonesian context
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const dateMap: any = {};
  parts.forEach(p => dateMap[p.type] = p.value);
  
  const today = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;
  const currentHour = parseInt(dateMap.hour);
  const currentMin = parseInt(dateMap.minute);
  
  console.log(`[Cron] Checking notifications for WIB: ${today} ${dateMap.hour}:${dateMap.minute}`);

  try {
    // Fetch data separately to avoid relationship errors
    const { data: assignments, error: assignError } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('date', today);

    if (assignError) throw assignError;

    const { data: emps } = await supabase.from('employees').select('*');
    const { data: allShifts } = await supabase.from('shifts').select('*');

    console.log(`[Cron] Found ${assignments?.length || 0} assignments today`);

    for (const assign of assignments || []) {
      const emp = emps?.find((e: any) => e.id === assign.employeeId);
      const shift = allShifts?.find((s: any) => s.id === assign.shiftId);
      
      if (!emp || !shift || !emp.noHandphone) continue;

      const shiftStart = shift.startTime; // HH:mm
      if (!shiftStart) continue;
      
      const [sHour, sMin] = shiftStart.split(':').map(Number);
      
      // Calculate difference in minutes
      const nowTotalMins = (currentHour * 60) + currentMin;
      const shiftTotalMins = (sHour * 60) + sMin;
      const diffMinutes = shiftTotalMins - nowTotalMins;

      // A. Absen Reminder (15 mins before shift start)
      // Only for non-off shifts
      const isOff = shift.name.toLowerCase().includes('off') || shift.name.toLowerCase().includes('libur');
      if (diffMinutes === 15 && !isOff) {
        // Check if already clocked in
        const { data: att } = await supabase
          .from('attendance')
          .select('*')
          .eq('employeeId', emp.id)
          .eq('date', today)
          .maybeSingle();

        if (!att || !att.clockIn) {
          await sendWahaMessage(emp.noHandphone, `⏰ *PENGINGAT ABSEN* ⏰\n\nHalo ${emp.nama}, shift *${shift.name}* Anda akan dimulai dalam 15 menit (${shiftStart}). Jangan lupa untuk melakukan absensi ya!`, emp.company);
        }
      }

      // B. Live Streaming & Studio Prep
      if (shift.name.toLowerCase().includes('live')) {
        const jab = (emp.jabatan || '').toLowerCase();
        
        // Studio Prep (30 mins before) - ONLY for Operator
        if (diffMinutes === 30 && jab.includes('operator')) {
          await sendWahaMessage(emp.noHandphone, `🎙️ *PERSIAPAN STUDIO* 🎙️\n\nHalo ${emp.nama}, jadwal Live Streaming akan dimulai dalam 30 menit. Sebagai Operator, silakan mulai persiapkan studio dan peralatan.`, emp.company);
        }
        
        // Live Starting (5 mins before) - ONLY for Host Livestreaming
        if (diffMinutes === 5 && jab.includes('host livestreaming')) {
          await sendWahaMessage(emp.noHandphone, `🚀 *LIVE SEGERA DIMULAI* 🚀\n\nHalo ${emp.nama}, Live Streaming Anda akan dimulai dalam 5 menit (${shiftStart}). Sebagai Host, pastikan semuanya sudah siap!`, emp.company);
        }
      }
    }

    // 2. Fetch Content Plans for today
    const { data: contents, error: contentError } = await supabase
      .from('content_plans')
      .select('*')
      .eq('postingDate', today);

    if (contentError) throw contentError;

    for (const content of contents || []) {
      const emp = emps?.find((e: any) => e.id === content.creatorId);
      if (!emp || !emp.noHandphone || !content.jamUpload) continue;

      const jab = (emp.jabatan || '').toLowerCase();
      // ONLY for Content Creator
      if (!jab.includes('content creator')) continue;

      const [cHour, cMin] = content.jamUpload.split(':').map(Number);
      
      const nowTotalMins = (currentHour * 60) + currentMin;
      const uploadTotalMins = (cHour * 60) + cMin;
      const diffMinutes = uploadTotalMins - nowTotalMins;

      // Content Posting Reminder (5 mins before)
      if (diffMinutes === 5) {
        await sendWahaMessage(emp.noHandphone, `📱 *PENGINGAT POSTING KONTEN* 📱\n\nHalo ${emp.nama}, jadwal posting konten *${content.title}* Anda adalah 5 menit lagi (${content.jamUpload}). Siapkan file dan caption-nya ya!`, emp.company);
      }
    }
  } catch (err) {
    console.error("[Cron] Error in checkAndSendNotifications:", err);
  }
}

// Start the server only if not in a serverless environment like Vercel
if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error("CRITICAL: Failed to start server:", err);
  });

  // Schedule cron job every minute
  cron.schedule('* * * * *', () => {
    checkAndSendNotifications();
  });
  console.log("Cron jobs scheduled successfully");
} else {
  // In Vercel, we still want to run any non-Vite initialization if needed
  // but currently startServer is mostly about Vite/Static/Listen
}

export default app;
