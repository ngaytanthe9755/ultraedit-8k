
import React, { useState } from 'react';
import { Upload, Image as ImageIcon, ArrowLeft, LayoutGrid, Wand2, Plus } from 'lucide-react';
import { EditorWorkspace } from '../components/EditorWorkspace';
import { CollageMaker } from '../components/CollageMaker';
import { ImageFile } from '../types';

interface PhotoEditorProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    isAuthenticated: boolean;
    onRequireAuth: () => void;
}

type EditorMode = 'menu' | 'editor' | 'collage';

const PhotoEditor: React.FC<PhotoEditorProps> = ({ addToast, isAuthenticated, onRequireAuth }) => {
    const [mode, setMode] = useState<EditorMode>('menu');
    
    // Editor State
    const [selectedFile, setSelectedFile] = useState<ImageFile | null>(null);
    
    // Collage State
    const [collageImages, setCollageImages] = useState<ImageFile[]>([]);

    const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) { onRequireAuth(); return; }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setSelectedFile({ id: 'temp-' + Date.now(), url, file });
            setMode('editor');
        }
    };

    const handleCollageFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) { onRequireAuth(); return; }
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            const newImages: ImageFile[] = files.map(file => ({
                id: 'col-' + Date.now() + '-' + Math.random(),
                url: URL.createObjectURL(file),
                file
            }));
            setCollageImages(prev => [...prev, ...newImages]);
            setMode('collage');
        }
    };

    const handleRemoveCollageImage = (id: string) => {
        setCollageImages(prev => prev.filter(img => img.id !== id));
    };

    const handleBackToMenu = () => {
        setMode('menu');
        // Clean up URLs
        if (selectedFile) URL.revokeObjectURL(selectedFile.url);
        setSelectedFile(null);
    };

    // --- RENDER MODES ---

    if (mode === 'editor' && selectedFile) {
        return <EditorWorkspace image={selectedFile} onBack={handleBackToMenu} />;
    }

    if (mode === 'collage') {
        return (
            <div className="flex flex-col h-full">
                <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBackToMenu} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={20}/>
                        </button>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <LayoutGrid className="text-indigo-500" size={20}/> Collage Maker
                        </h2>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    {collageImages.length > 0 ? (
                        <CollageMaker 
                            images={collageImages} 
                            onRemoveImage={handleRemoveCollageImage}
                            onAddMore={() => document.getElementById('add-more-collage')?.click()}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                            <p>Chưa có ảnh nào. Vui lòng thêm ảnh.</p>
                            <label className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer">
                                Thêm ảnh
                                <input id="add-more-collage" type="file" multiple accept="image/*" onChange={handleCollageFilesChange} className="hidden" />
                            </label>
                        </div>
                    )}
                </div>
                {/* Hidden input for Add More logic inside CollageMaker if needed, or controlled here */}
                <input id="add-more-collage" type="file" multiple accept="image/*" onChange={handleCollageFilesChange} className="hidden" />
            </div>
        );
    }

    // --- MENU MODE ---
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 bg-zinc-950">
            <div className="text-center mb-10 animate-in slide-in-from-bottom-4">
                <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Creative Studio</h2>
                <p className="text-zinc-400">Chọn chế độ để bắt đầu sáng tạo</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
                {/* Option 1: Single Editor */}
                <label className="group relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 cursor-pointer hover:border-indigo-500 hover:bg-zinc-900/80 transition-all duration-300 shadow-xl flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Wand2 size={40} className="text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">AI Photo Editor</h3>
                        <p className="text-sm text-zinc-500 group-hover:text-zinc-400">Chỉnh sửa ảnh đơn, bộ lọc màu & hiệu ứng AI Magic.</p>
                    </div>
                    <div className="mt-4 px-6 py-2 bg-zinc-800 rounded-full text-xs font-bold text-white group-hover:bg-indigo-600 transition-colors">
                        Tải ảnh lên
                    </div>
                    <input type="file" accept="image/*" onChange={handleSingleFileChange} className="hidden" />
                </label>

                {/* Option 2: Collage Maker */}
                <label className="group relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 cursor-pointer hover:border-purple-500 hover:bg-zinc-900/80 transition-all duration-300 shadow-xl flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <LayoutGrid size={40} className="text-purple-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">Collage Maker</h3>
                        <p className="text-sm text-zinc-500 group-hover:text-zinc-400">Ghép nhiều ảnh, bố cục lưới thông minh & xuất ảnh chất lượng cao.</p>
                    </div>
                    <div className="mt-4 px-6 py-2 bg-zinc-800 rounded-full text-xs font-bold text-white group-hover:bg-purple-600 transition-colors">
                        Chọn nhiều ảnh
                    </div>
                    <input type="file" multiple accept="image/*" onChange={handleCollageFilesChange} className="hidden" />
                </label>
            </div>
            
            <p className="text-xs text-zinc-600 mt-12">Hỗ trợ: JPG, PNG, WEBP • Max 20MB/File</p>
        </div>
    );
};

export default PhotoEditor;
