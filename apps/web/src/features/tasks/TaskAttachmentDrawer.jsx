import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function TaskAttachmentDrawer({ task, onClose }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch attachments for the current task
  const fetchAttachments = useCallback(async () => {
    if (!task?._id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/task-attachments/task/${task._id}`);
      setAttachments(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve attachments.');
    } finally {
      setLoading(false);
    }
  }, [task]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // 2. Upload file via Pre-signed S3 Flow
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      // Step A: Request S3 pre-signed upload URL from backend
      const presignedRes = await apiClient.post('/task-attachments/presigned-upload', {
        taskId: task._id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
      });

      const { uploadUrl, s3Key } = presignedRes.data?.data || {};

      // Step B: Direct S3 binary upload
      if (uploadUrl) {
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
      }

      // Step C: Persist document metadata in MongoDB
      await apiClient.post('/task-attachments', {
        taskId: task._id,
        s3Key,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
      });

      // Clear input and reload
      e.target.value = '';
      fetchAttachments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  // 3. Delete attachment
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this attachment?')) return;
    try {
      setError(null);
      await apiClient.delete(`/task-attachments/${id}`);
      fetchAttachments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attachment.');
    }
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end font-sans select-none">
      <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between border-l border-[#E3DED4] animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div>
          <div className="flex justify-between items-start pb-4 border-b border-[#E3DED4]">
            <div>
              <span className="text-[9.5px] font-mono text-[#728294] uppercase font-bold tracking-wider">
                DOCUMENT ARTIFACTS // TASK ENCLAVE
              </span>
              <h3 className="text-base font-bold text-[#16233B] mt-0.5 truncate max-w-[310px]">
                {task.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-[#728294] hover:text-[#16233B] text-2xl font-mono leading-none cursor-pointer p-1"
            >
              &times;
            </button>
          </div>

          {error && (
            <div className="p-2.5 mt-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-xs font-mono">
              ⚠️ {error}
            </div>
          )}

          {/* Upload Button Area */}
          <div className="mt-4 p-4 border border-dashed border-[#D8D3C7] rounded-lg bg-[#FAF8F5] text-center hover:bg-[#FAF4E8] transition-colors">
            <input
              type="file"
              id="drawer-task-file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label
              htmlFor="drawer-task-file"
              className="text-xs font-mono text-[#8C5D17] hover:underline cursor-pointer block font-bold"
            >
              {uploading ? '⏳ UPLOADING FILE TO CLOUD...' : '+ ATTACH NEW DOCUMENT / IMAGE'}
            </label>
            <span className="text-[10.5px] text-[#728294] block mt-1">
              Supports PDFs, Spreadsheets, Docs, and Images
            </span>
          </div>

          {/* Attachments List */}
          <div className="mt-4 space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs font-mono text-[#728294]">
                Retrieving task artifacts...
              </div>
            ) : attachments.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-[#728294] border border-dashed border-[#E3DED4] rounded">
                No files uploaded for this task yet.
              </div>
            ) : (
              attachments.map((att) => (
                <div
                  key={att._id}
                  className="p-3 bg-white border border-[#E3DED4] rounded-lg flex items-center justify-between text-xs font-mono shadow-2xs hover:border-[#8C5D17]/50 transition-all"
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#8C5D17]">
                        {att.fileType || 'FILE'}
                      </span>
                      <span className="font-bold text-[#16233B] truncate max-w-[190px] block">
                        {att.fileName}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#728294] mt-1">
                      {(att.fileSizeBytes ? att.fileSizeBytes / 1024 : 0).toFixed(1)} KB •{' '}
                      {att.uploadedBy?.name || 'Staff'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {att.viewUrl ? (
                      <a
                        href={att.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-[#FAF8F5] border border-[#D8D3C7] text-[#16233B] rounded text-[10.5px] font-bold hover:bg-[#FAF4E8] transition-colors"
                      >
                        ↓ Open
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#728294]">Processed</span>
                    )}

                    <button
                      onClick={() => handleDelete(att._id)}
                      title="Delete Attachment"
                      className="px-2 py-1 text-[#B83E28] hover:bg-[#FDEEEB] rounded text-xs cursor-pointer transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E3DED4]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#16233B] hover:bg-[#101A2B] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors"
          >
            Close Enclave
          </button>
        </div>

      </div>
    </div>
  );
}