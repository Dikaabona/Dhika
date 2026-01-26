
import { GoogleGenAI, Type } from "@google/genai";
import { Employee } from "../types";

export const analyzeEmployees = async (employees: Employee[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Berikut adalah data karyawan perusahaan:
    ${JSON.stringify(employees)}

    Berikan ringkasan singkat dalam Bahasa Indonesia mengenai komposisi karyawan ini (contoh: rentang umur, bank terbanyak digunakan, rata-rata masa kerja).
    Juga berikan 1 saran strategis untuk HR.
    Gunakan format ringkas 3-4 kalimat saja.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Tidak dapat menganalisis data saat ini.";
  } catch (error) {
    console.error("AI analysis error:", error);
    return "Terjadi kesalahan saat menghubungi asisten AI.";
  }
};

export const smartSearch = async (employees: Employee[], query: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      Cari ID karyawan dari daftar berikut berdasarkan kriteria: "${query}"
      Daftar Karyawan: ${JSON.stringify(employees.map(e => ({ id: e.id, nama: e.nama, bank: e.bank, tglMasuk: e.tanggalMasuk })))}
      
      Kembalikan hanya array ID yang cocok.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch {
    return [];
  }
};
