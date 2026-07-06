import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Copy, Check } from 'lucide-react';
import { getConfiguredStellarNetwork, getStellarExplorerTxUrl } from '@/lib/stellar';
import { formatTransactionAmount } from '@/lib/transactions';

const History = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading } = useAuth();
    const {
        transactions,
        isLoadingBalance,
        refreshBalance,
    } = useWallet();

    const [copiedDigest, setCopiedDigest] = useState<string | null>(null);
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthLoading, isAuthenticated, navigate]);

    if (isAuthLoading) {
        return (
            <div className="app-container">
                <div className="page-wrapper">
                    <div className="card-modern py-8 text-center text-muted-foreground text-sm">Loading...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('vi-VN');
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

    const formatAmount = (tx: typeof transactions[number]) => {
        return formatTransactionAmount(tx);
    };

    const formatAddress = (address?: string) => {
        if (!address) return 'Unknown';
        if (address.length <= 16) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    };

    const selectedTx = transactions.find((tx) => tx.id === selectedTxId) ?? null;

    if (selectedTx) {
        const txHash = selectedTx.digest || selectedTx.id;
        const explorerUrl = getStellarExplorerTxUrl(txHash, getConfiguredStellarNetwork());

        return (
            <div className="app-container">
                <div className="page-wrapper">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedTxId(null)}
                                className="p-2 border border-border rounded-xl hover:bg-secondary transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-bold">Transaction Detail</h1>
                        </div>
                    </div>

                    <div className="card-modern divide-y divide-border">
                        <div className="flex justify-between items-center py-3">
                            <span className="text-muted-foreground text-sm">Status</span>
                            <span className="text-success font-medium text-sm">Success</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-muted-foreground text-sm">Type</span>
                            <span className="font-medium text-sm">{selectedTx.type === 'sent' ? 'Sent' : 'Received'}</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-muted-foreground text-sm">Amount</span>
                            <span className={`font-semibold text-sm ${selectedTx.type === 'received' ? 'text-success' : 'text-foreground'}`}>
                                {formatAmount(selectedTx)}
                            </span>
                        </div>
                        <div className="flex justify-between items-start py-3 gap-4">
                            <span className="text-muted-foreground text-sm">{selectedTx.type === 'sent' ? 'To' : 'From'}</span>
                            <span className="font-mono text-xs text-right break-all">
                                {selectedTx.type === 'sent' ? selectedTx.to || 'Unknown' : selectedTx.from || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-muted-foreground text-sm">Token</span>
                            <span className="font-medium text-sm">{selectedTx.token}</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-muted-foreground text-sm">Time</span>
                            <span className="font-medium text-sm">{selectedTx.timestamp.toLocaleString('en-GB')}</span>
                        </div>
                        <div className="py-3">
                            <div className="flex justify-between items-center gap-3 mb-2">
                                <span className="text-muted-foreground text-sm">Transaction hash</span>
                                <button
                                    onClick={() => copyDigest(txHash)}
                                    className="p-1 hover:bg-secondary rounded transition-colors"
                                >
                                    {copiedDigest === txHash ? (
                                        <Check className="w-4 h-4 text-success" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            </div>
                            <p className="font-mono text-xs break-all">{txHash}</p>
                        </div>
                    </div>

                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary mt-6 block text-center"
                    >
                        View on Stellar Explorer
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <div className="page-wrapper">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 border border-border rounded-xl hover:bg-secondary transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold">Transaction History</h1>
                    </div>
                    <button
                        onClick={() => refreshBalance()}
                        disabled={isLoadingBalance}
                        className="p-2 border border-border rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Transactions List */}
                <div className="flex-1">
                    {isLoadingBalance && transactions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            Loading transactions...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <p className="text-lg mb-2">No transactions yet</p>
                            <p className="text-sm">Your transactions will appear here</p>
                        </div>
                    ) : (
                        <div className="card-modern space-y-1">
                            {transactions.map((tx) => {
                                // Use tx.id as digest (real blockchain txs store hash in id)
                                const txHash = tx.digest || tx.id;
                                const truncatedHash = txHash.length > 12
                                    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
                                    : txHash;

                                return (
                                    <div
                                        key={tx.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedTxId(tx.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                setSelectedTxId(tx.id);
                                            }
                                        }}
                                        className="w-full flex items-center justify-between py-3 text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`icon-circle ${tx.type === 'sent' ? 'bg-secondary' : 'bg-success/10'}`}>
                                                {tx.type === 'sent'
                                                    ? <ArrowUpRight className="w-5 h-5" />
                                                    : <ArrowDownLeft className="w-5 h-5 text-success" />
                                                }
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-medium text-sm">
                                                        {tx.type === 'sent' ? 'Sent' : 'Received'}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <a
                                                            href={getStellarExplorerTxUrl(txHash, getConfiguredStellarNetwork())}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(event) => event.stopPropagation()}
                                                            className="text-xs text-muted-foreground font-mono hover:text-foreground hover:underline transition-colors"
                                                        >
                                                            {truncatedHash}
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                copyDigest(txHash);
                                                            }}
                                                            className="p-0.5 hover:bg-secondary rounded transition-colors"
                                                        >
                                                            {copiedDigest === txHash ? (
                                                                <Check className="w-3 h-3 text-success" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {tx.type === 'sent' ? `To ${formatAddress(tx.to)}` : `From ${formatAddress(tx.from)}`} • {formatTime(tx.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className={`font-semibold flex-shrink-0 ${tx.type === 'sent' ? 'text-foreground' : 'text-success'}`}>
                                            {formatAmount(tx)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
