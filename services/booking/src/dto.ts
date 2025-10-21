import { IsString, IsInt, Min } from 'class-validator';
export class CreateBookingDto { @IsString() rideId!: string; @IsString() passengerId!: string; @IsInt() @Min(1) seats!: number; }
