import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { Copy, Check, ChevronLeft, Share2, ArrowDownLeft, Wallet, Building2, User } from 'lucide-react';
import { getDefaultPaymentMethod } from '@/services/api';
import { toast } from 'sonner';
import { BANK_BIN_MAP } from '@/constants/bankBins';

interface DefaultWalletInfo {
  type: 'onchain' | 'offchain';
  address?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

const Receive = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { username: walletUsername, isConnected } = useWallet();

  const username = (() => {
    const u = user as { username?: unknown } | null;
    return typeof u?.username === 'string' ? u.username : walletUsername;
  })();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [defaultWallet, setDefaultWallet] = useState<DefaultWalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDefault = async () => {
      try {
        const res = await getDefaultPaymentMethod();
        if (res.data?.walletType === 'offchain') {
          setDefaultWallet({
            type: 'offchain',
            bankName: res.data.bankName || '',
            accountNumber: res.data.accountNumber || '',
            accountName: res.data.accountName || '',
          });
        } else if (res.data?.walletType === 'onchain') {
          setDefaultWallet({
            type: 'onchain',
            address: res.data.address || '',
          });
        } else {
          setDefaultWallet(null);
        }
      } catch {
        setDefaultWallet(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefault();
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShare = async () => {
    const shareText = defaultWallet?.type === 'offchain'
      ? `Pay me via bank transfer:\n${defaultWallet.bankName}\nAccount: ${defaultWallet.accountNumber}\nName: ${defaultWallet.accountName}`
      : `Send me crypto:\nUsername: @${username}\nAddress: ${defaultWallet?.address}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        copyToClipboard(shareText, 'share');
      }
    } else {
      copyToClipboard(shareText, 'share');
    }
  };

  if (!isConnected || !username) {
    return (
      <div className="app-container">
        <div className="page-wrapper">
          <div className="flex items-center gap-2 mb-6 animate-fade-in">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Receive Payment</h1>
          </div>
          <div className="card-modern py-12 text-center animate-slide-up">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <ArrowDownLeft className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {!isConnected ? 'Wallet not connected.' : 'Loading profile...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const shortAddress = defaultWallet?.address
    ? `${defaultWallet.address.slice(0, 8)}...${defaultWallet.address.slice(-6)}`
    : '';

  const getVietQRImageUrl = () => {
    if (!defaultWallet || defaultWallet.type !== 'offchain') return null;
    const bankBin = BANK_BIN_MAP[defaultWallet.bankName || ''];
    if (!bankBin || !defaultWallet.accountNumber) return null;
    const accountNameEncoded = encodeURIComponent(defaultWallet.accountName || '');
    return `https://img.vietqr.io/image/${bankBin}-${defaultWallet.accountNumber}-compact.png?accountName=${accountNameEncoded}`;
  };

  const vietQRUrl = getVietQRImageUrl();

  return (
    <div className="app-container">
      <div className="page-wrapper">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 animate-fade-in">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Receive Payment</h1>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading payment info...</p>
          </div>
        ) : !defaultWallet ? (
          <div className="card-modern p-8 text-center animate-slide-up">
            <div className="icon-circle-secondary w-16 h-16 mx-auto mb-4">
              <ArrowDownLeft className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Payment Method Set</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Set a default wallet or bank account to receive payments
            </p>
            <button onClick={() => navigate('/settings')} className="btn-primary">
              Go to Settings
            </button>
          </div>
        ) : (
          <div className="space-y-5">


            {/* QR Code for Bank */}
            {defaultWallet.type === 'offchain' && vietQRUrl && (
              <div className="animate-slide-up">
                <p className="section-title">QR Code</p>
                <div className="card-modern p-6 flex flex-col items-center">
                  <img
                    src={vietQRUrl}
                    alt="VietQR Code"
                    className="w-60 h-auto object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      // Show fallback text in the parent container
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <p className="text-sm text-muted-foreground mt-3 hidden">QR code unavailable. Share details manually.</p>
                  <p className="text-xs text-muted-foreground mt-3">Scan to pay via bank transfer</p>
                </div>
              </div>
            )}

            {/* Payment Info Card */}
            <div className="animate-slide-up stagger-1">
              <p className="section-title">Payment Details</p>
              <div className="card-modern divide-y divide-border overflow-hidden">
                {/* Username - Always shown */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => copyToClipboard(`@${username}`, 'username')}
                >
                  <div className="flex items-center gap-3">
                    <div className="icon-circle bg-secondary flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Username</p>
                      <p className="font-semibold text-base mt-0.5">@{username}</p>
                    </div>
                  </div>
                  {copiedField === 'username' ? (
                    <Check className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <Copy className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>

                {defaultWallet.type === 'onchain' ? (
                  /* Wallet Address */
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => defaultWallet.address && copyToClipboard(defaultWallet.address, 'address')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="icon-circle bg-secondary flex-shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Wallet Address</p>
                        <p className="font-mono text-sm mt-0.5">{shortAddress}</p>
                      </div>
                    </div>
                    {copiedField === 'address' ? (
                      <Check className="w-5 h-5 text-success flex-shrink-0" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ) : (
                  /* Bank Details */
                  <>
                    <div className="flex items-center gap-3 p-4">
                      <div className="icon-circle bg-secondary flex-shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Bank</p>
                        <p className="font-medium mt-0.5">{defaultWallet.bankName}</p>
                      </div>
                    </div>
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => defaultWallet.accountNumber && copyToClipboard(defaultWallet.accountNumber, 'account')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="icon-circle bg-secondary flex-shrink-0">
                          <Copy className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Account Number</p>
                          <p className="font-mono font-semibold text-lg mt-0.5">{defaultWallet.accountNumber}</p>
                        </div>
                      </div>
                      {copiedField === 'account' ? (
                        <Check className="w-5 h-5 text-success flex-shrink-0" />
                      ) : (
                        <Copy className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {defaultWallet.accountName && (
                      <div className="flex items-center gap-3 p-4">
                        <div className="icon-circle bg-secondary flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Account Name</p>
                          <p className="font-medium mt-0.5">{defaultWallet.accountName}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Share Button */}
            <div className="animate-slide-up stagger-2">
              <button
                onClick={handleShare}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Share Payment Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receive;
