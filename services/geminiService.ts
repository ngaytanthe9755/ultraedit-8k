
import { GoogleGenAI } from "@google/genai";

// Initialize dynamically to ensure we get the latest API_KEY from the environment/dialog selection
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to extract JSON from response text safely
async function getJson(response: any) {
    try {
        let text = response.text;
        if (!text) return null;
        
        // 1. Clean Markdown code blocks (Common cause of JSON parse errors)
        text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        // 2. Try parsing
        try {
            return JSON.parse(text);
        } catch (e) {
            // 3. If failed, try finding JSON pattern within text
            const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw e;
        }
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return null;
    }
}

// Helper to extract Image Data safely
const getImageData = (response: any) => {
    if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned. Possible API error or Safety Block.");
    }
    const candidate = response.candidates[0];
    
    // Check for safety block
    if (candidate.finishReason === 'SAFETY') {
        throw new Error("Generation blocked by Safety Filters. Please try a different prompt.");
    }

    if (!candidate.content || !candidate.content.parts) {
         throw new Error("No content parts in response.");
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("No image data found in response.");
}

// --- CORE GENERATION SERVICES ---

export const validateImageSafety = async (base64Image: string): Promise<{ safe: boolean; reason?: string }> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: "Is this image safe to display? Answer strictly with JSON: { \"safe\": boolean, \"reason\": string }" }
                ]
            },
            config: { responseMimeType: 'application/json' }
        });
        return await getJson(response) || { safe: true };
    } catch (e) {
        return { safe: true };
    }
};

export const enhancePrompt = async (prompt: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Enhance this image generation prompt to be more detailed, artistic, and high quality: "${prompt}". Return only the enhanced prompt text.`,
        });
        return response.text || prompt;
    } catch (e) {
        return prompt;
    }
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1", quality: string = "2K", refImage?: string, negativePrompt?: string): Promise<string> => {
    const ai = getAiClient();
    
    // Config construction
    const buildConfig = (model: string) => {
        const conf: any = { imageConfig: { aspectRatio: aspectRatio } };
        if (model === 'gemini-3-pro-image-preview') {
            conf.imageConfig.imageSize = quality === '4K' ? '4K' : '2K';
        }
        return conf;
    };

    const parts: any[] = [{ text: prompt }];
    if (refImage) {
        parts.push({ inlineData: { mimeType: 'image/png', data: refImage } });
    }
    if (negativePrompt) {
        parts[0].text += ` (Negative prompt: ${negativePrompt})`;
    }

    // ATTEMPT 1: Try High Quality if requested (Pro Model)
    if (quality === '4K' || quality === '8K') {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts },
                config: buildConfig('gemini-3-pro-image-preview')
            });
            return getImageData(response);
        } catch (e) {
            console.warn("Pro model failed (likely billing/quota), falling back to Flash Image...", e);
            // Fall through to standard model
        }
    }

    // ATTEMPT 2: Standard/Fallback (Flash Model)
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: buildConfig('gemini-2.5-flash-image')
    });

    return getImageData(response);
};

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/png', data: base64Image } },
                { text: prompt }
            ]
        }
    });
    return getImageData(response);
};

// --- CREATION MODULES ---

export const generateNewCreationSuggestions = async (refImage: string | null, context: string): Promise<any[]> => {
    const ai = getAiClient();
    const prompt = `Generate 4 creative image prompts based on this context: "${context}". Return JSON array of objects with keys: "vi" (Vietnamese title), "en" (English prompt).`;
    const parts: any[] = [{ text: prompt }];
    if (refImage) parts.push({ inlineData: { mimeType: 'image/png', data: refImage } });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateCompositeImage = async (subject: string, outfit: string | null, accessory: string | null, prompt: string, bg: string, ratio: string, quality: string, preserveIdentity: boolean, negative?: string): Promise<string> => {
    const ai = getAiClient();
    const parts: any[] = [];
    
    // Only push inlineData if subject string is not empty
    if (subject) {
        parts.push({ inlineData: { mimeType: 'image/png', data: subject } });
    }
    if (outfit) parts.push({ inlineData: { mimeType: 'image/png', data: outfit } });
    if (accessory) parts.push({ inlineData: { mimeType: 'image/png', data: accessory } });
    
    let text = `Generate an image. ${subject ? "Subject is the first image." : ""} ${prompt}. Background: ${bg}.`;
    if (preserveIdentity && subject) text += " Preserve the subject's facial features and body shape.";
    if (negative) text += ` Negative prompt: ${negative}`;
    
    parts.push({ text });

    // Config construction
    const buildConfig = (model: string) => {
        const conf: any = { imageConfig: { aspectRatio: ratio } };
        if (model === 'gemini-3-pro-image-preview') {
            conf.imageConfig.imageSize = quality === '4K' ? '4K' : '2K';
        }
        return conf;
    };

    // ATTEMPT 1: Pro Model
    if (quality === '4K' || quality === '8K') {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts },
                config: buildConfig('gemini-3-pro-image-preview')
            });
            return getImageData(response);
        } catch (e) {
            console.warn("Pro model failed, fallback to Flash...");
        }
    }

    // ATTEMPT 2: Flash Model
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: buildConfig('gemini-2.5-flash-image')
    });

    return getImageData(response);
};

export const generateStudioSuggestions = async (subject: string | null, outfit: string | null, accessory: string | null, bg: string): Promise<any[]> => {
    const ai = getAiClient();
    const parts: any[] = [{ text: `Suggest 4 creative composition ideas for a photoshoot. Background: ${bg}. Return JSON array [{ "vi": "Title", "en": "Detailed Prompt" }]` }];
    if (subject) parts.push({ inlineData: { mimeType: 'image/png', data: subject } });
    if (outfit) parts.push({ inlineData: { mimeType: 'image/png', data: outfit } });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

// --- VIDEO & MARKETING ---

export const generateVideoStrategy = async (image: string | null, productName: string, usp: string, painPoint: string, cta: string, category: string, platform: string, context: string, voice: string, music: boolean, scenes: number, framework: string, hook: string, visualStyle: string, contextDetail: string, contextDesc: string, tab: string, bg: string, auxChar: string | null, lang: string, audience: string, tone: string, pace: string, musicMood: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Create a video script strategy for ${productName}.
    Platform: ${platform}. Category: ${category}.
    USP: ${usp}. Pain Point: ${painPoint}. CTA: ${cta}. Target Audience: ${audience}.
    Framework: ${framework}. Hook: ${hook}. Visual Style: ${visualStyle}.
    Tone: ${tone}. Pace: ${pace}. Music Mood: ${musicMood}.
    Scenes: ${scenes}.
    Language: ${lang}.
    
    Return a strictly valid JSON array of scenes: [{ "sceneNumber": number, "visualPrompt": "string", "dialogue": "string", "duration": number }]
    Do NOT wrap in markdown code blocks.`;

    const parts: any[] = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: 'image/png', data: image } });
    if (auxChar) parts.push({ inlineData: { mimeType: 'image/png', data: auxChar } });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    
    // Robust parsing using the helper
    const result = await getJson(response);
    return result ? JSON.stringify(result) : "[]";
};

export const generateVideoCaptions = async (product: string, usp: string, category: string, platform: string, context: string, tone: string, script: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate social media captions based on this script: ${script}. Product: ${product}. Platform: ${platform}.
        Return JSON: { "shortCaption": "string", "longCaption": "string", "hashtags": ["string"] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateMarketingStrategies = async (product: string, category: string, image: string | null): Promise<any[]> => {
    const ai = getAiClient();
    const parts: any[] = [{ text: `Suggest 4 marketing strategies for ${product} (${category}). Return JSON array [{ "strategyName": "string", "explanation": "string", "data": { "usp": "string", "painPoint": "string", "cta": "string", "audience": "string" } }]` }];
    if (image) parts.push({ inlineData: { mimeType: 'image/png', data: image } });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateVeoSceneImage = async (prompt: string, charImage: string | null, prodImage: string | null, aspectRatio: string, context: string, index: number, prevImage: string | null, quality: string, outfit?: string, charDesc?: string, bg?: string): Promise<string> => {
    // Priority for main reference: Identity (char/prod) > Previous Scene Image > Nothing
    const mainRef = charImage || prodImage || prevImage || "";
    
    // If using prevImage as base (continuity), we pass it as subject
    return generateCompositeImage(mainRef, outfit || null, null, prompt, bg || "", aspectRatio, quality, true);
};

export const regenerateScenePrompt = async (original: string, context: string): Promise<string> => {
    return enhancePrompt(original);
};

export const generateThumbnail = async (sourceImage: string, layout: string, aspectRatio: string, quality: string, lang: string, context: string): Promise<string> => {
    const ai = getAiClient();
    
    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: sourceImage } },
        { text: `Create a YouTube thumbnail. ${context}. Layout: ${layout}. Aspect Ratio: ${aspectRatio}. Text Language: ${lang}.` }
    ];
    
    const buildConfig = (model: string) => {
        const conf: any = { imageConfig: { aspectRatio: aspectRatio } };
        if (model === 'gemini-3-pro-image-preview') conf.imageConfig.imageSize = '2K'; 
        return conf;
    };

    // Attempt 1: Pro
    if (quality === '4K') {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts },
                config: buildConfig('gemini-3-pro-image-preview')
            });
            return getImageData(response);
        } catch (e) { console.warn("Thumbnail Pro failed, fallback..."); }
    }

    // Attempt 2: Flash
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: buildConfig('gemini-2.5-flash-image')
    });
    return getImageData(response);
};

export const generateThumbnailSuggestions = async (sourceImage: string | null, platform: string, category: string, style: string, text: string, context: string): Promise<any[]> => {
    const ai = getAiClient();
    const parts: any[] = [{ text: `Suggest 4 thumbnail concepts. Platform: ${platform}. Category: ${category}. Style: ${style}. Text: ${text}. Context: ${context}. Return JSON array [{ "vi": "Title Text", "en": "Visual Description", "data": { "sub": "Subtitle Text" } }]` }];
    if (sourceImage) parts.push({ inlineData: { mimeType: 'image/png', data: sourceImage } });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const analyzeVideoScript = async (scriptJson: string, product: string, usp: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Audit this video script for retention and conversion. Product: ${product}. USP: ${usp}. Script: ${scriptJson}.
        Return JSON: { "score": number (0-100), "strengths": ["string"], "weaknesses": ["string"] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || { score: 0, strengths: [], weaknesses: [] };
};

export const generateHookVariations = async (product: string, usp: string, pain: string, type: string): Promise<any[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 3 viral hooks for ${product}. USP: ${usp}. Pain: ${pain}. Hook Type: ${type}.
        Return JSON array [{ "type": "string", "visualPrompt": "string", "dialogue": "string" }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generatePoster = async (model: string | null, product: string | null, logo: string | null, headline: string, prompt: string, style: string, quality: string, negative?: string): Promise<string> => {
    const ai = getAiClient();
    const parts: any[] = [{ text: `Create a poster. Headline: ${headline}. Style: ${style}. ${prompt}.` }];
    if (model) parts.push({ inlineData: { mimeType: 'image/png', data: model } });
    if (product) parts.push({ inlineData: { mimeType: 'image/png', data: product } });
    if (logo) parts.push({ inlineData: { mimeType: 'image/png', data: logo } });
    
    // Config construction
    const buildConfig = (mod: string) => {
        const conf: any = { imageConfig: { aspectRatio: '3:4' } };
        if (mod === 'gemini-3-pro-image-preview') conf.imageConfig.imageSize = quality === '4K' ? '4K' : '2K';
        return conf;
    };

    // Attempt 1: Pro
    if (quality === '4K' || quality === '8K') {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts },
                config: buildConfig('gemini-3-pro-image-preview')
            });
            return getImageData(response);
        } catch (e) { console.warn("Poster Pro failed, fallback..."); }
    }

    // Attempt 2: Flash
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: buildConfig('gemini-2.5-flash-image')
    });
    return getImageData(response);
};

export const generatePosterSuggestions = async (model: string | null, product: string | null, logo: string | null, context: string): Promise<any[]> => {
    const ai = getAiClient();
    const parts: any[] = [{ text: `Suggest 4 poster concepts. Context: ${context}. Return JSON array [{ "vi": "Headline", "en": "Description", "data": { "headline": "string", "purpose": "string" } }]` }];
    if (model) parts.push({ inlineData: { mimeType: 'image/png', data: model } });
    if (product) parts.push({ inlineData: { mimeType: 'image/png', data: product } });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateAdvancedVeoVideo = async (params: { prompt: string, aspectRatio: string, resolution: string, image?: string, endImage?: string }): Promise<string> => {
    const ai = getAiClient();
    let config: any = {
        numberOfVideos: 1,
        resolution: params.resolution,
        aspectRatio: params.aspectRatio
    };
    
    try {
        // Prepare request
        const requestParams: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: params.prompt,
            config: config
        };

        if (params.image) {
            requestParams.image = { imageBytes: params.image, mimeType: 'image/png' };
        }
        
        let operation = await ai.models.generateVideos(requestParams);
        
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }
        
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("Video generation failed");
        
        const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error("Veo generation failed", e);
        throw e;
    }
};

export const generateCharacterNames = async (count: number, language: string, gender: string, style: string): Promise<string[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} character names. Language: ${language}. Gender: ${gender}. Style: ${style}. Return JSON array of strings.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateCharacterConcepts = async (count: number, theme: string, style: string, lang: string): Promise<any[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} character concepts for theme "${theme}". Style: ${style}. Language: ${lang}.
        Return JSON array: [{ "setName": "string", "characters": [{ "name": "string", "description": "string" }] }] (Generate 1 set with multiple characters)`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const expandCharacterPrompt = async (name: string, desc: string, style: string): Promise<string> => {
    return enhancePrompt(`${name}: ${desc}. Style: ${style}. Detailed character description.`);
};

export const generateStoryStructure = async (characters: string[], premise: string, episodes: number, market: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a story structure. Characters: ${characters.join(', ')}. Premise: ${premise}. Episodes: ${episodes}. Market: ${market}.
        Return strictly valid JSON: { "title": "string", "summary": "string", "episodes": [{ "episodeNumber": number, "title": "string", "summary": "string" }] }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateStoryScenes = async (summary: string, duration: number, context: string, charData: any[], voiceMap: any, textMode: string, prevScenes: any[], lang: string, sceneCount: number, epIdx: number, totalEp: number, prevSum: string, nextSum: string): Promise<any[]> => {
    const ai = getAiClient();
    
    // Enhanced Prompt Engineering for strict adherence
    const prompt = `
    ROLE: Expert Film Director and Screenwriter.
    TASK: Break down a story summary into a precise list of video scenes for AI Video Generation (Veo/Sora).
    
    INPUT DATA:
    - Summary: "${summary}"
    - Total Duration Target: ${duration} seconds.
    - Required Scene Count: Exactly ${sceneCount} scenes.
    - Language: ${lang}
    - Characters: ${JSON.stringify(charData)}
    - Voice Cast: ${JSON.stringify(voiceMap)}
    
    PRODUCTION MANIFEST (STRICT CONSTRAINTS):
    ${context}
    
    INSTRUCTIONS:
    1. TIMING: You MUST generate exactly ${sceneCount} scenes. Each scene represents roughly ${Math.round(duration/sceneCount)} seconds.
    2. VISUAL PROMPT: This is the most important field. It must be a detailed English description for an AI Image Generator. 
       - It MUST explicitly include the "Camera Angle", "Lighting", and "Visual Style" defined in the Production Manifest.
       - Describe the action, environment, and character appearance in every single scene.
    3. DIALOGUE: Write natural dialogue or voiceover in ${lang}.
    4. CONSISTENCY: Ensure characters and locations remain consistent with the Manifest.
    
    OUTPUT FORMAT:
    Return a STRICTLY VALID JSON ARRAY (no markdown, no code blocks):
    [
      {
        "sceneNumber": 1,
        "visualPrompt": "Detailed English visual description including camera angle, lighting, style...",
        "dialogue": "Spoken text in ${lang}",
        "character": "Name of speaker or 'Narrator'",
        "locationTag": "SHORT_TAG_FOR_LOCATION (e.g. BEDROOM_DAY)"
      },
      ...
    ]
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateYouTubeSEO = async (title: string, summary: string, lang: string, market: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate YouTube SEO for video "${title}". Summary: ${summary}. Lang: ${lang}. Market: ${market}.
        Return strictly valid JSON: { "optimizedTitle": "string", "hashtags": ["string"], "description": "string", "postingStrategy": "string" }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const suggestCharacterVoices = async (chars: any[], voices: string[], market: string): Promise<Record<string, string>> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Suggest voices for characters based on available list.
        Characters: ${JSON.stringify(chars)}.
        Available Voices: ${JSON.stringify(voices)}.
        Market: ${market}.
        Return JSON object { "CharacterName": "VoiceName" }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateDiverseStoryIdeas = async (chars: any[], mood: string, context: string, market: string): Promise<any[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 4 story ideas. Characters: ${JSON.stringify(chars)}. Mood: ${mood}. Context: ${context}. Market: ${market}.
        Return JSON array [{ "title": "string", "premise": "string", "mood": "string" }]`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateStoryThumbnail = async (storyTitle: string, epNum: number, epTitle: string, summary: string, layout: string, lang: string, ratio: string, hook: string, style: string, refImage?: string): Promise<string> => {
    const context = `Story: ${storyTitle}. Ep ${epNum}: ${epTitle}. Summary: ${summary}. Hook: ${hook}. Style: ${style}.`;
    return generateThumbnail(refImage || "", layout, ratio, "4K", lang, context);
};

// --- CHANNEL BUILDER SERVICES ---

export const generateChannelStrategy = async (product: string, platform: string, niche: string, goal: string, market: string, type: string): Promise<any> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a comprehensive "Zero to Hero" channel strategy.
        Product/Topic: ${product}. Platform: ${platform}. Niche: ${niche}. Goal: ${goal}. Market: ${market}. Channel Type: ${type}.
        
        Return valid JSON: { 
            "channelIdentity": { "name": string, "bio": string, "keywords": string[], "handle": string }, 
            "postingSchedule": { "shorts": { "bestTimes": string[], "frequency": string }, "longVideo": { "bestTimes": string[], "frequency": string } }, 
            "contentStrategy": { "pillars": [{ "name": string, "ratio": string, "ideas": string[] }] },
            "monetizationPlan": { "shortTerm": string, "longTerm": string }
        }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || {};
};

export const generateDailyChannelTask = async (plan: any, doneTasks: string[], phase: number): Promise<any> => {
    const ai = getAiClient();
    let phaseFocus = "";
    if (phase === 1) phaseFocus = "FOUNDATION & SETUP. Focus on channel SEO, branding, banner, and account security. DO NOT suggest making viral videos yet.";
    else if (phase === 2) phaseFocus = "WARM-UP & TRUST. Focus on community interaction (seeding), watching competitor videos to train algorithm, and creating first 3 introductory videos.";
    else if (phase === 3) phaseFocus = "TRACTION & GROWTH. Focus on high-retention Shorts, consistent posting, and analyzing CTR.";
    else phaseFocus = "MONETIZATION & SCALE. Focus on affiliate links, booking jobs, or increasing RPM.";

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Act as a YouTube Channel Manager. Generate ONE specific, actionable Daily Task for a creator.
        
        Channel Context:
        - Topic: ${plan.product}
        - Market: ${plan.targetMarket}
        - Current Phase: ${phase} (${phaseFocus})
        - Completed Tasks: ${JSON.stringify(doneTasks)}
        
        The task must be concrete. If it involves content creation, provide a specific video concept.
        
        Return strictly valid JSON: { 
            "taskTitle": string (Actionable title, e.g. "Create Avatar", "Reply to 10 comments"), 
            "description": string (Why & How), 
            "videoConcept": { "title": string, "hook": string, "visualStyle": string } (Optional: Only if task involves making a video, else null) 
        }`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || null;
};

export const generateQuickScript = async (conceptTitle: string, hook: string, product: string, market: string): Promise<any[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a short, viral video script (Vertical Short/Reel format, approx 15-30s).
        Topic: ${conceptTitle}. Hook: ${hook}. Product: ${product}. Market: ${market}.
        
        Structure: 
        1. Hook (0-3s): Grab attention.
        2. Value/Body (3-15s): Deliver the main point or twist.
        3. CTA (15s+): Call to action.
        
        Return strictly valid JSON Array: [{ "sceneNumber": number, "visualPrompt": "Detailed visual description for AI Video Generator", "dialogue": "Script line" }]
        Do NOT use markdown code blocks.`,
        config: { responseMimeType: 'application/json' }
    });
    return await getJson(response) || [];
};

export const generateSpecificChannelDetail = async (type: 'bio' | 'keywords' | 'description' | 'channel_names' | 'warming_plan', context: string): Promise<string> => {
    const ai = getAiClient();
    let prompt = "";
    if (type === 'bio') {
        prompt = `Write a catchy, SEO-optimized Channel Bio (under 150 chars) for this context: ${context}. Language: Vietnamese/English mixed if appropriate for market.`;
    } else if (type === 'keywords') {
        prompt = `Generate 30 high-traffic YouTube/TikTok Channel Keywords (comma separated) for: ${context}. Mix of broad and niche tags. Optimized for SEO.`;
    } else if (type === 'description') {
        prompt = `Write a professional "About" section description for a YouTube channel. Structure: Hook -> Value Proposition -> Schedule -> CTA. Context: ${context}. Language: Target Market Language.`;
    } else if (type === 'channel_names') {
        prompt = `Generate 10 high-quality, SEO-optimized YouTube Channel Names and corresponding unique Handles (@handle) for the following context: ${context}. Output Format: Plain Text List.`;
    } else if (type === 'warming_plan') {
        prompt = `Create a detailed "Gmail Warming & Interaction Plan" to build high trust (Trust Score) for a new Google Account. Context: ${context}. Format: Clear Markdown checklist.`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
};
