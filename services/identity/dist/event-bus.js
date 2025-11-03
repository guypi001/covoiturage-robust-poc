"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const common_1 = require("@nestjs/common");
const kafkajs_1 = require("kafkajs");
function sanitizeBrokers(raw) {
    return raw.split(',').map(b => b.trim()).map(b => (b.includes('127.0.0.1') || b.includes('localhost')) ? 'redpanda:9092' : b);
}
let EventBus = class EventBus {
    constructor() {
        this.consumers = [];
        this.connected = false;
        const raw = process.env.KAFKA_BROKERS || 'redpanda:9092';
        const brokers = sanitizeBrokers(raw);
        this.kafka = new kafkajs_1.Kafka({ brokers, logLevel: kafkajs_1.logLevel.ERROR });
    }
    async onModuleInit() { await this.ensureProducer(); }
    async onModuleDestroy() {
        await Promise.all(this.consumers.map(c => c.disconnect().catch(() => { })));
        if (this.producer)
            await this.producer.disconnect().catch(() => { });
    }
    async ensureProducer(retry = 3) {
        if (this.connected)
            return;
        this.producer = this.kafka.producer();
        while (retry-- > 0) {
            try {
                await this.producer.connect();
                this.connected = true;
                return;
            }
            catch (e) {
                console.error('[EventBus] producer connect failed, retrying:', e?.message || e);
                await new Promise(r => setTimeout(r, 800));
            }
        }
    }
    async publish(topic, message, key) {
        try {
            if (!this.connected)
                await this.ensureProducer();
            if (!this.connected)
                throw new Error('producer not connected');
            await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(message) }] });
        }
        catch (e) {
            console.error('[EventBus] publish failed:', topic, e?.message || e);
        }
    }
    async subscribe(groupId, topic, handler) {
        const consumer = this.kafka.consumer({ groupId });
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: true });
        await consumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value)
                    return;
                try {
                    await handler(JSON.parse(message.value.toString('utf-8')));
                }
                catch (e) {
                    console.error('Event handler error for topic', topic, e);
                }
            }
        });
        this.consumers.push(consumer);
    }
};
exports.EventBus = EventBus;
exports.EventBus = EventBus = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EventBus);
//# sourceMappingURL=event-bus.js.map