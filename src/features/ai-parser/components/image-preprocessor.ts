// ============================================
// Client-Side Image Preprocessor
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
 * Upload preprocessed files to Supabase Storage
 * Returns array of file paths in the storage bucket
 */
export async function uploadFilesToStorage(
    files: File[],
    companyId: string,
    supabaseClient: ReturnType<typeof import("@/shared/lib/supabase/client").createSupabaseBrowserClient>
): Promise<string[]> {
    const filePaths: string[] = [];

    for (const file of files) {
        const preprocessed = await preprocessImage(file);
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${companyId}/${timestamp}_${safeName}`;

        const { error } = await supabaseClient.storage
            .from("uploads")
            .upload(path, preprocessed, {
                contentType: "image/jpeg",
                upsert: false,
            });

        if (error) {
            console.error(`Upload failed for ${file.name}:`, error.message);
            continue;
        }

        filePaths.push(path);
    }

    return filePaths;
}
