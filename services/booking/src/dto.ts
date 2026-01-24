import { IsString, IsInt, Min, IsOptional } from 'class-validator';
export class CreateBookingDto {
  @IsString() rideId!: string;
  @IsString() passengerId!: string;
  @IsInt() @Min(1) seats!: number;
  @IsOptional() @IsString() passengerName?: string;
  @IsOptional() @IsString() passengerEmail?: string;
  @IsOptional() @IsString() passengerPhone?: string;
}
