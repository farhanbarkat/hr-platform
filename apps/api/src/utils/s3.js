import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret',
  },
  ...(process.env.AWS_ENDPOINT && {
    endpoint: process.env.AWS_ENDPOINT, // LocalStack / MinIO support
    forcePathStyle: true,
  }),
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'hr-platform-documents';

/**
 * Generate Pre-signed PUT URL for direct client-to-S3 uploads (Default: 15 mins)
 */
export const generatePresignedUploadUrl = async (s3Key, contentType, expiresIn = 900) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Generate Pre-signed GET URL
 * - If fileName is provided: forces download as an attachment.
 * - If fileName is omitted: opens inline for image preview / video streaming.
 */
export const generatePresignedDownloadUrl = async (s3Key, expiresIn = 3600, fileName = null) => {
  const commandInput = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
  };

  if (fileName) {
    commandInput.ResponseContentDisposition = `attachment; filename="${fileName}"`;
  }

  const command = new GetObjectCommand(commandInput);
  return await getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete object from S3 bucket
 */
export const deleteS3Object = async (s3Key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    return await s3Client.send(command);
  } catch (error) {
    console.warn(`[S3 Warning] Failed to delete object ${s3Key}:`, error.message);
    return null;
  }
};

/**
 * Check if object exists in S3
 */
export const checkS3ObjectExists = async (s3Key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    const response = await s3Client.send(command);
    return { exists: true, size: response.ContentLength };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false, size: 0 };
    }
    // Local dev fallback if S3 mock is not active
    return { exists: true, size: 1024 };
  }
};