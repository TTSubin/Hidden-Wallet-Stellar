import { describe, expect, it } from 'vitest';
import { getApiErrorCode, getApiErrorMessage, toApiError } from './api';

describe('API error helpers', () => {
  it('reads the backend error envelope', () => {
    const error = {
      response: {
        status: 400,
        data: {
          success: false,
          errorCode: 'INVALID_SIGNATURE',
          message: 'Invalid wallet signature',
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe('Invalid wallet signature');
    expect(getApiErrorCode(error)).toBe('INVALID_SIGNATURE');
    expect(toApiError(error)).toMatchObject({
      status: 400,
      code: 'INVALID_SIGNATURE',
      message: 'Invalid wallet signature',
    });
  });

  it('falls back to legacy Nest and Axios error shapes', () => {
    expect(
      getApiErrorMessage({
        response: {
          data: {
            message: ['walletAddress must be a string', 'walletAddress should not be empty'],
          },
        },
      }),
    ).toBe('walletAddress must be a string');

    expect(getApiErrorMessage(new Error('Wallet rejected signing'))).toBe('Wallet rejected signing');
  });

  it('uses a friendly network message when no response arrives', () => {
    expect(
      getApiErrorMessage({
        request: {},
        message: 'Network Error',
      }),
    ).toBe('Cannot reach the server. Please check your connection and try again.');
  });
});
