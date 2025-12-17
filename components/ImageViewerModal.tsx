
import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string | null;
    altText?: string;
    children?: React.ReactNode; // For extra buttons/actions
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, imageSrc, altText, children }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, imageSrc]);

    // Added: Listen for Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !imageSrc) return null;

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = -e.deltaY * 0.001;
        // Limit zoom between 0.5x and 5x
        setScale(prev => Math.min(Math.max(0.5, prev + delta), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-[fadeIn_0.2s_ease-out]">
            {/* Toolbar */}
            <div className="flex justify-between items-center p-4 bg-black/50 border-b border-white/10 z-20 backdrop-blur-md absolute top-0 left-0 right-0">
                <div className="text-white/70 text-sm font-medium truncate max-w-[60%]">{altText || 'Preview'}</div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg p-1 border border-white/10">
                        <button 
                            onClick={() => setScale(s => Math.max(0.5, s - 0.5))} 
                            className="p-1.5 hover:bg-white/10 rounded-md text-white transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16}/>
                        </button>
                        <span className="text-[10px] w-10 text-center text-zinc-400 font-mono select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        <button 
                            onClick={() => setScale(s => Math.min(5, s + 0.5))} 
                            className="p-1.5 hover:bg-white/10 rounded-md text-white transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn size={16}/>
                        </button>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full text-zinc-400 transition-colors"
                        title="Close (Esc)"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Image Area */}
            <div
                className="flex-1 overflow-hidden relative flex items-center justify-center cursor-move select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(e) => { if(e.target === e.currentTarget) onClose(); }} // Close if clicking background
            >
                <img
                    src={imageSrc}
                    alt={altText}
                    className="max-w-none transition-transform duration-75 ease-linear shadow-2xl"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        maxHeight: '80vh',
                        maxWidth: '90vw',
                        objectFit: 'contain'
                    }}
                    draggable={false}
                />
            </div>

            {/* Footer / Extra Actions */}
            {children && (
                <div className="p-6 bg-black/60 border-t border-white/10 z-20 backdrop-blur-md flex justify-center absolute bottom-0 left-0 right-0">
                    {children}
                </div>
            )}
        </div>
    );
};
