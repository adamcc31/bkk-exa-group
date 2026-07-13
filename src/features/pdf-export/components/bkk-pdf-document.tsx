// ============================================
// BKK PDF Document — @react-pdf/renderer
// 13cm × 9cm landscape, Times New Roman
// Nearly marginless, single page
// 
// WARNING: Data shape harus konsisten dengan bkk-document.types.ts
// Jika mengubah struktur atau tampilan (HTML Preview), update kedua file secara bersamaan.
// ============================================

import React from "react";
import {
    Document,
    Page,
    View,
    Text,
    StyleSheet,
} from "@react-pdf/renderer";
import type { StandardizedBkkData } from "@/shared/types";
import { PDF_SPECS } from "@/shared/lib/constants";
import { formatCurrency } from "@/shared/lib/format";

const B = `${PDF_SPECS.BORDER_WIDTH}pt solid #000`;
const { GRID_RATIOS, MAX_DATA_ROWS } = PDF_SPECS;

// Height budget (255pt page - 8pt margins = 247pt):
// Company:      14pt
// Title:        20pt
// Info:         38pt
// Table header: 13pt
// 6 data rows:  84pt (14pt each)
// Total:        13pt
// Signatures:   45pt
// Borders:      ~2pt
// Sum:         229pt (18pt spare) ✓

const s = StyleSheet.create({
    page: {
        width: PDF_SPECS.PAGE_WIDTH,
        height: PDF_SPECS.PAGE_HEIGHT,
        padding: PDF_SPECS.MARGIN,
        fontFamily: "Times-Roman",
        fontSize: 7,
        color: "#000",
    },
    outer: {
        border: B,
    },

    // === Company Name ===
    companyRow: {
        borderBottom: B,
        paddingHorizontal: 6,
        height: 14,
        justifyContent: "center",
    },
    companyText: {
        fontSize: 9,
        fontFamily: "Times-Bold",
    },

    // === Title + Doc Number + Date ===
    titleRow: {
        flexDirection: "row",
        borderBottom: B,
        height: 20,
    },
    titleLeft: {
        width: "50%",
        borderRight: B,
        paddingHorizontal: 6,
        justifyContent: "center",
    },
    titleText: {
        fontSize: 8,
        fontFamily: "Times-Bold",
    },
    titleRight: {
        width: "50%",
        paddingHorizontal: 6,
        justifyContent: "center",
    },
    titleRightLine: {
        fontSize: 8,
        lineHeight: 1.6,
    },

    // === Info Section ===
    infoSection: {
        borderBottom: B,
        paddingHorizontal: 6,
        paddingVertical: 3,
        minHeight: 38,
    },
    infoTitle: {
        fontSize: 7,
        fontFamily: "Times-Bold",
        textDecoration: "underline",
        marginBottom: 2,
    },
    infoRow: {
        flexDirection: "row",
        marginBottom: 1.5,
    },
    infoLabel: {
        width: 65,
        fontSize: 8,
    },
    infoSep: {
        width: 8,
        fontSize: 8,
    },
    infoValue: {
        flex: 1,
        fontSize: 8,
        fontFamily: "Times-Bold",
    },

    // === Table ===
    tableHeader: {
        flexDirection: "row",
        borderBottom: B,
        height: 13,
    },
    tableRow: {
        flexDirection: "row",
        borderBottom: B,
        minHeight: 14,
    },
    cellNo: {
        width: GRID_RATIOS.NO,
        justifyContent: "center",
        alignItems: "center",
        borderRight: B,
        fontSize: 8,
    },
    cellDesc: {
        width: GRID_RATIOS.DESCRIPTION,
        justifyContent: "center",
        paddingHorizontal: 4,
        borderRight: B,
        fontSize: 8,
    },
    cellAc: {
        width: GRID_RATIOS.ACCOUNT_CODE,
        justifyContent: "center",
        alignItems: "center",
        borderRight: B,
        fontSize: 8,
    },
    cellAmount: {
        width: GRID_RATIOS.AMOUNT,
        justifyContent: "center",
        alignItems: "flex-end",
        paddingRight: 4,
        fontSize: 8,
    },
    thText: {
        fontSize: 6,
        fontFamily: "Times-Bold",
        textAlign: "center",
    },

    // === Total ===
    totalRow: {
        flexDirection: "row",
        borderBottom: B,
        height: 13,
    },
    totalLabel: {
        width: "74%",
        justifyContent: "center",
        alignItems: "center",
        borderRight: B,
    },
    totalValue: {
        width: "26%",
        justifyContent: "center",
        alignItems: "flex-end",
        paddingRight: 4,
    },
    totalText: {
        fontSize: 7,
        fontFamily: "Times-Bold",
    },

    // === Signatories (compact) ===
    sigSection: {
        flexDirection: "row",
        height: 45,
    },
    sigCell: {
        flex: 1,
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 3,
        borderRight: B,
    },
    sigLabel: {
        fontSize: 8,
        fontFamily: "Times-Bold",
    },
    sigName: {
        fontSize: 7,
        fontFamily: "Times-Bold",
    },
});

interface BkkPdfDocumentProps {
    data: StandardizedBkkData;
}

function formatDateDDMMYYYY(dateInput: string | Date): string {
    if (!dateInput) return "—";

    // Handle Date object
    const dateStr =
        dateInput instanceof Date
            ? dateInput.toISOString().split("T")[0]
            : String(dateInput);

    // Expected format: YYYY-MM-DD
    const parts = dateStr.split("-");
    if (parts.length >= 3) {
        // Just take the first 3 parts if there's time info
        return `${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

export function BkkPdfDocument({ data }: BkkPdfDocumentProps) {
    const { header, info, rows, signatories } = data;
    const total = info.total_amount;

    const isBkk = header.transaction_type === "BKK";
    const title = isBkk ? "BUKTI KAS KELUAR" : "BUKTI KAS MASUK";
    const descHeader = isBkk ? "KETERANGAN PENGELUARAN" : "KETERANGAN PENERIMAAN";

    const paddedRows = [...rows];
    while (paddedRows.length < MAX_DATA_ROWS) {
        paddedRows.push({ no: paddedRows.length + 1, description: "", account_code: "", amount: 0 });
    }

    return (
        <Document>
            <Page size={{ width: PDF_SPECS.PAGE_WIDTH, height: PDF_SPECS.PAGE_HEIGHT }} style={s.page}>
                <View style={s.outer}>
                    {/* Company Name */}
                    <View style={s.companyRow}>
                        <Text style={s.companyText}>{header.company_name}</Text>
                    </View>

                    {/* Title + Doc Info */}
                    <View style={s.titleRow}>
                        <View style={s.titleLeft}>
                            <Text style={s.titleText}>{title}</Text>
                        </View>
                        <View style={s.titleRight}>
                            <Text style={s.titleRightLine}>No. {header.transaction_type} : {header.payment_type}</Text>
                            <Text style={s.titleRightLine}>Tanggal : {formatDateDDMMYYYY(header.transaction_date)}</Text>
                        </View>
                    </View>

                    {/* Info Section */}
                    <View style={s.infoSection}>
                        <Text style={s.infoTitle}>{isBkk ? "DIBAYARKAN KEPADA" : "DITERIMA DARI"}</Text>
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>Bagian</Text>
                            <Text style={s.infoSep}>:</Text>
                            <Text style={s.infoValue}>{info.division || info.department}</Text>
                        </View>
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>Jumlah Uang</Text>
                            <Text style={s.infoSep}>:</Text>
                            <Text style={s.infoValue}>{formatCurrency(total)}</Text>
                        </View>
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>Untuk keperluan</Text>
                            <Text style={s.infoSep}>:</Text>
                            <Text style={s.infoValue}>{info.purpose}</Text>
                        </View>
                    </View>

                    {/* Table Header */}
                    <View style={s.tableHeader}>
                        <View style={s.cellNo}><Text style={s.thText}>NO</Text></View>
                        <View style={s.cellDesc}><Text style={s.thText}>{descHeader}</Text></View>
                        <View style={s.cellAc}><Text style={s.thText}>NO. A/C</Text></View>
                        <View style={s.cellAmount}><Text style={s.thText}>JUMLAH</Text></View>
                    </View>

                    {/* Table Data Rows */}
                    {paddedRows.slice(0, MAX_DATA_ROWS).map((row, idx) => (
                        <View key={idx} style={s.tableRow}>
                            <View style={s.cellNo}><Text>{idx + 1}</Text></View>
                            <View style={s.cellDesc}><Text>{row.description}</Text></View>
                            <View style={s.cellAc}><Text>{row.account_code}</Text></View>
                            <View style={s.cellAmount}>
                                <Text>{row.amount > 0 ? formatCurrency(row.amount) : ""}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Total Row */}
                    <View style={s.totalRow}>
                        <View style={s.totalLabel}>
                            <Text style={s.totalText}>TOTAL</Text>
                        </View>
                        <View style={s.totalValue}>
                            <Text style={s.totalText}>Rp. {formatCurrency(total)}</Text>
                        </View>
                    </View>

                    {/* Signatories */}
                    <View style={s.sigSection}>
                        <View style={s.sigCell}>
                            <Text style={s.sigLabel}>Diterima oleh</Text>
                            <Text style={s.sigName}>{signatories.received_by}</Text>
                        </View>
                        <View style={s.sigCell}>
                            <Text style={s.sigLabel}>Dibayar oleh</Text>
                            <Text style={s.sigName}>{signatories.paid_by}</Text>
                        </View>
                        <View style={[s.sigCell, { borderRight: "none" }]}>
                            <Text style={s.sigLabel}>Disetujui oleh</Text>
                            <Text style={s.sigName}>{signatories.approved_by}</Text>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
