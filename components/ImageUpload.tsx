import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fileToBase64, imageUrlToBase64 } from '../services/geminiService';
import { UploadIcon, PencilIcon, TrashIcon, PlusCircleIcon, FaceIcon } from './Icons';
import Spinner from './Spinner';

interface ImageUploadProps {
  onImageUpload: (base64: string, mimeType: string) => void;
  onImageDelete: () => void;
  onInsertReference: (imageNumber: number) => void;
  imageNumber: number;
  onSetFaceSource: () => void;
  isFaceSource: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, onImageDelete, onInsertReference, imageNumber, onSetFaceSource, isFaceSource }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const currentUrl = previewUrl;
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [previewUrl]);

  const clearError = useCallback(() => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setError(null);
  }, []);

  const showError = useCallback((message: string) => {
    clearError();
    setError(message);
    errorTimeoutRef.current = window.setTimeout(() => {
      setError(null);
    }, 5000);
  }, [clearError]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);


  const handleFileChange = useCallback(async (files: FileList | null) => {
    if (files && files[0]) {
      setIsProcessing(true);
      clearError();
      try {
        const { base64, mimeType } = await fileToBase64(files[0]);
        setPreviewUrl(URL.createObjectURL(files[0]));
        onImageUpload(base64, mimeType);
      } catch (err) {
        console.error("Lỗi chuyển đổi tệp:", err);
        showError("Lỗi xử lý tệp.");
      } finally {
        setIsProcessing(false);
      }
    }
  }, [onImageUpload, clearError, showError]);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileChange(e.dataTransfer.files);
  }, [handleFileChange]);

  const handleUrlPaste = useCallback(async (url: string) => {
    setIsProcessing(true);
    clearError();
    try {
        const { base64, mimeType } = await imageUrlToBase64(url);
        
        const fetchRes = await fetch(`data:${mimeType};base64,${base64}`);
        const blob = await fetchRes.blob();

        setPreviewUrl(URL.createObjectURL(blob));
        onImageUpload(base64, mimeType);
    } catch (err) {
        console.error("Lỗi tải ảnh từ URL:", err);
        showError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.");
    } finally {
        setIsProcessing(false);
    }
  }, [onImageUpload, clearError, showError]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isProcessing || previewUrl) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const urlRegex = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
    if (pastedText && urlRegex.test(pastedText)) {
      handleUrlPaste(pastedText);
    } else {
        showError('Clipboard không chứa link hợp lệ.');
    }
  }, [handleUrlPaste, isProcessing, previewUrl, showError]);

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    clearError();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onImageDelete();
  };
  
  const handleChangeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onButtonClick();
  };
  
  const handleAddToPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInsertReference(imageNumber);
  };
  
  const handleSetFaceSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetFaceSource();
  };

  const baseStyle = `relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-center p-1 transition-all duration-300 group outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 dark:focus:ring-offset-slate-900`;
  const placeholderStyle = `bg-white/40 dark:bg-slate-800/70 border-2 border-dashed border-violet-300 dark:border-slate-600 hover:bg-white/60 dark:hover:bg-slate-800`;
  const faceSourceStyle = isFaceSource ? 'ring-4 ring-green-400 dark:ring-green-500 ring-offset-2 dark:ring-offset-slate-900' : 'border-white/30';

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={!previewUrl && !isProcessing ? onButtonClick : undefined}
      tabIndex={0}
      className={`${baseStyle} ${!previewUrl ? placeholderStyle : `border ${faceSourceStyle}`}`}
    >
      <span className="absolute top-1.5 left-1.5 bg-violet-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full z-10 shadow-sm">{imageNumber}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files)}
      />
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Xem trước" className="w-full h-full object-contain rounded-lg p-1" />
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl">
            <button title="Thêm vào mô tả" onClick={handleAddToPrompt} className="flex items-center justify-center text-white bg-black/50 w-10 h-10 rounded-full hover:bg-black/70">
              <PlusCircleIcon />
            </button>
             <button title="Dùng làm mặt mẫu" onClick={handleSetFaceSource} className="flex items-center justify-center text-white bg-black/50 w-10 h-10 rounded-full hover:bg-black/70">
              <FaceIcon />
            </button>
            <button title="Thay đổi" onClick={handleChangeClick} className="flex items-center justify-center text-white bg-black/50 w-10 h-10 rounded-full hover:bg-black/70">
              <PencilIcon />
            </button>
            <button title="Xóa" onClick={handleDelete} className="flex items-center justify-center text-white bg-black/50 w-10 h-10 rounded-full hover:bg-black/70">
              <TrashIcon />
            </button>
          </div>
        </>
      ) : isProcessing ? (
          <div className="flex flex-col items-center text-gray-600 dark:text-gray-400 p-2">
            <Spinner />
            <p className="mt-2 font-semibold text-xs leading-tight">Đang xử lý...</p>
          </div>
      ) : (
        <div className="flex flex-col items-center text-gray-600 dark:text-gray-400 p-2">
          {error ? (
              <p className="text-xs text-red-500 font-semibold text-center">{error}</p>
          ) : (
            <>
              <UploadIcon />
              <p className="mt-2 font-semibold text-xs leading-tight text-center">Nhấn, kéo thả, hoặc dán link</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;