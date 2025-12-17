import React, { useState, useRef } from 'react';
import { ImageFile } from '../types';
import { Button } from './ui/Button';
import { Download, LayoutGrid, X } from 'lucide-react';
import html2canvas from 'html2canvas';

interface CollageMakerProps {
  images: ImageFile[];
  onRemoveImage: (id: string) => void;
  onAddMore: () => void;
}

export const CollageMaker: React.FC<CollageMakerProps> = ({ images, onRemoveImage, onAddMore }) => {
  const [layout, setLayout] = useState<number>(0); // 0: Auto/Grid, 1: Column, 2: Row
  const collageRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (collageRef.current) {
        try {
            const canvas = await html2canvas(collageRef.current, {
                useCORS: true,
                backgroundColor: null, // Transparent if needed, or matches bg
                scale: 2 // Higher quality
            });
            const link = document.createElement('a');
            link.download = `pixelai-collage-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (e) {
            console.error(e);
            alert("Lỗi khi tải ảnh ghép.");
        }
    }
  };

  const getGridClass = (count: number, layoutType: number) => {
      if (layoutType === 1) return "grid-cols-1"; // Column
      if (layoutType === 2) return `grid-cols-${count}`; // Row (simple implementation)
      
      // Auto Grid
      if (count === 1) return "grid-cols-1";
      if (count === 2) return "grid-cols-2";
      if (count === 3) return "grid-cols-3";
      if (count === 4) return "grid-cols-2"; // 2x2
      if (count >= 5 && count <= 6) return "grid-cols-3";
      return "grid-cols-3"; // Default for many
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-900">
        {/* Left Control Panel */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-6">
            <div>
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <LayoutGrid size={18} /> Bố cục
                </h3>
                <div className="space-y-2">
                    <Button 
                        variant={layout === 0 ? 'primary' : 'secondary'} 
                        className="w-full justify-start"
                        onClick={() => setLayout(0)}
                    >
                        Lưới tự động
                    </Button>
                    <Button 
                        variant={layout === 1 ? 'primary' : 'secondary'} 
                        className="w-full justify-start"
                        onClick={() => setLayout(1)}
                    >
                        Cột dọc
                    </Button>
                     <Button 
                        variant={layout === 2 ? 'primary' : 'secondary'} 
                        className="w-full justify-start"
                        onClick={() => setLayout(2)}
                    >
                        Hàng ngang
                    </Button>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                <Button variant="secondary" className="w-full" onClick={onAddMore}>
                   + Thêm ảnh
                </Button>
                <Button 
                    variant="primary" 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={handleDownload}
                    icon={<Download size={16} />}
                >
                    Tải ảnh ghép
                </Button>
            </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-950 p-8 overflow-auto flex items-center justify-center">
            <div 
                ref={collageRef}
                className={`bg-white p-2 gap-2 grid ${getGridClass(images.length, layout)} shadow-2xl`}
                style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    aspectRatio: layout === 0 && images.length === 4 ? '1/1' : 'auto'
                }}
            >
                {images.map((img) => (
                    <div key={img.id} className="relative group overflow-hidden bg-slate-200">
                        <img 
                            src={img.url} 
                            alt="collage item" 
                            className="w-full h-full object-cover min-h-[150px] min-w-[150px]" 
                        />
                        <button 
                            onClick={() => onRemoveImage(img.id)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};