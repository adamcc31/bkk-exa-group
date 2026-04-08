// ============================================
// Stats Display — Server Component
// Renders dashboard stat cards
// ============================================

import { StatCard } from "@/shared/components/data-display/stat-card";
import { formatCurrency } from "@/shared/lib/format";

interface StatsDisplayProps {
    stats: {
        totalBkm: number;
        totalBkk: number;
        totalTransactions: number;
        balance: number;
    };
}

export function StatsDisplay({ stats }: StatsDisplayProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
                icon="account_balance_wallet"
                label="Total Kas Masuk (BKM)"
                value={`Rp ${formatCurrency(stats.totalBkm)}`}
                iconBgClass="bg-green-50"
                iconColorClass="text-green-600"
                bottomBarColor="from-green-400 to-green-600"
            />
            <StatCard
                icon="payments"
                label="Total Kas Keluar (BKK)"
                value={`Rp ${formatCurrency(stats.totalBkk)}`}
                iconBgClass="bg-red-50"
                iconColorClass="text-red-600"
                bottomBarColor="from-red-400 to-red-600"
            />
            <StatCard
                icon="swap_vert"
                label="Total Transaksi"
                value={String(stats.totalTransactions)}
                iconBgClass="bg-purple-50"
                iconColorClass="text-purple-600"
                bottomBarColor="from-purple-400 to-purple-600"
            />
            <StatCard
                icon="trending_up"
                label="Saldo"
                value={`Rp ${formatCurrency(stats.balance)}`}
                variant="highlight"
            />
        </div>
    );
}
