import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { StellarRpcService } from './stellar-rpc.service';

@Module({
  imports: [HttpModule],
  providers: [StellarRpcService],
  exports: [StellarRpcService],
})
export class StellarModule {}
