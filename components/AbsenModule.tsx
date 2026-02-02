
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface AbsenModuleProps {
  employee: Employee | null;
  attendanceRecords: AttendanceRecord[];
  onSuccess: () => void;
  onClose?: () => void;
}

const AbsenModule: React.FC<AbsenModuleProps> = ({ employee, attendanceRecords, onSuccess, onClose }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [localTodayRecord, setLocalTodayRecord] = useState<AttendanceRecord | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const getTodayLocalStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayLocalStr();

  useEffect(() => {
    if (employee) {
      const record = attendanceRecords.find(
        r => r.employeeId === employee.id && r.date === todayStr
      );
      setLocalTodayRecord(record || null);
    }
  }, [attendanceRecords, employee, todayStr]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        } 
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Kamera tidak aktif:", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return null;

    // RESOLUSI DIOPTIMALKAN: 320x320 sudah sangat cukup untuk verifikasi wajah
    // Ukuran file dengan quality 0.5 biasanya berkisar antara 20kb - 40kb
    const SIZE = 320; 
    canvas.width = SIZE;
    canvas.height = SIZE;
    
    // Mirroring untuk kamera depan agar natural
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    
    const minSize = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minSize) / 2;
    const startY = (video.videoHeight - minSize) / 2;
    
    context.drawImage(video, startX, startY, minSize, minSize, 0, 0, SIZE, SIZE);
    
    // QUALITY 0.5 menjamin file jauh di bawah 200kb tanpa mengorbankan detail wajah yang diperlukan
    return canvas.toDataURL('image/jpeg', 0.5); 
  };

  const handleAbsenUlang = async () => {
    if (!employee || !localTodayRecord) return;
    if (!window.confirm("Yakin ingin menghapus data absensi hari ini dan mulai ulang?")) return;

    setIsLoading(true);
    try {
      const query = supabase.from('attendance').delete();
      const { error } = localTodayRecord.id 
        ? await query.eq('id', localTodayRecord.id)
        : await query.match({ employeeId: employee.id, date: todayStr });

      if (error) throw error;
      
      setLocalTodayRecord(null);
      onSuccess();
    } catch (err: any) {
      alert("Gagal mereset absen: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbsenAction = async () => {
    if (!employee) return;
    setIsLoading(true);

    try {
      const photo = capturePhoto();
      if (!photo) throw new Error("Kamera gagal mengambil gambar.");

      let locStr = "Lokasi tidak terdeteksi";
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        locStr = `${position.coords.latitude}, ${position.coords.longitude}`;
      } catch (e) {}

      const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const isClockIn = !localTodayRecord || !localTodayRecord.clockIn;
      
      const updateData: any = {
        employeeId: employee.id,
        date: todayStr,
        status: 'Hadir'
      };

      if (localTodayRecord?.id) updateData.id = localTodayRecord.id;

      if (isClockIn) {
        updateData.clockIn = nowTime;
        updateData.photoIn = photo;
        updateData.notes = `Verifikasi Masuk di ${locStr}`;
      } else {
        if (localTodayRecord.clockOut) {
          setIsLoading(false);
          return;
        }
        updateData.clockOut = nowTime;
        updateData.photoOut = photo;
        updateData.notes = (localTodayRecord.notes || '') + ` | Keluar di ${locStr}`;
        updateData.clockIn = localTodayRecord.clockIn;
      }

      const { data, error } = await supabase.from('attendance').upsert(updateData).select();
      if (error) throw error;
      
      setLocalTodayRecord(data?.[0] || updateData);
      onSuccess();
    } catch (err: any) {
      alert("Gagal melakukan absensi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!employee) return null;
  const isFinished = !!(localTodayRecord?.clockIn && localTodayRecord?.clockOut);

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-md mx-auto relative shadow-2xl overflow-hidden animate-in fade-in duration-700">
      
      {/* Top Navigation */}
      <div className="flex justify-between items-center px-6 pt-10 z-10">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-full text-slate-400 hover:bg-white hover:text-slate-900 transition-all active:scale-90">
          <Icons.Home className="w-4 h-4" />
        </button>
        <img src="https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA" alt="Logo" className="h-10 w-auto" />
        <div className="w-10"></div>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col items-center mt-8 px-6 text-center">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
          {employee.nama}
        </h2>
        <div className="h-1 w-8 bg-[#FFC000] rounded-full mt-3"></div>
      </div>

      {/* Camera Viewport */}
      <div className="flex-grow flex flex-col items-center justify-center -mt-4">
        <div className="relative group">
          <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-8 border-white bg-slate-50 shadow-2xl overflow-hidden relative z-10 transition-transform duration-700 group-hover:scale-[1.02]">
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Icons.Camera className="w-10 h-10 text-slate-200" />
                <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">Inisialisasi...</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {/* Abstract background glow */}
          <div className="absolute inset-0 bg-[#FFC000]/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        </div>

        {/* Digital Clock Section */}
        <div className="mt-10 text-center space-y-1">
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] pt-1">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Action Area */}
      <div className="pb-16 pt-8 flex flex-col items-center px-10">
        <button 
          onClick={handleAbsenAction}
          disabled={isLoading || isFinished}
          className="relative group transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
        >
          <div className="bg-slate-900 text-[#FFC000] p-8 rounded-[32px] shadow-2xl shadow-slate-200 group-hover:bg-black transition-all">
            <Icons.Camera className="w-10 h-10" />
          </div>
          
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 flex flex-col items-center w-max">
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 leading-none">
              {isFinished ? 'TUNTAS' : isLoading ? 'PROSES...' : localTodayRecord?.clockIn ? 'PULANG' : 'MASUK'}
            </span>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-2">VERIFIKASI BIOMETRIK & GPS</p>
          </div>
        </button>

        {localTodayRecord && (
          <button 
            onClick={handleAbsenUlang}
            disabled={isLoading}
            className="mt-28 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] hover:text-rose-500 transition-colors"
          >
            Mulai Ulang Absensi
          </button>
        )}
      </div>

    </div>
  );
};

export default AbsenModule;
