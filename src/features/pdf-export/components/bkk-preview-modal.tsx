"use client";

import React, { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { BkkDocumentHtml } from "./bkk-document-html";
import type { StandardizedBkkData } from "@/shared/types";
import { Button } from "@/shared/components/ui/button";

interface BkkPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: StandardizedBkkData | null;
}

export function BkkPreviewModal({ isOpen, onClose, data }: BkkPreviewModalProps) {
    const documentRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState(false);

    if (!isOpen || !data) return null;

    async function handleExportJpg() {
        if (!documentRef.current || !data) return;
        setExporting(true);
        try {
            const dataUrl = await toJpeg(documentRef.current, {
                quality: 0.95,
                pixelRatio: 2, // 2x Device Pixel Ratio as requested
                backgroundColor: "#ffffff",
                skipFonts: true, // Fix for "Failed to read the 'cssRules' property" from cross-origin fonts
            });

            const date = data.header.transaction_date || new Date().toISOString().split("T")[0];
            const companyId = data.header.doc_number?.split(" ")[0] || "BKK";
            const filename = `${companyId}-${date}.jpg`;

            const link = document.createElement("a");
            link.download = filename;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to export JPG:", err);
            alert("Gagal mengekspor JPG. Silakan coba lagi.");
        } finally {
            setExporting(false);
        }
    }

    function handlePrint() {
        window.print();
    }

    function handleDownloadPdf() {
        // Trigger the existing PDF API
        // We use the ID if we had it, but here we'll assume the caller handles the link
        // Or we can just use the doc_number to find it if needed.
        // For now, let's just use the doc_number in a placeholder way if no ID is passed.
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <div className="bg-white rounded-2xl shadow-2xl max-w-[90vw] max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Preview Dokumen</h3>
                        <p className="text-xs text-gray-500 uppercase font-medium">{data.header.transaction_type} : {data.header.doc_number}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-500">close</span>
                    </button>
                </div>

                {/* Preview Area */}
                <div className="flex-1 overflow-auto p-12 bg-gray-200/50 flex justify-center items-start">
                    <div className="shadow-2xl border border-gray-300 print-content bkk-document-printable">
                        <BkkDocumentHtml ref={documentRef} data={data} />
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                    <Button
                        variant="secondary"
                        icon={<span className="material-symbols-outlined text-sm">print</span>}
                        onClick={handlePrint}
                    >
                        Print
                    </Button>
                    <Button
                        variant="secondary"
                        icon={<span className="material-symbols-outlined text-sm">picture_as_pdf</span>}
                        onClick={() => window.open(`/api/pdf/${(data as any).id || ""}`, "_blank")}
                    >
                        Export PDF
                    </Button>
                    <Button
                        loading={exporting}
                        icon={<span className="material-symbols-outlined text-sm">image</span>}
                        onClick={handleExportJpg}
                        className="!bg-orange-600 hover:!bg-orange-700 !shadow-orange-500/30"
                    >
                        {exporting ? "Capturing..." : "Export as JPG"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
