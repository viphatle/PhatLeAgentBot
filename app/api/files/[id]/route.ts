import { NextResponse } from "next/server";
import { getJsonValue } from "@/lib/kv";
import { decryptFileContent, verifyFileAccess } from "@/lib/file-security";
import type { FileItem } from "../route";

const FILES_KEY = "user_files";

export const dynamic = "force-dynamic";

// GET - Download file (requires authentication, decrypts content)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await verifyFileAccess();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tải xuống" },
        { status: 401 }
      );
    }

    const files = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    const file = files.find(f => f.id === params.id);
    
    if (!file) {
      return NextResponse.json(
        { error: "Tệp tin không tồn tại" },
        { status: 404 }
      );
    }

    // Check permission: owner or admin can download
    const isAdmin = session.role === "admin" || session.role === "super_admin";
    const isOwner = file.uploadedBy === session.uid || file.uploadSessionId === session.uid;
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập tệp tin này" },
        { status: 403 }
      );
    }

    // Decrypt file content
    const decrypted = decryptFileContent(file.encrypted, file.iv, file.authTag);

    // Return file as downloadable response
    return new NextResponse(new Uint8Array(decrypted), {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("File download error:", error);
    return NextResponse.json(
      { error: "Không thể tải xuống tệp tin" },
      { status: 500 }
    );
  }
}
