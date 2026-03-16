
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { ContentPlan, Employee } from '../types';
import { Icons } from '../constants';
import { GoogleGenAI } from "@google/genai";

interface ContentReportProps {
  plans: ContentPlan[];
  employees: Employee[];
  company: string;
  onClose: () => void;
}

const COLORS = ['#1E6BFF', '#FFC000', '#059669', '#EF4444', '#8B5CF6', '#EC4899'];

const ContentReport: React.FC<ContentReportProps> = ({ plans, employees, company, onClose }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Default to first day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(plans.map(p => p.brand).filter(Boolean)));
    return ['ALL', ...uniqueBrands.sort()];
  }, [plans]);

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesBrand = selectedBrand === 'ALL' || p.brand === selectedBrand;
      const matchesDate = (!startDate || (p.postingDate && p.postingDate >= startDate)) && 
                          (!endDate || (p.postingDate && p.postingDate <= endDate));
      return matchesBrand && matchesDate;
    });
  }, [plans, selectedBrand, startDate, endDate]);

  const stats = useMemo(() => {
    const brandData: Record<string, any> = {};
    const pillarData: Record<string, any> = {};
    
    filteredPlans.forEach(p => {
      const brand = p.brand || 'Unknown';
      const pillar = p.contentPillar || 'Other';
      const interactions = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
      const views = p.views || 0;

      if (!brandData[brand]) {
        brandData[brand] = { name: brand, views: 0, interactions: 0, count: 0 };
      }
      brandData[brand].views += views;
      brandData[brand].interactions += interactions;
      brandData[brand].count += 1;

      if (!pillarData[pillar]) {
        pillarData[pillar] = { name: pillar, views: 0, interactions: 0, count: 0 };
      }
      pillarData[pillar].views += views;
      pillarData[pillar].interactions += interactions;
      pillarData[pillar].count += 1;
    });

    const brandChart = Object.values(brandData).map(b => ({
      ...b,
      er: b.views > 0 ? ((b.interactions / b.views) * 100).toFixed(2) : 0
    }));

    const pillarChart = Object.values(pillarData).map(p => ({
      ...p,
      er: p.views > 0 ? ((p.interactions / p.views) * 100).toFixed(2) : 0
    }));

    const topContent = [...filteredPlans]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    const scalableContent = [...filteredPlans]
      .filter(p => (p.views || 0) > 0)
      .sort((a, b) => {
        const erA = ((a.likes || 0) + (a.comments || 0) + (a.saves || 0) + (a.shares || 0)) / (a.views || 1);
        const erB = ((b.likes || 0) + (b.comments || 0) + (b.saves || 0) + (b.shares || 0)) / (b.views || 1);
        return erB - erA;
      })
      .slice(0, 5);

    return { brandChart, pillarChart, topContent, scalableContent };
  }, [filteredPlans]);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `
        Analyze this content performance data for ${company} (Filtered by Brand: ${selectedBrand}):
        Brands: ${JSON.stringify(stats.brandChart)}
        Pillars: ${JSON.stringify(stats.pillarChart)}
        Top Content: ${JSON.stringify(stats.topContent.map(c => ({ title: c.title, views: c.views, brand: c.brand })))}
        
        Please provide:
        1. A summary of overall performance.
        2. Which brand/pillar is performing best and why.
        3. Which content pillar should be scaled.
        4. 3 actionable suggestions for the next month.
        Keep it concise and professional in Indonesian.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text || "Gagal mendapatkan analisis.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiAnalysis("Terjadi kesalahan saat menghubungi AI. Pastikan API Key sudah terpasang.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl hover:bg-black transition-all shrink-0">
            <Icons.ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Content Performance Report</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Analytics & AI Insights</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-1">
              <div className="flex flex-col items-start min-w-[100px]">
                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mulai</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
                />
              </div>
              <div className="h-6 w-px bg-slate-100"></div>
              <div className="flex flex-col items-start min-w-[100px]">
                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sampai</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm gap-2">
            {brands.map(b => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedBrand === b 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button 
            onClick={handleAiAnalysis}
            disabled={isAnalyzing}
            className="bg-[#FFC000] text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black hover:text-white transition-all disabled:opacity-50 flex items-center gap-3"
          >
            {isAnalyzing ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : <Icons.Sparkles className="w-4 h-4" />}
            {isAnalyzing ? 'MENGANALISIS...' : 'TANYA AI ANALYSIS'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 space-y-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Views per Brand</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.brandChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="views" fill="#1E6BFF" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 space-y-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Engagement Rate per Pillar</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pillarChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="interactions"
                >
                  {stats.pillarChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {aiAnalysis && (
        <div className="bg-slate-900 p-10 rounded-[48px] text-white shadow-2xl space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-[#FFC000] p-3 rounded-xl text-black">
              <Icons.Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight">AI Strategic Insights ({selectedBrand})</h3>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
              {aiAnalysis}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-5 md:p-10 rounded-[32px] md:rounded-[48px] shadow-sm border border-slate-100 space-y-5 md:space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[12px] md:text-sm font-black text-slate-900 uppercase tracking-widest truncate">Top Performing Content</h3>
            <div className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-3 py-1.5 rounded-full uppercase shrink-0 shadow-sm border border-emerald-100/50">BY VIEWS</div>
          </div>
          <div className="space-y-4 md:space-y-6">
            {stats.topContent.map((p, i) => (
              <div key={i} className="grid grid-cols-[32px_1fr_75px] md:grid-cols-[48px_1fr_100px] items-center gap-4 p-4 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-600 text-[11px] md:text-lg shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] md:text-base font-black text-slate-900 uppercase truncate leading-tight">{p.title}</p>
                  <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase truncate mt-1.5">{p.brand} • {p.contentPillar}</p>
                  {p.linkPostingan && (
                    <a href={p.linkPostingan} target="_blank" rel="noreferrer" className="text-[9px] md:text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-3 inline-flex items-center gap-1.5 hover:text-indigo-800 transition-colors">
                      <Icons.Play className="w-2.5 h-2.5 fill-current" /> LIHAT VIDEO
                    </a>
                  )}
                </div>
                <div className="text-right pl-3 border-l border-slate-100">
                  <p className="text-xs md:text-lg font-black text-slate-900">{(p.views || 0).toLocaleString()}</p>
                  <p className="text-[8px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">VIEWS</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 md:p-10 rounded-[32px] md:rounded-[48px] shadow-sm border border-slate-100 space-y-5 md:space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[12px] md:text-sm font-black text-slate-900 uppercase tracking-widest truncate">Scalable Content</h3>
            <div className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-3 py-1.5 rounded-full uppercase shrink-0 shadow-sm border border-indigo-100/50">BY ENGAGEMENT</div>
          </div>
          <div className="space-y-4 md:space-y-6">
            {stats.scalableContent.map((p, i) => (
              <div key={i} className="grid grid-cols-[32px_1fr_75px] md:grid-cols-[48px_1fr_100px] items-center gap-4 p-4 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-600 text-[11px] md:text-lg shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] md:text-base font-black text-slate-900 uppercase truncate leading-tight">{p.title}</p>
                  <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase truncate mt-1.5">{p.brand} • {p.contentPillar}</p>
                  {p.linkPostingan && (
                    <a href={p.linkPostingan} target="_blank" rel="noreferrer" className="text-[9px] md:text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-3 inline-flex items-center gap-1.5 hover:text-indigo-800 transition-colors">
                      <Icons.Play className="w-2.5 h-2.5 fill-current" /> LIHAT VIDEO
                    </a>
                  )}
                </div>
                <div className="text-right pl-3 border-l border-slate-100">
                  <p className="text-xs md:text-lg font-black text-indigo-600">{(((p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0)) / (p.views || 1) * 100).toFixed(2)}%</p>
                  <p className="text-[8px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">ENGAGEMENT</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


export default ContentReport;
