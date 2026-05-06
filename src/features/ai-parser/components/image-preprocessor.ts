// ============================================
// Client-Side Image Preprocessor (Post-Supabase)
// Resizes and compresses images before upload
// ============================================

import { AI_CONFIG } from "@/shared/lib/constants";

/**
 * Preprocess an image file for AI parsing.
 * - Resizes to max 1600px dimension
 * - Compresses to JPEG quality 0.8
 * - Reduces file sizes from 2-5MB to ~200-500KB
 */
export async function preprocessImage(file: File): Promise<Blob> {
    const { IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY } = AI_CONFIG;

    const img = await createImageBitmap(file);
    const scale = Math.min(
        1,
        IMAGE_MAX_DIMENSION / Math.max(img.width, img.height)
    );

    const canvas = new OffscreenCanvas(
        Math.round(img.width * scale),
        Math.round(img.height * scale)
    );
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.convertToBlob({
        type: "image/jpeg",
        quality: IMAGE_JPEG_QUALITY,
    });
}

/**
 * Upload preprocessed files to the custom /api/upload endpoint.
 * Returns array of file paths in the storage bucket.
 */
export async function uploadFilesToStorage(
    files: File[],
    companyId: string
): Promise<string[]> {
    const formData = new FormData();

    for (const file of files) {
        const preprocessed = await preprocessImage(file);
        // Create a new File object from the preprocessed blob to preserve the name
        const preprocessedFile = new File([preprocessed], file.name, {
            type: "image/jpeg",
        });
        formData.append("files", preprocessedFile);
    }

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Upload failed");
        }

        return result.data.file_paths;
    } catch (error) {
        console.error("Upload error:", error);
        throw error;
    }
}
