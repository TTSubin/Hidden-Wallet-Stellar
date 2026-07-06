import axios from 'axios';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'https://stellar-payment.onrender.com/api';

const api = axios.create({
  baseURL: VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type ApiEnvelope<T> = T | { data: T } | { result: T };

export type ApiErrorInfo = {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
};

type ErrorPayload = {
  errorCode?: unknown;
  error_code?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
  error?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const getFirstMessage = (message: unknown): string | undefined => {
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const first = message.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return first;
  }
  return undefined;
};

const getErrorPayload = (error: unknown): ErrorPayload | undefined => {
  if (!isRecord(error)) return undefined;
  const response = isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  return data as ErrorPayload | undefined;
};

export const toApiError = (error: unknown, fallbackMessage = 'Something went wrong. Please try again.'): ApiErrorInfo => {
  const payload = getErrorPayload(error);
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;

  const payloadCode =
    typeof payload?.errorCode === 'string'
      ? payload.errorCode
      : typeof payload?.error_code === 'string'
        ? payload.error_code
        : typeof payload?.code === 'string'
          ? payload.code
          : undefined;

  const payloadMessage = getFirstMessage(payload?.message) ?? getFirstMessage(payload?.error);

  if (payloadMessage || payloadCode) {
    return {
      status,
      code: payloadCode,
      message: payloadMessage ?? payloadCode ?? fallbackMessage,
      details: payload?.details,
    };
  }

  if (isRecord(error) && error.request && !response) {
    return {
      message: 'Cannot reach the server. Please check your connection and try again.',
    };
  }

  if (error instanceof Error && error.message) {
    return { status, message: error.message };
  }

  return { status, message: fallbackMessage };
};

export const getApiErrorMessage = (error: unknown, fallbackMessage?: string) =>
  toApiError(error, fallbackMessage).message;

export const getApiErrorCode = (error: unknown) => toApiError(error).code;

const unwrap = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object') {
    if ('data' in payload) return (payload as { data: T }).data;
    if ('result' in payload) return (payload as { result: T }).result;
  }
  return payload as T;
};

export const getData = async <T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => {
  const res = await promise;
  return unwrap<T>(res.data);
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response error interceptor for debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (error.response) {
      console.error('API Error:', {
        status: error.response.status,
        url: error.config?.url,
        method: error.config?.method,
        code: apiError.code,
        message: apiError.message,
      });
    } else {
      console.error('API Error:', apiError.message);
    }
    return Promise.reject(error);
  }
);

export type WalletChallengeResponseDto = {
  nonce: string;
  expiresAt: string;
  domain: string;
};

export type WalletVerifyRequestDto = {
  address: string;
  domain?: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  statement?: string;
  message: string;
  signature: string;
};

export const getChallenge = (address: string) => api.get<WalletChallengeResponseDto>('/auth/challenge', {
  params: { address },
});

export const postVerify = (dto: WalletVerifyRequestDto) => api.post('/auth/verify', dto);

export type RegisterRequestDto = {
  walletAddress: string;
  username: string;
  email?: string;
};

export const postRegister = (dto: RegisterRequestDto) => api.post('/wallet/register', dto);

export const getProfile = () => api.get('/users/profile');

export const updateProfile = (dto: { email?: string; firstName?: string; lastName?: string }) =>
  api.patch('/users/profile', dto);

export const changeUsername = (newUsername: string) => api.patch('/users/profile/username', { newUsername });

// User lookup for transfers
export type LookupUserDefaultWallet =
  | { id: string; type: 'onchain'; address: string; chain: string }
  | { id: string; type: 'offchain'; bankName: string; accountNumber: string; accountName: string; qrString: string };

export type LookupUserResponseDto = {
  userId: string;
  username: string;
  walletAddress: string;
  kycStatus: string;
  canReceiveTransfer: boolean;
  defaultWallet: LookupUserDefaultWallet | null;
};

export const lookupUser = (username: string) =>
  api.get<LookupUserResponseDto>(`/users/lookup?username=${username}`);

export type CheckUsernameResponseDto = {
  available: boolean;
};

export const checkUsername = (username: string) =>
  api.get<CheckUsernameResponseDto>('/users/check-username', { params: { username } });

export const postOnboarding = (dto: { username: string; email?: string; referralUsername?: string }) =>
  api.post('/users/onboarding', dto);

export const scanQr = async (qrString: string) => {
  const data = await getData(api.post('/transfer/scan', { qrString }));
  return { data };
};

export type OnchainWalletDto = {
  id: string;
  address: string;
  label?: string | null;
  createdAt?: string;
};

export type OffchainBankDto = {
  id: string;
  bankName: string;
  accountNumber: string;
  beneficiaryName: string;
  label?: string | null;
  createdAt?: string;
};

export type PaymentMethodDefaultResponseDto = {
  walletId: string | null;
  walletType: 'onchain' | 'offchain' | null;
  address?: string; // For onchain wallets
  accountNumber?: string; // For offchain banks
  bankName?: string; // For offchain banks
  accountName?: string; // For offchain banks
};

export const listOnchainWallets = async () => {
  const data = await getData<OnchainWalletDto[]>(api.get('/wallet/onchain'));
  return { data };
};
export const addOnchainWallet = (dto: { address: string; chain: string; label?: string; walletProvider?: string; publicKey?: string }) =>
  api.post('/wallet/onchain/add', dto);
export const deleteOnchainWallet = (id: string) => api.delete(`/wallet/onchain/${id}`);

export const listOffchainBanks = async () => {
  const data = await getData<{ total: number; banks: OffchainBankDto[] }>(api.get('/wallet/offchain'));
  return { data };
};
export const addOffchainBankByQr = (dto: { qrString: string; label?: string }) => api.post('/wallet/offchain/add', dto);
export const deleteOffchainBank = (id: string) => api.delete(`/wallet/offchain/${id}`);

export const getDefaultPaymentMethod = async () => {
  const data = await getData<PaymentMethodDefaultResponseDto>(api.get('/payment-methods/default'));
  return { data };
};
export const setDefaultPaymentMethod = (dto: { walletId: string; walletType: 'onchain' | 'offchain' }) =>
  api.post('/payment-methods/default', dto);

export type KycLinkResponseDto = {
  url?: string;
  kycLink?: string;
};

export type KycStatusResponseDto = {
  kycStatus: 'unverified' | 'pending' | 'verified' | 'approved' | string;
  userId?: string;
  username?: string;
  walletAddress?: string;
  firstName?: string;
  lastName?: string;
  canTransfer?: boolean;
};

export const getKycLink = (dto: { walletAddress: string }) => api.post<KycLinkResponseDto>('/kyc/get-link', dto);
export const getKycStatus = (walletAddress: string) =>
  api.get<KycStatusResponseDto>('/kyc/status', { params: { walletAddress } });

// ============================================
// PAYMENT ORDER API (Bank Transfers)
// ============================================

export type CreatePaymentOrderDto = {
  qrString: string;
  usdcAmount: number;
  payerWalletAddress: string;
  fiatCurrency?: string;
  country?: string;
  recipientCountry?: string;
  clientRequestId?: string;
};

export type PaymentInstructionDto = {
  toAddress: string;
  coinType: string;
  totalCrypto: string;
  totalCryptoRaw: string;
  totalPayout: number;
};

export type CreatePaymentOrderResponseDto = {
  id: string;
  status: string;
  exchangeInfo: {
    cryptoAmount: number;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
    exchangeRate: number;
    feeAmount: number;
  };
  platformFee?: {
    feePercent: string;
    feeRate: number;
    feeAmount: number;
    baseFiatAmount: number;
    finalFiatAmount: number;
  };
  paymentInstruction: PaymentInstructionDto;
  payout: {
    username?: string;
    fiatCurrency: string;
  };
};

export const createPaymentOrder = (dto: CreatePaymentOrderDto) =>
  api.post<CreatePaymentOrderResponseDto>('/payments/orders', dto);

export type PaymentsQuoteDto = {
  direction: 'USDC_TO_FIAT';
  usdcAmount: string;
  country: string;
  token: string;
};

export type PaymentsQuoteResponseDto = {
  success: boolean;
  direction: string;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
  usdcAmount: string;
  exchangeRate: string | number;
  feeAmount: number;
  feeRate: number;
  timestamp: string;
};

export const paymentsQuote = (dto: PaymentsQuoteDto) =>
  api.post<PaymentsQuoteResponseDto>('/payments/quote', dto);
export const confirmPaymentOrder = (orderId: string, userPaymentTxDigest: string) =>
  api.post(`/payments/orders/${orderId}/confirm-user-payment`, { userPaymentTxDigest });

export const getPaymentOrder = (orderId: string) =>
  api.get(`/payments/orders/${orderId}`);

export const syncPaymentOrder = (orderId: string) =>
  api.post(`/payments/orders/${orderId}/sync`);

export default api;
