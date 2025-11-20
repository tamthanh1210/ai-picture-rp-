import React, { useState, useRef, useCallback, useEffect } from 'react';
import { XIcon, ZoomInIcon, ZoomOutIcon } from './Icons';

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleZoom = useCallback((delta: number) => {
    setScale((prevScale) => {
      const newScale = prevScale + delta;
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    });
  }, []);

  useEffect(() => {
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    isDragging.current = true;
    startPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDragging.current || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    });
  }, [scale]);
  
  const handleMouseUpOrLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    handleZoom(e.deltaY * -0.01);
  }, [handleZoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-md"
      onWheel={handleWheel}
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Xem trước ảnh AI"
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default',
            transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        />
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/40 p-2 rounded-full hover:bg-black/60 transition-colors"
        aria-label="Đóng"
      >
        <XIcon />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-sm p-2 rounded-xl text-white border border-white/20">
        <button 
          onClick={() => handleZoom(-0.2)} 
          disabled={scale <= MIN_SCALE}
          className="p-2 disabled:opacity-50 transition-opacity"
          aria-label="Thu nhỏ"
        >
          <ZoomOutIcon />
        </button>
        <span className="min-w-[40px] text-center font-semibold tabular-nums">{(scale * 100).toFixed(0)}%</span>
        <button 
          onClick={() => handleZoom(0.2)} 
          disabled={scale >= MAX_SCALE}
          className="p-2 disabled:opacity-50 transition-opacity"
          aria-label="Phóng to"
        >
          <ZoomInIcon />
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;