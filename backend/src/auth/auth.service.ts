import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { hash, Keypair, xdr } from '@stellar/stellar-sdk';
import { VerifyDto } from './dto/verify.dto';
import { KycService } from '../modules/kyc/kyc.service';
import { isValidStellarPublicKey } from '../stellar/stellar.util';

const KYC_STATUSES_TO_REFRESH = new Set(['not_started', 'pending', 'rejected', 'not started']);

function normalizeStellarAddress(address: string) {
  return address.trim();
}

function decodeSignature(signature: string): Buffer {
  const trimmed = signature.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'base64');
}

function uniqueBuffers(buffers: Buffer[]): Buffer[] {
  const seen = new Set<string>();
  return buffers.filter((buffer) => {
    const key = buffer.toString('hex');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSignatureCandidates(signature: string): Buffer[] {
  const raw = decodeSignature(signature);
  const candidates = [raw];

  if (raw.length !== 64) {
    try {
      const decorated = xdr.DecoratedSignature.fromXDR(raw);
      candidates.push(Buffer.from(decorated.signature()));
    } catch {
      // Some wallet APIs return a raw 64-byte signature, others return decorated XDR.
    }
  }

  return uniqueBuffers(candidates);
}

function getMessagePayloadCandidates(message: string): Buffer[] {
  const raw = Buffer.from(message, 'utf8');
  const stellarPrefixed = Buffer.from(`Stellar Signed Message:\n${message}`, 'utf8');
  const stellarLengthPrefixed = Buffer.from(
    `Stellar Signed Message:\n${raw.length}${message}`,
    'utf8',
  );
  const stellarPersonalSign = Buffer.from(
    `\x19Stellar Signed Message:\n${raw.length}${message}`,
    'utf8',
  );

  const payloads = [
    raw,
    stellarPrefixed,
    stellarLengthPrefixed,
    stellarPersonalSign,
  ];

  return uniqueBuffers([...payloads, ...payloads.map((payload) => hash(payload))]);
}

@Injectable()
export class AuthService {
  private readonly domain: string;
  private readonly challengeTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly kycService: KycService,
  ) {
    this.domain = this.config.get<string>('AUTH_DOMAIN') ?? 'paypath.app';
    this.challengeTtlSeconds = Number(this.config.get<string>('AUTH_CHALLENGE_TTL_SECONDS') ?? '300');
  }

  async issueChallenge(address: string) {
    const normalized = normalizeStellarAddress(address);
    if (!isValidStellarPublicKey(normalized)) {
      throw new BadRequestException('INVALID_STELLAR_ADDRESS');
    }

    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    await this.prisma.authNonce.create({
      data: {
        address: normalized,
        nonce,
        expiresAt,
      },
    });

    return {
      nonce,
      expiresAt: expiresAt.toISOString(),
      domain: this.domain,
    };
  }

  private async refreshKycIfNeeded(walletAddress: string, kycStatus?: string | null) {
    const status =
      typeof kycStatus === 'string' && kycStatus.trim()
        ? kycStatus.trim()
        : (await this.prisma.user.findFirst({
            where: { walletAddress },
            select: { kycStatus: true },
          }))?.kycStatus ?? null;

    if (!status || !KYC_STATUSES_TO_REFRESH.has(status)) {
      return;
    }

    try {
      await this.kycService.getKycStatus(walletAddress);
    } catch {
      // Ignore KYC refresh failures so login still succeeds.
    }
  }

  private buildExpectedMessage(args: {
    domain: string;
    address: string;
    nonce: string;
    issuedAt: string;
    expirationTime: string;
    statement?: string;
  }) {
    const lines = [
      `Sign in to ${args.domain}`,
      '',
      `Address: ${args.address}`,
      `Nonce: ${args.nonce}`,
      `Issued At: ${args.issuedAt}`,
      `Expiration Time: ${args.expirationTime}`,
    ];
    if (args.statement) {
      lines.push('', args.statement);
    }
    return lines.join('\n');
  }

  async verifyAndIssueToken(dto: VerifyDto) {
    const address = normalizeStellarAddress(dto.address);
    if (!isValidStellarPublicKey(address)) {
      throw new BadRequestException('INVALID_STELLAR_ADDRESS');
    }

    let user = await this.prisma.user.findFirst({ where: { walletAddress: address } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress: address,
          username: null,
        },
      });
    }

    const nonceRow = await this.prisma.authNonce.findFirst({
      where: {
        address,
        nonce: dto.nonce,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!nonceRow) {
      throw new BadRequestException('NONCE_NOT_FOUND');
    }

    if (nonceRow.usedAt) {
      throw new BadRequestException('NONCE_ALREADY_USED');
    }

    if (nonceRow.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('NONCE_EXPIRED');
    }

    const expectedMessage = this.buildExpectedMessage({
      domain: dto.domain ?? this.domain,
      address,
      nonce: dto.nonce,
      issuedAt: dto.issuedAt,
      expirationTime: dto.expirationTime,
      statement: dto.statement,
    });

    if (dto.message !== expectedMessage) {
      throw new BadRequestException('MESSAGE_MISMATCH');
    }

    if (new Date(dto.expirationTime).getTime() < Date.now()) {
      throw new BadRequestException('MESSAGE_EXPIRED');
    }

    try {
      const publicKey = Keypair.fromPublicKey(address);
      const signatures = getSignatureCandidates(dto.signature);
      const payloads = getMessagePayloadCandidates(dto.message);
      const ok = signatures.some((signature) =>
        payloads.some((payload) => publicKey.verify(payload, signature)),
      );
      if (!ok) {
        throw new BadRequestException('INVALID_SIGNATURE');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      throw new BadRequestException(`INVALID_SIGNATURE:${msg}`);
    }

    await this.prisma.authNonce.update({
      where: { id: nonceRow.id },
      data: { usedAt: new Date() },
    });

    await this.refreshKycIfNeeded(address, user.kycStatus);

    const token = await this.jwt.signAsync({ sub: user.id, address });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      needsOnboarding: !user.username,
    };
  }
}
