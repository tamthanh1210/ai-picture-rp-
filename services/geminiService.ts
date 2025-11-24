import { GoogleGenAI, Modality, GenerateContentResponse, Part } from "@google/genai";
import { AspectRatio } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

// FIX: Initialize the Gemini client once and share it across all functions.
// This resolves the "Ambiguous request" error by ensuring a consistent
// and stable connection context for all API calls, and also improves performance
// by avoiding redundant client initializations.
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Resizes an image from a blob.
 * @param blob The image blob to resize.
 * @param maxSize The maximum width or height of the resized image.
 * @returns A promise that resolves with the resized blob.
 */
const resizeImageBlob = (blob: Blob, maxSize: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.src = url;
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;
    
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }
    
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Không thể lấy context của canvas.'));
            }
            ctx.drawImage(img, 0, 0, width, height);
    
            // Use JPEG for better compression, especially for photos
            canvas.toBlob((resizedBlob) => {
                if (resizedBlob) {
                    resolve(resizedBlob);
                } else {
                    reject(new Error('Chuyển đổi canvas sang Blob thất bại.'));
                }
            }, 'image/jpeg', 0.9);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(new Error("Không thể tải ảnh để thay đổi kích thước."));
        };
    });
};

/**
 * Converts a File object to a base64 encoded string after resizing.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string and mime type.
 */
export const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
        const resizedBlob = await resizeImageBlob(file, 1024);
        const reader = new FileReader();
        reader.readAsDataURL(resizedBlob);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: resizedBlob.type });
        };
        reader.onerror = (error) => reject(error);
    } catch (error) {
        reject(error);
    }
  });
};

/**
 * Fetches an image from a URL, resizes it, and converts it to a base64 encoded string.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves with the base64 string and mime type.
 */
export const imageUrlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string }> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Không thể tải ảnh từ link (lỗi HTTP ${response.status}).`);
    }

    const originalBlob = await response.blob();
    if (!originalBlob.type.startsWith('image/')) {
      throw new Error('Link cung cấp không phải là một tệp ảnh.');
    }
    
    const resizedBlob = await resizeImageBlob(originalBlob, 1024);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(resizedBlob);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: resizedBlob.type });
      };
      reader.onerror = (error) => reject(new Error('Lỗi khi đọc dữ liệu ảnh.'));
    });
  } catch (error) {
     console.error("Lỗi khi lấy hoặc xử lý ảnh từ URL:", error);
     if (error instanceof TypeError) { // Usually indicates CORS or network error
        throw new Error('Không thể tải link do lỗi mạng hoặc chính sách CORS. Vui lòng thử link khác.');
     }
     // Re-throw custom errors from the try block or a generic one
     if (error instanceof Error) {
        throw error;
     }
     throw new Error('Lỗi không xác định khi xử lý link ảnh.');
  }
};

/**
 * Generates an image from a text prompt using the Imagen model.
 * @param prompt The text prompt describing the desired image.
 * @param aspectRatio The desired aspect ratio for the image.
 * @returns A promise that resolves with the base64 string of the generated image.
 */
export const generateImageFromText = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    try {
        // FIX: Create a more descriptive and structured prompt for Imagen to
        // improve clarity and reduce generation failures. This prompt specifies
        // the desired output (professional fashion photo) and context, guiding
        // the model to produce a more relevant and high-quality image.
        const enhancedPrompt = `**Yêu cầu:** Tạo một bức ảnh lookbook thời trang chuyên nghiệp, chất lượng cao, siêu thực.
**Mô tả chi tiết từ người dùng:** ${prompt}
**Lưu ý quan trọng:** Bức ảnh phải sắc nét, có bố cục tốt và trông giống như được chụp bởi một nhiếp ảnh gia chuyên nghiệp.`;
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: enhancedPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        const result = response.generatedImages?.[0];
        
        // FIX: Removed the check for `response.promptFeedback` because it does not
        // exist on the `GenerateImagesResponse` type, which caused a compilation
        // error. Prompt-level blocks for this endpoint are likely handled by
        // throwing an exception, which is caught by the existing try-catch block.
        if (!result) {
            throw new Error('AI không trả về kết quả hình ảnh. Yêu cầu của bạn có thể đã bị chặn.');
        }

        const image = result?.image;

        if (!image?.imageBytes) {
            throw new Error('AI không trả về kết quả hình ảnh hợp lệ. Vui lòng thử lại hoặc thay đổi mô tả.');
        }

        const base64ImageBytes: string = image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;

    } catch (error) {
        console.error("Lỗi khi gọi Imagen API:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Đã xảy ra lỗi không xác định khi tạo ảnh. Vui lòng thử lại.');
    }
};


/**
 * Generates a try-on image using original clothing images and a text prompt.
 * @param images An array of objects, each containing a base64 encoded image and its mime type.
 * @param prompt The text prompt describing the desired output.
 * @returns A promise that resolves with the base64 string of the generated image.
 */
export const generateTryOnImage = async (images: { base64: string; mimeType: string }[], prompt: string): Promise<string> => {
    try {
        const imageParts = images.map(image => ({
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
            },
        }));

        // FIX: Re-engineer the prompt to provide clearer instructions to the AI,
        // reducing ambiguity and the likelihood of the "NO_IMAGE" error. This new
        // structure explicitly states the goal (create a lookbook photo), the context
        // (using provided clothing images), and the specific user description.
        const enhancedPrompt = `**Yêu cầu:** Tạo một bức ảnh lookbook thời trang hoàn chỉnh.
**Nhiệm vụ:** Sử dụng các sản phẩm quần áo từ (các) hình ảnh được cung cấp và mặc chúng cho người mẫu được mô tả dưới đây.
**Mô tả chi tiết từ người dùng:** ${prompt}
**Lưu ý quan trọng:** Kết quả cuối cùng phải là MỘT bức ảnh duy nhất, chất lượng cao, trông chuyên nghiệp và chân thực. Không tạo lưới ảnh hoặc trả về văn bản.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    ...imageParts,
                    {
                        text: enhancedPrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        if (response.promptFeedback?.blockReason) {
            let message = `Yêu cầu bị chặn vì lý do: ${response.promptFeedback.blockReason}.`;
            const harmfulCategory = response.promptFeedback.safetyRatings?.find(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW');
            if (harmfulCategory) {
                message += ` Vui lòng tránh nội dung liên quan đến "${harmfulCategory.category}".`;
            }
            throw new Error(message);
        }

        const candidate = response.candidates?.[0];

        if (!candidate) {
            throw new Error('AI không trả về kết quả. Vui lòng thử lại với một mô tả khác.');
        }
        
        // Use a Set for faster lookup of non-blocking finish reasons.
        const validFinishReasons = new Set(['STOP', 'FINISH_REASON_UNSPECIFIED']);
        if (candidate.finishReason && !validFinishReasons.has(candidate.finishReason)) {
             switch(candidate.finishReason) {
                case 'SAFETY':
                     const safetyRating = candidate.safetyRatings?.find(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW');
                     if (safetyRating) {
                         throw new Error(`Kết quả bị chặn vì lý do an toàn (danh mục: ${safetyRating.category}). Vui lòng điều chỉnh mô tả của bạn.`);
                     }
                     throw new Error('Kết quả bị chặn vì lý do an toàn. Vui lòng điều chỉnh mô tả của bạn.');
                case 'MAX_TOKENS':
                    throw new Error('Mô tả của bạn quá dài khiến kết quả bị cắt ngắn. Vui lòng rút ngắn và thử lại.');
                case 'RECITATION':
                     throw new Error('Kết quả bị chặn do trích dẫn. Vui lòng thay đổi mô tả của bạn.');
                case 'NO_IMAGE':
                    throw new Error('AI không thể tạo ảnh từ mô tả này. Vui lòng thử thay đổi mô tả của bạn để rõ ràng hơn.');
                default:
                    throw new Error(`AI không thể hoàn thành yêu cầu (lý do: ${candidate.finishReason}). Vui lòng thử lại.`);
            }
        }
        
        if (!candidate.content?.parts?.length) {
             throw new Error('AI không trả về nội dung hợp lệ. Vui lòng thử lại.');
        }

        // Find the image part in the response
        for (const part of candidate.content.parts) {
            if (part.inlineData) {
                const generatedBase64 = part.inlineData.data;
                return `data:${part.inlineData.mimeType};base64,${generatedBase64}`;
            }
        }

        // If no image is found, check for text which might contain an error or explanation
        for (const part of candidate.content.parts) {
            if (part.text) {
                throw new Error(`AI đã trả về văn bản thay vì ảnh: "${part.text}"`);
            }
        }

        throw new Error('Không nhận được ảnh từ AI. Phản hồi không chứa dữ liệu ảnh.');

    } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error);
        if (error instanceof Error) {
            // Rethrow our specific error messages or any other error from the API call.
            throw error;
        }
        // Fallback for non-Error exceptions
        throw new Error('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
    }
};

/**
 * Edits an existing image based on a text prompt.
 * @param base64Image The base64 encoded string of the image to edit.
 * @param mimeType The mime type of the image to edit.
 * @param prompt The text prompt describing the desired edit.
 * @param faceSourceImage An optional image to use as a face source.
 * @returns A promise that resolves with the base64 string of the edited image.
 */
export const editImage = async (
    base64Image: string, 
    mimeType: string, 
    prompt: string,
    faceSourceImage: { base64: string; mimeType: string } | null
): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        // Fix: Explicitly define the type for the 'parts' array to accommodate both
        // image objects ({ inlineData: ... }) and text objects ({ text: ... }).
        // This resolves the TypeScript error that occurred from inferring the type
        // solely from the first element and then attempting to push a different shape.
        const parts: ({ inlineData: { data: string; mimeType: string; }; } | { text: string })[] = [imagePart];
        let fullPrompt = prompt;

        if (faceSourceImage) {
            parts.push({
                inlineData: {
                    data: faceSourceImage.base64,
                    mimeType: faceSourceImage.mimeType,
                },
            });
            fullPrompt = `${prompt}. Quan trọng: hãy thay thế khuôn mặt của người mẫu trong ảnh đầu tiên bằng khuôn mặt từ ảnh thứ hai. Giữ nguyên phần còn lại của ảnh đầu tiên. Hãy làm cho nó trông tự nhiên và chân thực.`;
        }
    
        parts.push({ text: fullPrompt });


        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: parts,
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (response.promptFeedback?.blockReason) {
            let message = `Yêu cầu bị chặn vì lý do: ${response.promptFeedback.blockReason}.`;
            const harmfulCategory = response.promptFeedback.safetyRatings?.find(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW');
            if (harmfulCategory) {
                message += ` Vui lòng tránh nội dung liên quan đến "${harmfulCategory.category}".`;
            }
            throw new Error(message);
        }

        const candidate = response.candidates?.[0];
        
        if (!candidate) {
            throw new Error('AI không trả về kết quả. Vui lòng thử lại với một mô tả khác.');
        }

        // Use a Set for faster lookup of non-blocking finish reasons.
        const validFinishReasons = new Set(['STOP', 'FINISH_REASON_UNSPECIFIED']);
        if (candidate.finishReason && !validFinishReasons.has(candidate.finishReason)) {
             switch(candidate.finishReason) {
                case 'SAFETY':
                     const safetyRating = candidate.safetyRatings?.find(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW');
                     if (safetyRating) {
                         throw new Error(`Kết quả bị chặn vì lý do an toàn (danh mục: ${safetyRating.category}). Vui lòng điều chỉnh mô tả của bạn.`);
                     }
                     throw new Error('Kết quả bị chặn vì lý do an toàn. Vui lòng điều chỉnh mô tả của bạn.');
                case 'MAX_TOKENS':
                    throw new Error('Mô tả của bạn quá dài khiến kết quả bị cắt ngắn. Vui lòng rút ngắn và thử lại.');
                case 'RECITATION':
                     throw new Error('Kết quả bị chặn do trích dẫn. Vui lòng thay đổi mô tả của bạn.');
                case 'NO_IMAGE':
                    throw new Error('AI không thể chỉnh sửa ảnh theo yêu cầu này. Vui lòng thử một yêu cầu khác rõ ràng hơn.');
                default:
                    throw new Error(`AI không thể hoàn thành yêu cầu (lý do: ${candidate.finishReason}). Vui lòng thử lại.`);
            }
        }
        
        if (!candidate.content?.parts?.length) {
             throw new Error('AI không trả về nội dung hợp lệ. Vui lòng thử lại.');
        }


        for (const part of candidate.content.parts) {
            if (part.inlineData) {
                const generatedBase64 = part.inlineData.data;
                return `data:${part.inlineData.mimeType};base64,${generatedBase64}`;
            }
        }
        
        for (const part of candidate.content.parts) {
            if (part.text) {
                throw new Error(`AI đã trả về văn bản thay vì ảnh: "${part.text}"`);
            }
        }

        throw new Error('Không nhận được ảnh từ AI. Phản hồi không chứa dữ liệu ảnh.');

    } catch (error) {
        console.error("Lỗi khi gọi Gemini API để chỉnh sửa ảnh:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Đã xảy ra lỗi không xác định khi chỉnh sửa ảnh. Vui lòng thử lại.');
    }
};

/**
 * Generates speech from text using the Gemini TTS model and plays it.
 * @param text The text to convert to speech.
 */
export const generateSpeech = async (text: string): Promise<void> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // You can change the voice here
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
            throw new Error("Không nhận được dữ liệu âm thanh từ AI.");
        }

        // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browsers.
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            outputAudioContext,
            24000,
            1,
        );

        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.start();

        // Return a promise that resolves when the audio finishes playing
        return new Promise(resolve => {
            source.onended = () => {
                outputAudioContext.close();
                resolve();
            };
        });

    } catch (error) {
        console.error("Lỗi khi gọi Gemini TTS API:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Đã xảy ra lỗi không xác định khi tạo giọng nói.');
    }
};

// --- Chatbot Service ---

export type ChatMessage = {
  role: 'user' | 'model';
  parts: Part[];
};

/**
 * Sends a message to the chatbot and gets a streamed response.
 * Uses Google Maps grounding if location is available.
 * @param history The previous chat messages.
 * @param newMessage The new message from the user.
 * @param location The user's current location.
 * @returns A promise that resolves with the streamed response.
 */
export const getChatResponseStream = async (
    history: ChatMessage[],
    newMessage: string,
    location: { latitude: number; longitude: number } | null
) => {
    const modelName = 'gemini-2.5-flash';
    const systemInstruction = 'You are a friendly and helpful AI fashion stylist assistant. Your name is Stylist AI. Provide concise and useful advice on fashion, style, and using this application. You can also find nearby fashion stores if the user asks for them. Keep your answers short and to the point. Respond in Vietnamese.';

    const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];

    const config: any = {
        systemInstruction: systemInstruction,
    };

    if (location) {
        config.tools = [{ googleMaps: {} }];
        config.toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
            },
        };
    }

    const response = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: config,
    });

    return response;
};
