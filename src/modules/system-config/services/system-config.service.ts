import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SystemConfig } from '../schemas/system-config.schema';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
} from '../dto/system-config.dto';
import {
  AddSuspensionPeriodDto,
  UpdateSuspensionPeriodDto,
} from '../dto/suspension-period.dto';
import { SuspensionPeriod } from '../interfaces/suspension-period.interface';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
  ) {}

  async create(createDto: CreateSystemConfigDto, userId: string) {
    const config = await this.systemConfigModel.create({
      ...createDto,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
    return config;
  }

  async findAll() {
    return this.systemConfigModel
      .find()
      .populate([
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' },
      ])
      .exec();
  }

  async findByKey(key: string) {
    const config = await this.systemConfigModel
      .findOne({ key })
      .populate([
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' },
        { path: 'suspensionPeriods.createdBy', select: 'firstName lastName' },
        { path: 'suspensionPeriods.updatedBy', select: 'firstName lastName' },
      ])
      .exec();
    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }
    return config;
  }

  async findByType(type: string) {
    return this.systemConfigModel
      .find({ type })
      .populate([
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' },
      ])
      .exec();
  }

  async update(key: string, updateDto: UpdateSystemConfigDto, userId: string) {
    const config = await this.systemConfigModel
      .findOneAndUpdate(
        { key },
        { ...updateDto, updatedBy: new Types.ObjectId(userId) },
        { new: true },
      )
      .populate([
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' },
        { path: 'suspensionPeriods.createdBy', select: 'firstName lastName' },
        { path: 'suspensionPeriods.updatedBy', select: 'firstName lastName' },
      ])
      .exec();

    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    return config;
  }

  async remove(key: string) {
    const config = await this.systemConfigModel
      .findOneAndDelete({ key })
      .exec();

    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    return config;
  }

  async updateSuspensionPeriod(
    key: string,
    updateDto: UpdateSuspensionPeriodDto,
    userId: string,
  ) {
    const config = await this.systemConfigModel.findOne({ key }).exec();
    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    if (
      !config.suspensionPeriods ||
      updateDto.index >= config.suspensionPeriods.length
    ) {
      throw new NotFoundException('Invalid suspension period index');
    }

    // Update the suspension period

    config.suspensionPeriods[updateDto.index] = {
      startDate: updateDto.startDate,
      endDate: updateDto.endDate,
      reason: updateDto.reason,
      isActive: updateDto.isActive,
      updatedBy: new Types.ObjectId(userId),
    };
    config.updatedBy = new Types.ObjectId(userId);

    return await config.save();
  }

  async toggleSuspensionPeriod(
    key: string,
    index: number,
    isActive: boolean,
    userId: string,
  ) {
    const config = await this.systemConfigModel.findOne({ key }).exec();
    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    if (
      !config.suspensionPeriods ||
      index >= config.suspensionPeriods.length ||
      index < 0
    ) {
      throw new NotFoundException(
        `Suspension period at index ${index} not found`,
      );
    }

    config.suspensionPeriods[index].isActive = isActive;
    config.updatedBy = new Types.ObjectId(userId);

    return config.save();
  }

  async addSuspensionPeriod(
    key: string,
    addDto: AddSuspensionPeriodDto,
    userId: string,
  ) {
    const config = await this.systemConfigModel.findOne({ key }).exec();
    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    if (!config.suspensionPeriods) {
      config.suspensionPeriods = [];
    }

    config.suspensionPeriods.push({
      ...addDto,
      isActive: true,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
    config.updatedBy = new Types.ObjectId(userId);

    return config.save();
  }

  // Helper methods for specific configurations
  async getLoanConfig() {
    return this.findByKey('loan_config');
  }

  async getAdvanceConfig() {
    return this.findByKey('advance_config');
  }

  async getWalletConfig() {
    return this.findByKey('wallet_config');
  }

  async getMpesaConfig() {
    return this.findByKey('mpesa_config');
  }
}
