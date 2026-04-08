"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface PDFExportButtonProps {
  targetId: string;
  filename?: string;
  symbol: string;
  period: string;
}

export function PDFExportButton({ 
  targetId, 
  filename, 
  symbol, 
  period 
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const element = document.getElementById(targetId);
    if (!element) {
      alert("Không tìm thấy nội dung để xuất");
      return;
    }

    setIsExporting(true);
    
    try {
      // Create a clone for PDF rendering
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = "800px";
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.backgroundColor = "#0a0f1a";
      document.body.appendChild(clone);

      // Wait for fonts and styles
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#0a0f1a",
        logging: false,
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/png");
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Add header
      pdf.setFillColor(10, 15, 26);
      pdf.rect(0, 0, 210, 25, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.text(`BÁO CÁO PHÂN TÍCH CỔ PHIẾU`, 105, 12, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`${symbol} - Kỳ ${period}`, 105, 20, { align: "center" });
      
      // Add content image
      let heightLeft = imgHeight;
      let position = 30;
      
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 30;
      
      // Add new pages if content is too long
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 30;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Add footer to each page
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFillColor(10, 15, 26);
        pdf.rect(0, 287, 210, 10, "F");
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(8);
        pdf.text(
          `Stock Monitor VN - Trang ${i}/${pageCount} - ${new Date().toLocaleDateString("vi-VN")}`,
          105,
          293,
          { align: "center" }
        );
      }
      
      const finalFilename = filename || `BaoCao_${symbol}_${period}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(finalFilename);
      
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Có lỗi khi xuất PDF. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang xuất...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Xuất PDF
        </>
      )}
    </button>
  );
}
