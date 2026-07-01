import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { checkUsername, postOnboarding, postRegister } from '@/services/api';
import { toast } from 'sonner';
import { Mail, Users } from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();
  const { isAuthenticated, refreshProfile } = useAuth();
  const { setUsername, username: existingUsername, walletAddress } = useWallet();
  const [inputUsername, setInputUsername] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (existingUsername) {
      navigate('/dashboard');
    }
  }, [existingUsername, isAuthenticated, navigate]);

  if (!isAuthenticated || existingUsername) {
    return null;
  }

  const handleSubmit = async () => {
    const clean = inputUsername.replace('@', '').trim().toLowerCase();

    if (clean.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(clean)) {
      setError('Only letters, numbers, and underscores allowed');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      const res = await checkUsername(clean);
      const available = Boolean(res.data?.available);
      if (!available) {
        setError('Username already taken');
        return;
      }

      await postOnboarding({
        username: clean,
        email: email || undefined,
        referralUsername: referral || undefined,
      });

      if (!walletAddress) {
        throw new Error('No wallet connected');
      }

      try {
        await postRegister({
          walletAddress,
          username: clean,
          email: email || undefined,
        });
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        const status = e?.response?.status;
        const message = typeof e?.message === 'string' ? e.message : '';

        if (status !== 409 && !message.includes('status code 409')) {
          throw err;
        }
      }

      setUsername(clean);

      // Refresh profile to sync user data with AuthContext
      // Use a flag to prevent double navigation from timeout + normal flow
      let hasNavigated = false;
      const redirectTimeout = setTimeout(() => {
        if (!hasNavigated) {
          hasNavigated = true;
          toast.info('Taking longer than expected...');
          navigate('/dashboard');
        }
      }, 5000);

      try {
        await refreshProfile();
      } catch {
        // Profile refresh failed, but user is created - proceed anyway
        console.warn('Profile refresh failed, proceeding to dashboard');
      }

      clearTimeout(redirectTimeout);
      if (!hasNavigated) {
        hasNavigated = true;
        navigate('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onboarding failed';
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page-wrapper justify-between">
        {/* Top */}
        <div className="pt-12 animate-fade-in">
          <p className="label-caps mb-4">Almost there</p>
          <h1 className="display-medium">Choose your<br />username</h1>
        </div>

        {/* Middle */}
        <div className="py-6 animate-slide-up w-full max-w-full overflow-hidden space-y-6">
          {/* Username Input */}
          <div>
            <div className="flex items-center w-full min-w-0">
              <span className="text-2xl font-bold mr-2 flex-shrink-0">@</span>
              <input
                type="text"
                value={inputUsername}
                onChange={(e) => {
                  setInputUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="username"
                className="flex-1 min-w-0 w-full py-3 bg-transparent text-2xl font-bold placeholder:text-muted-foreground focus:outline-none border-b-2 border-border focus:border-foreground transition-colors"
                autoFocus
              />
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              This is how people will find and pay you
            </p>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4 pt-4 border-t border-border">
            <p className="label-caps text-muted-foreground">Optional</p>

            {/* Email Input */}
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Email address"
                className="flex-1 py-3 bg-transparent placeholder:text-muted-foreground focus:outline-none border-b border-border focus:border-foreground transition-colors"
              />
            </div>

            {/* Referral Input */}
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={referral}
                onChange={(e) => {
                  setReferral(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setError('');
                }}
                placeholder="Referral username (optional)"
                className="flex-1 py-3 bg-transparent placeholder:text-muted-foreground focus:outline-none border-b border-border focus:border-foreground transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-destructive">{error}</p>
          )}
        </div>

        {/* Bottom */}
        <div className="pb-8 animate-slide-up stagger-1">
          <button
            onClick={handleSubmit}
            disabled={!inputUsername || isChecking}
            className="btn-primary"
          >
            {isChecking ? 'Creating...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
