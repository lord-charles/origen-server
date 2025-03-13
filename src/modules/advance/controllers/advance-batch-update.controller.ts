import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdvanceBatchUpdateService } from '../services/advance-batch-update.service';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateResult } from '../types/advance-batch-update.types';

class BatchUpdateAdvancesDto {
  @ApiProperty({
    description: 'Array of advance IDs to mark as repaid',
    example: ['64abc123def4567890ghijk0', '64abc123def4567890ghijk1'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  advanceIds: string[];
}

@ApiTags('Advances Repayment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('advances')
export class AdvanceBatchUpdateController {
  constructor(
    private readonly batchUpdateService: AdvanceBatchUpdateService,
  ) {}

  @Post('batch-mark-repaid')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Mark multiple advances as repaid',
    description: 'Updates the status of multiple advances to repaid if they are in repaying status. Will only update advances that are in repaying status and will return status for each advance processed.'
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the results of the batch update operation',
    type: 'object',
    schema: {
      properties: {
        updated: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              previousAmount: { type: 'number' },
              newAmount: { type: 'number' }
            }
          }
        },
        failed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              reason: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async batchMarkRepaid(
    @Body() batchUpdateDto: BatchUpdateAdvancesDto,
  ): Promise<UpdateResult> {
    return this.batchUpdateService.updateAdvancesToRepaid(batchUpdateDto.advanceIds);
  }
}
