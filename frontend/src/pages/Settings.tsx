import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Building2, Scan, Check, Trash2, Shield, LogOut, Loader2, AlertTriangle, ChevronLeft, Copy } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { toast } from 'sonner';
import {
  addOffchainBankByQr,
  addOnchainWallet,
  deleteOffchainBank,
  deleteOnchainWallet,
  getDefaultPaymentMethod,
  getKycLink,
  getKycStatus,
  listOffchainBanks,
  listOnchainWallets,
  scanQr,
  setDefaultPaymentMethod,
} from '@/services/api';


interface ScannedBankData {
  bankName: string;
  accountNumber: string;
  beneficiaryName: string;
}

type ApiWallet = {
  walletId: string;
  address: string;
  label?: string | null;
};

type ApiWalletListResponse = {
  wallets?: ApiWallet[];
};

type ApiErrorWithResponse = {
  response?: {
    status?: number;
  };
};

type ApiBank = {
  bankId: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  label?: string | null;
};

const Settings = () => {
  const navigate = useNavigate();
  const { logout, isAuthenticated, user } = useAuth();
  const apiUsername = (() => {
    const u = user as { username?: unknown } | null;
    return typeof u?.username === 'string' ? u.username : null;
  })();
  const { username, disconnect, coins, isLoadingBalance, refreshBalance, walletAddress } = useWallet();

  const [linkedBanks, setLinkedBanks] = useState<ApiBank[]>([]);
  const [linkedWallets, setLinkedWallets] = useState<ApiWallet[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [defaultAccountType, setDefaultAccountType] = useState<'wallet' | 'bank'>('wallet');
  // Get kycStatus directly from user profile - no flicker
  const kycStatus = (() => {
    const u = user as { kycStatus?: unknown } | null;
    const status = typeof u?.kycStatus === 'string' ? u.kycStatus : 'unverified';
    // Map 'approved' to 'verified'
    if (status === 'approved') return 'verified';
    if (status === 'pending' || status === 'verified') return status;
    return 'unverified';
  })() as 'unverified' | 'pending' | 'verified';
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string>('');

  const walletAddressForKyc = (() => {
    const u = user as { walletAddress?: unknown; address?: unknown } | null;
    const addr = (typeof u?.walletAddress === 'string' && u.walletAddress.trim())
      ? u.walletAddress.trim()
      : (typeof u?.address === 'string' && u.address.trim())
        ? u.address.trim()
        : null;
    return addr;
  })();

  const [view, setView] = useState<'main' | 'add-wallet' | 'add-bank'>('main');
  const [showScanner, setShowScanner] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [scannedBankQr, setScannedBankQr] = useState<string | null>(null);
  const [scannedBank, setScannedBank] = useState<ScannedBankData | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const autoSaveAttempted = useRef<string | null>(null);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);

  // Create unified display list: include connected Stellar wallet if not already in linkedWallets
  // Memoized to prevent infinite re-render loops in the auto-save useEffect
  const displayWallets = useMemo(() => {
    const wallets = [...linkedWallets];
    const currentAddress = walletAddress;

    if (currentAddress) {
      const isCurrentInList = linkedWallets.some(w => w.address.toLowerCase() === currentAddress.toLowerCase());
      if (!isCurrentInList) {
        wallets.push({
          walletId: 'current-session',
          address: currentAddress,
          label: 'Main Wallet',
        });
      }
    }
    return wallets;
  }, [linkedWallets, walletAddress]);

  const displayedCoins = useMemo(() => {
    return coins.filter((coin) => coin.symbol === 'XLM' || coin.symbol === 'USDC');
  }, [coins]);

  // Auto-save session wallet if it's the only one
  useEffect(() => {
    const autoSave = async () => {
      // If we have exactly 1 wallet and it's a temporary session one
      if (displayWallets.length === 1 && displayWallets[0].walletId === 'current-session' && displayWallets[0].address) {
        // Guard: don't re-attempt for the same address
        if (autoSaveAttempted.current === displayWallets[0].address) return;
        // We only trigger this if we aren't already loading/processing
        if (!isLoadingSettings) {
          autoSaveAttempted.current = displayWallets[0].address;
          await handleSetDefault('current-session', 'wallet', displayWallets[0].address);
        }
      }
    };
    autoSave();
  }, [displayWallets, isLoadingSettings]);

  const refreshSettings = async () => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      const [walletsRes, banksRes, defaultRes] = await Promise.all([
        listOnchainWallets(),
        listOffchainBanks(),
        getDefaultPaymentMethod(),
      ]);

      const walletsData = (walletsRes as { data?: unknown })?.data;
      const walletsList = Array.isArray(walletsData)
        ? walletsData
        : (walletsData && typeof walletsData === 'object' && 'wallets' in (walletsData as Record<string, unknown>) && Array.isArray((walletsData as Record<string, unknown>).wallets))
          ? ((walletsData as Record<string, unknown>).wallets as unknown[])
          : [];

      const banksData = (banksRes as { data?: unknown })?.data;
      const banksList = Array.isArray(banksData)
        ? banksData
        : (banksData && typeof banksData === 'object' && 'banks' in (banksData as Record<string, unknown>) && Array.isArray((banksData as Record<string, unknown>).banks))
          ? ((banksData as Record<string, unknown>).banks as unknown[])
          : [];

      setLinkedWallets(walletsList as ApiWallet[]);
      setLinkedBanks(banksList as ApiBank[]);

      const defaultWalletId = defaultRes.data?.walletId ?? null;
      const defaultWalletType = defaultRes.data?.walletType ?? null;
      if (defaultWalletId && defaultWalletType) {
        setDefaultAccountId(defaultWalletId);
        const accountType = defaultWalletType === 'onchain' ? 'wallet' : 'bank';
        setDefaultAccountType(accountType);

        // Refresh balance with the correct wallet address
        if (accountType === 'wallet') {
          const targetWallet = (walletsList as ApiWallet[]).find(w => w.walletId === defaultWalletId);
          if (targetWallet) {
            refreshBalance(targetWallet.address);
          }
        }
      } else {
        setDefaultAccountId(null);
        setDefaultAccountType('wallet');
        // Refresh with connected wallet (default behavior)
        refreshBalance();
      }
      // KYC status is now read directly from user object - no API call needed
    } catch (e) {
      console.error('Failed to load settings', e);
      setSettingsError('Failed to load settings');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  // API parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const handleDisconnect = () => {
    disconnect();
    logout();
    navigate('/login');
  };

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletAddress) return;

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await addOnchainWallet({
        address: newWalletAddress,
        chain: 'Stellar',
        label: newWalletName,
      });
      await refreshSettings();
      setNewWalletName('');
      setNewWalletAddress('');
      setView('main');
    } catch (e) {
      console.error('Failed to add wallet', e);
      setSettingsError('Failed to add wallet');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleScanBank = async (qrString: string) => {
    setShowScanner(false);
    setIsParsing(true);
    setParseError('');
    setScannedBank(null);
    setScannedBankQr(qrString);

    try {
      const res = await scanQr(qrString);
      const payload = res.data as unknown;

      const bankInfo =
        payload && typeof payload === 'object' && 'bankInfo' in (payload as Record<string, unknown>)
          ? (payload as Record<string, unknown>).bankInfo
          : undefined;

      const bankName =
        bankInfo && typeof bankInfo === 'object' && 'bankName' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).bankName
          : undefined;
      const accountNumber =
        bankInfo && typeof bankInfo === 'object' && 'accountNumber' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).accountNumber
          : undefined;
      const beneficiaryName =
        bankInfo && typeof bankInfo === 'object' && 'accountName' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).accountName
          : undefined;

      if (typeof bankName === 'string' && typeof accountNumber === 'string' && typeof beneficiaryName === 'string') {
        setScannedBank({ bankName, accountNumber, beneficiaryName });
      } else {
        setParseError('Invalid QR Code. Please scan a valid bank QR.');
      }
    } catch (error) {
      console.error('Bank QR parsing error:', error);
      setParseError('Failed to parse QR code');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddBank = async () => {
    if (!scannedBank) return;

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await addOffchainBankByQr({
        qrString: scannedBankQr ?? '',
        label: scannedBank.bankName,
      });
      await refreshSettings();
      setScannedBank(null);
      setParseError('');
      setView('main');
    } catch (e) {
      console.error('Failed to add bank account', e);
      setSettingsError('Failed to add bank account');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const isDefault = (id: string, type: 'wallet' | 'bank') =>
    defaultAccountId === id && defaultAccountType === type;

  const handleRemoveWallet = async (id: string) => {
    if (isDefault(id, 'wallet')) {
      toast.error('Cannot remove default wallet', {
        description: 'Please set another wallet as default first.'
      });
      return;
    }

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await deleteOnchainWallet(id);
      await refreshSettings();
    } catch (e) {
      console.error('Failed to remove wallet', e);
      setSettingsError('Failed to remove wallet');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSetDefault = async (id: string, type: 'wallet' | 'bank', address?: string) => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      let walletId = id;

      // If it's a session wallet (not in DB), add it first
      if (id === 'current-session' && address) {
        const result = await addOnchainWallet({
          address,
          chain: 'Stellar',
          label: 'Main Wallet',
          walletProvider: 'Freighter',
        });
        // Get the new wallet ID from the response
        // Get the new wallet ID from the response (backend returns walletId)
        const newWalletId = (result.data as { walletId?: string; id?: string })?.walletId || (result.data as { id?: string })?.id;
        if (newWalletId) {
          walletId = newWalletId;
        }
        await refreshSettings();
      }

      await setDefaultPaymentMethod({
        walletId,
        walletType: type === 'wallet' ? 'onchain' : 'offchain',
      });
      await refreshSettings();

      // Immediately refresh balance with the correct address
      if (type === 'wallet' && address) {
        refreshBalance(address);
      } else if (type === 'wallet') {
        // Find the wallet address from linkedWallets
        const targetWallet = linkedWallets.find(w => w.walletId === walletId);
        if (targetWallet) {
          refreshBalance(targetWallet.address);
        }
      }
      // For bank type, don't refresh balance (banks don't have crypto)
    } catch (e: unknown) {
      const err = e as ApiErrorWithResponse;
      // Handle 409 Conflict (Wallet already exists)
      if (err.response?.status === 409 && address) {
        try {
          // Fetch fresh list to find the existing wallet ID
          const response = await listOnchainWallets();
          const wallets = ((response.data as ApiWalletListResponse)?.wallets || []) as ApiWallet[];
          const existing = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());

          if (existing) {
            // Retry set default with existing ID
            await setDefaultPaymentMethod({
              walletId: existing.walletId,
              walletType: 'onchain',
            });
            await refreshSettings();
            refreshBalance(address); // Refresh with the correct wallet address
            return; // Success
          } else {
            // Wallet exists but not in our list -> belongs to another user
            toast.error('Wallet already connected to another account');
          }
        } catch (retryErr) {
          console.error('Failed to retry set default after 409:', retryErr);
          toast.error('Failed to set default wallet');
        }
      }

      setSettingsError('Failed to set default account');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleRemoveBank = async (id: string) => {
    if (isDefault(id, 'bank')) {
      toast.error('Cannot remove default bank account', {
        description: 'Please set another account as default first.'
      });
      return;
    }

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await deleteOffchainBank(id);
      await refreshSettings();
    } catch (e) {
      console.error('Failed to remove bank', e);
      setSettingsError('Failed to remove bank account');
    } finally {
      setIsLoadingSettings(false);
    }
  };
  const handleStartKyc = async () => {
    if (!walletAddressForKyc) {
      setSettingsError('No wallet address found for KYC');
      return;
    }

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      const res = await getKycLink({ walletAddress: walletAddressForKyc });
      const url = res.data?.kycLink || res.data?.url;
      if (url) {
        // Open in-app browser instead of new tab
        setKycUrl(url);
        setShowKycModal(true);
        // KYC status will update when user refreshes/re-fetches profile
      } else {
        setSettingsError('Failed to get KYC link');
      }
    } catch (e) {
      setSettingsError('Failed to start KYC');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Handle wallet QR scan - reject bank QRs, only accept wallet addresses
  const handleScanWallet = async (qrString: string) => {
    setShowScanner(false);
    setIsParsing(true);
    setParseError('');

    try {
      const trimmed = qrString.trim();

      // Check if it's a HiddenWallet QR (username)
      if (trimmed.startsWith('@') || trimmed.toLowerCase().startsWith('hiddenwallet:')) {
        setParseError('This is a HiddenWallet username QR. Please scan a wallet address QR.');
        setIsParsing(false);
        return;
      }

      // Check if it's a valid Stellar public key
      if (/^G[A-Z2-7]{55}$/.test(trimmed)) {
        setNewWalletAddress(trimmed);
        setIsParsing(false);
        return;
      }

      // Ask BE to scan (to distinguish Bank QR vs garbage)
      try {
        const res = await scanQr(qrString);
        const payload = res.data as unknown;
        const isBankPayload =
          !!payload &&
          typeof payload === 'object' &&
          'bankName' in (payload as Record<string, unknown>) &&
          'accountNumber' in (payload as Record<string, unknown>) &&
          'beneficiaryName' in (payload as Record<string, unknown>);

        if (isBankPayload) {
          setParseError('This is a Bank QR code. Please scan a wallet address QR instead.');
          setIsParsing(false);
          return;
        }
      } catch {
        // ignore
      }

      // Unknown QR format
      setParseError('Invalid QR. Please scan a valid Stellar wallet address (G...).');
    } catch (error) {
      console.error('Wallet QR parsing error:', error);
      setParseError('Failed to parse QR code. Please enter address manually.');
    } finally {
      setIsParsing(false);
    }
  };

  // Add Wallet View
  if (view === 'add-wallet') {
    return (
      <>
        <QRScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScanWallet}
          title="Scan Wallet QR"
        />
        <div className="app-container">
          <div className="page-wrapper">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 animate-fade-in">
              <h1 className="text-xl font-bold">Add Wallet</h1>
              <button
                onClick={() => { setView('main'); setParseError(''); setNewWalletAddress(''); setNewWalletName(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 space-y-4 animate-slide-up">
              {/* Scan QR Button */}
              <button
                onClick={() => setShowScanner(true)}
                disabled={isParsing}
                className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary/80 text-center font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Scan Wallet QR Code
                  </>
                )}
              </button>

              {/* Parse Error */}
              {parseError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium text-sm">{parseError}</p>
                </div>
              )}

              {/* Or Divider */}
              <div className="flex items-center gap-3 text-muted-foreground text-sm py-2">
                <div className="flex-1 h-px bg-border" />
                <span>or enter manually</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Input Card */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Wallet Name</label>
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="e.g. Trading Wallet"
                    className="input-modern w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Wallet Address</label>
                  <input
                    type="text"
                    value={newWalletAddress}
                    onChange={(e) => { setNewWalletAddress(e.target.value); setParseError(''); }}
                    placeholder="G..."
                    className="input-modern w-full font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddWallet}
              disabled={!newWalletName || !newWalletAddress}
              className="btn-primary mt-6"
            >
              Add Wallet
            </button>
          </div>
        </div>
      </>
    );
  }

  // Add Bank View
  if (view === 'add-bank') {
    return (
      <>
        <QRScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScanBank}
          title="Scan Bank QR"
        />
        <div className="app-container">
          <div className="page-wrapper">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 animate-fade-in">
              <h1 className="text-xl font-bold">Add Bank Account</h1>
              <button
                onClick={() => { setView('main'); setScannedBank(null); setParseError(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 space-y-4 animate-slide-up">
              {/* Scan QR Button */}
              <button
                onClick={() => setShowScanner(true)}
                disabled={isParsing}
                className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary/80 text-center font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Parsing QR...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Scan Bank QR Code
                  </>
                )}
              </button>

              {/* Parse Error */}
              {parseError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium text-sm">{parseError}</p>
                </div>
              )}

              {/* Scanned Bank Info */}
              {scannedBank && (
                <div className="rounded-xl border border-border overflow-hidden animate-slide-up">
                  {/* Success Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-success/10">
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-success font-medium text-sm">QR Parsed Successfully</span>
                  </div>

                  {/* Bank Details */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Bank</span>
                      <span className="font-medium">{scannedBank.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Account</span>
                      <span className="font-mono text-sm">{scannedBank.accountNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Name</span>
                      <span className="font-medium">{scannedBank.beneficiaryName}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!scannedBank && !parseError && (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Scan your bank's QR code to link it</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAddBank}
              disabled={!scannedBank}
              className="btn-primary mt-6"
            >
              Link Bank Account
            </button>
          </div>
        </div>
      </>
    );
  }

  // Main Settings View
  return (
    <>
      {/* KYC In-App Browser Modal */}
      {showKycModal && kycUrl && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
            <h2 className="font-semibold">Verify Identity</h2>
            <button
              onClick={() => {
                setShowKycModal(false);
                setKycUrl(null);
                refreshSettings();
              }}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          {/* Iframe */}
          <iframe
            src={kycUrl}
            className="flex-1 w-full border-0"
            allow="camera; microphone"
            title="KYC Verification"
          />
        </div>
      )}

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
            <h1 className="text-xl font-bold">Settings</h1>
          </div>

          {/* Profile */}
          <div className="pb-6 border-b border-border mb-6 animate-slide-up">
            <p className="label-caps mb-2">Username</p>
            <p className="display-medium">@{apiUsername ?? username ?? ''}</p>
          </div>


          {/* Wallets */}
          <div className="mb-6 animate-slide-up stagger-1">
            <p className="section-title">Stellar Wallets</p>
            <div className="rounded-xl border border-border overflow-hidden">
              {displayWallets.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No wallets found
                </div>
              ) : (
                displayWallets.map((wallet) => {
                  const isActiveWallet = walletAddress?.toLowerCase() === wallet.address.toLowerCase();
                  const isTemporary = wallet.walletId === 'current-session';
                  const isDefaultWallet = isDefault(wallet.walletId, 'wallet') || (!isLoadingSettings && displayWallets.length === 1 && linkedBanks.length === 0 && !defaultAccountId);

                  return (
                    <div key={wallet.walletId} className="border-b border-border last:border-b-0">
                      <div className="row-item px-4">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5" />
                          <div>
                            <p className="font-medium">{wallet.label || 'Wallet'}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {wallet.address.slice(0, 8)}...{wallet.address.slice(-4)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(wallet.address);
                              setCopiedWalletId(wallet.walletId);
                              setTimeout(() => setCopiedWalletId(null), 2000);
                            }}
                            className="p-2 hover:bg-secondary rounded-full transition-colors"
                            title="Copy Address"
                          >
                            {copiedWalletId === wallet.walletId ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <div className="h-4 w-px bg-border mx-1" />

                          {isDefaultWallet ? (
                            <span className="tag-success">Default</span>
                          ) : (
                            <button
                              onClick={() => handleSetDefault(wallet.walletId, 'wallet', wallet.address)}
                              className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
                            >
                              Set Default
                            </button>
                          )}
                          {!isActiveWallet && displayWallets.length > 1 && !isTemporary && (
                            <button
                              onClick={() => handleRemoveWallet(wallet.walletId)}
                              className="p-2 hover:bg-destructive/10 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline balance for default wallet */}
                      {isDefaultWallet && defaultAccountType !== 'bank' && (
                        <div className="px-4 pb-3 pt-1 bg-secondary/30">
                          {isLoadingBalance ? (
                            <p className="text-xs text-muted-foreground">Loading balance...</p>
                          ) : displayedCoins.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No XLM/USDC found</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {displayedCoins.map((coin) => (
                                <div key={coin.coinType} className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1 text-xs">
                                  {coin.iconUrl ? (
                                    <>
                                      <img
                                        src={coin.iconUrl}
                                        alt={coin.symbol}
                                        className="w-4 h-4 rounded-full"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                          if (fallback) {
                                            fallback.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      <span
                                        className="hidden w-4 h-4 rounded-full bg-secondary items-center justify-center text-[10px] font-bold"
                                      >
                                        {coin.symbol[0]}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">{coin.symbol[0]}</span>
                                  )}
                                  <span className="font-medium">
                                    {coin.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {coin.symbol}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <button
                onClick={() => setView('add-wallet')}
                className="w-full py-4 text-center font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Add Wallet
              </button>
            </div>
          </div>

          {/* Banks */}
          <div className="mb-6 animate-slide-up stagger-2">
            <p className="section-title">Bank Accounts</p>
            <div className="rounded-xl border border-border overflow-hidden">
              {linkedBanks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No banks linked
                </div>
              ) : (
                (linkedBanks || []).map((bank) => (
                  <div key={bank.bankId} className="row-item px-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{bank.label || bank.bankName}</p>
                        <p className="text-sm text-muted-foreground">
                          ****{bank.accountNumber.slice(-4)} · {bank.accountName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDefault(bank.bankId, 'bank') ? (
                        <span className="tag-success">Default</span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(bank.bankId, 'bank')}
                          className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveBank(bank.bankId)}
                        className="p-2 hover:bg-destructive/10 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={() => setView('add-bank')}
                className="w-full py-4 text-center font-medium hover:bg-secondary transition-colors border-t border-border flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                Add Bank Account
              </button>
            </div>
          </div>

          {/* KYC - Hide completely if verified */}
          {kycStatus !== 'verified' && (
            <div className="mb-6 animate-slide-up stagger-3">
              <p className="section-title">Identity</p>
              <div className="rounded-xl border border-border p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <div>
                      <p className="font-medium">KYC Verification</p>
                      <p className="text-sm text-muted-foreground">Verify for higher limits</p>
                    </div>
                  </div>
                  {kycStatus === 'pending' ? (
                    <span className="tag-warning">Pending</span>
                  ) : (
                    <span className="tag">Unverified</span>
                  )}
                </div>
                <button
                  onClick={handleStartKyc}
                  disabled={isLoadingSettings || !walletAddressForKyc || kycStatus === 'pending'}
                  className="w-full py-3 mt-4 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  {kycStatus === 'pending' ? 'Verification in Progress' : 'Start KYC'}
                </button>
              </div>
            </div>
          )}



          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full py-4 rounded-xl text-destructive text-center font-medium border border-destructive hover:bg-destructive hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Disconnect
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            HiddenWallet v1.0 · Stellar {import.meta.env.VITE_STELLAR_NETWORK === 'PUBLIC' ? 'Mainnet' : 'Testnet'}
          </p>
        </div>
      </div>
    </>
  );
};

export default Settings;
