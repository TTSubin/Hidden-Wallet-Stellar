import * as assert from 'node:assert/strict';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

type MockResponse = {
  statusCode?: number;
  payload?: unknown;
  status: (statusCode: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

const createMockHost = (url = '/api/test') => {
  const response: MockResponse = {
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };

  return {
    response,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url }),
      }),
    },
  };
};

const assertMatches = (actual: unknown, expected: Record<string, unknown>) => {
  assert.equal(typeof actual, 'object');
  assert.notEqual(actual, null);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual((actual as Record<string, unknown>)[key], value);
  }
};

(() => {
  const filter = new HttpExceptionFilter();
  const { host, response } = createMockHost('/api/auth/verify');

  filter.catch(new BadRequestException('INVALID_SIGNATURE'), host as never);

  assert.equal(response.statusCode, HttpStatus.BAD_REQUEST);
  assertMatches(response.payload, {
    success: false,
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_SIGNATURE',
    message: 'INVALID_SIGNATURE',
    path: '/api/auth/verify',
  });
  assert.equal(typeof (response.payload as { timestamp?: unknown }).timestamp, 'string');
})();

(() => {
  const filter = new HttpExceptionFilter();
  const { host, response } = createMockHost();
  const exception = new BadRequestException({
    error_code: 'KYC_LINK_FAILED',
    message: 'Failed to generate KYC link',
    details: { provider: 'gaian' },
  });

  filter.catch(exception, host as never);

  assertMatches(response.payload, {
    success: false,
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'KYC_LINK_FAILED',
    message: 'Failed to generate KYC link',
  });
  assert.deepEqual((response.payload as { details?: unknown }).details, { provider: 'gaian' });
})();

(() => {
  const filter = new HttpExceptionFilter();
  const { host, response } = createMockHost();

  filter.catch(new Error('database password leaked'), host as never);

  assert.equal(response.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
  assertMatches(response.payload, {
    success: false,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
})();

console.log('http-exception-filter tests passed');
