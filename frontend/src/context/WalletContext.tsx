import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getAddress,
  isConnected as freighterIsConnected,
  requestAccess,
  signMessage as freighterSignMessage,
  signTransaction,
} from '@stellar/freighter-api';
import { Asset, BASE_FEE, Horizon, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  getConfiguredStellarNetwork,
  getStellarNetworkPassphrase,
  isValidStellarPublicKey,
  stroopsToXlm,
} from '@/lib/stellar';

type HorizonAccountBalance = {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
};

type HorizonPaymentOperation = {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

const STELLAR_NETWORK = getConfiguredStellarNetwork();
const NETWORK_PASSPHRASE = getStellarNetworkPassphrase(STELLAR_NETWORK);
const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON_URL ||
  (STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
const USDC_ASSET_CODE = import.meta.env.VITE_STELLAR_USDC_ASSET_CODE || 'USDC';
const USDC_ASSET_ISSUER = import.meta.env.VITE_STELLAR_USDC_ASSET_ISSUER || '';
const USDC_DECIMALS = Number(import.meta.env.VITE_STELLAR_USDC_DECIMALS || '7');

interface TransactionRecord {
  id: string;
  type: 'sent' | 'received';
  to?: string;
  from?: string;
  amount: number;
  timestamp: Date;
  token: 'XLM' | 'USDC';
  digest?: string;
}

export interface CoinBalance {
  coinType: string;
  totalBalance: number;
  rawBalance: string;
  symbol: string;
  decimals: number;
  iconUrl?: string | null;
}

interface ReferralStats {
  totalCommission: number;
  f0Volume: number;
  f0Count: number;
}

interface LinkedBank {
  id: string;
  bankName: string;
  accountNumber: string;
  beneficiaryName: string;
}

interface LinkedWallet {
  id: string;
  address: string;
  name: string;
}

interface HiddenWalletUser {
  username: string;
  avatar?: string;
  walletAddress?: string;
  linkedBank?: LinkedBank;
}

type DefaultAccountType = 'wallet' | 'bank';
type KYCStatus = 'unverified' | 'pending' | 'verified';

const registeredUsers: Record<string, HiddenWalletUser> = {};

interface WalletState {
  username: string | null;
  xlmBalance: number;
  usdcBalance: number;
  balanceVnd: number;
  transactions: TransactionRecord[];
  linkedBanks: LinkedBank[];
  linkedWallets: LinkedWallet[];
  defaultAccountId: string | null;
  defaultAccountType: DefaultAccountType;
  defaultWalletAddress: string | null;
  contacts: string[];
  kycStatus: KYCStatus;
  isLoadingBalance: boolean;
  isProfileLoading: boolean;
  rewardPoints: number;
  referralStats: ReferralStats;
  coins: CoinBalance[];
}

type WalletContextType = WalletState & {
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => Promise<string>;
  signAuthMessage: (message: string) => Promise<string>;
  setUsername: (username: string) => void;
  sendUsdc: (toAddress: string, amount: number) => Promise<{ success: boolean; digest?: string; message?: string }>;
  sendXlm: (toAddress: string, amount: number) => Promise<{ success: boolean; digest?: string; message?: string }>;
  disconnect: () => void;
  addBankAccount: (bank: Omit<LinkedBank, 'id'>) => void;
  removeBankAccount: (id: string) => void;
  addLinkedWallet: (wallet: Omit<LinkedWallet, 'id'>) => void;
  removeLinkedWallet: (id: string) => void;
  setDefaultAccount: (id: string, type: DefaultAccountType) => void;
  addContact: (username: string) => void;
  lookupBankAccount: (accountNumber: string) => HiddenWalletUser | null;
  lookupUsername: (username: string) => HiddenWalletUser | null;
  getDefaultAccount: () => { id: string; type: DefaultAccountType; name: string } | null;
  refreshBalance: (address?: string) => Promise<void>;
  isValidWalletAddress: (address: string) => boolean;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);
const USDC_TO_VND_RATE = 25500;

function rawUnits(amount: string, decimals: number) {
  const [whole, fraction = ''] = amount.split('.');
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')).toString();
}

function getUsdcBalance(balances: HorizonAccountBalance[]) {
  const balance = balances.find((item) =>
    item.asset_code === USDC_ASSET_CODE &&
    (!USDC_ASSET_ISSUER || item.asset_issuer === USDC_ASSET_ISSUER),
  );
  return balance ? Number(balance.balance) : 0;
}

function hasUsdcTrustline(balances: HorizonAccountBalance[]) {
  return balances.some((item) =>
    item.asset_code === USDC_ASSET_CODE &&
    (!USDC_ASSET_ISSUER || item.asset_issuer === USDC_ASSET_ISSUER),
  );
}

function getStellarSubmitErrorMessage(error: unknown) {
  const response = (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })?.response;
  const resultCodes = response?.data?.extras?.result_codes;
  const operationCode = resultCodes?.operations?.find(Boolean);
  const transactionCode = resultCodes?.transaction;

  switch (operationCode) {
    case 'op_no_trust':
      return 'Recipient has not added a USDC trustline for this Stellar issuer.';
    case 'op_underfunded':
      return 'Insufficient USDC balance.';
    case 'op_no_destination':
      return 'Recipient Stellar account does not exist on this network.';
    case 'op_line_full':
      return 'Recipient USDC trustline limit is full.';
    default:
      return operationCode || transactionCode || (error instanceof Error ? error.message : 'Failed to send USDC transaction');
  }
}

function freighterSignatureToBase64(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) {
    let binary = '';
    value.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  if (value && typeof value === 'object' && 'data' in value && Array.isArray((value as { data: unknown }).data)) {
    return btoa(String.fromCharCode(...((value as { data: number[] }).data)));
  }
  throw new Error('Freighter did not return a signature');
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [state, setState] = useState<WalletState>({
    username: null,
    xlmBalance: 0,
    usdcBalance: 0,
    balanceVnd: 0,
    transactions: [],
    linkedBanks: [],
    linkedWallets: [],
    defaultAccountId: null,
    defaultAccountType: 'wallet',
    defaultWalletAddress: null,
    contacts: [],
    kycStatus: 'unverified',
    isLoadingBalance: false,
    isProfileLoading: false,
    rewardPoints: 0,
    referralStats: { totalCommission: 0, f0Volume: 0, f0Count: 0 },
    coins: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const connect = useCallback(async () => {
    const res = await requestAccess();
    if (res.error) throw new Error(res.error.message);
    setWalletAddress(res.address);
    return res.address;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const connected = await freighterIsConnected();
      if (connected.error || !connected.isConnected) return;
      const res = await getAddress();
      if (!cancelled && !res.error && res.address) setWalletAddress(res.address);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchTransactions = useCallback(async (address: string): Promise<TransactionRecord[]> => {
    try {
      const server = new Horizon.Server(HORIZON_URL);
      const records = await server.transactions().forAccount(address).order('desc').limit(20).call();
      const txs = await Promise.all(
        records.records.map(async (tx) => {
          let matchingPayment: HorizonPaymentOperation | undefined;

          try {
            const ops = await server.operations().forTransaction(tx.hash).call();
            matchingPayment = (ops.records as HorizonPaymentOperation[]).find((op) => {
              if (op.type !== 'payment' || !op.amount) return false;
              const isConfiguredUsdc =
                op.asset_code === USDC_ASSET_CODE &&
                (!USDC_ASSET_ISSUER || op.asset_issuer === USDC_ASSET_ISSUER);
              return (op.asset_type === 'native' || isConfiguredUsdc) && (op.from === address || op.to === address);
            });
          } catch {
            matchingPayment = undefined;
          }

          if (!matchingPayment) {
            return null;
          }

          const isSent = matchingPayment.from === address;
          const token = matchingPayment?.asset_type === 'native' ? 'XLM' : 'USDC';
          const amount = Number(matchingPayment?.amount ?? '0');

          return {
            id: tx.hash,
            type: isSent ? 'sent' : 'received',
            to: matchingPayment?.to,
            from: matchingPayment?.from,
            amount: Number.isFinite(amount) ? amount : 0,
            timestamp: new Date(tx.created_at),
            token,
            digest: tx.hash,
          } satisfies TransactionRecord;
        }),
      );
      return txs.filter((tx): tx is TransactionRecord => Boolean(tx));
    } catch {
      return [];
    }
  }, []);

  const refreshBalance = useCallback(async (forcedAddress?: string) => {
    let targetAddress = forcedAddress;
    if (!targetAddress) {
      const currentState = stateRef.current;
      if (currentState.defaultAccountType === 'wallet' && currentState.defaultAccountId) {
        targetAddress = currentState.linkedWallets.find((w) => w.id === currentState.defaultAccountId)?.address;
      }
      if (!targetAddress) targetAddress = walletAddress ?? undefined;
    }

    if (!targetAddress) return;
    setState((prev) => ({ ...prev, isLoadingBalance: true }));

    try {
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(targetAddress);
      const coins: CoinBalance[] = (account.balances as HorizonAccountBalance[]).map((balance) => {
        if (balance.asset_type === 'native') {
          return {
            coinType: 'native',
            totalBalance: Number(balance.balance),
            rawBalance: rawUnits(balance.balance, 7),
            symbol: 'XLM',
            decimals: 7,
          };
        }
        const symbol = balance.asset_code || 'UNKNOWN';
        return {
          coinType: `${symbol}:${balance.asset_issuer}`,
          totalBalance: Number(balance.balance),
          rawBalance: rawUnits(balance.balance, USDC_DECIMALS),
          symbol,
          decimals: USDC_DECIMALS,
          iconUrl: symbol === 'USDC' ? '/token-icons/usdc.svg' : null,
        };
      });

      const xlm = coins.find((coin) => coin.symbol === 'XLM')?.totalBalance ?? 0;
      const usdc =
        coins.find((coin) => coin.symbol === USDC_ASSET_CODE && (!USDC_ASSET_ISSUER || coin.coinType.endsWith(USDC_ASSET_ISSUER)))
          ?.totalBalance ?? 0;

      coins.sort((a, b) => {
        if (a.symbol === 'USDC') return -1;
        if (b.symbol === 'USDC') return 1;
        if (a.symbol === 'XLM') return -1;
        if (b.symbol === 'XLM') return 1;
        return b.totalBalance - a.totalBalance;
      });

      setState((prev) => ({
        ...prev,
        xlmBalance: xlm,
        usdcBalance: usdc,
        coins,
        balanceVnd: usdc * USDC_TO_VND_RATE,
        isLoadingBalance: false,
      }));

      fetchTransactions(targetAddress).then((txHistory) => {
        setState((prev) => ({ ...prev, transactions: txHistory }));
      });
    } catch (error) {
      console.error('Failed to fetch Stellar balance:', error);
      setState((prev) => ({ ...prev, isLoadingBalance: false }));
    }
  }, [fetchTransactions, walletAddress]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance, state.defaultAccountId, state.defaultAccountType, walletAddress]);

  useEffect(() => {
    setState((prev) => ({ ...prev, isProfileLoading: false }));
  }, []);

  const isValidWalletAddress = (address: string) => isValidStellarPublicKey(address);

  const signAuthMessage = async (message: string): Promise<string> => {
    if (!walletAddress) throw new Error('No wallet connected');
    const res = await freighterSignMessage(message, { networkPassphrase: NETWORK_PASSPHRASE, address: walletAddress });
    if (res.error) throw new Error(res.error.message);
    return freighterSignatureToBase64(res.signedMessage);
  };

  const sendUsdc = async (toAddress: string, amount: number): Promise<{ success: boolean; digest?: string; message?: string }> => {
    if (!walletAddress) return { success: false, message: 'No wallet connected' };
    if (!isValidWalletAddress(toAddress)) return { success: false, message: 'Invalid Stellar recipient address' };
    if (!USDC_ASSET_ISSUER) return { success: false, message: 'USDC issuer is not configured' };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid USDC amount' };

    try {
      const server = new Horizon.Server(HORIZON_URL);
      const source = await server.loadAccount(walletAddress);
      const sourceUsdcBalance = getUsdcBalance(source.balances as HorizonAccountBalance[]);
      if (sourceUsdcBalance < amount) {
        return { success: false, message: 'Insufficient USDC balance' };
      }

      let destination;
      try {
        destination = await server.loadAccount(toAddress);
      } catch {
        return { success: false, message: 'Recipient Stellar account does not exist on this network' };
      }

      if (!hasUsdcTrustline(destination.balances as HorizonAccountBalance[])) {
        return { success: false, message: 'Recipient has not added a USDC trustline for this Stellar issuer' };
      }

      const asset = new Asset(USDC_ASSET_CODE, USDC_ASSET_ISSUER);
      const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: toAddress,
            asset,
            amount: amount.toFixed(USDC_DECIMALS),
          }),
        )
        .setTimeout(180)
        .build();

      const signed = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE, address: walletAddress });
      if (signed.error) throw new Error(signed.error.message);

      const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
      const result = await server.submitTransaction(signedTx);

      setState((prev) => ({
        ...prev,
        transactions: [
          {
            id: result.hash,
            type: 'sent',
            to: `${toAddress.slice(0, 6)}...${toAddress.slice(-5)}`,
            amount,
            timestamp: new Date(),
            token: 'USDC',
            digest: result.hash,
          },
          ...prev.transactions,
        ],
      }));

      setTimeout(() => refreshBalance(), 2000);
      return { success: true, digest: result.hash };
    } catch (error) {
      const message = getStellarSubmitErrorMessage(error);
      console.error('Failed to send USDC on Stellar:', error);
      return { success: false, message };
    }
  };

  const sendXlm = async (toAddress: string, amount: number): Promise<{ success: boolean; digest?: string; message?: string }> => {
    if (!walletAddress) return { success: false, message: 'No wallet connected' };
    if (STELLAR_NETWORK !== 'TESTNET') return { success: false, message: 'XLM test transaction flow requires Stellar testnet' };
    if (!isValidWalletAddress(toAddress)) return { success: false, message: 'Invalid Stellar recipient address' };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid XLM amount' };

    try {
      const server = new Horizon.Server(HORIZON_URL);
      const source = await server.loadAccount(walletAddress);
      const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: toAddress,
            asset: Asset.native(),
            amount: amount.toFixed(7),
          }),
        )
        .setTimeout(180)
        .build();

      const signed = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE, address: walletAddress });
      if (signed.error) throw new Error(signed.error.message);

      const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
      const result = await server.submitTransaction(signedTx);

      setState((prev) => ({
        ...prev,
        transactions: [
          {
            id: result.hash,
            type: 'sent',
            to: `${toAddress.slice(0, 6)}...${toAddress.slice(-5)}`,
            amount,
            timestamp: new Date(),
            token: 'XLM',
            digest: result.hash,
          },
          ...prev.transactions,
        ],
      }));

      setTimeout(() => refreshBalance(), 2000);
      return { success: true, digest: result.hash, message: 'XLM transaction submitted' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send XLM transaction';
      console.error('Failed to send XLM on Stellar testnet:', error);
      return { success: false, message };
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
    setState({
      username: null,
      xlmBalance: 0,
      usdcBalance: 0,
      balanceVnd: 0,
      transactions: [],
      linkedBanks: [],
      linkedWallets: [],
      defaultAccountId: null,
      defaultAccountType: 'wallet',
      defaultWalletAddress: null,
      contacts: [],
      kycStatus: 'unverified',
      isLoadingBalance: false,
      isProfileLoading: false,
      rewardPoints: 0,
      referralStats: { totalCommission: 0, f0Volume: 0, f0Count: 0 },
      coins: [],
    });
  };

  const setUsername = (username: string) => setState((prev) => ({ ...prev, username }));
  const addBankAccount = (bank: Omit<LinkedBank, 'id'>) =>
    setState((prev) => ({ ...prev, linkedBanks: [...prev.linkedBanks, { ...bank, id: Date.now().toString() }] }));
  const removeBankAccount = (id: string) => setState((prev) => ({ ...prev, linkedBanks: prev.linkedBanks.filter((bank) => bank.id !== id) }));
  const addLinkedWallet = (wallet: Omit<LinkedWallet, 'id'>) =>
    setState((prev) => ({ ...prev, linkedWallets: [...prev.linkedWallets, { ...wallet, id: Date.now().toString() }] }));
  const removeLinkedWallet = (id: string) =>
    setState((prev) => ({ ...prev, linkedWallets: prev.linkedWallets.filter((wallet) => wallet.id !== id) }));
  const setDefaultAccount = (id: string, type: DefaultAccountType) =>
    setState((prev) => ({ ...prev, defaultAccountId: id, defaultAccountType: type }));
  const addContact = (username: string) =>
    setState((prev) => ({ ...prev, contacts: prev.contacts.includes(username) ? prev.contacts : [...prev.contacts, username] }));
  const lookupBankAccount = (accountNumber: string) =>
    Object.values(registeredUsers).find((user) => user.linkedBank?.accountNumber === accountNumber) ?? null;
  const lookupUsername = (username: string) => registeredUsers[username.replace('@', '').toLowerCase()] ?? null;
  const getDefaultAccount = () => {
    if (!state.defaultAccountId) return null;
    if (state.defaultAccountType === 'wallet') {
      const wallet = state.linkedWallets.find((w) => w.id === state.defaultAccountId);
      return wallet ? { id: wallet.id, type: 'wallet' as const, name: wallet.name } : null;
    }
    const bank = state.linkedBanks.find((b) => b.id === state.defaultAccountId);
    return bank ? { id: bank.id, type: 'bank' as const, name: bank.bankName } : null;
  };

  return (
    <WalletContext.Provider
      value={{
        ...state,
        isConnected: Boolean(walletAddress),
        walletAddress,
        connect,
        signAuthMessage,
        setUsername,
        sendUsdc,
        sendXlm,
        disconnect,
        addBankAccount,
        removeBankAccount,
        addLinkedWallet,
        removeLinkedWallet,
        setDefaultAccount,
        addContact,
        lookupBankAccount,
        lookupUsername,
        getDefaultAccount,
        refreshBalance,
        isValidWalletAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
