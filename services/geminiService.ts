import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper Functions ---

async function getJson(response: any): Promise<any> {
    try {
        let text = response.text || "";
        // Clean markdown code blocks if present
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Enhance this image generation prompt to be more detailed, descriptive, and artistic. Keep the core meaning but add lighting, texture, and style keywords. \n\nOriginal: "${prompt}"\n\nEnhanced:`,
        });
        return response.text || prompt;
    } catch (e) {
        console.error(e);
        return prompt;
    }
};

export const validateImageSafety = async (base64Image: string): Promise<{ safe: boolean; reason?: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: "Analyze this image for safety. Check for NSFW, violence, hate symbols, or illegal content. Return strictly valid JSON: { \"safe\": boolean, \"reason\": string }" }
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

export const generateImage = async (
    prompt: string, 
    aspectRatio: string = '1:1', 
    quality: string = '2K', 
    refImageB64?: string, 
    negativePrompt?: string
): Promise<string> => {
    // Model selection based on task/quality
    const model = (quality === '4K' || quality === '8K' || refImageB64) 
        ? 'gemini-3-pro-image-preview' // Better for high quality & editing
        : 'gemini-2.5-flash-image'; // Faster

    const parts: any[] = [{ text: prompt }];
    
    // Add reference image for editing/variation
    if (refImageB64) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: refImageB64
            }
        });
    }

    // Include negative prompt in text if supported or via appended text
    if (negativePrompt) {
        parts[0].text += ` --no ${negativePrompt}`;
    }

    const config: any = {
        imageConfig: {
            aspectRatio: aspectRatio,
            // imageSize only for gemini-3-pro-image-preview
            imageSize: (model === 'gemini-3-pro-image-preview' && (quality === '4K' || quality === '8K')) ? '4K' : undefined
        }
    };

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: config
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("No image generated");
};

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
    // Editing typically requires prompting with the image
    return generateImage(prompt, '1:1', '4K', base64Image);
};

// --- Specific Module Services ---

// NewCreation
export const generateNewCreationSuggestions = async (refImageB64: string | null, context: string): Promise<any[]> => {
    const parts: any[] = [{ text: `Generate 4 creative image prompts based on this context: "${context}". Return JSON array of objects with 'vi' (Vietnamese description) and 'en' (English detailed prompt).` }];
    if (refImageB64) {
        parts.unshift({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
        parts[1].text = `Analyze this image and the context: "${context}". Generate 4 creative variations or editing ideas. Return JSON array of objects with 'vi' and 'en'.`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

// Studio
export const generateCompositeImage = async (
    subjectB64: string, 
    outfitB64: string | null, 
    accessoryB64: string | null, 
    prompt: string, 
    background: string,
    aspectRatio: string,
    quality: string,
    preserveIdentity: boolean,
    negativePrompt: string
): Promise<string> => {
    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: subjectB64 } }
    ];
    let instruction = `Composite the subject from the first image. `;
    
    if (outfitB64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: outfitB64 } });
        instruction += `Wear the outfit from the second image. `;
    }
    if (accessoryB64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: accessoryB64 } });
        instruction += `Hold/Wear the accessory from the third image. `;
    }

    instruction += `Context/Background: ${background}. Action/Pose: ${prompt}. `;
    if (preserveIdentity) instruction += `MAINTAIN STRICT FACE CONSISTENCY with the first image. `;
    if (negativePrompt) instruction += `Avoid: ${negativePrompt}. `;
    instruction += `High quality photorealistic composite.`;

    parts.push({ text: instruction });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', // Best for complex multimodal compositing
        contents: { parts },
        config: {
            imageConfig: { aspectRatio: aspectRatio, imageSize: quality === '4K' ? '4K' : undefined }
        }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Composite generation failed");
};

export const generateStudioSuggestions = async (subjectB64: string | null, outfitB64: string | null, accessoryB64: string | null, background: string): Promise<any[]> => {
    const parts: any[] = [{ text: `Based on the provided assets (if any) and background "${background}", suggest 4 photorealistic composition prompts. JSON array { "vi": string, "en": string }.` }];
    if (subjectB64) parts.unshift({ inlineData: { mimeType: 'image/png', data: subjectB64 } });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

// VeoIdeas & Video Strategy
export const generateVideoStrategy = async (
    refImageB64: string | null, productName: string, usp: string, painPoint: string, cta: string,
    category: string, platform: string, style: string, voice: string, hasMusic: boolean, durationScenes: number,
    framework: string, hook: string, visualStyle: string, contextDetail: string, contextDesc: string, 
    activeTab: string, bg: string, auxCharB64: string | null, lang: string, audience: string,
    tone: string, pace: string, musicMood: string
): Promise<string> => {
    const parts: any[] = [];
    if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
    if (auxCharB64) parts.push({ inlineData: { mimeType: 'image/png', data: auxCharB64 } });

    const promptText = `
        Create a viral video script strategy.
        Product: ${productName}. Category: ${category}. Platform: ${platform}.
        USP: ${usp}. Pain Point: ${painPoint}. CTA: ${cta}. Target Audience: ${audience}.
        Format: ${durationScenes} scenes. Framework: ${framework}. Hook Type: ${hook}. Visual Style: ${visualStyle}.
        Tone: ${tone}. Pace: ${pace}. Music: ${musicMood}.
        Voice: ${voice}. Dialogue Language: ${lang}.
        Context: ${activeTab} mode. ${contextDetail}. ${contextDesc}. Background: ${bg}.
        
        Return STRICT JSON array of objects:
        [{ 
            "sceneNumber": number,
            "visualPrompt": "Detailed English prompt for video generation model (Veo/Sora)",
            "dialogue": "Script in ${lang}",
            "duration": number (seconds),
            "transition": string,
            "character": string (optional name)
        }]
    `;
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return response.text || "[]";
};

export const generateVideoCaptions = async (product: string, usp: string, category: string, platform: string, tone: string, lang: string, scriptContent: string): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate social media captions for a video about ${product}. 
        USP: ${usp}. Platform: ${platform}. Script Context: ${scriptContent}.
        Return JSON: { "shortCaption": string, "longCaption": string, "hashtags": string[] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || { shortCaption: "", longCaption: "", hashtags: [] };
};

export const generateMarketingStrategies = async (product: string, category: string, imageB64: string | null): Promise<any[]> => {
    const parts: any[] = [];
    if (imageB64) parts.push({ inlineData: { mimeType: 'image/png', data: imageB64 } });
    parts.push({ text: `Analyze this product "${product}" (${category}). Suggest 4 distinct marketing angles/strategies. Return JSON array: [{ "strategyName": string, "explanation": string, "data": { "usp": string, "painPoint": string, "cta": string, "audience": string } }]` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

// Video Generation (Veo)
export const generateVeoSceneImage = async (
    visualPrompt: string, charB64: string | null, prodB64: string | null, 
    aspectRatio: string, context: string, index: number, prevImageB64: string | null, 
    quality: string, outfit?: string, charDesc?: string, bg?: string
): Promise<string> => {
    // Generating a keyframe image for Veo, effectively same as generateImage/Composite but optimized for continuity
    const parts: any[] = [];
    if (charB64) parts.push({ inlineData: { mimeType: 'image/png', data: charB64 } });
    if (prodB64) parts.push({ inlineData: { mimeType: 'image/png', data: prodB64 } });
    if (prevImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: prevImageB64 } });

    let finalPrompt = `Scene ${index + 1} of a video. ${visualPrompt}. `;
    if (prevImageB64) finalPrompt += `Maintain consistent style, lighting, and character appearance from the previous scene (image 3). `;
    if (charB64) finalPrompt += `Use character reference (image 1). `;
    if (outfit) finalPrompt += `Outfit: ${outfit}. `;
    if (bg) finalPrompt += `Background: ${bg}. `;
    
    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
        model: quality === '4K' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio } }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Scene image generation failed");
};

export const regenerateScenePrompt = async (originalPrompt: string, context: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Rewrite this video scene prompt to be more descriptive and visual. Context: ${context}. Original: "${originalPrompt}"`
    });
    return response.text || originalPrompt;
};

export const generateAdvancedVeoVideo = async (params: { prompt: string, aspectRatio: string, resolution: string, image?: string, endImage?: string }): Promise<string> => {
    // This uses the actual Veo video generation model
    const { prompt, aspectRatio, resolution, image, endImage } = params;
    
    const config: any = {
        numberOfVideos: 1,
        resolution: resolution as '720p' | '1080p',
        aspectRatio: aspectRatio,
    };

    if (endImage) {
        config.lastFrame = {
            imageBytes: endImage,
            mimeType: 'image/png'
        };
    }

    const requestPayload: any = {
        model: 'veo-3.1-fast-generate-preview', // Or 'veo-3.1-generate-preview' for high quality
        prompt: prompt,
        config: config
    };

    if (image) {
        requestPayload.image = {
            imageBytes: image,
            mimeType: 'image/png'
        };
    }

    let operation = await ai.models.generateVideos(requestPayload);

    // Polling
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed to return URI");

    // Fetch video blob
    const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
};

// Thumbnails & Posters
export const generateThumbnail = async (sourceB64: string, layout: string, aspectRatio: string, quality: string, lang: string, context: string): Promise<string> => {
    return generateImage(
        `YouTube Thumbnail. Layout: ${layout}. Language: ${lang}. Context: ${context}`, 
        aspectRatio, 
        quality, 
        sourceB64
    );
};

export const generateThumbnailSuggestions = async (sourceB64: string | null, platform: string, category: string, style: string, title: string, context: string): Promise<any[]> => {
    const parts: any[] = [];
    if (sourceB64) parts.push({ inlineData: { mimeType: 'image/png', data: sourceB64 } });
    parts.push({ text: `Suggest 4 viral thumbnail concepts. Platform: ${platform}. Category: ${category}. Style: ${style}. Title: ${title}. Context: ${context}. Return JSON array: [{ "vi": string (Main Text), "en": string (Visual description), "data": { "sub": string (Subtitle) } }]` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generatePoster = async (modelB64: string | null, productB64: string | null, logoB64: string | null, headline: string, prompt: string, style: string, quality: string, negativePrompt: string): Promise<string> => {
    // Combine assets into prompt instructions or use multimodal input if appropriate model supports multi-image
    // For simplicity and robustness with gemini-3-pro-image-preview:
    const parts: any[] = [];
    if (modelB64) parts.push({ inlineData: { mimeType: 'image/png', data: modelB64 } });
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });
    if (logoB64) parts.push({ inlineData: { mimeType: 'image/png', data: logoB64 } });
    
    let textPrompt = `Advertising Poster. Headline: "${headline}". Style: ${style}. ${prompt}. `;
    if (negativePrompt) textPrompt += `Avoid: ${negativePrompt}.`;
    
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio: '3:4', imageSize: quality === '4K' ? '4K' : undefined } }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Poster generation failed");
};

export const generatePosterSuggestions = async (modelB64: string | null, productB64: string | null, logoB64: string | null, context: string): Promise<any[]> => {
    const parts: any[] = [];
    if (productB64) parts.push({ inlineData: { mimeType: 'image/png', data: productB64 } });
    parts.push({ text: `Suggest 4 poster ad concepts based on context: "${context}". Return JSON array: [{ "vi": string (Headline), "en": string (Visual Prompt), "data": { "headline": string, "purpose": string } }]` });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

// Character Creator
export const generateCharacterNames = async (count: number, lang: string, gender: string, style: string): Promise<string[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} unique character names. Language/Nationality: ${lang}. Gender: ${gender}. Style: ${style}. Return JSON array of strings.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateCharacterConcepts = async (count: number, theme: string, style: string, lang: string): Promise<any[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} character concepts for a "${theme}" story. Style: ${style}. Language context: ${lang}. Return JSON array: [{ "setName": string (Group Name), "characters": [{ "name": string, "description": string }] }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const expandCharacterPrompt = async (name: string, desc: string, style: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Expand this character description into a detailed visual prompt for image generation. Character: ${name}. Description: ${desc}. Style: ${style}.`
    });
    return response.text || desc;
};

// Story Creator
export const generateDiverseStoryIdeas = async (charData: any[], mood: string, context: string, market: string): Promise<any[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 4 diverse story ideas. Characters: ${JSON.stringify(charData)}. Mood: ${mood}. Context: ${context}. Market: ${market}. Return JSON array: [{ "title": string, "premise": string, "mood": string }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryStructure = async (characters: string[], premise: string, episodes: number, market: string): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a story structure. Characters: ${characters.join(', ')}. Premise: ${premise}. Episodes: ${episodes}. Market: ${market}. 
        Return JSON: { "title": string, "summary": string, "episodes": [{ "episodeNumber": number, "title": string, "summary": string }] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const suggestCharacterVoices = async (charData: any[], availableVoices: string[], market: string): Promise<Record<string, string>> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Assign voices to characters. Characters: ${JSON.stringify(charData)}. Available Voices: ${JSON.stringify(availableVoices)}. Market: ${market}. Return JSON object mapping character name to voice name.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateStoryScenes = async (
    summary: string, totalSeconds: number, context: string, charData: any[], voiceMap: any, 
    textMode: string, prevScenes: any[], lang: string, sceneCount: number, 
    epIndex: number, totalEps: number, prevSum: string, nextSum: string
): Promise<any[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a video script/storyboard. 
        Episode Summary: ${summary}. Total Duration: ${totalSeconds}s. Context: ${context}.
        Characters: ${JSON.stringify(charData)}. Voice Map: ${JSON.stringify(voiceMap)}.
        Language: ${lang}. Scenes: ${sceneCount}.
        Previous Ep Summary: ${prevSum}. Next Ep Summary: ${nextSum}.
        Return JSON array: [{ "sceneNumber": number, "visualPrompt": "Detailed English visual prompt", "dialogue": "Dialogue in ${lang}", "character": "Speaker Name" }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateYouTubeSEO = async (title: string, summary: string, lang: string, market: string): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate YouTube SEO metadata. Title: ${title}. Summary: ${summary}. Language: ${lang}. Market: ${market}.
        Return JSON: { "optimizedTitle": string, "hashtags": string[], "description": string, "postingStrategy": string }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateStoryThumbnail = async (
    storyTitle: string, epNum: number, epTitle: string, epSummary: string, 
    layout: string, lang: string, aspectRatio: string, hook: string, style: string, refImageB64?: string
): Promise<string> => {
    const parts: any[] = [];
    if (refImageB64) parts.push({ inlineData: { mimeType: 'image/png', data: refImageB64 } });
    
    parts.push({ text: `Create a YouTube Thumbnail. Story: ${storyTitle}. Ep ${epNum}: ${epTitle}. Summary: ${epSummary}. Layout: ${layout}. Language: ${lang}. Hook Text: ${hook}. Style: ${style}. High CTR, Viral.` });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio } }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Story thumbnail generation failed");
};

// Channel Builder
export const generateChannelStrategy = async (product: string, platform: string, niche: string, goal: string, market: string, type: string): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a channel strategy. Product: ${product}. Platform: ${platform}. Niche: ${niche}. Goal: ${goal}. Market: ${market}. Type: ${type}.
        Return JSON: { "channelIdentity": { "name": string, "bio": string, "keywords": string[] }, "postingSchedule": { "shorts": { "bestTimes": string[] }, "longVideo": { "bestTimes": string[] } }, "contentStrategy": { "pillars": [{ "name": string, "ratio": string, "ideas": string[] }] } }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateDailyChannelTask = async (plan: any, doneTasks: string[]): Promise<any> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a daily task for a content creator. Plan: ${JSON.stringify(plan)}. Done Tasks: ${JSON.stringify(doneTasks)}.
        Return JSON: { "taskTitle": string, "description": string, "videoConcept": { "title": string, "hook": string } }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || null;
};

export const generateSpecificChannelDetail = async (type: 'bio' | 'keywords' | 'description' | 'channel_names' | 'warming_plan', context: string): Promise<string> => {
    let prompt = "";
    if (type === 'bio') {
        prompt = `Write a catchy, SEO-optimized Channel Bio (under 150 chars) for this context: ${context}. Language: Vietnamese.`;
    } else if (type === 'keywords') {
        prompt = `Generate 20 high-traffic YouTube/TikTok Channel Keywords (comma separated) for: ${context}. Mix of broad and niche tags.`;
    } else if (type === 'description') {
        prompt = `Write a professional "About" section description for a YouTube channel. Structure: Hook -> Value Proposition -> Schedule -> CTA. Context: ${context}. Language: Vietnamese.`;
    } else if (type === 'channel_names') {
        prompt = `Generate 5 high-quality, SEO-optimized YouTube Channel Names and corresponding unique Handles (@handle) for the following context: ${context}. Output Format: Plain Text List. Language: Vietnamese explanation.`;
    } else if (type === 'warming_plan') {
        prompt = `Create a detailed "Gmail Warming & Interaction Plan" to build high trust (Trust Score) for a new Google Account. Context: ${context}. Format: Clear Markdown.`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
};
