
import React, { useState, useEffect, useMemo } from 'react';
import { TrialData } from './types';

// Constants
const GRAVITY = 9.8;         // Gia tốc trọng trường (m/s2) - Phù hợp GDPT 2018
const G_CONV = 1000 / GRAVITY; // Hệ số đổi N -> g (1N = 1000/9.8 g)
const BASE_F_GRAMS = 520.45; // Trọng lượng nam châm + đế khi chưa có dòng (F1)
const B_ACTUAL = 0.1250;     // Cảm ứng từ B thực tế của nam châm (Tesla)

const App: React.FC = () => {
  const [currentI, setCurrentI] = useState<number>(1.0);
  const [lengthL, setLengthL] = useState<number>(0.08);
  const [isPowerOn, setIsPowerOn] = useState<boolean>(false);
  const [trials, setTrials] = useState<TrialData[]>([]);
  const [currentF1, setCurrentF1] = useState<number | null>(null);
  const [currentF2, setCurrentF2] = useState<number | null>(null);
  const [liveScaleReadingGrams, setLiveScaleReadingGrams] = useState<number>(BASE_F_GRAMS);
  
  // Verification states
  const [studentAvgB, setStudentAvgB] = useState<string>('');
  const [studentDeltaB, setStudentDeltaB] = useState<string>('');
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Calculated Metrics
  const metrics = useMemo(() => {
    if (trials.length === 0) return { avgB: 0, avgDeltaB: 0, avgF: 0, avgI: 0, avgL: 0, avgF1: 0, avgF2: 0, avgM1: 0, avgM2: 0 };
    const count = trials.length;
    const avgB = trials.reduce((acc, t) => acc + t.bValue, 0) / count;
    const avgDeltaB = trials.reduce((acc, t) => acc + Math.abs(t.bValue - avgB), 0) / count;
    const avgF = trials.reduce((acc, t) => acc + t.force, 0) / count;
    const avgI = trials.reduce((acc, t) => acc + t.current, 0) / count;
    const avgF1 = trials.reduce((acc, t) => acc + t.f1, 0) / count;
    const avgF2 = trials.reduce((acc, t) => acc + t.f2, 0) / count;
    const avgM1 = avgF1 * G_CONV;
    const avgM2 = avgF2 * G_CONV;
    const avgL = lengthL; 
    return { avgB, avgDeltaB, avgF, avgI, avgL, avgF1, avgF2, avgM1, avgM2 };
  }, [trials, lengthL]);

  // Simulation loop
  useEffect(() => {
    const timer = setInterval(() => {
      let magneticForceN = 0;
      if (isPowerOn) {
        magneticForceN = B_ACTUAL * currentI * lengthL;
      }
      const forceGrams = magneticForceN * G_CONV;
      const flicker = (Math.random() - 0.5) * 0.006; 
      setLiveScaleReadingGrams(BASE_F_GRAMS + forceGrams + flicker);
    }, 150);
    return () => clearInterval(timer);
  }, [isPowerOn, currentI, lengthL]);

  const gramsToNewtons = (g: number) => g / G_CONV;

  const handleReadF1 = () => {
    if (isPowerOn) return alert("Vui lòng ngắt điện để đo F1!");
    setCurrentF1(gramsToNewtons(liveScaleReadingGrams));
  };

  const handleReadF2 = () => {
    if (!isPowerOn) return alert("Vui lòng đóng mạch để đo F2!");
    if (currentF1 === null) return alert("Bạn phải đo F1 trước!");
    setCurrentF2(gramsToNewtons(liveScaleReadingGrams));
  };

  const handleRecord = () => {
    if (currentF1 === null || currentF2 === null) return;
    const force = currentF2 - currentF1;
    const bValue = (currentI * lengthL) !== 0 ? force / (currentI * lengthL) : 0;
    
    setTrials([...trials, { 
      id: trials.length + 1, 
      current: currentI, 
      f1: currentF1, 
      f2: currentF2, 
      force: force, 
      bValue: bValue 
    }]);
    setCurrentF1(null);
    setCurrentF2(null);
  };

  const handleVerify = () => {
    if (trials.length === 0) {
      setFeedback({ message: 'Vui lòng thực hiện ít nhất một phép đo trước!', type: 'error' });
      return;
    }
    const valB = parseFloat(studentAvgB);
    const valDelta = parseFloat(studentDeltaB);
    
    if (isNaN(valB) || isNaN(valDelta)) {
      setFeedback({ message: 'Vui lòng nhập đầy đủ các giá trị số!', type: 'error' });
      return;
    }

    const errorB = Math.abs(valB - metrics.avgB) / metrics.avgB;
    
    // Reveal anyway to show student where they might have gone wrong
    setIsRevealed(true);

    if (errorB <= 0.05) {
      setFeedback({ message: `Kết quả chính xác! Bảng số liệu và chi tiết tính toán đã được hiển thị bên dưới.`, type: 'success' });
    } else {
      setFeedback({ message: 'Kết quả có sai số lớn so với thực nghiệm. Hãy đối chiếu với bảng số liệu vừa hiện ra!', type: 'error' });
    }
  };

  const handleReset = () => {
    setTrials([]);
    setIsRevealed(false);
    setStudentAvgB('');
    setStudentDeltaB('');
    setFeedback({ message: '', type: null });
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 lg:p-8 font-sans text-slate-900">
      {/* Header */}
      <header className="max-w-[1600px] mx-auto mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Phòng Thí Nghiệm Vật Lí Kỹ Thuật Số</h1>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 italic">Chương trình GDPT 2018 • Chủ đề Từ Trường • Đo cảm ứng từ B</p>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL */}
        <div className="lg:col-span-4 space-y-4">
          {/* 1. SETUP */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> 1. Thiết lập thông số
              </h3>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">g = {GRAVITY} m/s²</span>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Cường độ dòng I</label>
                  <span className="text-sm font-mono font-black text-indigo-600">{currentI.toFixed(1)} A</span>
                </div>
                <input type="range" min="0.2" max="2.0" step="0.2" value={currentI} onChange={(e) => setCurrentI(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-full appearance-none" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Chiều dài đoạn dây L</label>
                  <span className="text-sm font-mono font-black text-indigo-600">{lengthL.toFixed(3)} m</span>
                </div>
                <input type="range" min="0.04" max="0.12" step="0.01" value={lengthL} onChange={(e) => setLengthL(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-full appearance-none" />
              </div>
            </div>
          </section>

          {/* 2. MEASUREMENTS */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 2. Tiến hành đo đạc
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">Trạng thái cân</span>
                <span className="text-xl font-mono font-black text-slate-800">{liveScaleReadingGrams.toFixed(2)} <small className="text-xs">g</small></span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleReadF1} className={`flex flex-col gap-2 p-4 rounded-xl border transition-all ${currentF1 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                  <span className="text-[12px] font-black text-slate-500 uppercase">Lấy m₁ (I=0)</span>
                  <span className="font-mono text-xl font-black text-indigo-600">{currentF1 ? (currentF1 * G_CONV).toFixed(2) + 'g' : '--'}</span>
                </button>
                <button onClick={handleReadF2} className={`flex flex-col gap-2 p-4 rounded-xl border transition-all ${currentF2 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                  <span className="text-[12px] font-black text-slate-500 uppercase">Lấy m₂ (I>0)</span>
                  <span className="font-mono text-xl font-black text-indigo-600">{currentF2 ? (currentF2 * G_CONV).toFixed(2) + 'g' : '--'}</span>
                </button>
              </div>
              <button onClick={handleRecord} disabled={!currentF1 || !currentF2} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg disabled:opacity-20 hover:bg-slate-900 transition-all active:scale-95">
                Ghi vào bảng số liệu
              </button>
            </div>
          </section>

          {/* 3. VERIFICATION */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> 3. Xác nhận kết quả
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">B trung bình (T)</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    placeholder="Nhập B̄..." 
                    value={studentAvgB} 
                    onChange={(e) => setStudentAvgB(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sai số tuyệt đối (T)</label>
                  <input 
                    type="number" 
                    step="0.00001"
                    placeholder="Nhập ΔB̄..." 
                    value={studentDeltaB} 
                    onChange={(e) => setStudentDeltaB(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                  />
                </div>
              </div>
              <button onClick={handleVerify} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                Kiểm tra & Hiển thị kết quả
              </button>
              {feedback.type && (
                <div className={`p-4 rounded-xl border text-[10px] font-bold leading-relaxed animate-in fade-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                  {feedback.message}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT PANEL: 3D SVG SIMULATION */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 relative overflow-hidden h-[600px]">
            <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-3">
               <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Nguồn DC</span>
                    <span className={`text-xl font-mono font-black ${isPowerOn ? 'text-indigo-600' : 'text-slate-300'}`}>
                      {isPowerOn ? currentI.toFixed(2) : "0.00"} A
                    </span>
                  </div>
                  <button onClick={() => setIsPowerOn(!isPowerOn)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 border-2 ${isPowerOn ? 'bg-red-500 border-red-200 text-white' : 'bg-emerald-500 border-emerald-200 text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                  </button>
               </div>
            </div>
            <svg viewBox="0 0 800 600" className="w-full h-full">
                <defs>
                   <linearGradient id="magnetRed" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#991b1b" /></linearGradient>
                   <linearGradient id="magnetBlue" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1e3a8a" /></linearGradient>
                   <linearGradient id="copperGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#92400e" /></linearGradient>
                   <linearGradient id="scaleBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#f1f5f9" /></linearGradient>
                   <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#1e293b" /></linearGradient>
                   <filter id="lcdGlow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                   <filter id="dropShadow"><feDropShadow dx="2" dy="4" stdDeviation="6" floodOpacity="0.1"/></filter>
                </defs>
                <g transform="translate(150, 420)" filter="url(#dropShadow)">
                   <rect x="0" y="0" width="500" height="160" rx="16" fill="url(#scaleBodyGrad)" stroke="#cbd5e1" strokeWidth="2" />
                   <rect x="25" y="-15" width="450" height="15" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                   <rect x="50" y="30" width="400" height="100" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                   <rect x="65" y="45" width="220" height="70" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                   <text x="175" y="95" textAnchor="middle" fill="#4ade80" className="font-mono text-5xl font-black italic tracking-tighter" filter="url(#lcdGlow)">{liveScaleReadingGrams.toFixed(2)}<tspan fontSize="16" dx="5">g</tspan></text>
                </g>
                <g transform="translate(400, 405)">
                   <polygon points="110,0 140,-30 140,-5 110,25" fill="#1e293b" opacity="0.8" />
                   <polygon points="-110,0 -80,-30 140,-30 110,0" fill="#334155" />
                   <rect x="-110" y="0" width="220" height="25" rx="2" fill="url(#baseGrad)" stroke="#0f172a" strokeWidth="1" />
                   <g transform="translate(-110, -140)">
                      <polygon points="60,0 90,-30 90,110 60,140" fill="#1e3a8a" />
                      <polygon points="0,0 30,-30 90,-30 60,0" fill="#60a5fa" />
                      <rect x="0" y="0" width="60" height="140" fill="url(#magnetBlue)" rx="1" />
                      <text x="30" y="80" textAnchor="middle" fill="white" fontWeight="900" fontSize="32">S</text>
                   </g>
                   <g transform="translate(50, -140)">
                      <polygon points="60,0 90,-30 90,110 60,140" fill="#991b1b" />
                      <polygon points="0,0 30,-30 90,-30 60,0" fill="#f87171" />
                      <rect x="0" y="0" width="60" height="140" fill="url(#magnetRed)" rx="1" />
                      <text x="30" y="80" textAnchor="middle" fill="white" fontWeight="900" fontSize="32">N</text>
                   </g>
                </g>
                <g transform="translate(400, 310)">
                   <rect x="-4" y="-195" width="4" height="180" fill="#94a3b8" opacity="0.3" rx="2" />
                   <rect x="26" y="-225" width="4" height="180" fill="#94a3b8" opacity="0.3" rx="2" />
                   <g transform="translate(46, -15)"> 
                      <rect x="-50" y="-150" width="8" height="165" fill="url(#copperGrad)" rx="4" />
                      <rect x="-20" y="-180" width="8" height="165" fill="url(#copperGrad)" rx="4" />
                      <path d="M-46,15 L-16,-15" stroke="url(#copperGrad)" strokeWidth="10" strokeLinecap="round" />
                      {isPowerOn && (
                         <g transform="translate(-31, 0)">
                               <path d="M0,0 L0,-50" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                               <path d="M-6,-40 L0,-50 L6,-40" fill="#f43f5e" />
                               <text x="0" y="-65" textAnchor="middle" fill="#f43f5e" fontSize="24" fontWeight="black" fontStyle="italic">F</text>
                         </g>
                      )}
                   </g>
                </g>
            </svg>
          </div>
        </div>
      </main>

      {/* DATA TABLE AREA */}
      <section className="max-w-[1600px] mx-auto mt-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">Bảng Số Liệu</h2>
          <button onClick={handleReset} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors">Xóa & Thử lại từ đầu</button>
        </div>
        
        <div className="overflow-hidden rounded-2xl border border-slate-100 mb-8">
          <table className="w-full text-center">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-4">STT</th>
                <th className="p-4">Dòng I (A)</th>
                <th className="p-4">Khối lượng m₁ (g)</th>
                <th className="p-4">Khối lượng m₂ (g)</th>
                <th className="p-4 text-indigo-600">Lực Từ F (N)</th>
                <th className="p-4 text-emerald-600">B Thực Nghiệm (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {trials.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-300 italic text-sm font-medium uppercase tracking-widest">Đang chờ bản ghi từ các lần đo...</td></tr>
              ) : (
                trials.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-all font-mono text-xs font-bold">
                    <td className="p-4 text-slate-300">#0{t.id}</td>
                    <td className="p-4 text-slate-900">{t.current.toFixed(1)}</td>
                    <td className="p-4 text-slate-400">{(t.f1 * G_CONV).toFixed(2)}</td>
                    <td className="p-4 text-slate-400">{(t.f2 * G_CONV).toFixed(2)}</td>
                    <td className="p-4 text-indigo-600 font-black">
                      {isRevealed ? t.force.toFixed(5) : <span className="text-slate-200">? ? ? ? ?</span>}
                    </td>
                    <td className="p-4 text-emerald-600 font-black">
                      {isRevealed ? t.bValue.toFixed(4) : <span className="text-slate-200">? ? ? ?</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CALCULATION DETAILS - Revealed after verification */}
        {isRevealed && (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              Chi tiết tính toán & Thay số thực nghiệm
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-orange-600 uppercase block">Bước 1: Trọng lượng (N)</span>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
                  <p className="font-serif italic text-lg text-center mb-2">F = (m / 1000) ⋅ g</p>
                  <div className="h-px bg-slate-100 w-full my-3"></div>
                  <div className="font-mono text-[10px] text-slate-600 text-center space-y-1">
                    <p>F₁ = ({metrics.avgM1.toFixed(2)}/1000)⋅{GRAVITY} ≈ <span className="text-orange-600 font-bold">{metrics.avgF1.toFixed(5)} N</span></p>
                    <p>F₂ = ({metrics.avgM2.toFixed(2)}/1000)⋅{GRAVITY} ≈ <span className="text-orange-600 font-bold">{metrics.avgF2.toFixed(5)} N</span></p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-indigo-600 uppercase block">Bước 2: Lực từ F</span>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
                  <p className="font-serif text-lg italic text-center mb-2">F = |F₂ - F₁|</p>
                  <div className="h-px bg-slate-100 w-full my-3"></div>
                  <p className="font-mono text-[10px] text-slate-600 text-center">
                    F = |{metrics.avgF2.toFixed(5)} - {metrics.avgF1.toFixed(5)}|<br/>
                    <span className="text-indigo-600 font-bold">F ≈ {metrics.avgF.toFixed(5)} (N)</span>
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-emerald-600 uppercase block">Bước 3: Cảm ứng từ B</span>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
                  <p className="font-serif italic text-lg text-center mb-2">B = F / (I ⋅ L)</p>
                  <div className="h-px bg-slate-100 w-full my-3"></div>
                  <div className="font-mono text-[10px] text-slate-600 text-center">
                    B = {metrics.avgF.toFixed(5)} / ({metrics.avgI.toFixed(1)} ⋅ {metrics.avgL.toFixed(3)})<br/>
                    <span className="text-emerald-600 font-bold">B ≈ {metrics.avgB.toFixed(4)} (T)</span>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-blue-600 uppercase block">Bước 4: Sai số ΔB̄</span>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
                  <p className="font-serif text-lg italic text-center mb-2">ΔB̄ = (Σ |Bᵢ - B̄|) / n</p>
                  <div className="h-px bg-slate-100 w-full my-3"></div>
                  <p className="font-mono text-[10px] text-slate-600 text-center">
                    Số lần đo n = {trials.length}<br/>
                    <span className="text-blue-600 font-bold">ΔB̄ ≈ {metrics.avgDeltaB.toFixed(5)} (T)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="max-w-[1600px] mx-auto mt-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] pb-8">
        Precision Digital Lab • Designed for Science Education • 2025
      </footer>
    </div>
  );
};

export default App;
