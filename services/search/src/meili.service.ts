import { Injectable, Logger } from '@nestjs/common'; import { MeiliSearch } from 'meilisearch';
@Injectable() export class MeiliService {
  private client!: MeiliSearch; private rides!: any; private readonly logger = new Logger(MeiliService.name);
  async init(){ const host = process.env.MEILISEARCH_URL || 'http://meilisearch:7700'; this.client = new MeiliSearch({ host });
    try{ const res = await this.client.createIndex('rides', { primaryKey:'rideId' }).catch((e:any)=>e); if(res?.taskUid) await this.client.waitForTask(res.taskUid); }
    catch(e:any){ if(e?.code!=='index_already_exists' && e?.statusCode!==409){ this.logger.warn(`createIndex error: ${e?.message || e}`);} }
    this.rides = this.client.index('rides'); try{ const task = await this.rides.updateSettings({
      searchableAttributes:['originCity','destinationCity'], filterableAttributes:['originCity','destinationCity','departureAt','pricePerSeat']
    }); if(task?.taskUid) await this.client.waitForTask(task.taskUid); } catch(e:any){ this.logger.warn(`updateSettings error: ${e?.message || e}`); } }
  private normalize(evt:any){ const rideId = evt.rideId || evt.id; return { rideId, originCity:evt.originCity, destinationCity:evt.destinationCity,
    departureAt:evt.departureAt, pricePerSeat:Number(evt.pricePerSeat??0), seatsTotal:Number(evt.seatsTotal??0), seatsAvailable:Number(evt.seatsAvailable??0),
    driverId:evt.driverId, status:evt.status }; }
  async indexRide(evt:any){ const doc = this.normalize(evt); if(!doc.rideId) throw new Error('missing rideId'); const task = await this.rides.addDocuments([doc]); if(task?.taskUid) await this.client.waitForTask(task.taskUid); }
  async search(params:any){ const filters:string[]=[]; if(params.from) filters.push(`originCity = "${params.from}"`); if(params.to) filters.push(`destinationCity = "${params.to}"`);
    const res = await this.rides.search('', { filter: filters.length ? filters.join(' AND ') : undefined, limit: 20 }); return res.hits; }
}
