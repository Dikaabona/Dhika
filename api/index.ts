import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "buffer";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for all origins
app.use(cors());

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

// Function to log Agent API Access for tracking
async function addAgentLog(type: string, data: any) {
  console.log(`[AGENT LOG] ${type}:`, JSON.stringify(data));
  if (!supabase) return;

  try {
    const { data: existing } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'agent_tracking_logs')
      .maybeSingle();

    let logs = existing?.value || [];
    if (!Array.isArray(logs)) logs = [];

    logs.unshift({
      timestamp: new Date().toISOString(),
      type,
      data
    });

    const trimmedLogs = logs.slice(0, 300);

    await supabase
      .from('settings')
      .upsert({ 
        key: 'agent_tracking_logs', 
        value: trimmedLogs
      }, { onConflict: 'key' });
  } catch (err) {
    console.error("Error in addAgentLog:", err);
  }
}

// Helper to get WAHA settings for a company
async function getWahaSettings(company: string, incomingSession?: string) {
  const comp = company.toUpperCase();
  
  // 1. If incomingSession is provided, try to match by session name first (Account 2 priority if it matches)
  if (incomingSession) {
    const envUrl1 = process.env.WAHA_API_URL;
    const envSession1 = process.env.WAHA_SESSION_NAME || 'default';
    const envUrl2 = process.env.WAHA_API_URL_2;
    const envSession2 = process.env.WAHA_SESSION_NAME_2;

    if (envUrl2 && incomingSession === envSession2) {
      let apiUrl = envUrl2.trim();
      if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      console.log(`[WAHA] Matching Account 2 by session: ${incomingSession}`);
      return { apiUrl, apiKey: process.env.WAHA_API_KEY_2, sessionName: envSession2 };
    }
    if (envUrl1 && incomingSession === envSession1) {
      let apiUrl = envUrl1.trim();
      if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      console.log(`[WAHA] Matching Account 1 by session: ${incomingSession}`);
      return { apiUrl, apiKey: process.env.WAHA_API_KEY, sessionName: envSession1 };
    }
  }

  // 2. Try to fetch from Supabase (Priority for initiated messages)
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
  } catch (err) {
    console.error(`[WAHA] Error fetching settings for ${company}:`, err);
  }

  // 3. Check Environment Variables for specific company
  const compUrl = process.env[`WAHA_API_URL_${comp}`];
  const compKey = process.env[`WAHA_API_KEY_${comp}`];
  const compSession = process.env[`WAHA_SESSION_NAME_${comp}`];

  if (compUrl) {
    let apiUrl = compUrl.trim();
    if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    console.log(`[WAHA] Using ENV settings for specific company: ${company}`);
    return { apiUrl, apiKey: compKey, sessionName: compSession || 'default' };
  }

  // Account 1 (Standard)
  const envUrl = process.env.WAHA_API_URL;
  const envKey = process.env.WAHA_API_KEY;
  const envSession = process.env.WAHA_SESSION_NAME || 'default';

  // Account 2
  const envUrl2 = process.env.WAHA_API_URL_2;
  const envKey2 = process.env.WAHA_API_KEY_2;
  const envSession2 = process.env.WAHA_SESSION_NAME_2;

  // Logic to decide between Account 1 and 2 if no specific company settings
  if (company !== 'VISIBEL' && envUrl2) {
    let apiUrl = envUrl2.trim();
    if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    console.log(`[WAHA] Using ENV Account 2 settings for ${company}`);
    return { apiUrl, apiKey: envKey2, sessionName: envSession2 || 'default' };
  }

  if (envUrl) {
    let apiUrl = envUrl.trim();
    if (apiUrl.endsWith('/dashboard')) apiUrl = apiUrl.replace('/dashboard', '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    console.log(`[WAHA] Using ENV Account 1 settings for ${company}`);
    return { apiUrl, apiKey: envKey, sessionName: envSession };
  }

  console.warn(`[WAHA] No settings found for ${company}`);
  return null;
}

// Helper to send WAHA message
async function sendWahaMessage(to: string, message: string, company: string = 'VISIBEL', incomingSession?: string) {
  const settings = await getWahaSettings(company, incomingSession);

  if (!settings || !settings.apiUrl) {
    console.warn(`WAHA not configured for company: ${company}`);
    return;
  }

  const { apiUrl, apiKey, sessionName } = settings;

  // Decide if we should clean the number or use as is
  let chatId = to;

  // If "to" already looks like a complete JID (contains @), we check if it's a type we should handle
  // Otherwise if it's just raw digits or needs formatting:
  if (!to.includes('@')) {
    let cleaned = to.replace(/\D/g, ''); // Remove all non-digits
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    // If it's a standard Indonesian number without 62, add it
    if (cleaned.length >= 9 && cleaned.length <= 13 && !cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    chatId = `${cleaned}@c.us`;
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
    console.log(`WAHA message sent to ${chatId} (${company}, session: ${sessionName})`);
    addWahaLog('MESSAGE_SENT', { to: chatId, company, session: sessionName, message: message.substring(0, 50) });
  } catch (err: any) {
    const errorMsg = err.response?.data || err.message;
    console.error(`Error sending WAHA message (${company}, session: ${sessionName}):`, errorMsg);
    addWahaLog('MESSAGE_ERROR', { to: chatId, error: errorMsg, company, session: sessionName, message: message.substring(0, 50) });
  }
}

// AI Tools implementation
const aiTools = {
  get_employees: async () => {
    const { data } = await supabase.from('employees').select('id, nama, jabatan, company');
    return data;
  },
  get_live_schedules: async (params: { date?: string; brand?: string }) => {
    const today = new Date().toISOString().split('T')[0];
    const date = params.date || today;
    
    // Fetch schedules
    let query = supabase.from('schedules').select('*').eq('date', date);
    if (params.brand && params.brand !== 'ALL') query = query.eq('brand', params.brand);
    const { data: schedules, error: schedError } = await query;
    
    if (schedError) {
      console.error("Error fetching schedules:", schedError);
      return [];
    }

    // Fetch employees for mapping names
    const { data: employees } = await supabase.from('employees').select('id, nama');
    const empMap: Record<string, string> = {};
    employees?.forEach((e: any) => { empMap[e.id] = e.nama; });

    // Format for AI
    return schedules?.map((s: any) => ({
      ...s,
      hostName: empMap[s.hostId] || 'Tidak diketahui',
      opName: empMap[s.opId] || 'Tidak diketahui'
    })) || [];
  },
  get_live_reports: async (params: { startDate?: string; endDate?: string; brand?: string }) => {
    const today = new Date().toISOString().split('T')[0];
    const start = params.startDate || today;
    const end = params.endDate || today;
    let query = supabase.from('live_reports').select('*').gte('tanggal', start).lte('tanggal', end);
    if (params.brand && params.brand !== 'ALL') query = query.eq('brand', params.brand);
    const { data } = await query;
    return data;
  },
  add_live_report: async (params: any) => {
    const { data, error } = await supabase.from('live_reports').insert([params]).select();
    if (error) throw error;
    return data;
  }
} // Helper to generate Gemini response (updated for Image support)
async function generateGeminiResponse(userMessage: string, company: string, emp?: any, from?: string, media?: { data: string, mimeType: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[GEMINI] API Key missing");
    return null;
  }

  try {
    const { data: knowledgeData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `gemini_knowledge_base_${company}`)
      .maybeSingle();

    const knowledgeBase = knowledgeData?.value || `Anda adalah Admin Visibel untuk ${company}. Berikan informasi yang akurat dan ramah.`;

    console.log(`[GEMINI] Generating response for ${company}... ${media ? 'WITH IMAGE' : ''}`);
    await addWahaLog('AI_DEBUG', { step: 'START_V4', message: userMessage?.substring(0, 50), company, hasMedia: !!media, from });

    // Fetch chat history from logs if 'from' is provided
    let chatHistory: any[] = [];
    if (from && supabase) {
      try {
        const { data: logData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'waha_debug_logs')
          .maybeSingle();
        
        if (logData?.value && Array.isArray(logData.value)) {
          // Filter logs for this specific user
          const userLogs = logData.value
            .filter((log: any) => {
              if (log.type === 'MESSAGE_RECEIVED' && log.data?.from === from) return true;
              if (log.type === 'AI_REPLY_SENT' && log.data?.to?.includes(from.split('@')[0])) return true;
              return false;
            })
            .slice(0, 10) // Last 10 messages for context
            .reverse(); // Gemini expects chronological order
          
          let rawHistory = userLogs.map((log: any) => ({
            role: log.type === 'MESSAGE_RECEIVED' ? 'user' : 'model',
            parts: [{ text: (log.type === 'MESSAGE_RECEIVED' ? log.data.message : log.data.reply) || "..." }]
          })).filter((chat: any) => chat.parts[0].text);

          // SANITIZE HISTORY: Gemini REQUIRES alternating roles starting with 'user'
          const sanitized: any[] = [];
          rawHistory.forEach((item: any) => {
            if (sanitized.length === 0) {
              if (item.role === 'user') sanitized.push(item);
            } else {
              const last = sanitized[sanitized.length - 1];
              if (item.role !== last.role) {
                sanitized.push(item);
              }
            }
          });
          chatHistory = sanitized;
        }
      } catch (historyErr) {
        console.error("Failed to fetch chat history:", historyErr);
      }
    }

    const gratitudeKeywords = ['terima kasih', 'terimakasih', 'thanks', 'thankyou', 'thank you', 'tengkyu', 'nuhun', 'matur nuwun', 'syukron', 'makasih', 'mks', 'thx'];
    const lowerMessage = (userMessage || "").toLowerCase();
    const isGratitude = gratitudeKeywords.some(keyword => lowerMessage.includes(keyword));

    // System Instruction
    const systemInstructionText = `
      Knowledge Base:
      ${knowledgeBase}
      
      Konteks Sekarang:
      Waktu Server: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
      Nama Perusahaan: ${company}
      Status Pesan: ${isGratitude ? 'User mengucapkan terima kasih' : 'Pesan normal'}
      Identitas Penanya:
      - Nama: ${emp ? emp.nama : 'Pelanggan Eksternal'}
      - Peran: ${emp ? (emp.role || 'Karyawan') : 'Bukan Karyawan'}
      - Perusahaan Penanya: ${emp ? (emp.company || company) : 'Eksternal'}

      Instruksi Utama:
      - Nama Anda adalah Vis, Admin Visibel. Santai, hangat, manusiawi.
      - DILARANG menggunakan format teks tebal (**) atau miring (*).
      - Anda memiliki akses ke riwayat obrolan (History) di atas untuk memahami konteks pembicaraan sebelumnya.

      Klasifikasi Pengunjung:
      1. KANDIDAT/PELAMAR: Jika bertanya tentang lowongan kerja, loker, kirim CV, atau cara bergabung.
         * Jawaban: Berikan pilihan link https://web.visibel.agency/karir atau https://forms.gle/ixfgPRtMV33PCcKt5.
      2. CALON CLIENT: Jika bertanya tentang jasa, harga, rate card, atau kerjasama bisnis.
         * Jawaban: Jelaskan layanan Visibel (Live Streaming, Ads, Sosmed) dan arahkan untuk konsultasi.
      
      Fitur Tambahan:
      - Jika user mengucapkan terima kasih, cukup balas "sama-sama ka" tanpa informasi tambahan.
      - Jika user kirim gambar, analisislah isi gambarnya.
      - Gunakan tools untuk data Jadwal atau GMV jika dibutuhkan (khusus data operasional).
    `;

    const ai = new GoogleGenAI({ apiKey });
    
    // Define Tool for @google/genai
    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_live_schedules",
            description: "Mendapatkan jadwal live streaming.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "YYYY-MM-DD. Kosongkan untuk hari ini." },
                brand: { type: Type.STRING, description: "Nama brand (opsional)." }
              }
            }
          },
          {
            name: "get_live_reports",
            description: "Mendapatkan laporan performa live.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                startDate: { type: Type.STRING, description: "YYYY-MM-DD." },
                endDate: { type: Type.STRING, description: "YYYY-MM-DD." },
                brand: { type: Type.STRING, description: "Nama brand (opsional)." }
              }
            }
          },
          {
            name: "add_live_report",
            description: "Menambahkan data laporan live streaming baru ke sistem.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                tanggal: { type: Type.STRING, description: "YYYY-MM-DD." },
                brand: { type: Type.STRING, description: "Nama Brand." },
                hostId: { type: Type.STRING, description: "UUID Host (dapatkan dari get_employees)." },
                opId: { type: Type.STRING, description: "UUID Operator (dapatkan dari get_employees)." },
                gmv: { type: Type.NUMBER, description: "Total GMV Rupiah." },
                checkout: { type: Type.NUMBER, description: "Total Checkout (CO)." },
                qty: { type: Type.NUMBER, description: "Total Qty terjual." }
              },
              required: ["tanggal", "brand", "hostId", "opId", "gmv", "checkout", "qty"]
            }
          },
          {
            name: "get_employees",
            description: "Mendapatkan daftar karyawan.",
            parameters: { type: Type.OBJECT, properties: {} }
          }
        ]
      }
    ];

    // Prepare message Parts
    const messageParts: any[] = [];
    if (media) {
      messageParts.push({
        inlineData: {
          data: media.data,
          mimeType: media.mimeType
        }
      });
    }
    messageParts.push({ text: userMessage || (media ? "Tolong jelaskan isi gambar ini." : "Halo") });

    // Multi-turn style using generateContent (manual history management)
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory,
        { role: 'user', parts: messageParts }
      ],
      config: {
        systemInstruction: systemInstructionText,
        tools: tools as any
      }
    });

    let text = result.text || "";
    const calls = result.functionCalls;

    if (calls && calls.length > 0) {
      console.log(`[GEMINI] Tool calls detected:`, calls);
      const toolResponses = [];
      for (const call of calls) {
        const fnName = call.name as keyof typeof aiTools;
        const fnArgs = call.args;
        try {
          const content = await aiTools[fnName](fnArgs as any);
          toolResponses.push({
            functionResponse: {
              name: fnName,
              response: { content }
            }
          });
        } catch (err) {
          toolResponses.push({
            functionResponse: {
              name: fnName,
              response: { error: "Failed to fetch data" }
            }
          });
        }
      }

      console.log(`[GEMINI] Sending tool responses back...`);
      const finalResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...chatHistory,
          { role: 'user', parts: messageParts },
          { role: 'model', parts: calls.map(c => ({ functionCall: c }) as any) },
          { role: 'user', parts: toolResponses }
        ],
        config: {
          systemInstruction: systemInstructionText,
          tools: tools as any
        }
      });
      text = finalResult.text || "";
    }

    await addWahaLog('AI_DEBUG', { step: 'RESPONSE_RECEIVED', text: text?.substring(0, 50) });
    return text;

  } catch (err: any) {
    console.error("[GEMINI ERROR]", err);
    await addWahaLog('AI_ERROR', { error: err.message, from, stack: err.stack?.substring(0, 50) });
    return "Maaf, terjadi kendala teknis saat menghubungi sistem AI Visibel. Coba sapa lagi ya kak.";
  }
}

// WAHA Webhook Endpoint
// ============================================================
// HELPER: Panggil Gemini API secara langsung via REST
// ============================================================
async function askGemini(prompt: string, systemContext: string): Promise<string> {
  // 1. Cek dari Environment Variable
  let apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  
  // 2. Jika kosong, coba ambil dari Database (settings)
  if (!apiKey && supabase) {
     try {
       const { data } = await supabase.from('settings').select('value').eq('key', 'GEMINI_API_KEY').maybeSingle();
       if (data && data.value) apiKey = data.value.trim();
     } catch (e) {
       console.error("[GEMINI] Database check failed", e);
     }
  }

  // 3. Fallback Terakhir: Gunakan Hardcoded Key jika memang mendesak (Opsional, tapi aman untuk debug)
  // Untuk keamanan, kita gunakan log yang lebih jelas jika gagal.
  if (!apiKey) {
    addWahaLog('GEMINI_ERROR', { error: 'API Key missing everywhere' });
    return 'Maaf, layanan AI sedang dalam pemeliharaan (Konfigurasi Belum Lengkap). Mohon hubungi admin.';
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        system_instruction: {
          parts: [{ text: systemContext }]
        },
        contents: [
          { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = response.data;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak bisa menjawab saat ini.';
  } catch (err: any) {
    console.error("[GEMINI REST ERROR]", err.response?.data || err.message);
    return 'Maaf, terjadi gangguan saat menghubungi AI.';
  }
}

// ============================================================
// HELPER: Ekstrak phone number dari payload WAHA (LID support)
// ============================================================
function extractPhoneNumber(payload: any, from: string | null): string | null {
  // Step 1: Kumpulkan semua kandidat ID dari berbagai field WAHA (termasuk Alt fields untuk LID support)
  const candidates = [
    payload.participantAlt,
    payload.remoteJidAlt,
    payload._data?.Info?.SenderAlt, // GOWS/WAHA specific candidate
    payload._data?.Info?.RecipientAlt,
    payload._data?.key?.participantAlt,
    payload._data?.key?.remoteJidAlt,
    payload._data?.remoteJidAlt,
    payload.participant,
    payload.author,
    from
  ];

  let phoneDigits = '';

  // Step 2: Cari kandidat pertama yang benar-benar berisi angka nomor telepon asli (62...)
  for (const candidate of candidates) {
    if (!candidate) continue;
    const jid = String(candidate);
    const digits = jid.split('@')[0].replace(/\D/g, '');
    
    // Prioritas: Nomor asli biasanya diawali 62 atau 0 dan bukan LID
    if (digits && digits.length >= 10 && digits.length <= 15 && (digits.startsWith('62') || digits.startsWith('0'))) {
      phoneDigits = digits;
      break; 
    }
  }

  // Step 3: Jika tidak ketemu yang 62/0, cari yang penting ada angka (dan bukan LID)
  if (!phoneDigits) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const jid = String(candidate);
      const digits = jid.split('@')[0].replace(/\D/g, '');
      if (digits && digits.length >= 5 && !jid.includes('@lid')) {
        phoneDigits = digits;
        break;
      }
    }
  }

  // Step 4: Normalisasi 0 → 62
  if (phoneDigits.startsWith('0')) {
    phoneDigits = '62' + phoneDigits.substring(1);
  }

  // Step 5: Validasi hasil akhir
  if (!phoneDigits || phoneDigits.length < 5) {
    if (from && from.includes('@c.us')) return from;
    return null;
  }

  return `${phoneDigits}@c.us`;
}

// ============================================================
// SYSTEM PROMPTS — Konteks untuk Gemini
// ============================================================
const SYSTEM_PROMPT_CS = `
Kamu adalah Vivi, asisten virtual cerdas dari Visibel.ID, sebuah creative agency dan TikTok Marketing Partner.
Jawab pertanyaan calon klien dengan ramah, ceria, dan profesional dalam Bahasa Indonesia.
Layanan Visibel: Live Streaming (Shopee/TikTok), Short Video, TikTok Ads, Social Media Management, KOL Campaign, Affiliate Management.
Harga paket standar: Video Rp 6.000.000/bulan, Live Rp 9.000.000/bulan.
Jika ada yang bertanya tentang "Jadwal" atau "Laporan/GMV", gunakan tools yang tersedia untuk memberikan data real-time.
Balas maksimal 3-4 kalimat kecuali jika memberikan data tabel.
`;

const SYSTEM_PROMPT_HR = `
Kamu adalah Vivi, asisten HR internal cerdas dari Visibel.ID.
Bantu karyawan dengan ramah dan akurat. Kamu bisa cek jadwal shift, absensi, dan performa konten menggunakan tools.
Jika karyawan bertanya "Jadwal saya", "Siapa yang live", "GMV kemarin", atau "Absen saya", pastikan gunakan tools.
Ingatkan mereka untuk selalu profesional dan semangat bekerja!
`;

// ============================================================
// WAHA Webhook Endpoint (Auto-Reply & Bot Logic)
// ============================================================
app.all(["/api/webhook/waha", "/api/waha"], async (req, res) => {
  // Log request awal
  addWahaLog('WEBHOOK_HIT', { 
    method: req.method,
    url: req.originalUrl,
    body: req.body
  });

  if (req.method === 'GET') {
    return res.send("✅ Webhook endpoint is ACTIVE and reachable. Point your WAHA server POST here.");
  }

  const body = req.body || {};
  const event = body.event;
  const session = body.session; // Capture WAHA session name
  
  // Hanya proses event 'message'
  if (event !== 'message' && event !== 'message.upsert') {
    return res.status(200).json({ status: "ignored_event", event });
  }

  const payload = body.payload;
  if (!payload || payload.fromMe === true) {
    return res.status(200).json({ status: "ignored" });
  }

  const message = payload.body || payload.content || payload.text || payload.caption || 
                 (payload.message && (payload.message.conversation || payload.message.extendedTextMessage?.text));
  
  const fromRaw = payload.from || payload.chatId || payload.remoteJid || null;
  const from = extractPhoneNumber(payload, fromRaw);

  if (!from || !message) {
    return res.status(200).json({ status: "ignored_incomplete" });
  }

  addWahaLog('MESSAGE_RECEIVED', { from, message, session, hasMedia: !!payload.hasMedia });

  try {
    if (!supabase) throw new Error("Supabase not initialized");

    // 1. Identifikasi Pengirim
    const phoneDigits = from.split('@')[0];
    const { data: emps } = await supabase.from('employees').select('*');
    const emp = emps?.find((e: any) => {
      let dbPhone = (e.noHandphone || '').replace(/\D/g, '');
      if (dbPhone.startsWith('0')) dbPhone = '62' + dbPhone.substring(1);
      const incomingTail = phoneDigits.slice(-9);
      const dbTail = dbPhone.slice(-9);
      return dbPhone === phoneDigits || (incomingTail && dbTail === incomingTail);
    });

    const company = (req.query.company as string) || emp?.company || 'VISIBEL';

    // 0. Cek Media (Gambar)
    let mediaData: any = null;
    if (payload.hasMedia && payload.id) {
      try {
        const settings = await getWahaSettings(company, session);
        if (settings) {
          const mediaResponse = await axios.get(`${settings.apiUrl}/api/${session}/messages/${payload.id}/media`, {
            headers: { 'X-Api-Key': settings.apiKey },
            responseType: 'json'
          });
          if (mediaResponse.data && mediaResponse.data.data) {
            mediaData = {
              data: mediaResponse.data.data, // Base64
              mimeType: mediaResponse.data.mimetype || 'image/jpeg'
            };
            console.log(`[WAHA] Media downloaded for message ${payload.id}`);
          }
        }
      } catch (mediaErr: any) {
        console.error("[WAHA] Failed to download media:", mediaErr.message);
      }
    }

    const lowerMsg = message.toLowerCase().trim();
    const words = message.trim().split(/\s+/);
    const gratitudeKeywords = ['terima kasih', 'terimakasih', 'thanks', 'thankyou', 'thank you', 'tengkyu', 'nuhun', 'matur nuwun', 'syukron', 'makasih', 'mks', 'thx'];
    
    // 0.1. Handle Terima Kasih (Sama-sama ka) - Respon Pendek Tanpa Informasi Tambahan
    const isPureGratitude = gratitudeKeywords.some(k => 
      lowerMsg === k || 
      lowerMsg === k + ' ka' || 
      lowerMsg === k + ' kak' || 
      lowerMsg === k + ' infonya ka' || 
      lowerMsg === k + ' infonya kak' ||
      lowerMsg === k + ' ya ka' ||
      lowerMsg === k + ' ya kak' ||
      lowerMsg === 'ok ' + k ||
      lowerMsg === 'oke ' + k ||
      lowerMsg === 'siap ' + k
    );

    if (isPureGratitude) {
      await sendWahaMessage(fromRaw, "sama-sama ka", company, session);
      await addWahaLog('AI_COMPLETED', { from, reply: "sama-sama ka (Pure Gratitude)" });
      return res.status(200).json({ status: "success_gratitude" });
    }

    // 0.2. Chat cuma 1 kata diabaikan (kecuali ada media/gambar)
    if (words.length < 2 && !payload.hasMedia) {
      console.log(`[WAHA] Pesan hanya ${words.length} kata dari ${from}, diabaikan.`);
      return res.status(200).json({ status: "ignored_one_word" });
    }
    
    // Cek jika pesan hanya berisi emoticon/emoji (tanpa teks/angka)
    const emojiRegex = /^(\s|[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}])+$/u;
    if (emojiRegex.test(message) && message.trim().length > 0) {
      console.log(`[WAHA] Pesan hanya emoji dari ${from}, diabaikan.`);
      return res.status(200).json({ status: "ignored_emoji" });
    }

    const isGroup = fromRaw.endsWith('@g.us');
    if (isGroup) {
      return res.status(200).json({ status: "ignored_group" });
    }

    // 2. Command Sederhana (Prioritas untuk Karyawan)
    if (lowerMsg === '!jadwal' && emp) {
      const today = new Date().toISOString().split('T')[0];
      const { data: shiftAssignments } = await supabase.from('shift_assignments').select('*, shifts(*)').eq('employeeId', emp.id).eq('date', today);
      let reply = `📅 JADWAL SHIFT HARI INI 📅\n\nHalo ${emp.nama},\n\n`;
      if (shiftAssignments && shiftAssignments.length > 0) {
        shiftAssignments.forEach((a: any) => {
          reply += `🔹 ${a.shifts?.name || 'Shift'}\n⏰ ${a.shifts?.startTime || '-'} - ${a.shifts?.endTime || '-'}\n`;
        });
      } else {
        reply += `Anda tidak memiliki jadwal shift hari ini (${today}).`;
      }
      await sendWahaMessage(fromRaw, reply, emp.company, session);
      return res.status(200).json({ status: "success_jadwal" });
    }

    if (lowerMsg === '!absen' && emp) {
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase.from('attendance').select('*').eq('employeeId', emp.id).eq('date', today).maybeSingle();
      let reply = `✅ STATUS ABSENSI HARI INI ✅\n\nHalo ${emp.nama},\n\n`;
      if (attendance) {
        reply += `📍 Status: ${attendance.status}\n🕒 Masuk: ${attendance.clockIn || '-'}\n🕒 Pulang: ${attendance.clockOut || '-'}`;
      } else {
        reply += `Anda belum melakukan absensi hari ini (${today}). Jangan lupa absen ya!`;
      }
      await sendWahaMessage(fromRaw, reply, emp.company, session);
      return res.status(200).json({ status: "success_absen" });
    }

    if (lowerMsg === '!libur') {
      const today = new Date().toISOString().split('T')[0];
      const targetCompany = emp?.company || 'VISIBEL';
      const { data: allEmployees } = await supabase.from('employees').select('id, nama').eq('company', targetCompany);
      const { data: assignments } = await supabase.from('shift_assignments').select('employeeId').eq('date', today).eq('company', targetCompany);
      const assignedEmpIds = new Set(assignments?.map((a: any) => a.employeeId) || []);
      const offEmployees = allEmployees?.filter((e: any) => !assignedEmpIds.has(e.id)) || [];
      let reply = `🏖️ KARYAWAN LIBUR HARI INI 🏖️\n\nTanggal: ${today}\n\n`;
      if (offEmployees.length > 0) {
        offEmployees.forEach((e: any, index: number) => reply += `${index + 1}. ${e.nama}\n`);
      } else {
        reply += `Semua karyawan memiliki jadwal hari ini.`;
      }
      await sendWahaMessage(fromRaw, reply, targetCompany, session);
      return res.status(200).json({ status: "success_libur" });
    }

    // 3. AI Fallback (Untuk semua chat pribadi)
    let processedMsg = message;
    if (lowerMsg.startsWith('ai ')) processedMsg = message.substring(3).trim();
    else if (lowerMsg.startsWith('vis ')) processedMsg = message.substring(4).trim();

    await addWahaLog('AI_START', { from, message: processedMsg.substring(0, 50) });
    
    try {
      const aiReply = await generateGeminiResponse(processedMsg, company, emp, from, mediaData);
      
      if (aiReply) {
        await addWahaLog('AI_COMPLETED', { from, reply: aiReply.substring(0, 50) });
        await sendWahaMessage(fromRaw, aiReply, company, session);
        await addWahaLog('AI_REPLY_SENT', { to: fromRaw, length: aiReply.length, session });
      } else {
        await addWahaLog('AI_EMPTY_REPLY', { from });
      }
    } catch (aiErr: any) {
      console.error("[AI ERROR IN WEBHOOK]", aiErr);
      await addWahaLog('AI_PROCESS_ERROR', { error: aiErr.message });
      // Kirim pesan fallback jika AI gagal
      const fallback = emp?.company === 'VISIBEL' 
        ? "Halo Tim, maaf Vis lagi ada kendala teknis sebentar. Butuh apa nih? Biar tim lain bantu."
        : "Halo ka, maaf Vis lagi istirahat sebentar. Ada yang bisa dibantu?";
      await sendWahaMessage(fromRaw, fallback, company, session);
    }

    return res.status(200).json({ status: "success_ai" });

  } catch (err: any) {
    console.error("[WEBHOOK ERROR]", err);
    addWahaLog('WEBHOOK_ERROR', { error: err.message });
    return res.status(200).json({ status: "error" });
  }
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

// ============================================================
// AGENT API ENDPOINTS (For OpenClaw / AI Agents)
// ============================================================

// Middleware for Agent API Authentication
const agentAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-agent-key'];
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const masterKey = process.env.AGENT_API_KEY || 'visibel-agent-viewer-2024';
  
  // Track the request
  addAgentLog('ACCESS', {
    method: req.method,
    url: req.originalUrl,
    userAgent: userAgent,
    authorized: apiKey === masterKey,
    ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown'
  });

  if (apiKey !== masterKey) {
    return res.status(401).json({ error: "Unauthorized. Invalid Agent Key." });
  }
  next();
};

app.get("/api/agent/v1", (req, res) => {
  res.json({ 
    status: "online", 
    message: "Majova Agent API v1 is active. Use the sub-endpoints for data access.",
    endpoints: [
      "/api/agent/v1/status",
      "/api/agent/v1/employees",
      "/api/agent/v1/schedules",
      "/api/agent/v1/reports",
      "/api/agent/v1/brands",
      "/api/agent/v1/short-video",
      "/api/agent/v1/advertising",
      "/api/agent/v1/attendance",
      "/api/agent/v1/recruitment",
      "/api/agent/v1/logs"
    ]
  });
});

app.get("/api/agent/v1/status", agentAuth, (req, res) => {
  res.json({ status: "online", version: "1.0.0", agent: "authorized" });
});

app.get("/api/agent/v1/logs", agentAuth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'agent_tracking_logs')
      .maybeSingle();
    res.json(data?.value || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/employees", agentAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('employees').select('id, nama, jabatan, company').is('deleted_at', null);
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/schedules", agentAuth, async (req, res) => {
  try {
    const { date, brand, startDate, endDate } = req.query;
    let query = supabase.from('schedules').select('*');
    
    if (date) {
      query = query.eq('date', date);
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else {
      // Default today
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('date', today);
    }
    
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }
    
    const { data: schedules, error: scheduleError } = await query.order('date', { ascending: true });
    if (scheduleError) throw scheduleError;

    // Fetch employee names to perform in-memory join (to avoid relationship cache issues)
    const { data: emps, error: empError } = await supabase.from('employees').select('id, nama');
    if (empError) throw empError;

    const empMap = new Map();
    (emps || []).forEach((e: any) => empMap.set(e.id, e.nama));

    const result = (schedules || []).map((s: any) => ({
      ...s,
      hostName: s.hostId ? empMap.get(s.hostId) : null,
      opName: s.opId ? empMap.get(s.opId) : null
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/reports", agentAuth, async (req, res) => {
  try {
    const { startDate, endDate, brand, limit = 50 } = req.query;
    let query = supabase.from('live_reports').select('*');
    
    if (startDate && endDate) {
      query = query.gte('tanggal', startDate).lte('tanggal', endDate);
    } else {
      // Last 7 days if not specified
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte('tanggal', start).lte('tanggal', end);
    }
    
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }
    
    const { data, error } = await query.order('tanggal', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/brands", agentAuth, async (req, res) => {
  try {
    const { company } = req.query;
    if (!company) return res.status(400).json({ error: "Company parameter is required" });
    
    const { data, error } = await supabase.from('settings').select('value').eq('key', `live_brands_${company}`).maybeSingle();
    if (error) throw error;
    res.json(data?.value || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/short-video", agentAuth, async (req, res) => {
  try {
    const { brand, creatorId, startDate, endDate, limit = 50 } = req.query;
    let query = supabase.from('content_plans').select('*');
    
    if (startDate && endDate) {
      query = query.gte('postingDate', startDate).lte('postingDate', endDate);
    }
    if (brand) query = query.ilike('brand', `%${brand}%`);
    if (creatorId) query = query.eq('creatorId', creatorId);
    
    const { data, error } = await query.order('postingDate', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/advertising", agentAuth, async (req, res) => {
  try {
    const { brand, startDate, endDate, limit = 50 } = req.query;
    let query = supabase.from('advertising_records').select('*');
    
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    if (brand) query = query.ilike('brand', `%${brand}%`);
    
    const { data, error } = await query.order('date', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/attendance", agentAuth, async (req, res) => {
  try {
    const { employeeId, date, startDate, endDate, limit = 100 } = req.query;
    let query = supabase.from('attendance').select('*');
    
    if (date) {
      query = query.eq('date', date);
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    if (employeeId) query = query.eq('employeeId', employeeId);
    
    const { data, error } = await query.order('date', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/recruitment", agentAuth, async (req, res) => {
  try {
    const { status, posisi, limit = 50 } = req.query;
    let query = supabase.from('candidates').select('*');
    
    if (status) query = query.eq('status', status);
    if (posisi) query = query.ilike('posisi', `%${posisi}%`);
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/short-video", agentAuth, async (req, res) => {
  try {
    const { brand, creatorId, startDate, endDate, limit = 50 } = req.query;
    let query = supabase.from('content_plans').select('*');
    
    if (startDate && endDate) {
      query = query.gte('postingDate', startDate).lte('postingDate', endDate);
    }
    if (brand) query = query.ilike('brand', `%${brand}%`);
    if (creatorId) query = query.eq('creatorId', creatorId);
    
    const { data, error } = await query.order('postingDate', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/advertising", agentAuth, async (req, res) => {
  try {
    const { brand, startDate, endDate, limit = 50 } = req.query;
    let query = supabase.from('advertising_records').select('*');
    
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    if (brand) query = query.ilike('brand', `%${brand}%`);
    
    const { data, error } = await query.order('date', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/attendance", agentAuth, async (req, res) => {
  try {
    const { employeeId, date, startDate, endDate, limit = 100 } = req.query;
    let query = supabase.from('attendance').select('*');
    
    if (date) {
      query = query.eq('date', date);
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    if (employeeId) query = query.eq('employeeId', employeeId);
    
    const { data, error } = await query.order('date', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/agent/v1/recruitment", agentAuth, async (req, res) => {
  try {
    const { status, posisi, limit = 50 } = req.query;
    let query = supabase.from('candidates').select('*');
    
    if (status) query = query.eq('status', status);
    if (posisi) query = query.ilike('posisi', `%${posisi}%`);
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(Number(limit));
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback for Agent API to prevent HTML response
app.use("/api/agent/*", (req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found", 
    path: req.originalUrl,
    message: "The requested agent API endpoint does not exist. Check /api/agent/v1 for available endpoints."
  });
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
