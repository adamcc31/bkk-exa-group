// ============================================
// AI Parser Page — Upload & Status UI (Fixed)
// Uses server-side upload to bypass RLS
// ============================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { formatCurrency } from "@/shared/lib/format";
import { AI_CONFIG } from "@/shared/lib/constants";
import { uploadFilesToStorage } from "@/features/ai-parser/components/image-preprocessor";
import type { StandardizedBkkData, AiJobStatus } from "@/shared/types";

interface JobInfo {
    id: string;
    status: AiJobStatus;
    original_filename: string;
    document_type: string | null;
    standardized_data: StandardizedBkkData | null;
    total_amount: number | null;
    error_message: string | null;
}

export default function AiParserPage() {
    const router = useRouter();
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [jobs, setJobs] = useState<JobInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [savingJobs, setSavingJobs] = useState<Set<string>>(new Set());
    const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
    const [savingAll, setSavingAll] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(e.target.files ?? []);
        if (selected.length + files.length > AI_CONFIG.MAX_BATCH_SIZE) {
            setError(`Maksimum ${AI_CONFIG.MAX_BATCH_SIZE} file per batch`);
            return;
        }
        setFiles((prev) => [...prev, ...selected]);
        setError(null);
    }

    function removeFile(index: number) {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleUpload() {
        if (files.length === 0) return;
        setUploading(true);
        setError(null);

        try {
            // 1. Upload preprocessed files via client-side uploader
            const filePaths = await uploadFilesToStorage(files, "");

            if (filePaths.length === 0) {
                setError("Semua file gagal di-upload");
                setUploading(false);
                return;
            }

            // 2. Trigger AI parsing
            const res = await fetch("/api/ai-parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file_paths: filePaths }),
            });

            const result = await res.json();

            if (!result.success) {
                setError(result.error?.message ?? "Terjadi kesalahan");
                setUploading(false);
                return;
            }

            // 3. Initialize jobs for tracking
            const initialJobs: JobInfo[] = result.data.job_ids.map(
                (id: string, i: number) => ({
                    id,
                    status: "queued" as AiJobStatus,
                    original_filename: files[i]?.name ?? "unknown",
                    document_type: null,
                    standardized_data: null,
                    total_amount: null,
                    error_message: null,
                })
            );

            setJobs(initialJobs);
            setFiles([]);
            setUploading(false);

            // 4. Start polling
            startPolling(result.data.job_ids);
        } catch (err) {
            setError(String(err));
            setUploading(false);
        }
    }

    function startPolling(jobIds: string[]) {
        if (pollingRef.current) clearInterval(pollingRef.current);

        let pollCount = 0;
        const MAX_POLLS = 30; // ~60 seconds at 2s interval

        pollingRef.current = setInterval(async () => {
            pollCount++;

            const updates = await Promise.all(
                jobIds.map(async (id) => {
                    const res = await fetch(`/api/ai-parse/status/${id}`);
                    const json = await res.json();
                    return json.success ? json.data : null;
                })
            );

            setJobs((prev) =>
                prev.map((job) => {
                    const update = updates.find(
                        (u: JobInfo | null) => u && u.id === job.id
                    );
                    return update ? { ...job, ...update } : job;
                })
            );

            const allDone = updates.every(
                (u: JobInfo | null) =>
                    u && (u.status === "completed" || u.status === "failed")
            );

            if (allDone || pollCount >= MAX_POLLS) {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }

                // Mark timed-out jobs as failed
                if (pollCount >= MAX_POLLS) {
                    setJobs((prev) =>
                        prev.map((job) =>
                            job.status === "queued" || job.status === "processing"
                                ? { ...job, status: "failed" as AiJobStatus, error_message: "Timeout: proses AI tidak merespon. Pastikan Inngest worker berjalan." }
                                : job
                        )
                    );
                    setError("Timeout: AI worker tidak merespon dalam 60 detik. Pastikan Inngest dev server berjalan (npx inngest-cli@latest dev).");
                }
            }
        }, AI_CONFIG.POLLING_INTERVAL_MS);
    }

    // ---- Save to Transaction ----
    async function saveJobToTransaction(jobId: string) {
        setSavingJobs((prev) => new Set(prev).add(jobId));
        setError(null);

        try {
            const res = await fetch("/api/ai-parse/save-to-transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job_ids: [jobId] }),
            });

            const result = await res.json();

            if (result.success && result.data.total_created > 0) {
                setSavedJobs((prev) => new Set(prev).add(jobId));
            } else {
                const errMsg = result.data?.errors?.[0]?.message ?? result.error?.message ?? "Gagal menyimpan";
                setError(errMsg);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setSavingJobs((prev) => {
                const next = new Set(prev);
                next.delete(jobId);
                return next;
            });
        }
    }

    async function saveAllToTransaction() {
        const completedJobIds = jobs
            .filter((j) => j.status === "completed" && !savedJobs.has(j.id))
            .map((j) => j.id);

        if (completedJobIds.length === 0) return;

        setSavingAll(true);
        setError(null);

        try {
            const res = await fetch("/api/ai-parse/save-to-transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job_ids: completedJobIds }),
            });

            const result = await res.json();

            if (result.success && result.data.total_created > 0) {
                setSavedJobs((prev) => {
                    const next = new Set(prev);
                    completedJobIds.forEach((id) => next.add(id));
                    return next;
                });

                // Navigate to transactions page after short delay
                setTimeout(() => router.push("/transactions"), 1200);
            }

            if (result.data?.errors?.length > 0) {
                setError(result.data.errors.map((e: { message: string }) => e.message).join(", "));
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setSavingAll(false);
        }
    }

    const completedUnsavedCount = jobs.filter(
        (j) => j.status === "completed" && !savedJobs.has(j.id)
    ).length;

    const allJobsDone = jobs.length > 0 && jobs.every(
        (j) => j.status === "completed" || j.status === "failed"
    );

    const statusVariant = useCallback((status: AiJobStatus) => {
        switch (status) {
            case "completed": return "success";
            case "failed": return "danger";
            case "processing": return "primary";
            case "queued": return "warning";
            default: return "default";
        }
    }, []);

    const statusLabel = useCallback((status: AiJobStatus) => {
        switch (status) {
            case "completed": return "Selesai";
            case "failed": return "Gagal";
            case "processing": return "Memproses";
            case "queued": return "Antrian";
            case "pending": return "Menunggu";
            default: return status;
        }
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">AI Parser</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Upload foto bukti transfer / BPN pajak untuk otomasi pembuatan BKK
                </p>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-6">{error}</div>
            )}

            {/* Upload Area */}
            <div
                className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center mb-6 hover:border-[var(--color-primary)] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">cloud_upload</span>
                <p className="text-sm font-medium text-gray-600 mb-1">Klik atau seret file ke sini</p>
                <p className="text-xs text-gray-400">Format: JPG, PNG, JPEG • Maks {AI_CONFIG.MAX_BATCH_SIZE} file • Otomatis dikompresi</p>
            </div>

            {/* File Preview */}
            {files.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6" style={{ boxShadow: "var(--shadow-soft)" }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-gray-900">{files.length} file dipilih</h2>
                        <Button loading={uploading} onClick={handleUpload}>{uploading ? "Mengupload..." : "Proses dengan AI"}</Button>
                    </div>
                    <div className="space-y-2">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-gray-400">image</span>
                                    <span className="text-xs text-gray-700 font-medium">{file.name}</span>
                                    <span className="text-[10px] text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Job Results */}
            {jobs.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-gray-900">Hasil Pemrosesan</h2>
                        {allJobsDone && completedUnsavedCount > 0 && (
                            <Button
                                onClick={saveAllToTransaction}
                                loading={savingAll}
                                className="!bg-green-600 hover:!bg-green-700 !shadow-green-500/30"
                            >
                                <span className="material-symbols-outlined text-sm mr-1">save</span>
                                Simpan Semua ke Transaksi ({completedUnsavedCount})
                            </Button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {jobs.map((job) => (
                            <div key={job.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-gray-400">description</span>
                                        <span className="text-xs font-medium text-gray-700">{job.original_filename}</span>
                                    </div>
                                    <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
                                </div>

                                {job.status === "processing" && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="material-symbols-outlined text-sm text-blue-500 animate-spin">progress_activity</span>
                                        <span className="text-xs text-blue-600">AI sedang menganalisis dokumen...</span>
                                    </div>
                                )}

                                {job.status === "completed" && job.standardized_data && (
                                    <div className="mt-3 p-3 bg-white rounded-lg border border-green-100">
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Tipe Dokumen</span>
                                                <span className="font-medium text-gray-700 uppercase">{job.document_type}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Nominal</span>
                                                <span className="font-bold text-green-600">Rp {formatCurrency(job.total_amount ?? 0)}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Dibayar Kepada</span>
                                                <span className="font-medium text-gray-700">{job.standardized_data.info.paid_to}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Tanggal</span>
                                                <span className="font-medium text-gray-700">{job.standardized_data.header.transaction_date}</span>
                                            </div>
                                        </div>

                                        {/* Save to Transaction Button */}
                                        <div className="mt-3 pt-3 border-t border-green-100">
                                            {savedJobs.has(job.id) ? (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    <span className="text-xs font-medium">Tersimpan ke Transaksi</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => saveJobToTransaction(job.id)}
                                                    disabled={savingJobs.has(job.id)}
                                                    className="w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-green-500/20"
                                                >
                                                    {savingJobs.has(job.id) ? (
                                                        <>
                                                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-sm">save</span>
                                                            Simpan ke Transaksi
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {job.status === "failed" && job.error_message && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                                        <span className="text-xs text-red-600">{job.error_message}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
