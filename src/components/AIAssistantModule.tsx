
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AIAssistantModuleProps {
  userCompany: string;
  userRole: string;
}

const AIAssistantModule: React.FC<AIAssistantModuleProps> = ({ userCompany, userRole }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchKnowledgeBase();
    // Initial greeting
    setMessages([
      { role: 'model', content: `Halo! Saya adalah AI Assistant untuk ${userCompany}. Ada yang bisa saya bantu terkait informasi Visibel atau operasional lainnya?` }
    ]);
  }, [userCompany]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchKnowledgeBase = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `gemini_knowledge_base_${userCompany}`)
        .single();
      if (data && typeof data.value === 'string') {
        setKnowledgeBase(data.value);
      }
    } catch (e) {
      console.error("Failed to fetch knowledge base");
    }
  };

  const handleSaveKnowledgeBase = async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: `gemini_knowledge_base_${userCompany}`,
          value: knowledgeBase
        }, { onConflict: 'key' });
      if (error) throw error;
      alert("Knowledge Base berhasil disimpan!");
      setIsSettingsOpen(false);
    } catch (e: any) {
      alert("Gagal menyimpan: " + e.message);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key tidak ditemukan. Silakan hubungi admin.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemPrompt = `
        Anda adalah AI Assistant untuk perusahaan bernama ${userCompany}.
        Informasi tentang perusahaan (Knowledge Base):
        ${knowledgeBase || 'Belum ada informasi spesifik.'}
        
        Tugas Anda adalah membantu menjawab pertanyaan pengguna berdasarkan informasi di atas.
        Jika pertanyaan tidak relevan dengan perusahaan atau knowledge base, jawablah dengan sopan bahwa Anda fokus pada informasi ${userCompany}.
        Gunakan bahasa Indonesia yang ramah dan profesional.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: userMessage }] }
        ]
      });

      const modelResponse = response.text || "Maaf, saya tidak bisa memproses permintaan Anda saat ini.";
      
      setMessages(prev => [...prev, { role: 'model', content: modelResponse }]);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="bg-white border-bottom border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Icons.MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">AI Assistant</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Powered by Gemini AI
            </p>
          </div>
        </div>
        
        {['owner', 'super', 'admin'].includes(userRole) && (
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="Knowledge Base Settings"
          >
            <Icons.Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Tanyakan sesuatu tentang Visibel..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center"
              >
                <Icons.Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Sidebar (Knowledge Base) */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Icons.Database className="w-4 h-4 text-indigo-600" />
                  Knowledge Base
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <p className="text-xs text-slate-500 mb-3">
                  Masukkan informasi detail tentang perusahaan, layanan, atau aturan yang ingin diketahui oleh AI.
                </p>
                <textarea
                  value={knowledgeBase}
                  onChange={(e) => setKnowledgeBase(e.target.value)}
                  placeholder="Contoh: Visibel adalah agency yang fokus pada live streaming dan content creation..."
                  className="w-full h-[calc(100%-60px)] p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleSaveKnowledgeBase}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-100"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIAssistantModule;
