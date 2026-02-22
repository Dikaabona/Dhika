
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Icons } from '../constants';
import * as XLSX from 'xlsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface MinVisModuleProps {
  onClose: () => void;
}

const MinVisModule: React.FC<MinVisModuleProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Halo! Saya MinVis, Digital Marketing & HR Expert Visibel ID. Ada yang bisa saya bantu analisa hari ini? Saya siap bantu strategi live streaming, ads, ide konten FYP, hingga pembuatan SOP & KPI perusahaan. Langsung aja tanya ya!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleExportToExcel = (content: string, title: string = 'SOP_Visibel') => {
    try {
      // Simple parsing: split by lines and try to create a basic structure
      const lines = content.split('\n').map(line => [line]);
      const ws = XLSX.utils.aoa_to_sheet(lines);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
    } catch (err) {
      console.error("Export Error:", err);
      alert("Gagal mengekspor ke Excel");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setSelectedImage({
        data: base64,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const currentImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      imageUrl: currentImage ? `data:${currentImage.mimeType};base64,${currentImage.data}` : undefined
    }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [{ text: userMessage || "Apa yang ada di gambar ini?" }];
      if (currentImage) {
        parts.push({
          inlineData: {
            data: currentImage.data,
            mimeType: currentImage.mimeType
          }
        });
      }

      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: [
          { role: 'user', parts }
        ],
        config: {
          systemInstruction: `Anda adalah 'MinVis', Senior Digital Marketing & HR Expert di Visibel ID dengan pengalaman lebih dari 7 tahun. 

DATA PERUSAHAAN VISIBEL:
- Nama: Visibel ID
- Alamat: Jln ciomas harapan kp neglasari RT 01/12 no 4, Kab Bogor, Jawa barat 16610
- No Telepon: 08111743005
- Email: kontakvisibel@gmail.com

TUGAS UTAMA ANDA:
1. Menganalisis performa live streaming (Shopee/TikTok), strategi video pendek, serta optimasi Ads.
2. Bertindak sebagai Konsultan HR Profesional: Anda ahli dalam membuat SOP (Standard Operating Procedure) dan KPI (Key Performance Indicator).
3. KHUSUS SOP: Jika ada yang meminta dibuatkan SOP, Anda HARUS langsung menyusunnya dengan lengkap dan menyertakan KOP SURAT VISIBEL di bagian atas dengan format:
   
   VISIBEL ID
   Jln ciomas harapan kp neglasari RT 01/12 no 4, Kab Bogor, Jawa barat 16610
   Telepon: 08111743005 | Email: kontakvisibel@gmail.com
   -------------------------------------------------------------------------
   [JUDUL SOP]
   
4. Gaya Bahasa: Profesional namun santai (seperti rekan kerja). To-the-point dan memberikan Actionable Steps.
5. Referensi Kreatif: Untuk konten FYP, gunakan gaya storytelling @leo_giovannii.

Jika tim bertanya tentang strategi, berikan langkah konkret 1, 2, 3 yang bisa langsung dieksekusi.`,
          temperature: 0.7,
        },
      });

      let assistantResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      for await (const chunk of stream) {
        assistantResponse += chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantResponse;
          return newMessages;
        });
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      const errorMsg = error?.message?.toLowerCase() || "";
      
      // Jika kunci tidak valid atau tidak ditemukan
      if (errorMsg.includes("requested entity was not found")) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sistem mendeteksi kesalahan pada konfigurasi model AI. Silakan hubungi administrator.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, lagi ada gangguan di sistem AI nih. Coba lagi bentar ya!' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const presetPrompts = [
    "Buat SOP Host Live Streaming",
    "Ide konten FYP brand Hijab",
    "Analisa KPI Crew Production",
    "Strategi Scale up TikTok Ads",
    "Buat SOP Penanganan Komplain Customer"
  ];

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] md:rounded-[48px] overflow-hidden shadow-2xl border-x sm:border-[12px] border-white max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-6 py-6 bg-white border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90">
            <Icons.Home className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              <span className="text-[#FFC000]">MINVIS</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Digital Marketing Specialist Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
             <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">POWERED BY</p>
             <p className="text-[9px] font-black text-indigo-500 uppercase">Gemini 3.1 Pro</p>
          </div>
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-[#FFC000] shadow-lg">
             <Icons.Cpu className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto px-6 py-10 space-y-8 custom-scrollbar bg-[#f8fafc]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] sm:max-w-[75%] p-5 sm:p-7 rounded-[32px] shadow-sm border ${
              msg.role === 'user' 
                ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[8px] font-black text-[#FFC000] uppercase tracking-widest">MINVIS EXPERT</p>
                  {msg.content.length > 50 && (
                    <button 
                      onClick={() => handleExportToExcel(msg.content)}
                      className="flex items-center gap-1 text-[8px] font-black text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest"
                      title="Download as Excel"
                    >
                      <Icons.FileText className="w-3 h-3" />
                      Export Excel
                    </button>
                  )}
                </div>
              )}
              {msg.imageUrl && (
                <div className="mb-3 rounded-2xl overflow-hidden border border-white/10">
                  <img src={msg.imageUrl} alt="User upload" className="max-w-full h-auto" />
                </div>
              )}
              <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-6 rounded-[32px] rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-3">
               <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sedang Berpikir...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Presets & Input */}
      <div className="p-6 bg-white border-t shrink-0">
        {selectedImage && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-bottom-2">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm">
              <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Preview" className="w-full h-full object-cover" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-0 right-0 bg-rose-500 text-white p-1 rounded-bl-xl hover:bg-rose-600 transition-colors"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gambar Terpilih</p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
          {presetPrompts.map((p, i) => (
            <button 
              key={i} 
              onClick={() => setInput(p)}
              className="whitespace-nowrap px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-3 relative">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-50 border-2 border-slate-100 text-slate-400 p-4 rounded-3xl hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-90"
          >
            <Icons.Image className="w-6 h-6" />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya strategi marketing atau buat SOP ke MinVis..."
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 text-sm font-medium outline-none focus:border-[#FFC000] focus:bg-white transition-all shadow-inner text-slate-900"
          />
          <button 
            type="submit" 
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 text-[#FFC000] p-4 rounded-2xl shadow-xl transition-all active:scale-90 hover:bg-black disabled:opacity-30"
          >
            <Icons.Plus className="w-6 h-6 rotate-45" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MinVisModule;
