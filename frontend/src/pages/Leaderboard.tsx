import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Check, Clock, Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Referee {
    username: string;
    registeredAt: string;
    transactionCount: number;
    bonusGranted: boolean;
}

interface ReferralInfo {
    totalReferrals: number;
    successfulReferrals: number;
    estimatedPointsFromReferrals: number;
    maxReferralPoints: number;
    referees: Referee[];
}

const Leaderboard = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthLoading, isAuthenticated, navigate]);

    useEffect(() => {
        const fetchReferralInfo = async () => {
            try {
                setIsLoading(true);
                const response = await api.get('/users/referral-info');
                setReferralInfo(response.data);
            } catch (err) {
                console.error('Failed to fetch referral info:', err);
                setError('Failed to load referral info');
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchReferralInfo();
        }
    }, [isAuthenticated]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="app-container">
            <div className="page-wrapper">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6 animate-fade-in">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold">My Friends</h1>
                </div>

                {/* Stats Summary */}
                {referralInfo && (
                    <div className="card-modern mb-6 animate-slide-up">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold">{referralInfo.totalReferrals}</p>
                                <p className="text-xs text-muted-foreground">Total Referrals</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-success">{referralInfo.successfulReferrals}</p>
                                <p className="text-xs text-muted-foreground">Qualified (3+ txn)</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border text-center">
                            <p className="text-sm text-muted-foreground">
                                Earned <span className="font-semibold text-foreground">{referralInfo.estimatedPointsFromReferrals}</span> / {referralInfo.maxReferralPoints} referral points
                            </p>
                        </div>
                    </div>
                )}

                {/* Friends List */}
                <div className="animate-slide-up stagger-1">
                    <h3 className="section-title">Referred Friends</h3>

                    {isLoading ? (
                        <div className="card-modern py-12 text-center">
                            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                    ) : error ? (
                        <div className="card-modern py-8 text-center text-destructive">
                            {error}
                        </div>
                    ) : referralInfo?.referees.length === 0 ? (
                        <div className="card-modern py-12 text-center">
                            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No referrals yet</p>
                            <p className="text-sm text-muted-foreground mt-1">Share your username to invite friends!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {referralInfo?.referees.map((referee) => (
                                <div
                                    key={referee.username}
                                    className="card-modern flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-lg">
                                            {referee.username[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="font-medium">@{referee.username}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Joined {formatDate(referee.registeredAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5">
                                            {referee.bonusGranted ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/10 text-success">
                                                    <Check className="w-3 h-3" />
                                                    Qualified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning/10 text-warning">
                                                    <Clock className="w-3 h-3" />
                                                    {referee.transactionCount}/3 txn
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
