
import React, { useState } from 'react';
import { Upload, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { EditorWorkspace } from '../components/EditorWorkspace';
import { ImageFile } from '../types';

interface PhotoEditorProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    isAuthenticated: boolean;
    onRequireAuth: () => void;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({ addToast, isAuthenticated, onRequireAuth }) => {
    const [selectedFile, setSelectedFile] = useState<ImageFile | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) {
            onRequireAuth();
            return;
        }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setSelectedFile({ id: 'temp-' + Date.now(), url, file });
        }
    };

    const handleBack = () => {
        if (selectedFile) {
            URL.revokeObjectURL(selectedFile.url);
            setSelectedFile(null);
        }
    };

    if (selectedFile) {
        return <EditorWorkspace image={selectedFile} onBack={handleBack} />;
    }

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-10 flex flex-col items-center shadow-2xl">
                <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <ImageIcon size={48} className="text-zinc-500 opacity-50" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Photo Editor Pro</h2>
                <p className="text-zinc-400 mb-8 text-sm">Upload an image to start editing with Filters & AI.</p>
                
                <label className="w-full cursor-pointer group">
                    <div className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02]">
                        <Upload size={20} />
                        Upload Image
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
                
                <p className="text-xs text-zinc-600 mt-4">Supported formats: JPG, PNG, WEBP</p>
            </div>
        </div>
    );
};

export default PhotoEditor;
