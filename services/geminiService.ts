
import { GoogleGenAI, Type } from "@google/genai";
/* Import missing SEOData type */
import { SEOData } from "../types";

/* Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog */
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper Functions ---

async function getJson(response: any): Promise<any> {
    try {
        let text = response.text || "";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse JSON from Gemini response", e);
        return null;
    }
}

// --- Text Generation Services ---

export const enhancePrompt = async (prompt: string): Promise<string> => {
    try {
        const response = await getAi().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Enhance this image generation prompt to be more detailed, descriptive, and artistic. Original: "${prompt}"`,
        });
        return response.text || prompt;
    } catch (e) {
        return prompt;
    }
};

export const validateImageSafety = async (base64Image: string): Promise<{ safe: boolean; reason?: string }> => {
    try {
        const response = await getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
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

// --- Image Generation Services ---

export type ImageEngine = 'imagen' | 'gemini-pro';

export const generateImage = async (
    prompt: string, 
    aspectRatio: string = '1:1', 
    quality: string = '1K', 
    refImageB64?: string, 
    negativePrompt?: string,
    engine: ImageEngine = 'imagen'
): Promise<string> => {
    
    const ai = getAi();
    if (engine === 'imagen' && !refImageB64) {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt + (negativePrompt ? ` (Avoid: ${negativePrompt})` : ''),
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio as any,
            },
        });
        return response.generatedImages[0].image.imageBytes;
    }

    const model = 'gemini-3-pro-image-preview';
    const parts: any[] = [{ text: prompt }];
    if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
    if (negativePrompt) parts[0].text += ` --no ${negativePrompt}`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { imageConfig: { aspectRatio, imageSize: quality === '1K' ? '1K' : (quality === '2K' ? '2K' : '4K') } }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image generated");
};

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
    return generateImage(prompt, '1:1', '2K', base64Image, undefined, 'gemini-pro');
};

// --- Specialized Services ---

export const generateThumbnail = async (base64Image: string, layout: string, aspectRatio: string, quality: string, lang: string, context: string): Promise<string> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/png', data: base64Image } },
                { text: `Create a professional viral thumbnail. Layout: ${layout}. Language: ${lang}. Context: ${context}` }
            ]
        },
        config: { imageConfig: { aspectRatio, imageSize: quality as any } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Thumbnail generation failed");
};

export const generateThumbnailSuggestions = async (base64Image: string | null, platform: string, category: string, style: string, product: string, context: string): Promise<any[]> => {
    const parts: any[] = [{ text: `Suggest 4 viral thumbnail hooks for ${product} on ${platform}. Category: ${category}, Style: ${style}. Context: ${context}. Return JSON array: [{ "vi": "tiêu đề", "en": "prompt_en", "data": {"sub": "phụ đề"} }]` }];
    if (base64Image) parts.unshift({ inlineData: { mimeType: 'image/png', data: base64Image } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generatePoster = async (modelB64: string | null, productB64: string | null, logoB64: string | null, headline: string, finalPrompt: string, template: string, quality: string, negativePrompt: string): Promise<string> => {
    const parts: any[] = [{ text: `Create an advertising poster. Headline: "${headline}". Template: ${template}. Prompt: ${finalPrompt}. Negative: ${negativePrompt}` }];
    if (modelB64) parts.push({ inlineData: { mimeType: 'image/png', data: modelB64 } });
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });
    if (logoB64) parts.push({ inlineData: { mimeType: 'image/png', data: logoB64 } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio: '3:4', imageSize: quality as any } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Poster generation failed");
};

export const generatePosterSuggestions = async (modelB64: string | null, productB64: string | null, logoB64: string | null, context: string): Promise<any[]> => {
    const parts: any[] = [{ text: `Suggest 4 poster concepts based on: ${context}. Return JSON: [{ "vi": "mô tả", "en": "prompt", "data": {"headline": "...", "purpose": "..."} }]` }];
    if (modelB64) parts.push({ inlineData: { mimeType: 'image/png', data: modelB64 } });
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateVeoSceneImage = async (prompt: string, charB64: string | null, prodB64: string | null, aspectRatio: string, type: string, index: number, refImage: string | null, quality: string, outfit?: string, charDesc?: string, bg?: string): Promise<string> => {
    const parts: any[] = [{ text: `Scene Image (${type} #${index+1}). Prompt: ${prompt}. Outfit: ${outfit}. Desc: ${charDesc}. BG: ${bg}` }];
    if (charB64) parts.push({ inlineData: { mimeType: 'image/png', data: charB64 } });
    if (prodB64) parts.push({ inlineData: { mimeType: 'image/png', data: prodB64 } });
    if (refImage) parts.push({ inlineData: { mimeType: 'image/png', data: refImage } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio, imageSize: quality as any } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Scene image failed");
};

export const regenerateScenePrompt = async (oldPrompt: string, context: string): Promise<string> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Rewrite this scene prompt to be better. Old: "${oldPrompt}". Context: ${context}`,
    });
    return response.text || oldPrompt;
};

export const generateVideoCaptions = async (product: string, usp: string, category: string, platform: string, audience: string, tone: string, script: string): Promise<any> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate viral captions for ${platform}. Product: ${product}. USP: ${usp}. Script: ${script}. Return JSON: { "shortCaption": "...", "longCaption": "...", "hashtags": ["#a", "#b"] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || { shortCaption: "", longCaption: "", hashtags: [] };
};

export const generateStudioSuggestions = async (subjectB64: string | null): Promise<any[]> => {
    const parts: any[] = [{ text: "Suggest 4 artistic composition ideas for this subject. Return JSON array." }];
    if (subjectB64) parts.unshift({ inlineData: { mimeType: 'image/png', data: subjectB64 } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryStructure = async (characters: string[], premise: string, epCount: number, market: string): Promise<any> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Create a story structure for ${market}. Premise: ${premise}. Characters: ${characters.join(', ')}. Episodes: ${epCount}. Return JSON structure.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateStoryScenes = async (epSummary: string, duration: number, context: string, chars: any[], voices: any, textMode: string, existing: any[], lang: string, estCount: number, epIdx: number, totalEp: number, prevSum?: string, nextSum?: string): Promise<any[]> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate ${estCount} scenes for Episode ${epIdx+1}. Summary: ${epSummary}. Language: ${lang}. Return JSON array of objects with sceneNumber, visualPrompt, voiceover, character, locationTag.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateYouTubeSEO = async (title: string, summary: string, lang: string, market: string): Promise<SEOData> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `SEO for: ${title}. ${summary}. Market: ${market}. Lang: ${lang}. Return JSON: { "optimizedTitle": "...", "hashtags": [], "description": "...", "postingStrategy": "..." }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const suggestCharacterVoices = async (chars: any[], voices: string[], market: string): Promise<any> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Assign these voices: ${voices.join(', ')} to these characters: ${JSON.stringify(chars)}. Return JSON mapping.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateDiverseStoryIdeas = async (chars: any[], mood: string, idea: string, market: string): Promise<any[]> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Suggest 4 story ideas. Characters: ${JSON.stringify(chars)}. Mood: ${mood}. Market: ${market}. Context: ${idea}. Return JSON array.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryThumbnail = async (storyTitle: string, epNum: number, epTitle: string, summary: string, layout: string, lang: string, ratio: string, hook: string, style: string, refB64?: string): Promise<string> => {
    const parts: any[] = [{ text: `Create story thumbnail. Title: ${storyTitle}. Ep ${epNum}: ${epTitle}. Summary: ${summary}. Hook: ${hook}. Style: ${style}` }];
    if (refB64) parts.push({ inlineData: { mimeType: 'image/png', data: refB64 } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio: ratio as any, imageSize: '2K' } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Story thumbnail failed");
};

export const generateCharacterNames = async (count: number, lang: string, gender: string, style: string): Promise<string[]> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `List ${count} character names in ${lang}. Gender: ${gender}. Style: ${style}. Return JSON array of strings.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateCharacterConcepts = async (count: number, theme: string, style: string, lang: string): Promise<any[]> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Suggest ${count} character concepts for theme: ${theme}. Style: ${style}. Lang: ${lang}. Return JSON: [{ "setName": "...", "characters": [{ "name": "...", "description": "..." }] }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const expandCharacterPrompt = async (name: string, desc: string, style: string): Promise<string> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Expand this character description for high-quality image generation. Name: ${name}. Desc: ${desc}. Style: ${style}`,
    });
    return response.text || desc;
};

export const generateNewCreationSuggestions = async (refImageB64: string | null, context: string): Promise<any[]> => {
    const parts: any[] = [{ text: `Generate 4 creative image prompts based on this context: "${context}". Return JSON array of objects with 'vi' (Vietnamese description) and 'en' (English detailed prompt).` }];
    if (refImageB64) parts.unshift({ inlineData: { mimeType: 'image/png', data: refImageB64 } });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateCompositeImage = async (subjectB64: string, outfitB64: string | null, accessoryB64: string | null, prompt: string, background: string, aspectRatio: string, quality: string, preserveIdentity: boolean, negativePrompt: string): Promise<string> => {
    const parts: any[] = [{ inlineData: { mimeType: 'image/png', data: subjectB64 } }];
    let instruction = `Composite the subject. `;
    if (outfitB64) { parts.push({ inlineData: { mimeType: 'image/png', data: outfitB64 } }); instruction += `Wear the outfit from 2nd image. `; }
    if (accessoryB64) { parts.push({ inlineData: { mimeType: 'image/png', data: accessoryB64 } }); instruction += `Hold accessory from 3rd image. `; }
    instruction += `Context: ${background}. Action: ${prompt}. ${preserveIdentity ? 'Maintain face.' : ''} ${negativePrompt ? 'Avoid: ' + negativePrompt : ''}`;
    parts.push({ text: instruction });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio, imageSize: quality as any } }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Composite failed");
};

export const generateVideoStrategy = async (refImageB64: string | null, productName: string, usp: string, painPoint: string, cta: string, category: string, platform: string, style: string, voice: string, hasMusic: boolean, durationScenes: number, framework: string, hook: string, visualStyle: string, contextDetail: string, contextDesc: string, activeTab: string, bg: string, auxCharB64: string | null, lang: string, audience: string, tone: string, pace: string, musicMood: string): Promise<string> => {
    const parts: any[] = [];
    if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
    const promptText = `Create viral video script. Product: ${productName}. USP: ${usp}. Platform: ${platform}. Scenes: ${durationScenes}. Tone: ${tone}. Return JSON array of scenes.`;
    parts.push({ text: promptText });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return response.text || "[]";
};

export const generateMarketingStrategies = async (product: string, category: string, imageB64: string | null): Promise<any[]> => {
    const parts: any[] = [];
    if (imageB64) parts.push({ inlineData: { mimeType: 'image/png', data: imageB64 } });
    parts.push({ text: `Suggest 4 marketing strategies for "${product}". Return JSON array.` });

    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateAdvancedVeoVideo = async (params: { prompt: string, aspectRatio: string, resolution: string, image?: string, endImage?: string }): Promise<string> => {
    const { prompt, aspectRatio, resolution, image, endImage } = params;
    const config: any = { numberOfVideos: 1, resolution: resolution as any, aspectRatio: aspectRatio as any };
    if (endImage) config.lastFrame = { imageBytes: endImage, mimeType: 'image/png' };
    const requestPayload: any = { model: 'veo-3.1-fast-generate-preview', prompt, config };
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
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Strategy for ${platform} channel. Product: ${product}. Niche: ${niche}. Market: ${market}. Return JSON structure.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateDailyChannelTask = async (plan: any, done: string[]): Promise<any> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Daily task for channel plan: ${JSON.stringify(plan)}. Done: ${done.join(', ')}. Return JSON: { "taskTitle": "...", "description": "...", "videoConcept": { "title": "...", "hook": "..." } }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response);
};

export const generateSpecificChannelDetail = async (type: string, context: string): Promise<string> => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate ${type} based on: ${context}.`,
    });
    return response.text || "";
};
