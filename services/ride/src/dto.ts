import { IsString, IsInt, Min, IsISO8601 } from 'class-validator';
export class CreateRideDto { @IsString() driverId!: string; @IsString() originCity!: string; @IsString() destinationCity!: string;
  @IsISO8601() departureAt!: string; @IsInt() @Min(1) seatsTotal!: number; @IsInt() @Min(0) pricePerSeat!: number; }
