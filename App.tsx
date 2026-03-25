
import React, { useState, useRef, useEffect } from 'react';
import { editImage, ProductSource } from './services/geminiService';
import { DEFAULT_SCENIC_BG } from './constants';
import { 
  MagicWandIcon, 
  SpinnerIcon, 
  DownloadIcon, 
  UploadIcon, 
  ImageIcon, 
  LayersIcon, 
  TrashIcon, 
  PlusIcon, 
  KeyIcon,
  RefreshIcon
} from './components/Icons';

interface ProductItem {
  id: string;
  originalData: string;
  mimeType: string;
  status: 'idle' | 'reading' | 'error';
}

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', icon: '■' },
  { label: '16:9', value: '16:9', icon: '▬' },
  { label: '9:16', value: '9:16', icon: '▮' },
  { label: '4:3', value: '4:3', icon: '▭' },
  { label: '3:4', value: '3:4', icon: '▯' },
];

const QUALITY_OPTIONS = [
  { label: 'HD (1K)', value: '1K' },
  { label: 'HD (2K)', value: '2K' },
  { label: 'Ultra (4K)', value: '4K' },
];

const ANGLE_OPTIONS = [
  { label: 'Soft (10°)', value: '10' },
  { label: 'Commercial (25°)', value: '25' },
  { label: '3/4 View (45°)', value: '45' },
  { label: 'Top View (90°)', value: '90' },
];

const MATERIAL_OPTIONS = [
  { label: 'Glossy', value: 'Glossy' },
  { label: 'Matte', value: 'Matte' },
  { label: 'Polished Inox', value: 'PolishedInox' },
  { label: 'Brushed Inox', value: 'BrushedInox' },
];

const REFLECTION_LEVELS = [
  { label: 'Natural', value: 'Natural' },
  { label: 'Strong (Mirror)', value: 'Strong' },
  { label: 'Cinematic', value: 'Cinematic' },
];

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  
  const [bgImage, setBgImage] = useState<string | null>(DEFAULT_SCENIC_BG);
  const [bgMimeType, setBgMimeType] = useState<string>('image/png');
  const [products, setProducts] = useState<ProductItem[]>([]);
  
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [quality, setQuality] = useState<string>('1K');
  const [cameraAngle, setCameraAngle] = useState<string>('45');
  const [reflection, setReflection] = useState<string>('Natural');
  const [material, setMaterial] = useState<string>('Glossy');
  const [stagingMode, setStagingMode] = useState<'replace' | 'add'>('replace');
  const [strictFidelity, setStrictFidelity] = useState<boolean>(true);
  const [isCarawayStyle, setIsCarawayStyle] = useState<boolean>(true);
  const [productScale, setProductScale] = useState<number>(1.0);
  
  const [refinementPrompt, setRefinementPrompt] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const productInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const win = window as any;
        if (win.aistudio?.hasSelectedApiKey) {
          const hasKey = await win.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else if (process.env.API_KEY) {
          setHasApiKey(true);
        }
      } catch (e) { 
        console.error("API Key check error", e); 
      } finally { 
        setIsCheckingKey(false); 
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    const win = window as any;
    if (win.aistudio?.openSelectKey) {
      try { 
        await win.aistudio.openSelectKey(); 
        setHasApiKey(true); 
      } catch (e) { 
        console.error(e); 
      }
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const fullData = ev.target?.result as string;
        const base64 = fullData.split(',')[1];
        setBgImage(base64);
        setBgMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    imageFiles.forEach(file => {
      const id = Math.random().toString(36).substring(7);
      const newItem: ProductItem = {
        id,
        originalData: '',
        mimeType: file.type,
        status: 'reading'
      };
      setProducts(prev => [...prev, newItem]);

      const reader = new FileReader();
      reader.onload = (e) => {
        const fullData = e.target?.result as string;
        setProducts(current => current.map(p => p.id === id ? { ...p, originalData: fullData.split(',')[1], status: 'idle' } : p));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleProcess = async () => {
    if (products.length === 0 || !bgImage) {
      setErrorMessage("Vui lòng tải ảnh nền và ít nhất một sản phẩm.");
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const productSources: ProductSource[] = products
        .filter(p => p.originalData)
        .map(p => ({ data: p.originalData, mimeType: p.mimeType }));
      
      const result = await editImage({
        products: productSources,
        refinement: refinementPrompt,
        aspectRatio,
        quality,
        cameraAngle,
        material,
        reflection,
        isCaraway: isCarawayStyle,
        productScale,
        backgroundImage: bgImage,
        backgroundMime: bgMimeType,
        stagingMode,
        strictFidelity
      });
      if (result) {
        setResultImage(`data:image/png;base64,${result}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      if (err.message && err.message.includes("not found")) {
        setHasApiKey(false);
      }
    } finally { 
      setIsProcessing(false); 
    }
  };

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  if (isCheckingKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <SpinnerIcon className="animate-spin w-8 h-8 text-white" />
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 bg-[#1a1a1a] p-10 rounded-3xl border border-white/10 shadow-2xl">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 mb-4">
              <KeyIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Kết nối Gemini Pro</h1>
            <p className="text-gray-400">
              Để sử dụng tính năng Visual Staging chất lượng cao, vui lòng kết nối API Key đã trả phí.
            </p>
          </div>
          
          <div className="space-y-4 pt-4">
            <button
              onClick={handleConnectKey}
              className="w-full py-4 px-6 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Kết nối API Key</span>
              <MagicWandIcon className="w-4 h-4" />
            </button>
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Tìm hiểu về thanh toán Gemini API →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">VisualStager <span className="text-blue-500">Pro</span></span>
          </div>
          
          <div className="flex items-center gap-4">
             {resultImage && (
               <a 
                 href={resultImage} 
                 download="visual-staging-result.png"
                 className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-sm font-medium"
               >
                 <DownloadIcon className="w-4 h-4" />
                 Tải về
               </a>
             )}
             <button 
               onClick={handleProcess}
               disabled={isProcessing || products.length === 0}
               className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold shadow-lg shadow-blue-500/20"
             >
               {isProcessing ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <MagicWandIcon className="w-4 h-4" />}
               {isProcessing ? 'Đang Render...' : 'Render Sản Phẩm'}
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* FIDELITY & STAGING SECTION */}
          <section className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-500 block">Bảo Toàn Sản Phẩm Tuyệt Đối</label>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${strictFidelity ? 'text-green-400' : 'text-gray-500'}`}>
                  {strictFidelity ? 'BẢO TOÀN' : 'TỰ DO'}
                </span>
                <button 
                  onClick={() => setStrictFidelity(!strictFidelity)}
                  className={`w-10 h-5 rounded-full transition-all relative ${strictFidelity ? 'bg-green-600' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${strictFidelity ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Giữ nguyên 100% hình dáng, cấu trúc và chi tiết của sản phẩm gốc. Không biến đổi vật liệu hay tỷ lệ.
            </p>
            
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Chế Độ Thay Thế</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setStagingMode('replace')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${stagingMode === 'replace' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                >
                  Ghi đè vật mẫu
                </button>
                <button 
                  onClick={() => setStagingMode('add')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${stagingMode === 'add' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                >
                  Thêm mới
                </button>
              </div>
            </div>
          </section>

          <section className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">1. Không Gian Bối Cảnh</label>
              <div 
                onClick={() => bgInputRef.current?.click()}
                className="group relative h-40 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-all cursor-pointer overflow-hidden bg-black/40 flex flex-col items-center justify-center text-center p-4"
              >
                {bgImage ? (
                  <>
                    <img src={`data:image/png;base64,${bgImage}`} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" alt="BG" />
                    <div className="relative z-10 flex flex-col items-center">
                      <RefreshIcon className="w-6 h-6 mb-2 text-white/80" />
                      <span className="text-xs font-medium bg-black/60 px-2 py-1 rounded">Đổi Bối Cảnh</span>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-8 h-8 mb-3 text-gray-600" />
                    <span className="text-sm font-medium text-gray-400">Tải ảnh nền bối cảnh</span>
                  </>
                )}
                <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">2. Sản Phẩm Cần Ghép</label>
                <button 
                  onClick={() => productInputRef.current?.click()}
                  className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors"
                >
                  <PlusIcon className="w-3 h-3 inline mr-1" /> Thêm
                </button>
              </div>
              <input 
                type="file" 
                multiple 
                ref={productInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => e.target.files && handleProductFiles(e.target.files)} 
              />
              
              <div className="grid grid-cols-3 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-black/40 group border border-white/5">
                    {p.status === 'reading' ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <SpinnerIcon className="w-4 h-4 animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <>
                        <img src={`data:image/png;base64,${p.originalData}`} className="w-full h-full object-cover" alt="Product" />
                        <button 
                          onClick={() => removeProduct(p.id)}
                          className="absolute top-1 right-1 p-1 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {products.length === 0 && (
                  <div 
                    onClick={() => productInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-white/20 transition-all text-gray-600"
                  >
                    <PlusIcon className="w-6 h-6" />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">3. Hiệu Ứng Nghệ Thuật</label>
              
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Độ Phản Chiếu</span>
                <div className="grid grid-cols-3 gap-2">
                  {REFLECTION_LEVELS.map(rl => (
                    <button
                      key={rl.value}
                      onClick={() => setReflection(rl.value)}
                      className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border ${reflection === rl.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                    >
                      {rl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-500 font-bold">TỶ LỆ KHUNG</span>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map(ar => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${aspectRatio === ar.value ? 'bg-white text-black font-bold' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        <span className="text-[10px] opacity-60">{ar.icon}</span>
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-gray-500 font-bold">CHẤT LƯỢNG</span>
                  <div className="flex flex-wrap gap-2">
                    {QUALITY_OPTIONS.map(q => (
                      <button
                        key={q.value}
                        onClick={() => setQuality(q.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${quality === q.value ? 'bg-white text-black font-bold' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <span className="text-[10px] text-gray-500 font-bold">CHẤT LIỆU</span>
                  <select 
                    value={material} 
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {MATERIAL_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] text-gray-500 font-bold">GÓC CHỤP</span>
                  <select 
                    value={cameraAngle} 
                    onChange={(e) => setCameraAngle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {ANGLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 font-bold">TỶ LỆ SẢN PHẨM</span>
                  <span className="text-xs font-mono text-blue-400">{productScale.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={productScale} 
                  onChange={(e) => setProductScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold">Phong Cách Quảng Cáo Cao Cấp</div>
                  <div className="text-[10px] text-gray-500">Bố cục Caraway minimalist, ánh sáng tự nhiên</div>
                </div>
                <button 
                  onClick={() => setIsCarawayStyle(!isCarawayStyle)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isCarawayStyle ? 'bg-blue-600' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isCarawayStyle ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">4. Ghi chú bổ sung</label>
              <textarea 
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                placeholder="Ví dụ: Đảm bảo sản phẩm trông thật chắc chắn trên mặt bàn..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none placeholder:text-gray-600"
              />
            </div>
          </section>
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-8">
          <div className="sticky top-24 space-y-6">
            <div className="relative aspect-square lg:aspect-[4/3] bg-[#111] rounded-3xl border border-white/5 overflow-hidden shadow-2xl flex items-center justify-center">
              {isProcessing && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <MagicWandIcon className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Đang xử lý Pixel</h3>
                  <p className="text-gray-400 max-w-sm">
                    {strictFidelity ? 'Bảo toàn hình dạng sản phẩm và ' : ''} Gemini đang đồng bộ ánh sáng & bóng đổ...
                  </p>
                </div>
              )}
              
              {resultImage ? (
                <img src={resultImage} className="w-full h-full object-contain" alt="Staged Scene" />
              ) : bgImage ? (
                <div className="relative w-full h-full">
                  <img src={`data:image/png;base64,${bgImage}`} className="w-full h-full object-cover opacity-30 grayscale" alt="Preview" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                    <LayersIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">Nhấn <span className="text-blue-500 font-bold">Render Sản Phẩm</span> để thực hiện ghép ảnh chuyên nghiệp.</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-600 flex flex-col items-center gap-4">
                  <ImageIcon className="w-16 h-16 opacity-10" />
                  <p className="text-sm font-medium">Tải ảnh nền để bắt đầu</p>
                </div>
              )}

              {errorMessage && (
                <div className="absolute bottom-6 left-6 right-6 bg-red-500/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <PlusIcon className="w-5 h-5 rotate-45" />
                  </div>
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-4 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span>Gemini 3 Pro Active</span>
                 </div>
                 <span>|</span>
                 <span>Chế độ: {stagingMode === 'replace' ? 'THAY THẾ' : 'THÊM MỚI'}</span>
                 <span>|</span>
                 <span className={strictFidelity ? 'text-green-400' : ''}>
                   Hình dạng: {strictFidelity ? 'BẢO TOÀN NGHIÊM NGẶT' : 'TỰ DO'}
                 </span>
               </div>
               <div className="flex items-center gap-2">
                 <span>Chất lượng cao nhất</span>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
