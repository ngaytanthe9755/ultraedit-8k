
/**
 * Applies a diagonal watermark to an image (Base64).
 * Text: 
 * "Gemini UltraEdit 8K"
 * "Premium Creative Suite"
 * "https://t.me/JacyGM_Official"
 */
export const applyWatermark = (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject("Canvas context not supported");
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Watermark Settings
            const fontSize = Math.max(24, Math.floor(img.width / 20)); // Responsive font size
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Rotate context 45 degrees (approx 0.785 radians)
            // Or roughly diagonal based on aspect ratio
            const angle = -Math.PI / 6; // -30 degrees looks good diagonally up

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);

            // CHANGED: Compliant Text
            const lines = [
                "Gemini UltraEdit 8K",
                "Premium Creative Suite",
                "https://t.me/JacyGM_Official"
            ];

            const lineHeight = fontSize * 1.5;
            const totalHeight = lines.length * lineHeight;
            let startY = -(totalHeight / 2) + (lineHeight / 2);

            lines.forEach((line) => {
                // Draw Shadow/Stroke for readability
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillText(line, 2, startY + 2);

                // Draw Main Text (White/Red semi-transparent)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillText(line, 0, startY);
                
                startY += lineHeight;
            });

            ctx.restore();

            // Export
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => reject(e);
        // Ensure prefix
        img.src = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
    });
};
