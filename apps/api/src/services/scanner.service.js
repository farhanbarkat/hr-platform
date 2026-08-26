/**
 * Lightweight File Scanner Adapter (e.g. ClamAV / VirusTotal / S3 Object Tagging Mock)
 */
export const scanUploadedFile = async (s3Key, fileName) => {
  // Check for malicious file extensions or simulation triggers
  const maliciousKeywords = ['eicar', 'malware', 'virus', 'trojan', '.exe', '.sh', '.bat'];
  const isSuspicious = maliciousKeywords.some((keyword) =>
    fileName.toLowerCase().includes(keyword)
  );

  if (isSuspicious) {
    return {
      isClean: false,
      details: 'Malware signature detected. File moved to quarantine.',
      scannedAt: new Date(),
    };
  }

  return {
    isClean: true,
    details: 'Clean - passed heuristic and signature scan.',
    scannedAt: new Date(),
  };
};