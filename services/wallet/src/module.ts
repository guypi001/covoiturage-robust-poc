import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common'; import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet, Hold } from './entities'; import { WalletController } from './wallet.controller'; import { EventBus } from './event-bus'; import { MetricsController, MetricsMiddleware } from './metrics'; import { DataSource } from 'typeorm';
const dbUrl = process.env.DATABASE_URL || '';
@Module({ imports:[ TypeOrmModule.forRoot({ type:'postgres', url:dbUrl, entities:[Wallet,Hold], synchronize:true }), TypeOrmModule.forFeature([Wallet,Hold]) ],
  controllers:[WalletController, MetricsController], providers:[EventBus] })
export class AppModule implements OnModuleInit {
  constructor(private bus:EventBus, private ds:DataSource){} configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); }
  async onModuleInit(){ await this.bus.subscribe('wallet-group','payment.captured', async (evt:any)=>{
    if(!evt?.holdId) return; const repo=this.ds.getRepository(Hold); const h=await repo.findOne({ where:{ id: evt.holdId } });
    if(!h) return; h.status='CAPTURED'; await repo.save(h); console.log('[wallet] captured hold', h.id); }); }
}
