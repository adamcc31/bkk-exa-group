// ============================================
// Gemini Vision Extractor — Unified Prompt
// Single API call with AI-driven classification
// ============================================

import { AI_CONFIG } from "@/shared/lib/constants";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// ---- System Instruction ----

const SYSTEM_INSTRUCTION = `Kamu adalah sistem ekstraksi data finansial tingkat lanjut. Tugasmu hanya satu: menganalisis gambar dokumen keuangan dan mengembalikan data murni dalam format JSON.
Jangan pernah memberikan penjelasan, kalimat pembuka, atau penutup.
Format JSON harus selalu mengikuti skema ini dengan ketat:
{
  "jenis_dokumen": "BPN" | "BANK_TRANSFER" | "TIDAK_DIKENALI",
  "nama_pt": "string",
  "tanggal": "DD/MM/YYYY",
  "jumlah_uang_total": number,
  "untuk_keperluan": "string",
  "keterangan_pengeluaran": [
    {
      "keterangan": "string",
      "jumlah": number
    }
  ]
}
Jika sebuah nilai tidak ditemukan, kembalikan null atau string kosong. Angka nominal tidak boleh menggunakan pemisah ribuan (titik/koma), kembalikan sebagai integer murni.`;

// ---- Main Prompt ----

const MAIN_PROMPT = `Analisis gambar yang dilampirkan dan ekstrak datanya sesuai aturan ketat berikut berdasarkan jenis dokumennya:

KONDISI 1: JIKA GAMBAR ADALAH BUKTI PENERIMAAN NEGARA (BPN)
- "jenis_dokumen": Isi dengan "BPN".
- "nama_pt": Ambil teks tepat di sebelah "Nama Wajib pajak".
- "jumlah_uang_total": Ambil angka dari kolom "Jumlah".
- "tanggal": Ambil dari "Tanggal dan Jam Bayar" atau "Tanggal Buku", format menjadi DD/MM/YYYY.
- "untuk_keperluan": Ambil dari kolom "Uraian".
- "keterangan_pengeluaran": Buat 1 item array. "keterangan" diisi sama dengan "untuk_keperluan", "jumlah" diisi dengan nominal "Jumlah".

KONDISI 2: JIKA GAMBAR ADALAH BUKTI TRANSFER E-BANKING (Contoh: Mandiri Cash Management, BNI, BCA, dll)
- "jenis_dokumen": Isi dengan "BANK_TRANSFER".
- "nama_pt": Ekstrak nama entitas perusahaan dari kolom "From Account" atau pengirim (misal: hilangkan angka rekening, ambil nama seperti "JAPANINDO TRAVEL CON").
- "jumlah_uang_total": Jumlahkan "Amount" (Nominal) + "Charge" (Biaya Admin) jika ada.
- "tanggal": Ambil dari "Date/Time" atau "Tanggal/Jam", format menjadi DD/MM/YYYY.
- "untuk_keperluan": Ambil teks dari "Extended Payment Details", "Remark", atau "Keterangan Pembayaran".
- "keterangan_pengeluaran":
   * Buat array item ke-1: "keterangan" berisi teks dari "Extended Payment Details"/"Remark", dan "jumlah" berisi nilai dari "Amount".
   * JIKA terdapat biaya admin/charge lebih dari 0, buat array item ke-2: "keterangan" diisi tepat dengan kata "BIAYA ADMIN", dan "jumlah" berisi nilai dari "Charge".

Keluarkan hasil akhir HANYA dalam format JSON yang valid.`;

// ---- Types ----
interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

// ---- Core Extractor ----

export async function extractWithGemini(
    imageBase64: string,
    mimeType: string
): Promise<Record<string, unknown>> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const model = process.env.GEMINI_MODEL ?? AI_CONFIG.MODEL;

    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
                {
                    parts: [
                        { text: MAIN_PROMPT },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageBase64,
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
            },
        }),
        signal: AbortSignal.timeout(AI_CONFIG.PER_FILE_TIMEOUT_MS),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Empty response from Gemini API");
    }

    // Clean JSON response (remove markdown fences if present)
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    return JSON.parse(cleaned) as Record<string, unknown>;
}
