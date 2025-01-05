import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemConfig } from '../schemas/system-config.schema';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
} from '../dto/system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
  ) {}

  async create(createDto: CreateSystemConfigDto, userId: string) {
    const config = await this.systemConfigModel.create({
      ...createDto,
      updatedBy: userId,
    });
    return config;
  }

  async findAll() {
    return this.systemConfigModel.find().exec();
  }

  async findByKey(key: string) {
    const config = await this.systemConfigModel.findOne({ key }).exec();
    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }
    return config;
  }

  async findByType(type: string) {
    return this.systemConfigModel.find({ type }).exec();
  }

  async update(key: string, updateDto: UpdateSystemConfigDto, userId: string) {
    const config = await this.systemConfigModel
      .findOneAndUpdate(
        { key },
        { ...updateDto, updatedBy: userId },
        { new: true },
      )
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
