import React, { useState } from 'react';
import { GeneratedImage } from '../types';
import { RefreshCw, Maximize2, Download } from 'lucide-react';
import { ImageViewerModal } from './ImageViewerModal';

interface GalleryProps {
  images: GeneratedImage[];
  onRegenerate: (img: GeneratedImage) => void;
}

const Gallery: React.FC<GalleryProps> = ({ images, onRegenerate }) => {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  // Sort by newest
  const sortedImages = [...images].sort((a, b) => b.timestamp - a.timestamp);

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start custom-scrollbar">
        {sortedImages.map((img) => (
          <div key={img.id} className="group bg-[#0c0c0e] border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-indigo-500/10 flex flex-col">
            {/* Image Area - Show full thumbnail */}
            <div className="relative aspect-square bg-black/40 overflow-hidden cursor-pointer" onClick={() => setSelectedImage(img)}>
               <img 
                src={img.url} 
                alt="Generated" 
                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                 <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur rounded-full p-2">
                    <Maximize2 className="w-5 h-5 text-white" />
                 </div>
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="p-3 border-t border-white/5 bg-[#0c0c0e]">
              <div className="flex justify-between items-center gap-2">
                 <button 
                  onClick={() => handleDownload(img.url, img.id)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-white/5"
                 >
                   <Download className="w-3.5 h-3.5" /> Tải ảnh
                 </button>
                 <button 
                  onClick={() => onRegenerate(img)}
                  className="flex-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-indigo-500/20"
                 >
                   <RefreshCw className="w-3.5 h-3.5" /> Tạo lại
                 </button>
              </div>
            </div>
          </div>
        ))}
        {sortedImages.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-20">
            Chưa có hình ảnh nào được tạo.
          </div>
        )}
      </div>

      {/* Replaced Inline Modal with ImageViewerModal */}
      <ImageViewerModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageSrc={selectedImage?.url || null}
          altText={selectedImage?.prompt}
      >
          <div className="flex gap-4">
             <button 
                onClick={() => selectedImage && handleDownload(selectedImage.url, selectedImage.id)}
                className="px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
             >
               <Download className="w-4 h-4" /> Download
             </button>
             <button 
                onClick={() => { if(selectedImage) onRegenerate(selectedImage); }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all shadow-lg"
             >
               <RefreshCw className="w-4 h-4" /> Regenerate
             </button>
          </div>
      </ImageViewerModal>
    </div>
  );
};

export default Gallery;