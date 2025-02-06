import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPinDto {
  @ApiProperty({
    description: 'National ID number of the user',
    example: '12345678',
  })
  @IsNotEmpty({ message: 'National ID is required' })
  @IsString({ message: 'National ID must be a string' })
  nationalId: string;
}
