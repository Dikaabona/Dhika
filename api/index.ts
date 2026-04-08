import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "buffer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Health check
app.get("/api/health", async (req, res) => {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  res.json({ 
    status: "ok", 
    resendConfigured: !!resendKey,
    env: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL
  });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/api/test", (req, res) => {
  res.send("🚀 API Server Majova.id is ONLINE!");
});

// Cron endpoint for Vercel
app.get("/api/cron/notifications", async (req, res) => {
  try {
    await checkAndSendNotifications();
    res.json({ status: "success", message: "Notifications checked and sent" });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/cron/retention", async (req, res) => {
  try {
    await runDataRetentionPolicy();
    res.json({ status: "success", message: "Data retention policy executed" });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
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

// Global variable to store recent logs (now using Supabase for persistence)
async function addWahaLog(type: string, data: any) {
  console.log(`[WAHA LOG] ${type}:`, JSON.stringify(data));
  if (!supabase) return;

  try {
    // Fetch existing logs
    const { data: existing, error: fetchError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'waha_debug_logs')
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error fetching logs:", fetchError);
    }

    let logs = existing?.value || [];
    if (!Array.isArray(logs)) logs = [];

    // Add new log at the beginning
    logs.unshift({
      timestamp: new Date().toISOString(),
      type,
      data
    });

    // Keep only last 200 logs
    const trimmedLogs = logs.slice(0, 200);

    // Save back to Supabase
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({ 
        key: 'waha_debug_logs', 
        value: trimmedLogs
      }, { onConflict: 'key' });

    if (upsertError) console.error("Upsert error:", upsertError);

  } catch (err) {
    console.error("Failed to save WAHA log to Supabase:", err);
  }
}

// Helper to get WAHA settings for a company
async function getWahaSettings(company: string) {
  // First check environment variables (as default/global)
  const envUrl = process.env.WAHA_API_URL;
  const envKey = process.env.WAHA_API_KEY;
  const envSession = process.env.WAHA_SESSION_NAME || 'default';

  if (envUrl) {
    let apiUrl = envUrl.trim();
    if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    console.log(`[WAHA] Using ENV settings for ${company}`);
    return { apiUrl, apiKey: envKey, sessionName: envSession };
  }

  // Otherwise fetch from Supabase
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `waha_settings_${company}`)
      .maybeSingle();
    
    if (data && data.value) {
      const settings = data.value as { apiUrl: string; apiKey: string; sessionName: string };
      let apiUrl = settings.apiUrl;
      if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      console.log(`[WAHA] Using DB settings for ${company}`);
      return { ...settings, apiUrl };
    }
    console.warn(`[WAHA] No settings found for ${company}`);
  } catch (err) {
    console.error(`[WAHA] Error fetching settings for ${company}:`, err);
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

  // Format number: remove +, ensure it ends with @c.us, handle leading 0 for Indonesia
  let cleaned = to.replace(/\D/g, ''); // Remove all non-digits
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  // If it's a standard Indonesian number without 62, add it
  if (cleaned.length >= 9 && cleaned.length <= 13 && !cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  let chatId = cleaned;
  if (chatId && !chatId.includes('@')) {
    chatId = `${chatId}@c.us`;
  }

  if (!chatId || chatId === '@c.us') {
    console.warn(`Invalid phone number for WAHA: ${to}`);
    return;
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
    addWahaLog('MESSAGE_SENT', { to: chatId, company, message: message.substring(0, 50) });
  } catch (err: any) {
    const errorMsg = err.response?.data || err.message;
    console.error(`Error sending WAHA message (${company}):`, errorMsg);
    addWahaLog('MESSAGE_ERROR', { to: chatId, error: errorMsg, company, message: message.substring(0, 50) });
  }
}

// WAHA Webhook Endpoint
app.all(["/api/webhook/waha", "/api/waha", "/api/waha/"], async (req, res) => {
  // Log every request that hits this endpoint
  addWahaLog('WEBHOOK_HIT', { 
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body
  });

  if (req.method === 'GET') {
    return res.send("✅ Webhook endpoint is ACTIVE and reachable. Please use POST for actual WAHA data.");
  }

  // Robust payload extraction
  const body = req.body || {};
  const event = body.event || (body.payload && body.payload.event) || (body.data && body.data.event);
  const payload = body.payload || body.data || body;
  
  console.log(`[WAHA Webhook] Event: ${event}`);
  addWahaLog('WEBHOOK_EVENT', { event, from: payload.from || payload.chatId || (payload.key && payload.key.remoteJid) });

  if (event === 'message.upsert' || event === 'message' || !event) {
    // Ignore messages from self to prevent loops
    if (payload.fromMe === true) return res.status(200).json({ status: "ignored_self" });

    // If no event, we try to process it as a message anyway if it looks like one
    const message = payload.body || payload.content || payload.text || payload.caption || 
                   (payload.message && (payload.message.conversation || payload.message.extendedTextMessage?.text || payload.message.imageMessage?.caption || payload.message.videoMessage?.caption));
    const from = payload.from || payload.chatId || payload.remoteJid || (payload.key && payload.key.remoteJid);
    
    if (!message || !from) {
      addWahaLog('WEBHOOK_SKIP', { reason: 'Missing message or from', payload_sample: JSON.stringify(payload).substring(0, 100) });
      return res.status(200).json({ status: "ignored_missing_data" });
    }

    // Determine company from query or default
    let company = (req.query.company as string) || 'VISIBEL';

    // --- Check if sender is an employee ---
    const fromParts = from.split('@');
    const fromId = fromParts[0];
    const fromType = fromParts[1]; // lid or c.us or s.whatsapp.net
    
    // Extract phone digits from 'from' or 'remoteJidAlt'
    let phoneDigits = fromId.replace(/\D/g, '');
    
    // Check if there's an alternative JID (often contains the real phone number for LID)
    const remoteJidAlt = payload._data?.key?.remoteJidAlt || payload.remoteJidAlt;
    if (remoteJidAlt) {
      const altDigits = remoteJidAlt.split('@')[0].replace(/\D/g, '');
      if (altDigits && altDigits.length >= 10) {
        phoneDigits = altDigits;
        addWahaLog('DEBUG_PHONE_ALT', { original: from, alt: remoteJidAlt, used: phoneDigits });
      }
    }
    
    if (!supabase) {
      addWahaLog('ERROR', 'Supabase not initialized');
      return res.status(200).json({ status: "error_no_supabase" });
    }

    const { data: emps, error: empError } = await supabase.from('employees').select('*');
    
    if (empError) {
      addWahaLog('ERROR', `Supabase error: ${empError.message}`);
      return res.status(200).json({ status: "error_db" });
    }

    const emp = emps?.find((e: any) => {
      const dbPhone = (e.noHandphone || '').replace(/\D/g, '');
      if (!dbPhone) return false;
      
      // Match if:
      // 1. Exact match
      // 2. DB phone ends with incoming phone (last 9 digits)
      // 3. Incoming phone ends with DB phone (last 9 digits)
      const incomingTail = phoneDigits.slice(-9);
      const dbTail = dbPhone.slice(-9);
      
      const isMatch = dbPhone === phoneDigits || (incomingTail.length >= 7 && dbTail === incomingTail);
      
      if (!isMatch && (dbTail === incomingTail || dbPhone.includes(phoneDigits) || phoneDigits.includes(dbPhone))) {
         addWahaLog('DEBUG_PHONE_MATCH_NEAR', { db: dbPhone, incoming: phoneDigits, dbTail, incomingTail });
      }
      
      return isMatch;
    });

    if (emp) {
      company = emp.company;
      addWahaLog('WEBHOOK_PROCESS_EMPLOYEE', { name: emp.nama, from, company });
    } else {
      addWahaLog('WEBHOOK_PROCESS_CLIENT', { from, company });
    }

    const lowerMsg = typeof message === 'string' ? message.toLowerCase().trim() : '';

    // --- DYNAMIC AUTO-REPLY RULES (For everyone) ---
    try {
      // Try both uppercase and original casing for company
      const companyKeys = [company, company.toUpperCase(), company.charAt(0).toUpperCase() + company.slice(1).toLowerCase()];
      const uniqueKeys = Array.from(new Set(companyKeys));
      
      let rules: any[] = [];
      for (const key of uniqueKeys) {
        const { data: rulesData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `waha_autoreply_rules_${key}`)
          .maybeSingle();
        
        if (rulesData && Array.isArray(rulesData.value)) {
          rules = rulesData.value;
          company = key; // Use the key that worked
          break;
        }
      }
      
      if (rules.length > 0) {
        addWahaLog('RULE_CHECK', { rules_count: rules.length, message: lowerMsg, company });
        
        for (const rule of rules) {
          const keyword = (rule.keyword || '').toLowerCase().trim();
          if (!keyword) continue;

          if (rule.matchType === 'exact') {
            if (lowerMsg === keyword) {
              addWahaLog('RULE_MATCH', { type: 'exact', keyword, from, company });
              await sendWahaMessage(from, rule.response, company);
              return res.status(200).json({ status: "received_dynamic_exact" });
            }
          } else if (rule.matchType === 'contains') {
            if (lowerMsg.includes(keyword)) {
              addWahaLog('RULE_MATCH', { type: 'contains', keyword, from, company });
              await sendWahaMessage(from, rule.response, company);
              return res.status(200).json({ status: "received_dynamic_contains" });
            }
          }
        }
      } else {
        addWahaLog('RULE_SKIP', { reason: 'No rules found for company', company });
      }
    } catch (e: any) {
      console.error("[WAHA Webhook] Error fetching dynamic rules:", e);
      addWahaLog('RULE_ERROR', { error: e.message, company });
    }
    // --------------------------------

    if (!emp) {
      return res.status(200).json({ status: "ignored_unauthorized_client" });
    }

    if (lowerMsg === '!menu' || lowerMsg === '!help' || lowerMsg === 'p' || lowerMsg === 'halo') {
      const menu = `🤖 *MAJOVA.ID HR BOT MENU* 🤖\n\nHalo ${emp.nama},\n\nBerikut adalah perintah yang bisa Anda gunakan:\n\n` +
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
      console.log(`[WAHA Webhook] No command matched for: ${lowerMsg}`);
      if (lowerMsg.startsWith('!')) {
        await sendWahaMessage(from, "Perintah tidak dikenal. Ketik !menu untuk melihat daftar perintah.");
      }
    }
  }

  res.status(200).json({ status: "received" });
});

// API to test WAHA connection from backend
app.post("/api/waha/test-connection", async (req, res) => {
  const { apiUrl, apiKey, sessionName } = req.body;
  if (!apiUrl) return res.status(400).json({ success: false, message: "URL is required" });
  
  let cleanUrl = apiUrl.trim();
  if (cleanUrl.endsWith('/dashboard')) cleanUrl = cleanUrl.replace('/dashboard', '');
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

  try {
    const response = await axios.get(`${cleanUrl}/api/sessions`, {
      headers: { 'X-Api-Key': apiKey }
    });
    
    // Check if the specific session exists or is connected
    const sessions = response.data;
    const session = Array.isArray(sessions) ? sessions.find((s: any) => s.name === sessionName) : null;
    
    res.status(200).json({ 
      success: true, 
      status: session ? session.status : "Connected to WAHA (Session not found or default)",
      data: response.data 
    });
  } catch (err: any) {
    console.error("WAHA Test Error:", err.response?.data || err.message);
    res.status(200).json({ 
      success: false, 
      message: err.response?.data?.message || err.message 
    });
  }
});

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

// API to manually send weekly schedule
app.get("/api/waha/send-weekly-schedule", async (req, res) => {
  const phone = req.query.phone as string;
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  try {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const { data: emps } = await supabase.from('employees').select('*');
    const emp = emps?.find((e: any) => (e.noHandphone || '').replace(/\D/g, '').endsWith(last10));

    if (!emp) return res.status(404).json({ error: "Employee not found" });

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

    const { data: assignments, error: shiftError } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('employeeId', emp.id)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true });

    if (shiftError) throw shiftError;

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
app.get("/api/waha/logs", async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'waha_debug_logs')
      .single();
    res.json(data?.value || []);
  } catch (err) {
    res.json([]);
  }
});

// API to clear WAHA logs
app.post("/api/waha/logs/clear", async (req, res) => {
  if (!supabase) return res.json({ success: false });
  try {
    await supabase
      .from('settings')
      .upsert({ key: 'waha_debug_logs', value: [] }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// API to automatically register webhook in WAHA
app.get("/api/waha/setup-webhook", async (req, res) => {
  const company = (req.query.company as string) || 'Visibel';
  const settings = await getWahaSettings(company);
  
  if (!settings?.apiUrl) return res.status(400).json({ error: "WAHA not configured yet" });

  const webhookUrl = `${process.env.APP_URL || 'https://' + req.get('host')}/api/webhook/waha?company=${encodeURIComponent(company)}`;

  try {
    const sessionName = settings.sessionName || "default";
    const response = await axios.put(`${settings.apiUrl}/api/sessions/${sessionName}`, {
      config: {
        webhooks: [
          {
            url: webhookUrl,
            events: ["message", "session.status"],
            enabled: true
          }
        ]
      }
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
  const msg = (req.query.msg as string) || "Tes pesan dari sistem Majova.id";
  const company = (req.query.company as string) || 'Visibel';

  if (!to) return res.status(400).json({ error: "Parameter 'to' (nomor HP) diperlukan. Contoh: ?to=628123456789" });

  try {
    await sendWahaMessage(to, msg, company);
    res.json({ status: "success", message: `Pesan sedang dikirim ke ${to}` });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// --- EMAIL SERVICE (RESEND) ---
// Using direct API calls to avoid dependency issues with the SDK
async function sendEmailViaApi(payload: any): Promise<{ data: any; error: any }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  try {
    const response = await axios.post("https://api.resend.com/emails", payload, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    return { data: response.data, error: null };
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error("Resend API Error:", errorData);
    return { data: null, error: errorData };
  }
}

// API Route to send email
app.post("/api/send-email", async (req, res) => {
  const { to, subject, html, from, attachments, replyTo } = req.body;
  console.log(`API Request: Send email to ${to}, subject: ${subject}`);

  try {
    console.log("Processing attachments...");
    let processedAttachments: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      processedAttachments = attachments
        .filter((att: any) => att.content && att.content.length > 0)
        .map((att: any) => {
          try {
            const base64Content = typeof att.content === 'string' 
              ? att.content 
              : Buffer.from(att.content).toString('base64');
            
            return {
              filename: att.filename || 'attachment.png',
              content: base64Content,
            };
          } catch (err) {
            console.error("Error processing attachment:", att.filename, err);
            return null;
          }
        })
        .filter(Boolean);
    }

    console.log(`Sending email via Resend API to ${to}...`);
    const emailPayload = {
      from: from || "admin@visibel.agency",
      to: typeof to === 'string' ? [to] : to,
      subject: subject,
      html: html,
      reply_to: replyTo,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    };

    const { data, error } = await sendEmailViaApi(emailPayload);

    if (error) {
      console.error("Resend API Error:", JSON.stringify(error));
      return res.status(400).json({ error: error.message || "Resend API Error", details: error });
    }
    
    console.log("Email sent successfully:", data?.id);
    res.status(200).json(data);
  } catch (err: any) {
    console.error("Server Error sending email:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
});

// Debug endpoint to inspect assignments
app.get("/api/debug/inspect-assignments", async (req, res) => {
  const phone = req.query.phone as string;
  if (!phone) return res.status(400).json({ error: "Phone is required" });
  try {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const { data: emps } = await supabase.from('employees').select('*');
    const emp = emps?.find((e: any) => (e.noHandphone || '').replace(/\D/g, '').endsWith(last10));
    if (!emp) return res.status(404).json({ error: "Employee not found", last10 });
    const { data: allAssignments } = await supabase.from('shift_assignments').select('*').eq('employeeId', emp.id);
    res.json({
      emp: { id: emp.id, nama: emp.nama, noHandphone: emp.noHandphone },
      assignmentCount: allAssignments?.length || 0,
      allAssignments: allAssignments?.slice(0, 20),
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
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production" || isVercel;

  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode (Vercel: ${isVercel})...`);

  // Start listening immediately to satisfy the platform's health check
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  if (!isProd) {
    try {
      console.log("Initializing Vite middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.includes('.')) return next();
        
        try {
          let template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
      console.log("Vite middleware initialized successfully");
    } catch (err) {
      console.error("Vite initialization failed, falling back to static:", err);
    }
  } else if (!isVercel) {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }
}

// Helper to send Email notification
async function sendEmailNotification(to: string, subject: string, message: string) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey || !to) return;

  try {
    await sendEmailViaApi({
      from: "Majova.id <admin@visibel.agency>",
      to: [to],
      subject: subject,
      html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">${subject}</h2>
        <p style="font-size: 16px; color: #374151;">${message.replace(/\n/g, '<br>')}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af;">Ini adalah pesan otomatis dari sistem Majova.id.</p>
      </div>`,
    });
    console.log(`Email notification sent to ${to}`);
  } catch (err) {
    console.error("Error sending email notification:", err);
  }
}

// Generic notification sender (WA only)
async function sendNotification(emp: any, subject: string, message: string) {
  // Try WhatsApp
  if (emp.noHandphone) {
    await sendWahaMessage(emp.noHandphone, message, emp.company);
  }
}

// --- SCHEDULED NOTIFICATIONS ---
async function checkAndSendNotifications() {
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
    if (!supabase) {
      console.warn("[Cron] Supabase not initialized, skipping notifications");
      return;
    }
    const { data: assignments, error: assignError } = await supabase.from('shift_assignments').select('*').eq('date', today);
    if (assignError) throw assignError;

    const { data: emps } = await supabase.from('employees').select('*');
    const { data: allShiftsTable } = await supabase.from('shifts').select('*');
    const { data: allSettings } = await supabase.from('settings').select('*').like('key', 'shifts_config_%');

    const shiftsByCompany: Record<string, any[]> = {};
    
    // Initialize with table data if it exists
    if (allShiftsTable && allShiftsTable.length > 0) {
      // Assuming table data is global or we can group it by company if it has a company column
      // For now, let's assume it's a fallback for all
      emps?.forEach((e: any) => {
        if (e.company) shiftsByCompany[e.company] = allShiftsTable;
      });
    }

    // Overlay with settings data (more specific)
    allSettings?.forEach((s: any) => {
      const company = s.key.replace('shifts_config_', '');
      shiftsByCompany[company] = s.value;
      // Also handle case-insensitive matches if needed, but usually it's uppercase
      shiftsByCompany[company.toUpperCase()] = s.value;
    });

    for (const assign of assignments || []) {
      const emp = emps?.find((e: any) => e.id === assign.employeeId);
      if (!emp) continue;

      const company = emp.company || 'VISIBEL';
      const companyShifts = shiftsByCompany[company] || shiftsByCompany[company.toUpperCase()] || shiftsByCompany['VISIBEL'];
      
      const shift = companyShifts?.find((s: any) => s.id === assign.shiftId);
      if (!emp || !shift || !emp.noHandphone) continue;

      const shiftStart = shift.startTime;
      if (!shiftStart || typeof shiftStart !== 'string' || !shiftStart.includes(':')) continue;
      
      const [sHour, sMin] = shiftStart.split(':').map(Number);
      const nowTotalMins = (currentHour * 60) + currentMin;
      const shiftTotalMins = (sHour * 60) + sMin;
      const diffMinutes = shiftTotalMins - nowTotalMins;

      const isOff = shift.name.toLowerCase().includes('off') || shift.name.toLowerCase().includes('libur');
      if (!isOff) {
        const { data: att } = await supabase.from('attendance').select('*').eq('employeeId', emp.id).eq('date', today).maybeSingle();
        
        if (!att || !att.clockIn) {
          if (diffMinutes === 15) {
            const subject = "⏰ Pengingat Absen (15 Menit Lagi)";
            const msg = `⏰ *PENGINGAT ABSEN* ⏰\n\nHalo ${emp.nama}, shift *${shift.name}* Anda akan dimulai dalam 15 menit (${shiftStart}). Jangan lupa untuk melakukan absensi ya!`;
            await sendNotification(emp, subject, msg);
          } else if (diffMinutes === 0) {
            const subject = "⏰ Shift Dimulai";
            const msg = `⏰ *SHIFT DIMULAI* ⏰\n\nHalo ${emp.nama}, shift *${shift.name}* Anda sudah dimulai (${shiftStart}). Anda belum melakukan absensi masuk. Segera absen ya!`;
            await sendNotification(emp, subject, msg);
          } else if (diffMinutes === -10) {
            const subject = "⚠️ Peringatan Terlambat";
            const msg = `⚠️ *PERINGATAN TERLAMBAT* ⚠️\n\nHalo ${emp.nama}, Anda sudah terlambat 10 menit dari jadwal shift *${shift.name}* (${shiftStart}) dan belum melakukan absensi masuk. Harap segera melakukan absensi!`;
            await sendNotification(emp, subject, msg);
          }
        }
      }

      if (shift.name.toLowerCase().includes('live')) {
        const jab = (emp.jabatan || '').toLowerCase();
        if (diffMinutes === 30 && jab.includes('operator')) {
          const subject = "🎙️ Persiapan Studio";
          const msg = `🎙️ *PERSIAPAN STUDIO* 🎙️\n\nHalo ${emp.nama}, jadwal Live Streaming akan dimulai dalam 30 menit. Sebagai Operator, silakan mulai persiapkan studio dan peralatan.`;
          await sendNotification(emp, subject, msg);
        }
        if (diffMinutes === 5 && jab.includes('host livestreaming')) {
          const subject = "🚀 Live Segera Dimulai";
          const msg = `🚀 *LIVE SEGERA DIMULAI* 🚀\n\nHalo ${emp.nama}, Live Streaming Anda akan dimulai dalam 5 menit (${shiftStart}). Sebagai Host, pastikan semuanya sudah siap!`;
          await sendNotification(emp, subject, msg);
        }
      }
    }

    // --- LIVE SCHEDULE NOTIFICATIONS (15 Minutes Before) ---
    const { data: liveSchedules, error: liveError } = await supabase.from('schedules').select('*').eq('date', today);
    if (!liveError && liveSchedules) {
      for (const schedule of liveSchedules) {
        const host = emps?.find((e: any) => e.id === schedule.hostId);
        const operator = emps?.find((e: any) => e.id === schedule.opId);
        
        if (!schedule.hourSlot) continue;
        
        // Parse hourSlot like "19.00 - 21.00" or "19:00 - 21:00"
        // Handle different dashes: hyphen (-), en-dash (–), em-dash (—)
        const parts = schedule.hourSlot.split(/[-–—]/);
        const startTimeStr = parts[0].trim().replace('.', ':');
        const [sHour, sMin] = startTimeStr.split(':').map(Number);
        
        if (isNaN(sHour) || isNaN(sMin)) {
          console.warn(`Invalid hourSlot format for schedule ${schedule.id}: ${schedule.hourSlot}`);
          continue;
        }

        const nowTotalMins = (currentHour * 60) + currentMin;
        const shiftTotalMins = (sHour * 60) + sMin;
        const diffMinutes = shiftTotalMins - nowTotalMins;

        // Debug log for specific problematic time
        if (sHour === 16 && sMin === 0) {
          console.log(`Checking 16:00 schedule for ${schedule.brand}. Diff: ${diffMinutes} mins. Now: ${currentHour}:${currentMin}`);
        }

        if (diffMinutes === 15) {
          // Notify Host
          if (host && host.noHandphone) {
            const msg = `🎥 *PENGINGAT LIVE STREAMING* 🎥\n\nHalo *${host.nama}*,\n\nJadwal Live Anda di brand *${schedule.brand}* jam *${schedule.hourSlot}* akan dimulai dalam *15 menit*. Mohon bersiap-siap ya! Semangat! 🚀`;
            await sendWahaMessage(host.noHandphone, msg, host.company);
          }
          
          // Notify Operator
          if (operator && operator.noHandphone) {
            const msg = `🎙️ *PERSIAPAN STUDIO LIVE* 🎙️\n\nHalo *${operator.nama}*,\n\nJadwal Live brand *${schedule.brand}* jam *${schedule.hourSlot}* akan dimulai dalam *15 menit*.\n\nMohon segera persiapkan studio dan peralatan untuk Host (*${host?.nama || 'Unknown'}*). Terima kasih! 🙏`;
            await sendWahaMessage(operator.noHandphone, msg, operator.company);
          }
        }
      }
    }

    const { data: contents, error: contentError } = await supabase.from('content_plans').select('*').eq('postingDate', today);
    if (contentError) throw contentError;

    for (const content of contents || []) {
      const emp = emps?.find((e: any) => e.id === content.creatorId);
      if (!emp) continue;

      let jamUpload = content.jamUpload;
      if (!jamUpload && content.notes && content.notes.includes('[Time:')) {
        const match = content.notes.match(/\[Time:\s*(\d{2}:\d{2})\]/);
        if (match) jamUpload = match[1];
      }

      if (!jamUpload || typeof jamUpload !== 'string' || !jamUpload.includes(':')) continue;

      const jab = (emp.jabatan || '').toLowerCase();
      if (!jab.includes('content creator')) continue;

      const [cHour, cMin] = jamUpload.split(':').map(Number);
      const nowTotalMins = (currentHour * 60) + currentMin;
      const uploadTotalMins = (cHour * 60) + cMin;
      const diffMinutes = uploadTotalMins - nowTotalMins;

      if (diffMinutes === 5) {
        const subject = "📱 Pengingat Posting Konten";
        const msg = `📱 *PENGINGAT POSTING KONTEN* 📱\n\nHalo ${emp.nama}, jadwal posting konten *${content.title}* Anda adalah 5 menit lagi (${jamUpload}). Siapkan file dan caption-nya ya!`;
        await sendNotification(emp, subject, msg);
      }
    }
  } catch (err) {
    console.error("[Cron] Error in checkAndSendNotifications:", err);
  }
}

// --- DATA RETENTION POLICY ---
async function runDataRetentionPolicy() {
  console.log("[Retention] Running data retention policy...");
  if (!supabase) {
    console.warn("[Retention] Supabase not initialized, skipping retention policy");
    return;
  }

  const now = new Date();
  
  // 1. Attendance records (1 year)
  // Deleting records older than 1 year
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

  console.log(`[Retention] Deleting attendance records older than ${oneYearAgoStr}...`);
  const { error: attError, count: attCount } = await supabase
    .from('attendance')
    .delete({ count: 'exact' })
    .lt('date', oneYearAgoStr);

  if (attError) {
    console.error("[Retention] Error deleting old attendance records:", attError);
  } else {
    console.log(`[Retention] Successfully deleted ${attCount || 0} attendance records older than ${oneYearAgoStr}`);
  }

  // 2. Attendance photos (1 month)
  // Clearing photo fields for records older than 1 month
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

  console.log(`[Retention] Clearing attendance photos older than ${oneMonthAgoStr}...`);
  const { error: photoError } = await supabase
    .from('attendance')
    .update({ photoIn: null, photoOut: null })
    .lt('date', oneMonthAgoStr);

  if (photoError) {
    console.error("[Retention] Error clearing old attendance photos:", photoError);
  } else {
    console.log(`[Retention] Successfully cleared attendance photos older than ${oneMonthAgoStr}`);
  }
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error("CRITICAL: Failed to start server:", err);
  });
  
  // Only run cron if explicitly enabled via environment variable
  if (process.env.ENABLE_LOCAL_CRON === 'true') {
    cron.schedule('* * * * *', () => {
      checkAndSendNotifications();
    });
    
    // Run retention policy every day at 01:00 AM
    cron.schedule('0 1 * * *', () => {
      runDataRetentionPolicy();
    });
    
    console.log("Local cron jobs scheduled successfully");
  } else {
    console.log("Local cron is DISABLED. Set ENABLE_LOCAL_CRON=true in .env to enable.");
  }
}

export default app;
