import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { Copy, Check, LogOut, Wallet, ChevronRight } from 'lucide-react';
import { getApiErrorMessage } from '@/services/api';

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isSmallScreen = window.innerWidth <= 768;
  return mobileRegex.test(userAgent.toLowerCase()) || isSmallScreen;
};

const isInFreighterBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('freighter');
};

const Login = () => {
  const navigate = useNavigate();
  const { connect, disconnect, walletAddress } = useWallet();
  const [hasClickedConnect, setHasClickedConnect] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isInWalletBrowser, setIsInWalletBrowser] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const { loginWithWallet, isAuthLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const activeAddress = walletAddress;

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInWalletBrowser(isInFreighterBrowser());
  }, []);

  useEffect(() => {
    if (!hasClickedConnect) return;
    if (!walletAddress) return;
    setShowWalletOptions(true);
  }, [walletAddress, hasClickedConnect]);



  const handleConnectClick = async () => {
    // If already connected, show options instead of auto-navigating
    if (activeAddress) {
      setShowWalletOptions(true);
      return;
    }
    setHasClickedConnect(true);
    setAuthError(null);
    try {
      await connect();
      setShowWalletOptions(true);
    } catch (err) {
      setAuthError(getApiErrorMessage(err, 'Failed to connect Freighter'));
    }
  };

  const handleAuthLogin = async () => {
    setAuthError(null);
    try {
      const { needsOnboarding } = await loginWithWallet();
      navigate(needsOnboarding ? '/onboarding' : '/dashboard');
    } catch (err) {
      setAuthError(getApiErrorMessage(err, 'Login failed'));
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowWalletOptions(false);
  };

  const copyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const showMobileInstructions = isMobile && !isInWalletBrowser;

  return (
    <div className="app-container">
      <div className="page-wrapper justify-between">
        {/* Top spacer */}
        <div className="pt-16" />

        {/* Center content */}
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">HiddenWallet</h1>
          <p className="text-muted-foreground">
            Send money instantly with Stellar
          </p>
        </div>

        {/* Bottom section */}
        <div className="space-y-4 animate-slide-up pb-6">
          {/* Priority: Show connected options first, then mobile instructions, then default */}
          {activeAddress ? (
            /* Connected Wallet Options Card */
            <div className="card-modern p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Connected Wallet</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
                  </p>
                </div>
              </div>

              {authError && (
                <p className="text-destructive text-sm text-center bg-destructive/10 py-2 rounded-xl">{authError}</p>
              )}

              <button
                onClick={handleAuthLogin}
                disabled={isAuthLoading}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {isAuthLoading ? 'Signing...' : 'Continue to App'}
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full py-3 rounded-xl border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </button>
            </div>
          ) : showMobileInstructions ? (
            /* Mobile: Show instructions when not connected */
            <>
              <div className="card-modern p-5 space-y-4">
                <p className="text-sm font-medium text-center">
                  Open in Freighter Wallet to connect
                </p>

                <button
                  onClick={copyAppLink}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy App Link
                    </>
                  )}
                </button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <span>Open <strong className="text-foreground">Freighter Wallet</strong></span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <span>Go to <strong className="text-foreground">Apps</strong> tab</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <span>Paste link & tap <strong className="text-foreground">Connect</strong></span>
                  </div>
                </div>
              </div>

              <button onClick={handleConnectClick} className="btn-primary">
                Connect Freighter
              </button>
            </>
          ) : (
            <button onClick={handleConnectClick} className="btn-primary">
              Connect Freighter
            </button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className="font-medium">Stellar</span> & <span className="font-medium">Gaian</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
