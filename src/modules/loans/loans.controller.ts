import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CreateLoanDto, UpdateLoanStatusDto, LoanFilterDto } from './dto/loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new loan request' })
  @ApiResponse({
    status: 201,
    description: 'Loan request created successfully',
  })
  async create(@Req() req: Request, @Body() createLoanDto: CreateLoanDto) {
    const employeeId = (req.user as any)._id;
    return this.loansService.create(employeeId, createLoanDto);
  }

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all loans with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Returns all loans matching the filters',
  })
  async findAll(@Query() filterDto: LoanFilterDto) {
    return this.loansService.findAll(filterDto);
  }

  @Get('my-loans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all loans for the current employee' })
  @ApiResponse({
    status: 200,
    description: 'Returns all loans for the current employee',
  })
  async findMyLoans(@Req() req: Request) {
    const employeeId = (req.user as any)._id;
    return this.loansService.findByEmployee(employeeId);
  }

  @Get('statistics')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get loan statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns loan statistics',
  })
  async getStatistics() {
    return this.loansService.getLoanStatistics();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific loan by ID' })
  @ApiParam({
    name: 'id',
    description: 'Loan ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the loan details',
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update loan status' })
  @ApiParam({
    name: 'id',
    description: 'Loan ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateLoanStatusDto: UpdateLoanStatusDto,
    @Req() req: Request,
  ) {
    const adminId = (req.user as any)._id;
    return this.loansService.updateStatus(id, adminId, updateLoanStatusDto);
  }
}
