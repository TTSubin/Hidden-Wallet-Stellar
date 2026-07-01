import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [StellarService],
  exports: [StellarService],
})
export class BlockchainModule {}
