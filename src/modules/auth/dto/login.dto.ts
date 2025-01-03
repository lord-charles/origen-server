import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsMongoId,
} from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    description: 'Employee national ID number',
    example: '23456789',
  })
  @IsString()
  @IsNotEmpty()
  nationalId: string;

  @ApiProperty({
    description: '4-digit authentication PIN',
    example: '1234',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  @IsNotEmpty()
  pin: string;
}

export class EmailDto {
  @ApiProperty({
    description: 'Employee email address',
    example: 'jane.wanjiku@company.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token received via email',
    example: 'abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'New 4-digit authentication PIN',
    example: '5678',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  @IsNotEmpty()
  newPin: string;
}

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current 4-digit authentication PIN',
    example: '1234',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  @IsNotEmpty()
  currentPin: string;

  @ApiProperty({
    description: 'New 4-digit authentication PIN',
    example: '5678',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  @IsNotEmpty()
  newPin: string;

  @ApiProperty({
    description: 'Employee ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}
