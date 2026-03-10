
import { GoogleGenAI, Type } from "@google/genai";
import { Employee } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Cache sederhana untuk menghindari pemanggilan ulang yang tidak perlu
let analysisCache: { data: string; timestamp: number } | null = null;
let lastRequestTime = 0;

const ensurePaidKey = async () => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }
};

const callWithRetry = async (fn: () => Promise<any>, maxRetries = 2): Promise<any> => {
  // Mekanisme Throttling: Pastikan ada jeda minimal 2 detik antar request
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 2000) {
    await delay(2000 - timeSinceLastRequest);
  }

  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      lastRequestTime = Date.now();
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message?.toLowerCase() || "";
      const isRateLimit = errorMsg.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      
      // Fix: Handle key selection reset if error is "Requested entity was not found"
      if (errorMsg.includes("requested entity was not found")) {
         if (typeof window !== 'undefined' && (window as any).aistudio) {
           await (window as any).aistudio.openSelectKey();
         }
      }

      if (isRateLimit) {
        // Jika berbayar tapi tetap limit, berikan jeda sangat panjang (10 detik)
        const waitTime = 10000 + (Math.random() * 2000);
        console.warn(`Quota Limit (429). Menunggu ${Math.round(waitTime/1000)} detik sebelum mencoba lagi...`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const analyzeEmployees = async (employees: Employee[]): Promise<string> => {
  // Kembalikan cache jika analisis dilakukan kurang dari 5 menit yang lalu
  if (analysisCache && (Date.now() - analysisCache.timestamp < 300000)) {
    return analysisCache.data;
  }

  await ensurePaidKey();
  
  // Ambil hanya data esensial untuk menghemat token dan proses
  const summaryData = employees.slice(0, 20).map(e => ({
    n: e.nama,
    j: e.jabatan,
    h: e.hutang
  }));

  try {
    // Buat instance tepat sebelum panggil
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: `Berikan 2 kalimat singkat analisis HR untuk data ini: ${JSON.stringify(summaryData)}`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    }));

    const result = response.text || "Analisis selesai.";
    analysisCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error: any) {
    return "Sistem AI sedang memproses banyak permintaan. Silakan cek kembali beberapa saat lagi.";
  }
};

export const smartSearch = async (employees: Employee[], query: string): Promise<string[]> => {
  await ensurePaidKey();
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Cari ID dari query: "${query}" di data: ${JSON.stringify(employees.slice(0, 50).map(e => ({id: e.id, n: e.nama})))}. Balas hanya array JSON ID.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }));
    return JSON.parse(response.text.trim());
  } catch {
    return [];
  }
};
