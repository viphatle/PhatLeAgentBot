"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

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
  const [viewPath, setViewPath] = useState<string[]>([]); // Folder navigation path

  const categories = ["Tài liệu", "Báo cáo", "Hợp đồng", "Hóa đơn", "Khác"];

  // Group files by category for folder view
  const groupedFiles = useMemo(() => {
    const groups = new Map<string, { groups: Map<string, FileItem[]>; count: number }>();
    
    files.forEach(file => {
      const cat = file.category || "Khác";
      const grp = file.docGroup || "Chung";
      
      if (!groups.has(cat)) {
        groups.set(cat, { groups: new Map(), count: 0 });
      }
      const catData = groups.get(cat)!;
      catData.count++;
      
      if (!catData.groups.has(grp)) {
        catData.groups.set(grp, []);
      }
      catData.groups.get(grp)!.push(file);
    });
    
    return Array.from(groups.entries()).map(([category, data]) => ({
      category,
      groups: Array.from(data.groups.entries()).map(([name, files]) => ({
        name,
        files,
        hasPrivate: files.some(f => f.visibility === "private"),
        hasPublic: files.some(f => f.visibility === "public"),
      })),
      count: data.count,
    }));
  }, [files]);

  // Get current groups when in a category
  const currentGroups = useMemo(() => {
    if (viewPath.length === 0) return [];
    const category = groupedFiles.find(g => g.category === viewPath[0]);
    return category?.groups || [];
  }, [groupedFiles, viewPath]);

  // Get current files when in a group
  const currentFiles = useMemo(() => {
    if (viewPath.length < 2) return [];
    const group = currentGroups.find(g => g.name === viewPath[1]);
    return group?.files || [];
  }, [currentGroups, viewPath]);

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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 md:p-6">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2">
            <span className="text-xl sm:text-2xl">📁</span>
            <span className="truncate">Kho lưu trữ bảo mật</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2">
            Tệp tin được mã hóa, chỉ bạn và admin mới có thể truy cập
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] sm:text-xs px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-800 whitespace-nowrap">
            🔒 Mã hóa
          </span>
          <span className="text-[10px] sm:text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded border border-blue-800 whitespace-nowrap">
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
      <div className="bg-slate-800/30 rounded-xl p-3 sm:p-4 border border-slate-700/50">

        {/* STEP 1: Document Type */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
            <span className="text-sm font-medium text-slate-300">Chọn phân loại</span>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 sm:p-3">
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    px-2.5 sm:px-3 py-1.5 rounded-full text-xs transition-all touch-manipulation
                    ${selectedCategory === cat
                      ? "bg-emerald-600 text-white font-medium"
                      : "bg-slate-700 text-slate-400 active:bg-slate-600"
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 2: Custom Group Name */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
            <span className="text-sm font-medium text-slate-300">Đặt tên nhóm</span>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 sm:p-3">
            <input
              type="text"
              value={selectedDocGroup}
              onChange={(e) => setSelectedDocGroup(e.target.value)}
              placeholder="VD: Kế toán 2024, Hợp đồng Q1..."
              className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[44px]"
            />
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">💡 Đặt tên dễ nhớ để dễ tìm kiếm</p>
          </div>
        </div>

        {/* STEP 3: Visibility */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
            <span className="text-sm font-medium text-slate-300">Quyền truy cập</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => setVisibility("private")}
              className={`
                p-2.5 sm:p-3 rounded-lg border-2 transition-all text-left active:scale-[0.98]
                ${visibility === "private"
                  ? "border-rose-500 bg-rose-900/20"
                  : "border-slate-700 bg-slate-800/50 active:bg-slate-700"
                }
              `}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <span className="text-base sm:text-lg">🔒</span>
                <span className={`text-xs sm:text-sm font-medium ${visibility === "private" ? "text-rose-400" : "text-slate-400"}`}>
                  Riêng tư
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Chỉ bạn xem</p>
            </button>

            <button
              onClick={() => setVisibility("public")}
              className={`
                p-2.5 sm:p-3 rounded-lg border-2 transition-all text-left active:scale-[0.98]
                ${visibility === "public"
                  ? "border-emerald-500 bg-emerald-900/20"
                  : "border-slate-700 bg-slate-800/50 active:bg-slate-700"
                }
              `}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <span className="text-base sm:text-lg">🌐</span>
                <span className={`text-xs sm:text-sm font-medium ${visibility === "public" ? "text-emerald-400" : "text-slate-400"}`}>
                  Công khai
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Mọi người xem</p>
            </button>
          </div>
        </div>

        {/* STEP 4: Upload File */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold shrink-0">4</span>
            <span className="text-sm font-medium text-slate-300">Tải lên tệp tin</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-3 sm:p-4 text-center transition-colors cursor-pointer min-h-[120px] flex items-center justify-center
              ${dragOver
                ? "border-purple-500 bg-purple-900/20"
                : "border-slate-600 active:border-slate-500 bg-slate-800/50"
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
              className="cursor-pointer flex flex-col items-center gap-1.5 w-full"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl sm:text-2xl">
                {uploading ? "⏳" : "📁"}
              </div>
              <p className="text-slate-300 text-sm">
                {uploading ? "Đang tải lên..." : "Chọn file"}
              </p>
              <p className="text-slate-500 text-[10px] sm:text-xs leading-tight px-2">
                <span className="text-emerald-400">{selectedCategory}</span> •
                <span className="text-blue-400">{selectedDocGroup || "Chưa đặt"}</span> •
                <span className={visibility === "private" ? "text-rose-400" : "text-emerald-400"}>{visibility === "private" ? "🔒" : "🌐"}</span>
              </p>
              <p className="text-slate-500 text-[10px] sm:text-xs mt-1">PDF, Excel, Word, Ảnh (max 5MB)</p>
            </label>
          </div>
        </div>
      </div>

      {/* Folder View Navigation */}
      <div className="mt-4 flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
        <button
          onClick={() => setViewPath([])}
          className={`px-2 py-1 rounded transition-colors shrink-0 ${viewPath.length === 0 ? "text-emerald-400 font-medium" : "text-slate-400 active:text-slate-300"}`}
        >
          <span className="mr-1">📁</span>Kho tài liệu
        </button>
        {viewPath.map((folder, idx) => (
          <span key={idx} className="flex items-center gap-1 shrink-0">
            <span className="text-slate-600">/</span>
            <span className={`truncate max-w-[100px] sm:max-w-[150px] ${idx === viewPath.length - 1 ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
              {folder}
            </span>
          </span>
        ))}
        <span className="text-[10px] sm:text-xs text-slate-500 ml-auto shrink-0">
          ({viewPath.length === 0 
            ? `${groupedFiles.length} thư mục` 
            : viewPath.length === 1 
              ? `${currentGroups.length} nhóm • ${currentFiles.length} tệp`
              : `${currentFiles.length} tệp`
          })
        </span>
      </div>

      {/* Folder View Content */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {loading ? (
          <p className="text-center text-slate-500 py-8 col-span-full">Đang tải...</p>
        ) : files.length === 0 ? (
          <p className="text-center text-slate-500 py-8 col-span-full">
            Chưa có tệp tin nào
          </p>
        ) : viewPath.length === 0 ? (
          // ROOT: Show Categories as folders
          groupedFiles.map(({ category, groups, count }) => (
            <button
              key={category}
              onClick={() => setViewPath([category])}
              className="p-3 sm:p-4 bg-slate-800/50 active:bg-slate-800 rounded-xl border border-slate-700/50 active:border-slate-600 transition-all text-left group min-h-[80px] sm:min-h-[100px]"
            >
              <div className="text-2xl sm:text-3xl mb-1.5 sm:mb-2">📁</div>
              <p className="font-medium text-slate-200 text-xs sm:text-sm truncate">{category}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                {groups.length} nhóm • {count} tệp
              </p>
            </button>
          ))
        ) : viewPath.length === 1 ? (
          // CATEGORY: Show Groups as subfolders
          currentGroups.map((group) => (
            <button
              key={group.name}
              onClick={() => setViewPath([...viewPath, group.name])}
              className="p-3 sm:p-4 bg-slate-800/50 active:bg-slate-800 rounded-xl border border-slate-700/50 active:border-slate-600 transition-all text-left group min-h-[80px] sm:min-h-[100px]"
            >
              <div className="text-2xl sm:text-3xl mb-1.5 sm:mb-2">📂</div>
              <p className="font-medium text-slate-200 text-xs sm:text-sm truncate">{group.name}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                {group.files.length} tệp
              </p>
              <div className="flex items-center gap-1 mt-1.5 sm:mt-2">
                {group.hasPrivate && <span className="text-[10px] sm:text-xs">🔒</span>}
                {group.hasPublic && <span className="text-[10px] sm:text-xs">🌐</span>}
              </div>
            </button>
          ))
        ) : (
          // GROUP: Show files in list
          currentFiles.map(file => (
            <div
              key={file.id}
              className="p-2.5 sm:p-3 bg-slate-800/50 active:bg-slate-800 rounded-xl border border-slate-700/50 active:border-slate-600 transition-all group relative min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">{getFileIcon(file.type, file.name)}</div>
              <p className="text-slate-200 text-[11px] sm:text-xs truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1">
                {formatFileSize(file.size)}
              </p>
              <div className="flex items-center gap-1 mt-1.5 sm:mt-2">
                {file.visibility === "private" ? (
                  <span className="text-[9px] sm:text-[10px] text-rose-400">🔒</span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] text-emerald-400">🌐</span>
                )}
              </div>
              
              {/* Action buttons - always visible on mobile, hover on desktop */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                  className="p-1.5 rounded bg-emerald-600/90 sm:bg-emerald-600/80 active:bg-emerald-600 text-white text-xs touch-manipulation"
                  title="Tải xuống"
                >
                  ⬇️
                </button>
                {(file.isOwner || file.uploadedBy === currentUser) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                    className="p-1.5 rounded bg-rose-600/90 sm:bg-rose-600/80 active:bg-rose-600 text-white text-xs touch-manipulation"
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
