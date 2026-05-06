import { S3Client } from "@aws-sdk/client-s3";

const {
    S3_ENDPOINT,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME,
} = process.env;

// Startup Validation
if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET_NAME) {
    throw new Error(
        "Critical S3 environment variables are missing. " +
        "Please check S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME."
    );
}

/**
 * Global S3 Client instance for Railway / S3-compatible storage
 */
export const s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "us-east-1", // Default to us-east-1 if not provided
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for many S3-compatible providers like MinIO/Tigris
});

export const BUCKET_NAME = S3_BUCKET_NAME;
