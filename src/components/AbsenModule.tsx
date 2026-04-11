
import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, AttendanceSettings } from '../types';
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { transformGoogleDriveUrl } from '../utils/imageUtils';
import * as faceapi from '@vladmandic/face-api';

interface AbsenModuleProps {
  employee: Employee | null;
  attendanceRecords: AttendanceRecord[];
  company: string; 
  onSuccess: () => void;
  onClose?: () => void;
}

const MAJOVA_LOGO = "https://lh3.googleusercontent.com/d/1pjtSR-r2YJMexgm3hl6jtANdjbVn2FZD";
const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

// Fungsi bantu kalkulasi jarak Haversine (meter)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // meter
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

const AbsenModule: React.FC<AbsenModuleProps> = ({ employee, attendanceRecords, company, onSuccess, onClose }) => {
  const { confirm } = useConfirmation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<{distance: number | null, isInside: boolean, isUsingDefault: boolean, settings: AttendanceSettings | null}>({
    distance: null,
    isInside: false,
    isUsingDefault: false,
    settings: null
  });
  
  const [localTodayRecord, setLocalTodayRecord] = useState<AttendanceRecord | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const comp = (company || '').trim().toLowerCase();
  const currentLogo = comp === 'seller space' ? SELLER_SPACE_LOGO : comp === 'visibel' ? VISIBEL_LOGO : MAJOVA_LOGO;

  const getTodayLocalStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayLocalStr();

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoading(false);
      } catch (err) {
        console.error("Gagal memuat model deteksi wajah:", err);
        setIsModelLoading(false);
      }
    };
    loadModels();
    fetchSettingsAndLocate();
    const interval = setInterval(fetchSettingsAndLocate, 10000); // Cek lokasi tiap 10 detik
    return () => clearInterval(interval);
  }, []);

  const fetchSettingsAndLocate = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `attendance_settings_${company.toUpperCase().trim()}`)
        .single();
      
      const attSettings: AttendanceSettings = data?.value || {
        locationName: 'Main Office (Default)',
        latitude: -6.1754,
        longitude: 106.8272,
        radius: 100,
        allowRemote: false,
        isDefault: true
      };

      // Tentukan lokasi target (Cabang atau Main Office)
      let targetLat = attSettings.latitude;
      let targetLon = attSettings.longitude;
      let targetRadius = attSettings.radius;
      let targetName = attSettings.locationName;
      let isUsingDefault = !!attSettings.isDefault;

      if (employee?.lokasiKerja && attSettings.branches) {
        const branch = attSettings.branches.find(b => b.name === employee.lokasiKerja);
        if (branch) {
          targetLat = branch.latitude;
          targetLon = branch.longitude;
          targetRadius = branch.radius;
          targetName = branch.name;
        }
      }

      navigator.geolocation.getCurrentPosition((pos) => {
        const dist = getDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          targetLat, 
          targetLon
        );
        
        // Jika remote diizinkan secara individu, isInside selalu true
        const isRemote = employee?.isRemoteAllowed;
        
        setLocationStatus({
          distance: Math.round(dist),
          isInside: isRemote ? true : dist <= targetRadius,
          isUsingDefault,
          settings: {
            ...attSettings,
            locationName: targetName,
            latitude: targetLat,
            longitude: targetLon,
            radius: targetRadius
          }
        });
      }, (err) => {
        console.warn("GPS Warning:", err.message);
      }, { enableHighAccuracy: true });
    } catch (e) {}
  };

  useEffect(() => {
    if (employee) {
      const record = attendanceRecords.find(
        r => String(r.employeeId) === String(employee.id) && r.date === todayStr
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
      console.error("Kamera gagal diakses:", err);
      alert("Harap izinkan akses kamera untuk melakukan absensi selfie.");
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
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Pastikan video sudah memiliki dimensi (sudah loading)
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const SIZE = 400; 
    canvas.width = SIZE;
    canvas.height = SIZE;
    
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    
    const minSize = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minSize) / 2;
    const startY = (video.videoHeight - minSize) / 2;
    
    context.drawImage(video, startX, startY, minSize, minSize, 0, 0, SIZE, SIZE);
    
    let quality = 0.5; // Turunkan kualitas awal
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // Safety check size - limit to ~40KB (dataUrl length * 0.75 is approx bytes)
    while (dataUrl.length * 0.75 > 40000 && quality > 0.05) {
      quality -= 0.05;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    
    return dataUrl; 
  };

  const handleAbsenUlang = async () => {
    if (!employee || !localTodayRecord) return;
    
    const isConfirmed = await confirm({
      title: 'Hapus & Mulai Ulang?',
      message: 'Yakin ingin menghapus data absensi hari ini dan mulai ulang?',
      type: 'danger',
      confirmText: 'HAPUS DATA'
    });
    
    if (!isConfirmed) return;

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
    
    // 1. CEK STATUS LOKASI TERBARU
    const isGlobalRemote = locationStatus.settings?.allowRemote;
    const isIndividualRemote = employee.isRemoteAllowed;
    
    if (locationStatus.settings && !locationStatus.isInside && !isGlobalRemote && !isIndividualRemote) {
      alert(`Gagal Verifikasi: Anda berada di luar radius kantor (${locationStatus.distance}m) dan tidak memiliki izin absen remote.`);
      return;
    }

    setIsLoading(true);

    try {
      // 2. CEK DETEKSI WAJAH PADA VIDEO SEBELUM CAPTURE (LEBIH AKURAT)
      if (videoRef.current) {
        const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions());
        if (!detections) {
          setIsLoading(false);
          alert("foto absen wajib menampilkan wajah");
          return;
        }
      }

      // 3. CAPTURE SELFIE
      const photo = capturePhoto();
      if (!photo) {
        setIsLoading(false);
        alert("Gagal mengambil foto. Pastikan kamera sudah menyala dan berikan waktu 1-2 detik.");
        return;
      }

      // 4. AMBIL KOORDINAT PREISI SAAT INI
      let locStr = "Lokasi tidak terdeteksi";
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 6000, 
            enableHighAccuracy: true 
          });
        });
        locStr = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (Jarak: ${locationStatus.distance}m)`;
      } catch (e) {
        console.warn("GPS Timeout, using last known status");
      }

      const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const isClockIn = !localTodayRecord || !localTodayRecord.clockIn;
      
      const updateData: any = {
        employeeId: employee.id,
        company: company.toUpperCase().trim(), 
        date: todayStr,
        status: 'Hadir'
      };

      // Ensure we have the latest ID if it exists in DB but not in local state
      if (!localTodayRecord?.id) {
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('employeeId', employee.id)
          .eq('date', todayStr)
          .maybeSingle();
        if (existing) updateData.id = existing.id;
      } else {
        updateData.id = localTodayRecord.id;
      }

      if (isClockIn) {
        updateData.clockIn = nowTime;
        updateData.photoIn = photo;
        updateData.notes = `Verifikasi Masuk: ${locStr} ${isIndividualRemote ? '[Remote Individual]' : ''}`;
      } else {
        if (localTodayRecord.clockOut) {
          setIsLoading(false);
          return;
        }
        updateData.clockOut = nowTime;
        updateData.photoOut = photo;
        updateData.notes = (localTodayRecord.notes || '') + ` | Keluar: ${locStr} ${isIndividualRemote ? '[Remote Individual]' : ''}`;
        updateData.clockIn = localTodayRecord.clockIn;
      }

      const { data, error } = await supabase.from('attendance').upsert(updateData, { onConflict: 'employeeId,date' }).select();
      if (error) throw error;
      
      setLocalTodayRecord(data?.[0] || updateData);
      alert(`Absensi ${isClockIn ? 'MASUK' : 'PULANG'} Berhasil!`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Sistem Error: " + (err.message || "Gagal menyimpan data ke database."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!employee) return null;
  const isFinished = !!(localTodayRecord?.clockIn && localTodayRecord?.clockOut);

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-md mx-auto relative shadow-2xl overflow-hidden animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-6 pt-6 z-10 shrink-0">
        <button onClick={onClose} className="px-4 py-2 flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full text-slate-400 hover:bg-white hover:text-slate-900 transition-all active:scale-90 shadow-sm">
          <Icons.Home className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Tutup</span>
        </button>
        <div className="flex flex-col items-center">
           <img 
             src={transformGoogleDriveUrl(currentLogo)} 
             alt="Logo" 
             className={`${ comp === 'seller space' ? 'h-[60px] sm:h-[120px]' : 'h-8 sm:h-14' } w-auto`} 
             crossOrigin="anonymous"
           />
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex flex-col items-center mt-4 px-6 text-center shrink-0">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
          {employee.nama}
        </h2>
        <div className="h-1 w-8 bg-[#FFC000] rounded-full mt-2"></div>
        {locationStatus.settings && (
          <div className="flex flex-col items-center gap-1">
            <div className={`mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${locationStatus.isInside || employee.isRemoteAllowed ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'}`}>
              <Icons.Fingerprint className="w-3 h-3" />
              {locationStatus.isInside ? 'Di Area Kantor' : (employee.isRemoteAllowed ? 'Izin Remote Aktif' : 'Di Luar Area Kantor')}
              {locationStatus.distance !== null && <span className="ml-1">({locationStatus.distance}m)</span>}
            </div>
            {/* Debug Info for Admin/Owner or during troubleshooting */}
            <div className="text-[7px] text-slate-300 uppercase tracking-tighter font-bold">
              Target: {locationStatus.settings.locationName} ({locationStatus.settings.latitude.toFixed(4)}, {locationStatus.settings.longitude.toFixed(4)})
            </div>
            {locationStatus.isUsingDefault && (
              <div className="text-[7px] text-rose-500 uppercase tracking-tighter font-black mt-1">
                ⚠️ Pengaturan Lokasi Kantor Belum Diset (Default Jakarta)
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center pt-2 pb-4">
        <div className="relative group">
          <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full border-[8px] border-white bg-slate-50 shadow-2xl overflow-hidden relative z-10 transition-transform duration-700 group-hover:scale-[1.02]">
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <Icons.Camera className="w-10 h-10 text-slate-200" />
                <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">Harap Izinkan Kamera...</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            {isModelLoading && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3 z-20">
                <div className="w-8 h-8 border-4 border-[#FFC000] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Memuat AI...</p>
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-[#FFC000]/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        </div>

        <div className="mt-4 text-center space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] pt-1">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="flex-grow pb-12 pt-2 flex flex-col items-center px-10">
        <button 
          onClick={handleAbsenAction}
          disabled={isLoading || isFinished || !isCameraActive || isModelLoading}
          className="relative group transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
        >
          <div className="bg-slate-900 text-[#FFC000] p-6 rounded-[28px] shadow-2xl shadow-slate-200 group-hover:bg-black transition-all">
            <Icons.Camera className="w-8 h-8" />
          </div>
          
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex flex-col items-center w-max">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900 leading-none">
              {isFinished ? 'TUNTAS' : isLoading ? 'PROSES...' : localTodayRecord?.clockIn ? 'PULANG' : 'MASUK'}
            </span>
            <p className="text-[7px] font-bold text-slate-300 uppercase tracking-widest mt-1.5">VERIFIKASI {company.toUpperCase()}</p>
          </div>
        </button>

        {localTodayRecord && (
          <button 
            onClick={handleAbsenUlang}
            disabled={isLoading}
            className="mt-12 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] hover:text-slate-900 transition-colors"
          >
            Mulai Ulang Absensi
          </button>
        )}
      </div>

    </div>
  );
};

export default AbsenModule;

