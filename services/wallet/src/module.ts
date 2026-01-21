import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet, Hold, PaymentMethod, WalletTransaction } from './entities';
import { WalletController } from './wallet.controller';
import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
import { DataSource } from 'typeorm';

const dbUrl = process.env.DATABASE_URL || '';
const migrationsRun =
  process.env.MIGRATIONS_RUN !== undefined
    ? ['1', 'true', 'yes', 'on'].includes(process.env.MIGRATIONS_RUN.toLowerCase())
    : true;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [Wallet, Hold, PaymentMethod, WalletTransaction],
      synchronize: false,
      migrationsRun,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([Wallet, Hold, PaymentMethod, WalletTransaction]),
  ],
  controllers: [WalletController, MetricsController],
  providers: [EventBus],
})
export class AppModule implements OnModuleInit {
  constructor(private bus: EventBus, private ds: DataSource) {}
  configure(c: MiddlewareConsumer) {
    c.apply(MetricsMiddleware).forRoutes('*');
  }
  async onModuleInit() {
    await this.bus.subscribe('wallet-group', 'payment.captured', async (evt: any) => {
      if (!evt?.holdId) return;
      const holdRepo = this.ds.getRepository(Hold);
      const walletRepo = this.ds.getRepository(Wallet);
      const txRepo = this.ds.getRepository(WalletTransaction);
      const h = await holdRepo.findOne({ where: { id: evt.holdId } });
      if (!h) return;
      h.status = 'CAPTURED';
      await holdRepo.save(h);
      let wallet = await walletRepo.findOne({ where: { ownerId: h.ownerId } });
      if (!wallet) {
        wallet = await walletRepo.save(walletRepo.create({ ownerId: h.ownerId, balance: 0 }));
      }
      wallet.balance = (wallet.balance || 0) - Number(evt.amount || h.amount || 0);
      await walletRepo.save(wallet);
      await txRepo.save(
        txRepo.create({
          ownerId: h.ownerId,
          referenceId: h.referenceId,
          type: 'DEBIT',
          amount: Number(evt.amount || h.amount || 0),
          reason: 'payment_capture',
        }),
      );
      console.log('[wallet] captured hold', h.id);
    });

    await this.bus.subscribe('wallet-group', 'payment.refunded', async (evt: any) => {
      if (!evt?.bookingId) return;
      const holdRepo = this.ds.getRepository(Hold);
      const walletRepo = this.ds.getRepository(Wallet);
      const txRepo = this.ds.getRepository(WalletTransaction);
      const hold = await holdRepo.findOne({ where: { referenceId: evt.bookingId } });
      if (!hold) return;
      hold.status = 'RELEASED';
      await holdRepo.save(hold);
      let wallet = await walletRepo.findOne({ where: { ownerId: hold.ownerId } });
      if (!wallet) {
        wallet = await walletRepo.save(walletRepo.create({ ownerId: hold.ownerId, balance: 0 }));
      }
      const amount = Number(evt.amount || 0);
      wallet.balance = (wallet.balance || 0) + amount;
      await walletRepo.save(wallet);
      await txRepo.save(
        txRepo.create({
          ownerId: hold.ownerId,
          referenceId: evt.bookingId,
          type: 'CREDIT',
          amount,
          reason: 'payment_refund',
        }),
      );
      console.log('[wallet] refunded booking', evt.bookingId);
    });
  }
}
