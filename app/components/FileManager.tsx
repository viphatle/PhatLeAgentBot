"use client";

import { useState, useCallback, useEffect } from "react";

export type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  category?: string; // Loại tài liệu
  docGroup?: string; // Nhóm tài liệu (Kế toán, Nhân sự...)
  visibility?: "public" | "private";
  uploadedBy?: string; // Owner
  isOwner?: boolean;
  content?: string;
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
  const [selectedDocGroup, setSelectedDocGroup] = useState("Chung");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const categories = ["Tài liệu", "Báo cáo", "Hợp đồng", "Hóa đơn", "Khác"];
  const docGroups = ["Chung", "Kế toán", "Nhân sự", "Kinh doanh", "Marketing", "Pháp lý", "Kỹ thuật", "Quản lý"];

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/files", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải danh sách");
      const data = await res.json();
      setFiles(data.files || []);
      setCurrentUser(data.currentUser || null);
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
      formData.append("docGroup", selectedDocGroup);
      formData.append("visibility", visibility);

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

      {/* STEP-BY-STEP UPLOAD WORKFLOW */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
        
        {/* STEP 1: Select File */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            <span className="text-sm font-medium text-slate-300">Chọn tệp tin</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
              ${dragOver 
                ? "border-emerald-500 bg-emerald-900/20" 
                : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
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
              className="cursor-pointer flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                {uploading ? "⏳" : "📁"}
              </div>
              <p className="text-slate-300 text-sm">
                {uploading ? "Đang tải lên..." : "Click hoặc kéo thả file vào đây"}
              </p>
              <p className="text-slate-500 text-xs">PDF, Excel, Word, Ảnh (tối đa 5MB)</p>
            </label>
          </div>
        </div>

        {/* STEP 2: Document Type & Group */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            <span className="text-sm font-medium text-slate-300">Phân loại tài liệu</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {/* Category */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <label className="text-xs text-slate-500 mb-2 block">📂 Loại tài liệu</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`
                      px-2.5 py-1 rounded-full text-xs transition-all
                      ${selectedCategory === cat
                        ? "bg-emerald-600 text-white font-medium"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }
                    `}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* DocGroup */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <label className="text-xs text-slate-500 mb-2 block">🏷️ Nhóm tài liệu</label>
              <select
                value={selectedDocGroup}
                onChange={(e) => setSelectedDocGroup(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {docGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* STEP 3: Visibility */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">3</span>
            <span className="text-sm font-medium text-slate-300">Thiết lập quyền truy cập</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVisibility("private")}
              className={`
                p-3 rounded-lg border-2 transition-all text-left
                ${visibility === "private"
                  ? "border-rose-500 bg-rose-900/20"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔒</span>
                <span className={`text-sm font-medium ${visibility === "private" ? "text-rose-400" : "text-slate-400"}`}>
                  Riêng tư
                </span>
              </div>
              <p className="text-xs text-slate-500">Chỉ bạn mới xem được</p>
            </button>

            <button
              onClick={() => setVisibility("public")}
              className={`
                p-3 rounded-lg border-2 transition-all text-left
                ${visibility === "public"
                  ? "border-emerald-500 bg-emerald-900/20"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🌐</span>
                <span className={`text-sm font-medium ${visibility === "public" ? "text-emerald-400" : "text-slate-400"}`}>
                  Công khai
                </span>
              </div>
              <p className="text-xs text-slate-500">Mọi người đều xem được</p>
            </button>
          </div>
        </div>
      </div>

      {/* Filter by DocGroup */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-slate-500">Lọc theo nhóm:</span>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
        >
          <option value="all">Tất cả nhóm</option>
          {docGroups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 ml-2">
          ({files.filter(f => filterGroup === "all" || f.docGroup === filterGroup).length} tệp)
        </span>
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
          files
            .filter(file => filterGroup === "all" || file.docGroup === filterGroup)
            .map(file => (
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
                  {formatFileSize(file.size)} • {file.category} 
                  {file.docGroup && file.docGroup !== "Chung" && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded text-[10px]">
                      {file.docGroup}
                    </span>
                  )}
                  • {formatDate(file.uploadedAt)}
                </p>
                <p className="text-xs mt-0.5 flex items-center gap-1">
                  {file.visibility === "private" ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <span>🔒</span>
                      <span>Riêng tư {file.uploadedBy && `• ${file.uploadedBy.split('@')[0]}`}</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span>🌐</span>
                      <span>Công khai {file.uploadedBy && `• ${file.uploadedBy.split('@')[0]}`}</span>
                    </span>
                  )}
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
                {(file.isOwner || file.uploadedBy === currentUser) && (
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                    title="Xóa"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
