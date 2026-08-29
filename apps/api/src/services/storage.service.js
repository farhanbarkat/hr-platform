import fs from 'fs';
import path from 'path';

/**
 * Uploads a file buffer to S3 or local disk fallback
 * 
 * @param {Buffer} buffer - File buffer
 * @param {String} key - Path / Key (e.g. `tax-certificates/company-123/cert-2026.pdf`)
 * @param {String} contentType - MIME Type
 * @returns {Promise<{ s3Key: String, s3Url: String }>}
 */
export const uploadCertificateFile = async (buffer, key, contentType = 'application/pdf') => {
  const hasS3Config =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME;

  if (hasS3Config) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
      return { s3Key: key, s3Url };
    } catch (s3Error) {
      console.warn('⚠️ S3 Upload failed, falling back to local file storage:', s3Error.message);
      // Graceful fallback to local storage below
    }
  }

  // Local storage in public/uploads
  const publicDir = path.resolve(process.cwd(), 'public/uploads', path.dirname(key));
  fs.mkdirSync(publicDir, { recursive: true });

  const localFilePath = path.resolve(process.cwd(), 'public/uploads', key);
  fs.writeFileSync(localFilePath, buffer);

  const localUrl = `/uploads/${key.replace(/\\/g, '/')}`;
  return { s3Key: key, s3Url: localUrl };
};