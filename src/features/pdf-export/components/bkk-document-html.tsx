"use client";

import React from "react";
import type { StandardizedBkkData } from "@/shared/types";
import { PDF_SPECS } from "@/shared/lib/constants";
import { formatCurrency } from "@/shared/lib/format";

interface BkkDocumentHtmlProps {
    data: StandardizedBkkData;
    id?: string;
}

/**
 * BKK Document HTML Component
 * Designed to match the 13cm x 9cm physical template exactly.
 * Used for screen preview, high-quality JPG export, and browser printing.
 */
export const BkkDocumentHtml = React.forwardRef<HTMLDivElement, BkkDocumentHtmlProps>(
    ({ data, id }, ref) => {
        const { header, info, rows, signatories } = data;
        const total = info.total_amount;

        const isBkk = header.transaction_type === "BKK";
        const title = isBkk ? "BUKTI KAS KELUAR" : "BUKTI KAS MASUK";
        const descHeader = isBkk ? "KETERANGAN PENGELUARAN" : "KETERANGAN PENERIMAAN";

        // Pad rows to exactly MAX_DATA_ROWS (6)
        const paddedRows = [...rows];
        while (paddedRows.length < PDF_SPECS.MAX_DATA_ROWS) {
            paddedRows.push({
                no: paddedRows.length + 1,
                description: "",
                account_code: "",
                amount: 0,
            });
        }

        function formatDate(dateStr: string) {
            if (!dateStr) return "—";
            const parts = dateStr.split("-");
            if (parts.length >= 3) {
                return `${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}`;
            }
            return dateStr;
        }

        const borderStyle = "border-[0.75pt] border-black";

        return (
            <div
                id={id}
                ref={ref}
                className="bg-white text-black print:m-0"
                style={{
                    width: "369pt",
                    height: "255pt",
                    padding: "4pt", // matching PDF_SPECS.MARGIN
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: "8pt",
                    boxSizing: "border-box",
                    lineHeight: "1.2",
                }}
            >
                <div className={`w-full h-full flex flex-col ${borderStyle}`}>
                    {/* Company Name */}
                    <div className={`px-2 h-[14pt] flex items-center shrink-0 ${borderStyle} border-t-0 border-x-0`}>
                        <span className="font-bold text-[9pt] uppercase">{header.company_name}</span>
                    </div>

                    {/* Title & Doc Info */}
                    <div className={`flex h-[20pt] shrink-0 ${borderStyle} border-t-0 border-x-0`}>
                        <div className={`w-1/2 px-2 flex items-center ${borderStyle} border-y-0 border-l-0`}>
                            <span className="font-bold text-[8pt] uppercase">{title}</span>
                        </div>
                        <div className="w-1/2 px-2 flex flex-col justify-center text-[7pt]">
                            <div>No. {header.transaction_type} : {header.payment_type}</div>
                            <div>Tanggal : {formatDate(header.transaction_date)}</div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div 
                        className={`px-2 py-1 shrink-0 flex flex-col overflow-hidden justify-center ${borderStyle} border-t-0 border-x-0`}
                        style={{
                            // INFO: SOT (bkk-pdf-document.tsx) mendefinisikan Info Section = 38pt
                            // menggunakan Yoga engine yang mengkompresi font bounding-box.
                            // Browser CSS Box Model membutuhkan ~43.5pt (kalkulasi: 31pt font + 
                            // 6.5pt margin + 6pt padding). Nilai 40pt adalah toleransi minimum
                            // yang menghindari clipping tanpa merusak proporsi dokumen secara visual.
                            // JANGAN ubah nilai ini tanpa menjalankan pixel comparison test.
                            minHeight: "40pt"
                        }}
                    >
                        <div className="font-bold text-[7pt] underline uppercase" style={{ marginTop: "2pt", marginBottom: "2pt" }}>
                            {isBkk ? "DIBAYARKAN KEPADA" : "DITERIMA DARI"}
                        </div>
                        <div className="flex text-[8pt]" style={{ marginBottom: "1.5pt" }}>
                            <div className="w-[65pt]">Bagian</div>
                            <div className="w-[8pt]">:</div>
                            <div className="font-bold uppercase">{info.division || info.department}</div>
                        </div>
                        <div className="flex text-[8pt]" style={{ marginBottom: "1.5pt" }}>
                            <div className="w-[65pt]">Jumlah Uang</div>
                            <div className="w-[8pt]">:</div>
                            <div className="font-bold">{formatCurrency(total)}</div>
                        </div>
                        <div className="flex text-[8pt]">
                            <div className="w-[65pt]">Untuk keperluan</div>
                            <div className="w-[8pt]">:</div>
                            <div className="font-bold whitespace-normal break-words flex-1" title={info.purpose}>{info.purpose}</div>
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className={`flex h-[13pt] shrink-0 text-[6pt] font-bold text-center ${borderStyle} border-t-0 border-x-0`}>
                        <div className={`flex items-center justify-center ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.NO }}>NO</div>
                        <div className={`flex items-center px-1 ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.DESCRIPTION }}>{descHeader}</div>
                        <div className={`flex items-center justify-center ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.ACCOUNT_CODE }}>NO. A/C</div>
                        <div className="flex items-center justify-center" style={{ width: PDF_SPECS.GRID_RATIOS.AMOUNT }}>JUMLAH</div>
                    </div>

                    {/* Table Rows */}
                    <div className="flex-1 flex flex-col">
                        {paddedRows.slice(0, PDF_SPECS.MAX_DATA_ROWS).map((row, idx) => (
                            <div key={idx} className={`flex min-h-[14pt] text-[8pt] ${borderStyle} border-t-0 border-x-0`}>
                                <div className={`flex items-center justify-center ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.NO }}>{idx + 1}</div>
                                <div className={`flex items-center px-1 whitespace-normal break-words ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.DESCRIPTION }}>{row.description}</div>
                                <div className={`flex items-center justify-center ${borderStyle} border-y-0 border-l-0`} style={{ width: PDF_SPECS.GRID_RATIOS.ACCOUNT_CODE }}>{row.account_code}</div>
                                <div className="flex items-center justify-end px-1" style={{ width: PDF_SPECS.GRID_RATIOS.AMOUNT }}>
                                    {row.amount > 0 ? formatCurrency(row.amount) : ""}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total Row */}
                    <div className={`flex h-[13pt] shrink-0 font-bold ${borderStyle} border-t-0 border-x-0`}>
                        <div className={`flex items-center justify-center ${borderStyle} border-y-0 border-l-0`} style={{ width: "74%" }}>TOTAL</div>
                        <div className="flex items-center justify-end px-1" style={{ width: "26%" }}>Rp. {formatCurrency(total)}</div>
                    </div>

                    {/* Signatories */}
                    <div className="flex h-[45pt] shrink-0 text-[8pt]">
                        <div className={`flex-1 flex flex-col justify-between items-center py-1 ${borderStyle} border-y-0 border-l-0`}>
                            <div className="font-bold">Diterima oleh</div>
                            <div className="font-bold uppercase text-[7pt]">{signatories.received_by}</div>
                        </div>
                        <div className={`flex-1 flex flex-col justify-between items-center py-1 ${borderStyle} border-y-0 border-l-0`}>
                            <div className="font-bold">Dibayar oleh</div>
                            <div className="font-bold uppercase text-[7pt]">{signatories.paid_by}</div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between items-center py-1">
                            <div className="font-bold">Disetujui oleh</div>
                            <div className="font-bold uppercase text-[7pt]">{signatories.approved_by}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

BkkDocumentHtml.displayName = "BkkDocumentHtml";
