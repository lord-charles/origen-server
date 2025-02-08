import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemLog, SystemLogDocument, LogSeverity } from '../schemas/system-log.schema';
import { Request } from 'express';

@Injectable()
export class SystemLogsService {
  constructor(
    @InjectModel(SystemLog.name)
    private systemLogModel: Model<SystemLogDocument>,
  ) {}

  async createLog(
    event: string,
    details: string,
    severity: LogSeverity = LogSeverity.INFO,
    userId?: string,
    req?: Request,
  ) {
    const log = new this.systemLogModel({
      event,
      details,
      severity,
      userId,
      ipAddress: req?.ip,
      timestamp: new Date(),
    });

    return log.save();
  }

  async getLogs(
    page = 1,
    limit = 2000,
    severity?: LogSeverity,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query: any = {};

    if (severity) {
      query.severity = severity;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.systemLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.systemLogModel.countDocuments(query),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
