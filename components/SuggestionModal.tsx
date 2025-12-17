
import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, Volume2, StopCircle } from 'lucide-react';

interface SuggestionItem {
    vi: string;
    en: string; // The value to be used
    data?: any; // Optional complex data (e.g. for Poster)
}

interface SuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    suggestions: SuggestionItem[];
    onSelect: (item: SuggestionItem) => void;
    isLoading?: boolean;
    onPreviewAudio?: (text: string) => void; // New prop for TTS
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({ 
    isOpen, onClose, title, suggestions, onSelect, isLoading, onPreviewAudio
}) => {
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);

    // Stop audio when modal closes
    useEffect(() => {
        if (!isOpen) {
            window.speechSynthesis.cancel();
            setPlayingIndex(null);
        }
    }, [isOpen]);

    const handlePlayClick = (e: React.MouseEvent, index: number, text: string) => {
        e.stopPropagation(); // Prevent selecting the item
        
        if (playingIndex === index) {
            // Stop
            window.speechSynthesis.cancel();
            setPlayingIndex(null);
        } else {
            // Play new
            if (onPreviewAudio) {
                setPlayingIndex(index);
                // Create a wrapper to detect end of speech to reset icon
                const utterance = new SpeechSynthesisUtterance(text);
                const voices = window.speechSynthesis.getVoices();
                const vnVoice = voices.find(v => v.lang.includes('vi') && (v.name.includes('Female') || v.name.includes('Nu')));
                if (vnVoice) utterance.voice = vnVoice;
                utterance.lang = 'vi-VN';
                utterance.rate = 1.1; // Slightly faster for preview
                
                utterance.onend = () => setPlayingIndex(null);
                utterance.onerror = () => setPlayingIndex(null);
                
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-[zoomIn_0.3s_ease-out]">
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles size={20} className="text-yellow-500 animate-pulse"/> 
                        {title}
                    </h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={20}/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-950/30">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4 text-zinc-500">
                            <div className="w-12 h-12 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                            <p className="animate-pulse font-medium">AI đang suy nghĩ ra 6 ý tưởng độc đáo...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suggestions.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onSelect(item)}
                                    className="group relative flex flex-col text-left p-5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-indigo-900/10 hover:border-indigo-500 transition-all duration-200 cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold bg-zinc-700/50 text-zinc-400 px-2 py-1 rounded group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                                            Gợi ý #{idx + 1}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {/* Audio Preview Button */}
                                            {onPreviewAudio && (
                                                <button
                                                    onClick={(e) => handlePlayClick(e, idx, item.vi)}
                                                    className={`p-1.5 rounded-full transition-all ${playingIndex === idx ? 'bg-indigo-500 text-white animate-pulse' : 'text-zinc-500 hover:text-indigo-400 hover:bg-white/5'}`}
                                                    title="Nghe thử"
                                                >
                                                    {playingIndex === idx ? <StopCircle size={16} /> : <Volume2 size={16} />}
                                                </button>
                                            )}
                                            <CheckCircle2 size={18} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity transform scale-50 group-hover:scale-100"/>
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-200 font-medium leading-relaxed group-hover:text-white whitespace-pre-wrap">
                                        {item.vi}
                                    </p>
                                    <div className="mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-[10px] text-zinc-500 line-clamp-1 italic">
                                            Strategy: {item.en}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                {!isLoading && (
                    <div className="p-4 border-t border-white/10 bg-zinc-900 text-center">
                        <p className="text-xs text-zinc-500">Bấm vào nút loa để nghe thử. Chọn một gợi ý để áp dụng vào kịch bản.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
