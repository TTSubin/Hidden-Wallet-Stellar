import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff, Copy, Check, Users, Award, Trophy, Crown, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { formatTransactionAmount } from '@/lib/transactions';

const Dashboard = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading, user } = useAuth();

    const {
        usdcBalance,
        xlmBalance,
        transactions,
        isConnected,
        isLoadingBalance,
    } = useWallet();
    const rewardPoints = useMemo(() => {
        const u = user as { loyaltyPoints?: unknown } | null;
        return typeof u?.loyaltyPoints === 'number' ? u.loyaltyPoints : 0;
    }, [user]);

    const referralStats = useMemo(() => {
        const u = user as { commissionBalance?: unknown; f0Volume?: unknown; refereesCount?: unknown; loyaltyTier?: unknown } | null;

        const totalCommission = typeof u?.commissionBalance === 'number' ? u.commissionBalance : 0;
        const f0Volume = typeof u?.f0Volume === 'number' ? u.f0Volume : 0;
        const f0Count = typeof u?.refereesCount === 'number' ? u.refereesCount : 0;
        const loyaltyTier = typeof u?.loyaltyTier === 'string' ? u.loyaltyTier : 'Standard';

        return { totalCommission, f0Volume, f0Count, loyaltyTier };
    }, [user]);

    const username = useMemo(() => {
        const u = user as { username?: unknown } | null;
        return typeof u?.username === 'string' && u.username.length > 0 ? u.username : null;
    }, [user]);

    const [showBalance, setShowBalance] = useState(true);
    const [copiedDigest, setCopiedDigest] = useState<string | null>(null);
    const [copiedUsername, setCopiedUsername] = useState(false);

    const copyUsername = async () => {
        if (!username) return;
        try {
            await navigator.clipboard.writeText(`@${username}`);
            setCopiedUsername(true);
            toast.success('Copied!');
            setTimeout(() => setCopiedUsername(false), 2000);
        } catch (err) {
            console.error('Failed to copy username:', err);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg font-semibold">Not logged in</div>
                    <button className="btn-primary mt-4" onClick={() => navigate('/login')}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg font-semibold">Wallet not connected</div>
                    <div className="text-sm text-muted-foreground mt-1">Connect your Stellar wallet to view the Dashboard.</div>
                    <button className="btn-primary mt-4" onClick={() => navigate('/login')}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!username) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                    <div className="text-lg font-semibold">Loading profile</div>
                    <div className="text-sm text-muted-foreground mt-1">Please wait...</div>
                    <button
                        className="btn-ghost text-sm mt-4"
                        onClick={() => window.location.reload()}
                    >
                        Reload page
                    </button>
                </div>
            </div>
        );
    }

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Now';
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}k`;
        return `$${volume}`;
    };

    const copyDigest = async (digest: string) => {
        try {
            await navigator.clipboard.writeText(digest);
            setCopiedDigest(digest);
            setTimeout(() => setCopiedDigest(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Split balance into whole and decimal
    const balanceWhole = Math.floor(usdcBalance);
    const balanceDecimal = (usdcBalance - balanceWhole).toFixed(2).slice(1); // .00

    // Remove duplicates based on transaction ID
    const uniqueTransactions = Array.from(
        new Map(transactions.map(tx => [tx.id, tx])).values()
    );
    const recentTransactions = uniqueTransactions.slice(0, 3);

    return (
        <div className="app-container">
            <div className="page-wrapper">
                {/* Header - User Pill & Reward Badge */}
                <div className="flex items-center justify-between animate-fade-in pt-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-10 h-10 bg-secondary hover:bg-secondary/80 rounded-full transition-colors flex items-center justify-center"
                            title="Settings"
                        >
                            <span className="text-sm font-semibold">{username ? username[0].toUpperCase() : '?'}</span>
                        </button>
                        <button
                            onClick={copyUsername}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
                            title="Click to copy username"
                        >
                            <span className="font-medium text-sm">@{username}</span>
                            {copiedUsername ? (
                                <Check className="w-3.5 h-3.5 text-success" />
                            ) : (
                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                        </button>
                    </div>

                    {/* Reward Points Badge - Subtle */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full transition-colors hover:bg-secondary/80 cursor-default">
                        <span className="text-sm">🏆</span>
                        <span className="text-sm font-medium">{rewardPoints.toLocaleString()} pts</span>
                    </div>
                </div>

                {/* Balance Section */}
                <div className="py-8 text-center animate-slide-up">
                    {/* USDC Balance - Large */}
                    <div className="relative min-h-[48px] flex items-center justify-center">
                        <div className="flex items-baseline justify-center">
                            {showBalance ? (
                                <>
                                    <span className="balance-display">
                                        ${isLoadingBalance ? '...' : balanceWhole}
                                    </span>
                                    <span className="balance-decimal">
                                        {isLoadingBalance ? '' : balanceDecimal}
                                    </span>
                                </>
                            ) : (
                                <span className="balance-display">$•••••</span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowBalance(!showBalance)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* XLM Balance - Small Gray */}
                    <p className="text-sm text-muted-foreground mt-1 min-h-[20px]">
                        {showBalance ? `${xlmBalance.toFixed(4)} XLM` : '••• XLM'}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 animate-slide-up stagger-1">
                    <button
                        onClick={() => navigate('/send')}
                        className="btn-pill-primary flex-1 max-w-[140px] min-w-[120px]"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Send
                    </button>
                    <button
                        onClick={() => navigate('/receive')}
                        className="btn-pill-secondary flex-1 max-w-[140px] min-w-[120px]"
                    >
                        <ArrowDownLeft className="w-4 h-4" />
                        Receive
                    </button>
                </div>

                {/* Referral Stats Card */}
                <div className="mt-6 animate-slide-up stagger-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="section-title mb-0">Affiliate Performance</h3>
                    </div>
                    <div className="card-modern">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            {/* Commission */}
                            <div className="py-2">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Award className="w-4 h-4 text-success" />
                                </div>
                                <p className="text-lg font-bold">${referralStats.totalCommission}</p>
                                <p className="text-xs text-muted-foreground">Earned</p>
                            </div>
                            {/* Tier */}
                            <div className="py-2 border-l border-r border-border">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Crown className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{referralStats.loyaltyTier}</p>
                                    <p className="text-xs text-muted-foreground">Tier</p>
                                </div>
                            </div>
                            {/* Network */}
                            <div className="py-2 relative group cursor-pointer" onClick={() => navigate('/leaderboard')}>
                                <div className="absolute inset-x-2 -top-2 -bottom-2 bg-secondary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-center justify-center gap-1.5 mb-1">
                                    <Users className="w-4 h-4 text-success" />
                                </div>
                                <p className="relative text-lg font-bold">{referralStats.f0Count}</p>
                                <p className="relative text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                                    Friends <span className="text-primary">→</span>
                                </p>
                            </div>
                        </div>

                        {/* How to Earn Points - Redesigned */}
                        <details className="mt-4 pt-4 border-t border-border group">
                            <summary className="text-sm font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-warning/10 flex items-center justify-center text-xs">💡</span>
                                How to Earn Points
                                <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-4 space-y-3">
                                {/* Transaction Frequency */}
                                <div className="rounded-lg bg-secondary/30 p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[10px]">📊</span>
                                        Transaction Frequency
                                    </p>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">3+ txns/day</span>
                                            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+50 pts</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">15+ txns/week</span>
                                            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+100 pts</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">50+ txns/month</span>
                                            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+300 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction Volume */}
                                <div className="rounded-lg bg-secondary/30 p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[10px]">💰</span>
                                        Transaction Volume
                                    </p>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Over $50 per txn</span>
                                        <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+10 pts</span>
                                    </div>
                                </div>

                                {/* Referrals */}
                                <div className="rounded-lg bg-secondary/30 p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[10px]">👥</span>
                                        Referrals
                                    </p>
                                    <p className="text-xs text-muted-foreground">Earn points for each qualified referral (3+ txns)</p>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>

                <div className="mt-6 animate-slide-up stagger-3">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="section-title mb-0">Transactions History</h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            See all →
                        </button>
                    </div>

                    <div className="card-modern space-y-1">
                        {recentTransactions.length > 0 ? (
                            recentTransactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`icon-circle ${tx.type === 'sent' ? 'bg-secondary' : 'bg-success/10'}`}>
                                            {tx.type === 'sent'
                                                ? <ArrowUpRight className="w-4 h-4" />
                                                : <ArrowDownLeft className="w-4 h-4 text-success" />
                                            }
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {tx.type === 'sent' ? 'Sent' : 'Received'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatTime(tx.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`font-semibold ${tx.type === 'sent' ? '' : 'text-success'}`}>
                                        {formatTransactionAmount(tx)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                No transactions yet
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
