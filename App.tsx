// Fix: Add types for the Web Speech API to resolve TypeScript errors.
// These interfaces and the global declaration make the browser-specific
// SpeechRecognition API available to TypeScript.
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  // Fix: Add 'isFinal' property to match the Web Speech API specification.
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  // Fix: Add 'resultIndex' property to match the Web Speech API specification.
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateTryOnImage, generateImageFromText, editImage, generateSpeech } from './services/geminiService';
import { AspectRatio, PhotoStyle } from './types';
import ImageUpload from './components/ImageUpload';
import SelectInput from './components/SelectInput';
import TextAreaInput from './components/TextAreaInput';
import Spinner from './components/Spinner';
import ImagePreviewModal from './components/ImagePreviewModal';
import { SparklesIcon, PhotoIcon, DownloadIcon, ExpandIcon, RefreshIcon, SunIcon, MoonIcon, WandIcon, PencilIcon, MicrophoneIcon, SpeakerIcon, ChatIcon, MessageIcon, XIcon, GridIcon, RowsIcon, LogOutIcon } from './components/Icons';
import Header from './components/Header';
import SkeletonLoader from './components/SkeletonLoader';
import ErrorDisplay from './components/ErrorDisplay';
import Chatbot from './components/Chatbot';
import LiveChat from './components/LiveChat';
import ToggleSwitch from './components/ToggleSwitch';
import Login from './components/Login';


const MAX_IMAGES = 10;
const INITIAL_MODEL_DESCRIPTION = 'Người mẫu nữ cao 1m65, tóc dài, mặc áo từ ảnh 1';
const INITIAL_PHOTO_STYLE: PhotoStyle = 'Chụp studio';
const INITIAL_ASPECT_RATIO: AspectRatio = '3:4';

type Theme = 'light' | 'dark';
type ImageState = string | 'loading' | 'error' | null;
type LookbookLayout = 'grid' | 'row';


const ThemeToggle: React.FC<{ theme: Theme; toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
  <button
    onClick={toggleTheme}
    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full text-violet-600 dark:text-violet-300 bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/20 hover:bg-white/60 transition-colors duration-200"
    aria-label={`Chuyển sang chế độ ${theme === 'light' ? 'tối' : 'sáng'}`}
  >
    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
  </button>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [originalImages, setOriginalImages] = useState<( { base64: string; mimeType: string; } | null)[]>(Array(MAX_IMAGES).fill(null));
  const [modelDescription, setModelDescription] = useState<string>(INITIAL_MODEL_DESCRIPTION);
  const [photoStyle, setPhotoStyle] = useState<PhotoStyle>(INITIAL_PHOTO_STYLE);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(INITIAL_ASPECT_RATIO);
  const [generatedImages, setGeneratedImages] = useState<ImageState[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [theme, setTheme] = useState<Theme>('light');
  const [history, setHistory] = useState<string[]>([]);
  const [isTtsLoading, setIsTtsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isEditRecording, setIsEditRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [faceSourceIndex, setFaceSourceIndex] = useState<number | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isLiveChatOpen, setIsLiveChatOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isLookbookMode, setIsLookbookMode] = useState<boolean>(false);
  const [lookbookLayout, setLookbookLayout] = useState<LookbookLayout>('grid');
  
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textBeforeRecording = useRef<string>('');
  const editRecognitionRef = useRef<SpeechRecognition | null>(null);
  const textBeforeEditRecording = useRef<string>('');
  
  const hasImages = originalImages.some(img => img !== null);
  const imageToEdit = generatedImages.length > 0 && typeof generatedImages[0] === 'string' ? generatedImages[0] : null;

  useEffect(() => {
    if (!hasImages && modelDescription === INITIAL_MODEL_DESCRIPTION) {
        setModelDescription('');
    } else if (hasImages && modelDescription === '') {
        setModelDescription(INITIAL_MODEL_DESCRIPTION);
    }
  }, [hasImages, modelDescription]);

  useEffect(() => {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDarkMode ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn("Web Speech API không được trình duyệt này hỗ trợ.");
      setIsSpeechSupported(false);
      return;
    }
    // Setup for main description
    recognitionRef.current = new SpeechRecognitionAPI();
    const mainRecognition = recognitionRef.current;
    mainRecognition.lang = 'vi-VN';
    mainRecognition.continuous = true;
    mainRecognition.interimResults = true;

    mainRecognition.onstart = () => setIsRecording(true);
    mainRecognition.onend = () => setIsRecording(false);
    mainRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Lỗi nhận dạng giọng nói:', event.error);
      setIsRecording(false);
    };
    mainRecognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setModelDescription(textBeforeRecording.current + finalTranscript + interimTranscript);
    };

    // Setup for edit prompt
    editRecognitionRef.current = new SpeechRecognitionAPI();
    const editRecognition = editRecognitionRef.current;
    editRecognition.lang = 'vi-VN';
    editRecognition.continuous = true;
    editRecognition.interimResults = true;

    editRecognition.onstart = () => setIsEditRecording(true);
    editRecognition.onend = () => setIsEditRecording(false);
    editRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Lỗi nhận dạng giọng nói (chỉnh sửa):', event.error);
      setIsEditRecording(false);
    };
    editRecognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setEditPrompt(textBeforeEditRecording.current + finalTranscript + interimTranscript);
    };

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
        if (editRecognitionRef.current) {
            editRecognitionRef.current.abort();
        }
    };
  }, []);

  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      if (isEditRecording && editRecognitionRef.current) {
        editRecognitionRef.current.stop();
      }
      textBeforeRecording.current = modelDescription;
      recognitionRef.current.start();
    }
  };

  const handleToggleEditRecording = () => {
    if (!editRecognitionRef.current) return;
    if (isEditRecording) {
      editRecognitionRef.current.stop();
    } else {
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
      }
      textBeforeEditRecording.current = editPrompt;
      editRecognitionRef.current.start();
    }
  };

  const handleImageUpload = (index: number) => (base64: string, mimeType: string) => {
    setOriginalImages(prev => {
      const newImages = [...prev];
      newImages[index] = { base64, mimeType };
      return newImages;
    });
  };

  const handleImageDelete = (index: number) => () => {
    setOriginalImages(prev => {
      const newImages = [...prev];
      newImages[index] = null;
      if (faceSourceIndex === index) {
        setFaceSourceIndex(null);
      }
      return newImages;
    });
  };

  const handleSetFaceSource = (index: number) => {
    setFaceSourceIndex(prevIndex => (prevIndex === index ? null : index));
  };


  const handleInsertReference = (imageNumber: number) => {
    const refText = ` ảnh ${imageNumber} `;
    setModelDescription(prev => {
      if (descriptionRef.current) {
        const { selectionStart, selectionEnd } = descriptionRef.current;
        const newText = prev.substring(0, selectionStart) + refText + prev.substring(selectionEnd);
        // Move cursor after the inserted text
        setTimeout(() => {
            if (descriptionRef.current) {
                descriptionRef.current.selectionStart = descriptionRef.current.selectionEnd = selectionStart + refText.length;
            }
        }, 0);
        return newText;
      }
      return `${prev}${refText}`;
    });
    descriptionRef.current?.focus();
  };
  
  const generateBaseImage = async () => {
    const uploadedImages = originalImages.filter(img => img !== null) as { base64: string; mimeType: string }[];
    const fullPrompt = `${modelDescription}. Phong cách: ${photoStyle}.`;

    if (uploadedImages.length > 0) {
      return await generateTryOnImage(uploadedImages, fullPrompt);
    } else {
      return await generateImageFromText(fullPrompt, aspectRatio);
    }
  }

  const handleGenerate = useCallback(async () => {
    setError(null);
    const uploadedImages = originalImages.filter(img => img !== null);
    
    if (uploadedImages.length === 0 && !modelDescription) {
      setError('Vui lòng tải lên ít nhất một ảnh hoặc nhập mô tả.');
      return;
    }

    setIsLoading(true);
    setGeneratedImages(isLookbookMode ? Array(4).fill('loading') : ['loading']);

    try {
      const baseImage = await generateBaseImage();
      setGeneratedImages(prev => {
        const newImages = [...prev];
        newImages[0] = baseImage;
        return newImages;
      });
      setHistory(prev => [baseImage, ...prev].slice(0, 5));

      if (isLookbookMode) {
        const variationPrompt = "Giữ nguyên người mẫu, trang phục và phong cách từ ảnh gốc. Chỉ thay đổi tư thế hoặc góc chụp một chút để tạo sự đa dạng. Kết quả phải là một bức ảnh duy nhất.";
        const base64Data = baseImage.split(',')[1];
        const mimeType = baseImage.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
        
        const variationPromises = [1, 2, 3].map(i =>
            editImage(base64Data, mimeType, variationPrompt, null).then(variationImage => {
                setGeneratedImages(prev => {
                    const newImages = [...prev];
                    newImages[i] = variationImage;
                    return newImages;
                });
            }).catch(err => {
                console.error(`Lỗi tạo biến thể ${i}:`, err);
                 setGeneratedImages(prev => {
                    const newImages = [...prev];
                    newImages[i] = 'error';
                    return newImages;
                });
            })
        );
        await Promise.all(variationPromises);
      }
    } catch (err) {
      console.error("Lỗi tạo ảnh:", err);
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.';
      setError(errorMessage);
      setGeneratedImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [originalImages, modelDescription, photoStyle, aspectRatio, isLookbookMode]);

  const handleEdit = useCallback(async () => {
    if (!imageToEdit || !editPrompt) return;

    setError(null);
    setIsEditing(true);
    try {
        const base64Data = imageToEdit.split(',')[1];
        const mimeType = imageToEdit.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
        const faceSourceImage = faceSourceIndex !== null ? originalImages[faceSourceIndex] : null;

        const resultImage = await editImage(base64Data, mimeType, editPrompt, faceSourceImage);
        setGeneratedImages([resultImage]); // Replace array with single edited image
        setHistory(prev => [resultImage, ...prev].slice(0, 5));
        setEditPrompt('');
    } catch (err) {
        console.error("Lỗi chỉnh sửa ảnh:", err);
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
        setIsEditing(false);
    }
  }, [imageToEdit, editPrompt, faceSourceIndex, originalImages]);

  const handleReset = () => {
    setOriginalImages(Array(MAX_IMAGES).fill(null));
    setModelDescription('');
    setPhotoStyle(INITIAL_PHOTO_STYLE);
    setAspectRatio(INITIAL_ASPECT_RATIO);
    setGeneratedImages([]);
    setError(null);
    setFaceSourceIndex(null);
    setResetKey(prev => prev + 1);
  };
  
  const handleSuggest = async () => {
    const suggestions = [
      "Người mẫu nữ plus-size, tóc xoăn bồng bềnh, mặc một chiếc váy maxi voan hoa, đang đi dạo giữa một cánh đồng hoa hướng dương vào buổi chiều tà. Phong cách chụp ảnh lãng mạn, màu sắc ấm áp.",
      "Người mẫu nam trung niên, râu quai nón, mặc một bộ suit vải lanh màu be và áo sơ mi trắng không cài cúc trên, ngồi trên một chiếc ghế mây ở ban công nhìn ra biển. Ánh sáng tự nhiên, tạo cảm giác thư thái.",
      "Một cặp đôi người mẫu (nam và nữ) mặc trang phục phong cách cyberpunk với áo khoác da và chi tiết neon, đứng trong một con hẻm ở Seoul vào ban đêm, ánh đèn neon từ các biển hiệu hắt lên. Góc chụp thấp, không khí phim điện ảnh.",
      "Người mẫu nữ da màu, tóc tết cornrow, mặc bộ jumsuit thể thao màu cam sáng, tạo dáng mạnh mẽ trong một sân bóng rổ ngoài trời. Phong cách street style, ảnh chụp có độ tương phản cao.",
      "Ảnh chụp cận cảnh chân dung một người mẫu nữ có tàn nhang, mặc áo len cổ lọ màu kem, tay cầm một tách cà phê nóng. Bối cảnh trong một thư viện cổ, ánh sáng dịu nhẹ từ cửa sổ. Tạo cảm giác ấm cúng, tri thức.",
      "Người mẫu nam dáng người mảnh khảnh, mặc quần tây ống rộng và áo khoác blazer oversized, đứng trước một bức tường bê tông tối giản. Phong cách high fashion, tối giản, ảnh đen trắng.",
      "Người mẫu nữ châu Á, tóc ngắn pixie, mặc áo dài cách tân bằng lụa, tạo dáng bên một hồ sen. Phong cách nghệ thuật, sử dụng kỹ thuật phơi sáng kép để lồng ghép hình ảnh hoa sen.",
      "Người mẫu nam với mái tóc bạch kim, mặc áo hoodie và quần cargo, đang trượt ván trong một công viên skate. Ảnh chụp bằng ống kính mắt cá, bắt trọn khoảnh khắc chuyển động, năng động.",
      "Người mẫu nữ mặc váy dạ hội lấp lánh màu bạc, đứng trên ban công của một tòa nhà chọc trời, nhìn ra quang cảnh thành phố về đêm. Ánh sáng huyền ảo, sang trọng.",
      "Người mẫu nam mặc áo khoác trench coat, đi dưới mưa trên một con phố cổ ở Paris, tay cầm một chiếc ô đen. Ảnh có tông màu lạnh, gợi cảm giác lãng mạn và một chút cô đơn."
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    setModelDescription(randomSuggestion);
  };
  
  const handleTts = async () => {
    if (!modelDescription || isTtsLoading) return;
    setIsTtsLoading(true);
    try {
        await generateSpeech(modelDescription);
    } catch (err) {
        console.error("Lỗi TTS:", err);
        setError(err instanceof Error ? err.message : 'Lỗi tạo giọng nói.');
    } finally {
        setIsTtsLoading(false);
    }
  };

  const handleLiveChatComplete = (finalTranscript: string) => {
    if (finalTranscript) {
      setModelDescription(prev => `${prev}\n${finalTranscript}`.trim());
    }
  };
  
  const renderImageItem = (img: ImageState, index: number) => (
    <>
      {img === 'loading' && <SkeletonLoader />}
      {img === 'error' && <ErrorDisplay message="Lỗi tạo ảnh" />}
      {typeof img === 'string' && (
        <>
          <img src={img} alt={`Ảnh lookbook được tạo ${index + 1}`} className="w-full h-full object-contain" />
          <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={img} download={`ai-fashion-lookbook-${index + 1}.jpg`} className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors" title="Tải xuống">
              <DownloadIcon />
            </a>
            <button onClick={() => setPreviewImage(img)} className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors" title="Xem toàn màn hình">
              <ExpandIcon />
            </button>
          </div>
        </>
      )}
    </>
  );

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-violet-100 to-rose-100 dark:from-slate-900 dark:to-purple-950 text-slate-800 dark:text-slate-200 transition-colors duration-300`}>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <Login onLoginSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-violet-100 to-rose-100 dark:from-slate-900 dark:to-purple-950 text-slate-800 dark:text-slate-200 transition-colors duration-300`}>
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
       <button
        onClick={handleLogout}
        className="absolute top-4 right-16 sm:top-6 sm:right-20 p-2.5 rounded-full text-violet-600 dark:text-violet-300 bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/20 hover:bg-white/60 transition-colors duration-200"
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOutIcon />
      </button>
      <div className="container mx-auto px-4 py-8">
        <Header />
        
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Control Panel */}
          <div className="bg-white/40 dark:bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl border border-white/50 dark:border-white/20 shadow-lg">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Tải lên bộ quần áo (Tối đa {MAX_IMAGES} ảnh)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {originalImages.map((_, index) => (
                        <ImageUpload
                            key={`${resetKey}-${index}`}
                            onImageUpload={handleImageUpload(index)}
                            onImageDelete={handleImageDelete(index)}
                            onInsertReference={handleInsertReference}
                            imageNumber={index + 1}
                            onSetFaceSource={() => handleSetFaceSource(index)}
                            isFaceSource={faceSourceIndex === index}
                        />
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <TextAreaInput
                        ref={descriptionRef}
                        id="modelDescription"
                        label="Mô tả người mẫu và trang phục"
                        value={modelDescription}
                        onChange={(e) => setModelDescription(e.target.value)}
                        placeholder="VD: người mẫu nữ cao 1m7, tóc vàng, mặc áo từ ảnh 1 và quần từ ảnh 2..."
                    />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                        {isSpeechSupported && (
                           <button 
                             onClick={handleToggleRecording} 
                             className={`p-2.5 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200/50 dark:bg-slate-600/50 hover:bg-gray-300/70 dark:hover:bg-slate-500/70 text-gray-600 dark:text-gray-300'}`}
                             aria-label={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
                           >
                             <MicrophoneIcon />
                           </button>
                        )}
                        <button 
                          onClick={handleTts}
                          disabled={isTtsLoading || !modelDescription}
                          className="p-2.5 rounded-full bg-gray-200/50 dark:bg-slate-600/50 hover:bg-gray-300/70 dark:hover:bg-slate-500/70 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Đọc mô tả"
                        >
                            {isTtsLoading ? <Spinner /> : <SpeakerIcon />}
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex flex-wrap gap-2 mt-2">
                       <button onClick={handleSuggest} className="flex items-center gap-1.5 text-xs bg-violet-200/50 dark:bg-violet-800/40 text-violet-700 dark:text-violet-200 px-2.5 py-1.5 rounded-full hover:bg-violet-200/80 dark:hover:bg-violet-800/70 transition-colors">
                         <WandIcon /> Gợi ý bất ngờ!
                       </button>
                       <p className="text-xs text-gray-500 dark:text-gray-400 self-center">Hoặc tự nhập mô tả chi tiết của bạn.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SelectInput
                        id="photoStyle"
                        label="Phong cách chụp ảnh"
                        value={photoStyle}
                        onChange={(e) => setPhotoStyle(e.target.value as PhotoStyle)}
                        options={['Chụp studio', 'Street style', 'Lookbook nghệ thuật', 'Chụp ngoại cảnh', 'Phong cách cổ điển']}
                    />
                    <SelectInput
                        id="aspectRatio"
                        label="Tỷ lệ khung hình"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        options={['3:4', '1:1', '16:9']}
                        disabled={isLookbookMode}
                    />
                </div>
                 <div className="bg-white/30 dark:bg-slate-700/30 p-3 rounded-lg">
                    <ToggleSwitch
                        label="Tạo Lookbook (4 ảnh)"
                        enabled={isLookbookMode}
                        onChange={(enabled) => {
                           setIsLookbookMode(enabled);
                           if (!enabled) {
                               setLookbookLayout('grid');
                           }
                        }}
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || (!hasImages && !modelDescription)}
                        className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        {isLoading ? <Spinner /> : <SparklesIcon />}
                        {isLoading ? 'Đang tạo...' : 'Tạo ảnh Lookbook'}
                    </button>
                     <button
                        onClick={handleReset}
                        title="Làm mới"
                        className="w-full sm:w-auto p-3 bg-white/50 dark:bg-slate-700/50 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 transition-colors"
                    >
                        <RefreshIcon />
                    </button>
                </div>
            </div>
          </div>
          
          {/* Image Display */}
          <div className="bg-white/40 dark:bg-slate-800/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 dark:border-white/20 shadow-lg flex flex-col items-center justify-center min-h-[400px] lg:min-h-0">
            
            {isLookbookMode && generatedImages.length > 0 && !isLoading && (
                 <div className="w-full flex justify-end gap-2 mb-2">
                    <button 
                        onClick={() => setLookbookLayout('grid')}
                        aria-pressed={lookbookLayout === 'grid'}
                        title="Chế độ lưới"
                        className={`p-2 rounded-md transition-colors ${lookbookLayout === 'grid' ? 'bg-violet-600 text-white' : 'bg-white/50 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-700'}`}
                    >
                        <GridIcon />
                    </button>
                    <button 
                        onClick={() => setLookbookLayout('row')}
                        aria-pressed={lookbookLayout === 'row'}
                        title="Chế độ hàng"
                        className={`p-2 rounded-md transition-colors ${lookbookLayout === 'row' ? 'bg-violet-600 text-white' : 'bg-white/50 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-700'}`}
                    >
                        <RowsIcon />
                    </button>
                </div>
            )}

            <div className={`relative w-full ${isLookbookMode && lookbookLayout === 'row' ? 'h-80' : 'aspect-[3/4]'} max-h-[80vh] flex items-center justify-center rounded-lg overflow-hidden`}>
                {error && <ErrorDisplay message={error} />}
                {generatedImages.length === 0 && !error && !isLoading && (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                        <PhotoIcon />
                        <p className="mt-2 font-semibold">Ảnh lookbook của bạn sẽ xuất hiện ở đây</p>
                    </div>
                )}
                {generatedImages.length > 0 && !error && (
                    isLookbookMode && lookbookLayout === 'row' ? (
                        <div className="w-full h-full flex gap-2 overflow-x-auto py-2">
                            {generatedImages.map((img, index) => (
                                <div key={index} className="relative h-full w-auto aspect-[3/4] flex-shrink-0 group bg-slate-200/50 dark:bg-slate-900/50 flex items-center justify-center rounded-md overflow-hidden">
                                    {renderImageItem(img, index)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`w-full h-full grid ${isLookbookMode ? 'grid-cols-2 gap-2' : 'grid-cols-1'} bg-black/5`}>
                            {generatedImages.map((img, index) => (
                                <div key={index} className="relative w-full h-full group bg-slate-200/50 dark:bg-slate-900/50 flex items-center justify-center rounded-md overflow-hidden">
                                    {renderImageItem(img, index)}
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

             {!isLookbookMode && imageToEdit && (
                <div className="w-full mt-4">
                    <label htmlFor="editPrompt" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                        Chỉnh sửa nhanh {faceSourceIndex !== null && `(sử dụng mặt mẫu ${faceSourceIndex + 1})`}
                    </label>
                    <div className="relative">
                        <input
                            id="editPrompt"
                            type="text"
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                            placeholder="VD: Thêm một chiếc vòng cổ, đổi nền thành bãi biển..."
                            className="w-full p-3 pr-32 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-500"
                        />
                         <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-2">
                            {isSpeechSupported && (
                                <button
                                    onClick={handleToggleEditRecording}
                                    className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${isEditRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200/50 dark:bg-slate-600/50 hover:bg-gray-300/70 dark:hover:bg-slate-500/70 text-gray-600 dark:text-gray-300'}`}
                                    aria-label={isEditRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
                                >
                                    <MicrophoneIcon />
                                </button>
                            )}
                            <button
                                onClick={handleEdit}
                                disabled={isEditing || !editPrompt}
                                className="flex items-center justify-center w-11 h-11 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Chỉnh sửa ảnh"
                            >
                                {isEditing ? <Spinner /> : <PencilIcon />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
          </div>
        </main>

        {history.length > 0 && (
             <section className="mt-12">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">Lịch sử sáng tạo</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {history.map((imgSrc, index) => (
                        <div key={index} className="relative group aspect-[3/4] bg-white/40 dark:bg-slate-800/60 p-2 rounded-xl border border-white/50 dark:border-white/20 shadow-md">
                            <img 
                                src={imgSrc} 
                                alt={`Lịch sử tạo ảnh ${index + 1}`} 
                                className="w-full h-full object-cover rounded-md"
                            />
                            <div 
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => { setGeneratedImages([imgSrc]); setIsLookbookMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            >
                                <RefreshIcon />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

      </div>
      
      {/* Floating Action Button for Chat */}
       <div className="fixed bottom-6 right-6 z-40">
            <div className="relative flex flex-col items-center gap-3">
                 <div className={`transition-all duration-300 ease-in-out flex flex-col items-center gap-3 ${isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <button 
                        onClick={() => { setIsChatbotOpen(true); setIsFabOpen(false); }}
                        className="flex items-center gap-2 bg-white dark:bg-slate-700 shadow-lg px-4 py-2.5 rounded-full text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
                    >
                       Chat văn bản <MessageIcon />
                    </button>
                    <button 
                        onClick={() => { setIsLiveChatOpen(true); setIsFabOpen(false); }}
                        className="flex items-center gap-2 bg-white dark:bg-slate-700 shadow-lg px-4 py-2.5 rounded-full text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
                    >
                       Chat giọng nói <MicrophoneIcon />
                    </button>
                </div>
                <button
                    onClick={() => setIsFabOpen(prev => !prev)}
                    className="w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform duration-200"
                    aria-label="Mở trợ lý AI"
                >
                   {isFabOpen ? <XIcon /> : <ChatIcon />}
                </button>
            </div>
        </div>

      {isChatbotOpen && <Chatbot onClose={() => setIsChatbotOpen(false)} />}
      {isLiveChatOpen && <LiveChat onClose={() => setIsLiveChatOpen(false)} onComplete={handleLiveChatComplete} />}

      {previewImage && (
        <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
};

export default App;