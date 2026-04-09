"use client";

import { useState, useCallback, useEffect } from "react";

export type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  category?: string;
  uploadedBy?: string; // Owner of the file
  content?: string; // Only present when downloading
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleString("vi-VN");
};

const getFileIcon = (type: string, name: string): string => {
  if (type.includes("pdf") || name.endsWith(".pdf")) return "📄";
  if (type.includes("image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return "🖼️";
  if (type.includes("excel") || /\.(xls|xlsx|csv)$/i.test(name)) return "📊";
  if (type.includes("word") || /\.(doc|docx)$/i.test(name)) return "📝";
  if (type.includes("powerpoint") || /\.(ppt|pptx)$/i.test(name)) return "📽️";
  if (type.includes("zip") || /\.(zip|rar|7z)$/i.test(name)) return "📦";
  if (type.includes("text") || name.endsWith(".txt")) return "📃";
  return "📎";
};

export function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Tài liệu");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const categories = ["Tài liệu", "Báo cáo", "Hợp đồng", "Hóa đơn", "Khác"];

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/files", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải danh sách");
      const data = await res.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      setError("Không thể tải danh sách tệp tin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Tệp tin quá lớn (tối đa 5MB)");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", selectedCategory);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload thất bại");
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải lên");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // Reset
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const deleteFile = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa tệp tin này?")) return;

    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Xóa thất bại");
      await fetchFiles();
    } catch (err) {
      setError("Không thể xóa tệp tin");
    }
  };

  const downloadFile = async (file: FileItem) => {
    try {
      // Fetch full file with content
      const res = await fetch(`/api/files/${file.id}`);
      const data = await res.json();
      
      if (!data.file?.content) {
        setError("Không thể tải xuống tệp tin");
        return;
      }

      const byteCharacters = atob(data.file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.type });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: try to use stored content if available
      if (file.content) {
        const byteCharacters = atob(file.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: file.type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        setError("Tính năng tải xuống đang được cập nhật");
      }
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            � Kho lưu trữ bảo mật
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tệp tin được mã hóa AES-256-GCM, chỉ bạn và admin mới có thể truy cập
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-800">
            🔒 Mã hóa
          </span>
          <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded border border-blue-800">
            👤 Riêng tư
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragOver 
            ? "border-emerald-500 bg-emerald-900/20" 
            : "border-slate-700 hover:border-slate-600"
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-2xl">
            {uploading ? "⏳" : "☁️"}
          </div>
          <p className="text-slate-300 text-sm">
            {uploading ? "Đang tải lên..." : "Kéo thả hoặc click để chọn tệp tin"}
          </p>
          <p className="text-slate-500 text-xs">
            PDF, Excel, Word, Ảnh, v.v.
          </p>
        </label>
      </div>

      {/* Category Selection */}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`
              px-3 py-1.5 rounded-full text-xs transition-colors
              ${selectedCategory === cat
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* File List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-center text-slate-500 py-8">Đang tải...</p>
        ) : files.length === 0 ? (
          <p className="text-center text-slate-500 py-8">
            Chưa có tệp tin nào
          </p>
        ) : (
          files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                {getFileIcon(file.type, file.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-slate-500 text-xs">
                  {formatFileSize(file.size)} • {file.category} • {formatDate(file.uploadedAt)}
                </p>
                <p className="text-xs text-emerald-500/70 mt-0.5 flex items-center gap-1">
                  <span>🔒</span>
                  <span>{file.uploadedBy ? `Bảo mật • ${file.uploadedBy}` : 'Mã hóa AES-256-GCM'}</span>
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => downloadFile(file)}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                  title="Tải xuống"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => deleteFile(file.id)}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                  title="Xóa"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
