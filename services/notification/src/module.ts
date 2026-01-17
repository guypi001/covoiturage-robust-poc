import { Logger, MiddlewareConsumer, Module, OnModuleInit } from '@nestjs/common';
import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
import { MailerService } from './mailer.service';
import { IdentityClient, AccountSummary } from './identity.client';
import { BookingClient } from './booking.client';
import { RideClient } from './ride.client';

type MessageSentEvent = {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  body?: string;
  createdAt?: string;
};

type BookingConfirmedEvent = {
  bookingId: string;
  passengerId: string;
  rideId: string;
  seats?: number;
  amount?: number;
  originCity?: string | null;
  destinationCity?: string | null;
  departureAt?: string | null;
};

type PaymentCapturedEvent = {
  bookingId: string;
  amount?: number;
  provider?: string;
  holdId?: string;
  paymentMethodType?: string;
  paymentMethodId?: string;
};

@Module({
  controllers: [MetricsController],
  providers: [EventBus, MailerService, IdentityClient, BookingClient, RideClient],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly bus: EventBus,
    private readonly mailer: MailerService,
    private readonly identity: IdentityClient,
    private readonly bookings: BookingClient,
    private readonly rides: RideClient,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    await this.bus.subscribe('notif-group', 'payment.captured', async (evt) => {
      await this.handlePaymentCaptured(evt as PaymentCapturedEvent);
    });

    await this.bus.subscribe('notif-group', 'ride.published', async (evt) => {
      this.logger.log(
        `[ride] nouvelle annonce ${evt?.originCity || '?'} -> ${evt?.destinationCity || '?'}`,
      );
    });

    await this.bus.subscribe('notif-group', 'message.sent', async (evt) => {
      await this.handleMessageSent(evt as MessageSentEvent);
    });

    await this.bus.subscribe('notif-group', 'booking.confirmed', async (evt) => {
      await this.handleBookingConfirmed(evt as BookingConfirmedEvent);
    });

    await this.bus.subscribe('notif-group', 'message.read', async (evt) => {
      this.logger.log(
        `[message] conversation ${evt?.conversationId} lue par ${evt?.readerId} (${evt?.count ?? 0} msgs)`,
      );
    });
  }

  private resolveName(account: AccountSummary | null): string {
    if (!account) return 'un utilisateur KariGo';
    return account.fullName || account.companyName || account.email;
  }

  private async handleMessageSent(evt: MessageSentEvent) {
    if (!evt?.recipientId) {
      this.logger.warn('message.sent event missing recipientId');
      return;
    }

    const recipient = await this.identity.getAccountById(evt.recipientId);
    if (!recipient?.email) {
      this.logger.warn(`Impossible d'envoyer un email: destinataire ${evt.recipientId} introuvable.`);
      return;
    }

    const sender = evt.senderId ? await this.identity.getAccountById(evt.senderId) : null;
    const sent = await this.mailer.sendMessageEmail(recipient.email, {
      recipientName: this.resolveName(recipient),
      senderName: this.resolveName(sender),
      preview: evt.body,
      conversationId: evt.conversationId,
    });

    if (!sent) {
      this.logger.warn(`Echec de l'envoi de l'email de notification pour ${recipient.email}`);
    }
  }

  private async handleBookingConfirmed(evt: BookingConfirmedEvent) {
    if (!evt?.passengerId) return;
    const passenger = await this.identity.getAccountById(evt.passengerId);
    if (!passenger?.email) {
      this.logger.warn(`Impossible d'envoyer la confirmation: email manquant pour ${evt.passengerId}`);
      return;
    }
    const sent = await this.mailer.sendBookingConfirmationEmail(passenger.email, {
      passengerName: this.resolveName(passenger),
      originCity: evt.originCity,
      destinationCity: evt.destinationCity,
      departureAt: evt.departureAt,
      seats: evt.seats,
      amount: evt.amount,
      rideId: evt.rideId,
    });
    if (!sent) {
      this.logger.warn(`Echec de la confirmation email pour ${passenger.email}`);
    }
  }

  private async handlePaymentCaptured(evt: PaymentCapturedEvent) {
    if (!evt?.bookingId) return;
    const booking = await this.bookings.getBooking(evt.bookingId);
    if (!booking?.passengerId) {
      this.logger.warn(`payment.captured missing passenger for booking ${evt.bookingId}`);
      return;
    }
    const passenger = await this.identity.getAccountById(booking.passengerId);
    if (!passenger?.email) {
      this.logger.warn(`payment.captured email missing for passenger ${booking.passengerId}`);
      return;
    }
    const ride = booking.rideId ? await this.rides.getRide(booking.rideId) : null;
    const paymentMethod = evt.paymentMethodType
      ? evt.paymentMethodType === 'CASH'
        ? 'Especes'
        : evt.provider
        ? `${evt.paymentMethodType} (${evt.provider})`
        : evt.paymentMethodType
      : evt.provider || 'Paiement';
    const sent = await this.mailer.sendPaymentReceiptEmail(passenger.email, {
      bookingId: booking.id,
      passengerName: this.resolveName(passenger),
      passengerEmail: passenger.email,
      originCity: ride?.originCity ?? undefined,
      destinationCity: ride?.destinationCity ?? undefined,
      departureAt: ride?.departureAt ?? undefined,
      seats: booking.seats ?? 1,
      amount: evt.amount ?? booking.amount ?? 0,
      paymentMethod,
      issuedAt: new Date().toISOString(),
      rideId: booking.rideId,
    });
    if (!sent) {
      this.logger.warn(`Echec de l'envoi du recu pour ${passenger.email}`);
    }
  }
}
