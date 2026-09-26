import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

const DOCUMENT_TYPES = ['CNIC', 'CONTRACT', 'CERTIFICATE', 'RESUME', 'OTHER'];

export default function EmployeeDocumentsPanel({ employee, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/documents/employee/${employee._id}`);
      const payload = response.data?.data || [];
      setDocuments(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employee documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [employee._id]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a document file before uploading.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const uploadResponse = await apiClient.post('/documents/upload-url', {
        employeeId: employee._id,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        documentType,
      });
      const upload = uploadResponse.data?.data;
      if (!upload?.uploadUrl || !upload?.s3Key) throw new Error('Upload URL was not returned.');

      const putResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putResponse.ok) throw new Error('File upload failed before verification.');

      await apiClient.post('/documents', {
        employeeId: employee._id,
        documentType,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        s3Key: upload.s3Key,
        expiryDate: expiryDate || null,
      });

      setFile(null);
      setExpiryDate('');
      event.target.reset();
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document) => {
    try {
      setError('');
      const response = await apiClient.get(`/documents/${document._id}/download-url`);
      const url = response.data?.data?.downloadUrl;
      if (!url) throw new Error('Download URL was not returned.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to prepare document download.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#E3DED4] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#728294]">Employee Documents</span>
            <h2 className="text-base font-bold text-[#16233B]">{employee.firstName} {employee.lastName}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-xl text-[#728294] hover:text-[#16233B]">&times;</button>
        </div>

        <div className="space-y-5 p-5">
          {error && <div className="rounded border border-[#F5C2BA] bg-[#FDEEEB] p-3 text-xs text-[#B83E28]">{error}</div>}

          <form onSubmit={handleUpload} className="grid grid-cols-1 gap-3 rounded-lg border border-[#E3DED4] bg-[#FAF8F5] p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-1 block text-[10px] font-mono font-bold uppercase text-[#728294]">Document Type</label>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full rounded border border-[#D5CEC2] bg-white px-2 py-2 text-xs">
                {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono font-bold uppercase text-[#728294]">File</label>
              <input required type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} className="w-full rounded border border-[#D5CEC2] bg-white px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono font-bold uppercase text-[#728294]">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="w-full rounded border border-[#D5CEC2] bg-white px-2 py-2 text-xs" />
            </div>
            <button type="submit" disabled={uploading} className="rounded bg-[#8C5D17] px-4 py-2 text-xs font-mono font-bold text-white disabled:opacity-50">
              {uploading ? 'VERIFYING...' : 'UPLOAD'}
            </button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-[#E3DED4]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[10px] font-mono uppercase text-[#728294]"><tr><th className="px-3 py-2">File</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {loading ? <tr><td colSpan="5" className="p-6 text-center text-[#728294]">Loading documents...</td></tr> : documents.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-[#728294]">No documents uploaded.</td></tr> : documents.map((document) => (
                  <tr key={document._id}>
                    <td className="px-3 py-3 font-medium text-[#16233B]">{document.fileName}</td>
                    <td className="px-3 py-3 text-[#5B6B79]">{document.documentType}</td>
                    <td className="px-3 py-3"><span className={document.status === 'AVAILABLE' ? 'text-[#1E7E34]' : 'text-[#B83E28'}>{document.status}</span></td>
                    <td className="px-3 py-3 text-[#5B6B79]">{document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : 'None'}</td>
                    <td className="px-3 py-3 text-right"><button type="button" disabled={document.status !== 'AVAILABLE'} onClick={() => handleDownload(document)} className="text-[10px] font-mono font-bold text-[#8C5D17] disabled:text-[#A9A9A9]">DOWNLOAD</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}