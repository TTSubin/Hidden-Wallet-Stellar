import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmUserPaymentDto {
  @ApiProperty({ example: 'stellar-transaction-hash' })
  @IsString()
  userPaymentTxDigest: string;
}
