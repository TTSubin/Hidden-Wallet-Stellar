import { strict as assert } from 'assert';
import { Keypair } from '@stellar/stellar-sdk';
import {
  formatStellarAssetId,
  isValidStellarPublicKey,
  rawAmountToStellarAmount,
  stellarAmountToRawAmount,
} from './stellar.util';

const validAddress = Keypair.random().publicKey();

assert.equal(isValidStellarPublicKey(validAddress), true);
assert.equal(isValidStellarPublicKey('0x1234567890abcdef'), false);
assert.equal(isValidStellarPublicKey('not-a-stellar-address'), false);

assert.equal(formatStellarAssetId('USDC', validAddress), `USDC:${validAddress}`);
assert.equal(stellarAmountToRawAmount('1.2345678', 7), '12345678');
assert.equal(stellarAmountToRawAmount('0.0000001', 7), '1');
assert.equal(rawAmountToStellarAmount('12345678', 7), '1.2345678');

console.log('stellar.util.spec.ts passed');
