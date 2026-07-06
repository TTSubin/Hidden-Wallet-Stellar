type AuthUser = unknown;

export const getAuthUserWalletAddress = (user: AuthUser | null): string | null => {
  const u = user as { walletAddress?: unknown; address?: unknown } | null;
  const addr =
    typeof u?.walletAddress === 'string' && u.walletAddress.trim()
      ? u.walletAddress.trim()
      : typeof u?.address === 'string' && u.address.trim()
        ? u.address.trim()
        : null;
  return addr;
};

export const isWalletSessionMismatch = (activeWalletAddress: string | null, user: AuthUser | null): boolean => {
  const authenticatedWalletAddress = getAuthUserWalletAddress(user);
  if (!activeWalletAddress || !authenticatedWalletAddress) return false;
  return activeWalletAddress.toLowerCase() !== authenticatedWalletAddress.toLowerCase();
};
