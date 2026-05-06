import {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "./s3-client";

/**
 * Uploads a file to the S3 bucket.
 * @returns Object containing the key and public URL
 */
export async function uploadFile(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string
): Promise<{ key: string; url: string }> {
    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: body,
                ContentType: contentType,
            })
        );

        return {
            key,
            url: getPublicUrl(key),
        };
    } catch (error) {
        console.error(`S3 Upload Error [${key}]:`, error);
        throw new Error("Failed to upload file to storage.");
    }
}

/**
 * Generates a presigned URL for temporary access to a private file.
 * @param key - File path in the bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getPresignedUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error(`S3 Presign Error [${key}]:`, error);
        throw new Error("Failed to generate access URL.");
    }
}

/**
 * Deletes a file from the S3 bucket.
 * Silent if the file does not exist.
 */
export async function deleteFile(key: string): Promise<void> {
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            })
        );
    } catch (error) {
        if (error instanceof S3ServiceException && error.name === "NoSuchKey") {
            return; // Ignore if not found
        }
        console.error(`S3 Delete Error [${key}]:`, error);
        throw new Error("Failed to delete file from storage.");
    }
}

/**
 * Constructs a public URL for a file.
 * Assumes the bucket/object has public read permissions if used directly.
 */
export function getPublicUrl(key: string): string {
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
    return `${endpoint}/${BUCKET_NAME}/${key}`;
}
