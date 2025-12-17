
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SEOData, ModelTier, User } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getCurrentUserTier = (): ModelTier => {
    const userStr = localStorage.getItem('ue_current_user');
    if (!userStr) return '1.5-free';
    try {
        const user = JSON.parse(userStr) as User;
        if (user.role === 'admin') {
            return user.modelTier || '3.0-pro'; 
        }
        return user.modelTier || '1.5-free';
    } catch (e) {
        return '1.5-free';
    }
};

const getModelNames = (tier: ModelTier) => {
    switch (tier) {
        case '3.0-pro':
            return {
                text: 'gemini-3-pro-preview',
                image: 'gemini-3-pro-image-preview',
                video: 'veo-3.1-generate-preview'
            };
        case '2.5-verified':
            return {
                text: 'gemini-flash-latest', 
                image: 'gemini-3-pro-image-preview', 
                video: 'veo-3.1-fast-generate-preview'
            };
        case '1.5-free':
        default:
            return {
                text: 'gemini-3-flash-preview', 
                image: 'gemini-2.5-flash-image', 
                video: 'veo-3.1-fast-generate-preview'
            };
    }
};

// Check if current user has permission to use a specific quality or engine
const validateTierAccess = (tier: ModelTier, quality: string, engine?: string) => {
    if (quality === '4K' && tier !== '3.0-pro') {
        throw new Error("Tài khoản chưa được cấp quyền 4K. Vui lòng nâng cấp lên 3.0 Pro.");
    }
    if (quality === '2K' && tier === '1.5-free') {
        throw new Error("Tài khoản miễn phí chỉ hỗ trợ 1K. Vui lòng xác minh để dùng 2K.");
    }
};

async function getJson(response: any): Promise<any> {
    try {
        let text = response.text || "";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

export const generateCompositeImage = async (
    subjectB64: string, 
    outfitB64: string | null, 
    productB64: string | null,
    accessoryB64: string | null,
    prompt: string, 
    background: string, 
    aspectRatio: string, 
    quality: string, 
    preserveIdentity: boolean, 
    negativePrompt: string
): Promise<string> => {
    const tier = getCurrentUserTier();
    
    // Strict Tier Lock
    validateTierAccess(tier, quality);

    const models = getModelNames(tier);
    const ai = getAi();

    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: subjectB64 } }
    ];

    let systemDirective = `**STRICT PIXEL-PERFECT COMPOSITE MISSION**\n`;
    systemDirective += `TASK: You MUST merge the following elements with 100% fidelity. NO hallucinations allowed.\n\n`;
    systemDirective += `1. **IDENTITY (IMAGE 1):** Maintain the EXACT face, body shape, and hair of the person in Image 1. DO NOT change ethnicity or proportions.\n`;

    if (outfitB64) { 
        parts.push({ inlineData: { mimeType: 'image/png', data: outfitB64 } }); 
        systemDirective += `2. **OUTFIT (IMAGE 2):** The person MUST WEAR this EXACT clothing. Every pattern, texture, and seam must match Image 2 perfectly.\n`;
    }
    
    if (productB64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });
        systemDirective += `3. **PRODUCT (IMAGE 3):** The person MUST HOLD this EXACT product. The design, logo, and material of the product in Image 3 are immutable.\n`;
    }

    if (accessoryB64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: accessoryB64 } });
        systemDirective += `4. **ACCESSORY (IMAGE 4):** The person MUST WEAR or ATTACH this EXACT accessory (watch/jewelry/bag). Zero deviation from Image 4.\n`;
    }

    systemDirective += `\n**EXECUTION:** ${prompt}. Background: ${background}. Lighting: Professional Studio. Resolution: High-fidelity. ${negativePrompt ? 'Negative: ' + negativePrompt : ''}`;

    parts.push({ text: systemDirective });

    // Fix: imageSize is only available for gemini-3-pro-image-preview
    const imageConfig: any = { aspectRatio };
    if (models.image === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = (tier === '1.5-free' ? '1K' : quality) as any;
    }

    const response = await ai.models.generateContent({
        model: models.image,
        contents: { parts },
        config: { 
            imageConfig
        }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Render failed: No image output from Pro Engine.");
};

export const generateImage = async (
    prompt: string, 
    aspectRatio: string = '1:1', 
    quality: string = '1K', 
    refImageB64?: string, 
    negativePrompt?: string,
    engine: ImageEngine = 'imagen'
): Promise<string> => {
    const ai = getAi();
    const tier = getCurrentUserTier();
    
    // Strict Tier Lock
    validateTierAccess(tier, quality, engine);

    const models = getModelNames(tier);

    if (tier === '1.5-free') {
        if (engine === 'imagen') {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt + (negativePrompt ? ` (Avoid: ${negativePrompt})` : ''),
                config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: aspectRatio as any },
            });
            return response.generatedImages[0].image.imageBytes;
        }
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
        });
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) return part.inlineData.data;
        }
        throw new Error("No image generated");
    }

    const parts: any[] = [{ text: prompt }];
    if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
    if (negativePrompt) parts[0].text += ` --no ${negativePrompt}`;

    let finalQuality = quality;
    if (tier === '2.5-verified' && (quality === '4K')) finalQuality = '2K';

    // Fix: imageSize is only available for gemini-3-pro-image-preview
    const imageConfig: any = { aspectRatio };
    if (models.image === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = finalQuality as any;
    }

    const response = await ai.models.generateContent({
        model: models.image,
        contents: { parts },
        config: { imageConfig }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image generated");
};

export const enhancePrompt = async (prompt: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    try {
        const response = await getAi().models.generateContent({
            model: models.text,
            contents: `Enhance this image generation prompt to be more detailed, descriptive, and artistic. Original: "${prompt}"`,
        });
        return response.text || prompt;
    } catch (e) {
        return prompt;
    }
};

export const validateImageSafety = async (base64Image: string): Promise<{ safe: boolean; reason?: string }> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    try {
        const response = await getAi().models.generateContent({
            model: models.text, 
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: "Analyze this image for safety. Return JSON: { \"safe\": boolean, \"reason\": string }" }
                ]
            },
            config: { responseMimeType: 'application/json' }
        });
        return await getJson(response) || { safe: false, reason: "Analysis failed" };
    } catch (e) {
        return { safe: false, reason: "Safety check error" };
    }
};

export const generateNewCreationSuggestions = async (refImageB64: string | null, prompt: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Suggest 4 artistic image generation ideas based on this context: "${prompt}". Return JSON array of objects: [{"vi": "mô tả tiếng Việt", "en": "prompt in English"}]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStudioSuggestions = async (base64Image: string | null, prompt: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Suggest 4 image composition ideas for a studio setup. Prompt: "${prompt}". Return JSON array: [{"vi": "mô tả", "en": "prompt"}]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export type ImageEngine = 'imagen' | 'gemini-pro';

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
    return generateImage(prompt, '1:1', '2K', base64Image, undefined, 'gemini-pro');
};

export const generateThumbnail = async (base64Image: string, layout: string, aspectRatio: string, quality: string, lang: string, context: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    
    // Fix: imageSize is only available for gemini-3-pro-image-preview
    const imageConfig: any = { aspectRatio };
    if (models.image === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = quality as any;
    }

    const response = await getAi().models.generateContent({
        model: models.image,
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/png', data: base64Image } },
                { text: `Create a professional viral thumbnail. Layout: ${layout}. Language: ${lang}. Context: ${context}` }
            ]
        },
        config: { imageConfig }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Thumbnail generation failed");
};

export const generateThumbnailSuggestions = async (base64Image: string | null, platform: string, category: string, style: string, product: string, context: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: `Suggest 4 viral thumbnail hooks for ${product} on ${platform}. Category: ${category}, Style: ${style}. Context: ${context}. Return JSON array: [{ "vi": "tiêu đề", "en": "prompt_en", "data": {"sub": "phụ đề"} }]` }];
    if (base64Image) parts.unshift({ inlineData: { mimeType: 'image/png', data: base64Image } });

    const response = await getAi().models.generateContent({
        model: models.text,
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generatePoster = async (modelB64: string | null, productB64: string | null, logoB64: string | null, headline: string, finalPrompt: string, template: string, quality: string, negativePrompt: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: `Create an advertising poster. Headline: "${headline}". Template: ${template}. Prompt: ${finalPrompt}. Negative: ${negativePrompt}` }];
    if (modelB64) parts.push({ inlineData: { mimeType: 'image/png', data: modelB64 } });
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });
    if (logoB64) parts.push({ inlineData: { mimeType: 'image/png', data: logoB64 } });

    // Fix: imageSize is only available for gemini-3-pro-image-preview
    const imageConfig: any = { aspectRatio: '3:4' };
    if (models.image === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = quality as any;
    }

    const response = await getAi().models.generateContent({
        model: models.image,
        contents: { parts },
        config: { imageConfig }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Poster generation failed");
};

export const generatePosterSuggestions = async (modelB64: string | null, productB64: string | null, logoB64: string | null, context: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: `Suggest 4 poster concepts based on: ${context}. Return JSON: [{ "vi": "mô tả", "en": "prompt", "data": {"headline": "...", "purpose": "..."} }]` }];
    if (modelB64) parts.push({ inlineData: { mimeType: 'image/png', data: modelB64 } });
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });

    const response = await getAi().models.generateContent({
        model: models.text,
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryStructure = async (characters: string[], premise: string, epCount: number, market: string): Promise<any> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Create a story structure for ${market}. Premise: ${premise}. Characters: ${characters.join(', ')}. Episodes: ${epCount}. Return JSON structure.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateStoryScenes = async (epSummary: string, duration: number, context: string, chars: any[], voices: any, textMode: string, existing: any[], lang: string, estCount: number, epIdx: number, totalEp: number, prevSum?: string, nextSum?: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Generate ${estCount} scenes for Episode ${epIdx+1}. Summary: ${epSummary}. Language: ${lang}. Return JSON array of objects with sceneNumber, visualPrompt, voiceover, character, locationTag.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateYouTubeSEO = async (title: string, summary: string, lang: string, market: string): Promise<SEOData> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `SEO for: ${title}. ${summary}. Market: ${market}. Lang: ${lang}. Return JSON: { \"optimizedTitle\": \"...\", \"hashtags\": [], \"description\": \"...\", \"postingStrategy\": \"...\" }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateCharacterConcepts = async (count: number, theme: string, style: string, lang: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Suggest ${count} character concepts for theme: ${theme}. Style: ${style}. Lang: ${lang}. Return JSON: [{ \"setName\": \"...\", \"characters\": [{ \"name\": \"...\", \"description\": \"...\" }] }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateAdvancedVeoVideo = async (params: { prompt: string, aspectRatio: string, resolution: string, image?: string, endImage?: string }): Promise<string> => {
    const { prompt, aspectRatio, resolution, image, endImage } = params;
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);

    const config: any = { numberOfVideos: 1, resolution: resolution as any, aspectRatio: aspectRatio as any };
    if (endImage) config.lastFrame = { imageBytes: endImage, mimeType: 'image/png' };
    
    const requestPayload: any = { model: models.video, prompt, config };
    if (image) requestPayload.image = { imageBytes: image, mimeType: 'image/png' };

    const ai = getAi();
    let operation = await ai.models.generateVideos(requestPayload);
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed");
    const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
};

export const generateChannelStrategy = async (product: string, platform: string, niche: string, goal: string, market: string, type: string): Promise<any> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Strategy for ${platform} channel. Product: ${product}. Niche: ${niche}. Market: ${market}. Return JSON structure.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateVideoStrategy = async (
    b64: string | null, productName: string, 
    usp: string, painPoint: string, cta: string,
    category: string, platform: string, 
    audience: string, voice: string, hasMusic: boolean, 
    sceneCount: number, salesFramework: string, hookType: string, visualStyle: string,
    contextDetail: string, contextDesc: string, activeTab: string, bg: string, 
    auxCharB64: string | null, language: string, targetAudience: string,
    tone: string, pace: string, musicMood: string
): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Create a detailed video strategy script for ${productName} on ${platform}.
        USP: ${usp}. Pain Point: ${painPoint}. CTA: ${cta}. Framework: ${salesFramework}. Hook: ${hookType}. Visual Style: ${visualStyle}.
        Return JSON array of scene objects.`,
        config: { responseMimeType: 'application/json' }
    });
    return response.text || "[]";
};

export const generateVideoCaptions = async (product: string, usp: string, category: string, platform: string, extra1: string, extra2: string, scriptJson: string): Promise<any> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Generate viral captions for ${platform} based on this script: ${scriptJson}. Product: ${product}. USP: ${usp}. Return JSON: {\"shortCaption\": \"...\", \"longCaption\": \"...\", \"hashtags\": [\"#tag1\", ...] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || { shortCaption: "", longCaption: "", hashtags: [] };
};

export const generateMarketingStrategies = async (product: string, category: string, b64: string | null): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: `Generate 4 marketing strategy suggestions for ${product} in category ${category}. Return JSON array.` }];
    if (b64) parts.push({ inlineData: { mimeType: 'image/png', data: b64 } });

    const response = await getAi().models.generateContent({
        model: models.text,
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateVeoSceneImage = async (
    prompt: string, 
    charImage: string | null, 
    prodImage: string | null, 
    aspectRatio: string, 
    usp: string, 
    index: number, 
    prevImageB64: string | null, 
    quality: string,
    outfit?: string, 
    charDesc?: string, 
    bg?: string
): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: prompt }];
    if (charImage) parts.push({ inlineData: { mimeType: 'image/png', data: charImage } });
    if (prodImage) parts.push({ inlineData: { mimeType: 'image/png', data: prodImage } });
    if (prevImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: prevImageB64 } });
    
    // Fix: imageSize is only available for gemini-3-pro-image-preview
    const imageConfig: any = { aspectRatio };
    if (models.image === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = quality as any;
    }

    const response = await getAi().models.generateContent({
        model: models.image,
        contents: { parts },
        config: { imageConfig }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Failed to generate scene image");
};

export const regenerateScenePrompt = async (prompt: string, context: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Rewrite this image generation prompt to be more cinematic and detailed. Context: ${context}. Original: "${prompt}"`,
    });
    return response.text || prompt;
};

export const generateCharacterNames = async (count: number, language: string, type: string, style: string): Promise<string[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Generate ${count} character names in ${language}. Type: ${type}. Style: ${style}. Return JSON string array.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const expandCharacterPrompt = async (name: string, desc: string, style: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Expand this character description for high-quality image generation. Name: ${name}. Style: ${style}. Desc: ${desc}`,
    });
    return response.text || desc;
};

export const suggestCharacterVoices = async (chars: any[], voices: string[], market: string): Promise<Record<string, string>> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Suggest best voices for những nhân vật sau: ${JSON.stringify(chars)}. Return JSON.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateDiverseStoryIdeas = async (chars: any[], mood: string, context: string, market: string): Promise<any[]> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Generate 4 diverse story ideas for market ${market}. Mood: ${mood}. Context: ${context}. Return JSON array.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryThumbnail = async (storyTitle: string, epNum: number, epTitle: string, epSum: string, layout: string, lang: string, aspectRatio: string, hook: string, style: string, refImage?: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const parts: any[] = [{ text: `Create a story thumbnail for Episode ${epNum}. Story: ${storyTitle}. Style: ${style}.` }];
    if (refImage) parts.push({ inlineData: { mimeType: 'image/png', data: refImage } });
    
    const response = await getAi().models.generateContent({
        model: models.image,
        contents: { parts },
        config: { imageConfig: { aspectRatio } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Failed to generate story thumbnail");
};

export const generateDailyChannelTask = async (plan: any, doneTasks: string[]): Promise<any> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Dựa trên plan: ${JSON.stringify(plan)} và tasks đã xong: ${doneTasks.join(', ')}, gợi ý task tiếp theo. Return JSON.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateSpecificChannelDetail = async (type: string, context: string): Promise<string> => {
    const tier = getCurrentUserTier();
    const models = getModelNames(tier);
    const response = await getAi().models.generateContent({
        model: models.text,
        contents: `Generate channel detail of type ${type} for context: ${context}`,
    });
    return response.text || "";
};
