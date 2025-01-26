import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Advance } from '../../advance/schemas/advance.schema';
import { User } from '../../auth/schemas/user.schema';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
  setDate,
} from 'date-fns';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<Advance>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async getDashboardStatistics() {
    const now = new Date('2025-01-26T22:38:14+02:00');
    const lastMonth = subMonths(now, 1);
    const lastQuarter = subMonths(now, 3);
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    // Card 1: Total Employees
    const [employeeStats] = await this.userModel.aggregate([
      {
        $facet: {
          total: [
            { $match: { status: { $in: ['active', 'inactive'] } } },
            { $count: 'count' },
            {
              $group: {
                _id: null,
                count: { $first: '$count' },
                departments: { $addToSet: '$department' },
              },
            },
          ],
          lastQuarter: [
            {
              $match: {
                status: { $in: ['active', 'inactive'] },
                createdAt: { $lte: lastQuarter },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const totalEmployees = employeeStats.total[0]?.count || 0;
    const lastQuarterEmployees = employeeStats.lastQuarter[0]?.count || 0;
    const employeeGrowth =
      lastQuarterEmployees === 0
        ? 0
        : ((totalEmployees - lastQuarterEmployees) / lastQuarterEmployees) *
          100;

    const [advanceStats] = await this.advanceModel.aggregate([
      {
        $facet: {
          totals: [
            {
              $match: {
                status: {
                  $in: ['approved', 'repaying', 'disbursed', 'repaid'],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalRepaid: { $sum: '$amountRepaid' },
                count: { $sum: 1 },
              },
            },
          ],
          active: [
            {
              $match: {
                status: { $in: ['approved', 'repaying', 'disbursed'] },
              },
            },
            {
              $match: {
                $expr: {
                  $lt: ['$amountRepaid', '$totalRepayment'],
                },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalInterestRate: { $sum: '$interestRate' },
                totalOutstandingInterest: {
                  $sum: {
                    $multiply: [
                      { $subtract: ['$amount', '$amountRepaid'] },
                      { $divide: ['$interestRate', 100] },
                      { $divide: ['$repaymentPeriod', 12] },
                    ],
                  },
                },
              },
            },
          ],
          dueThisMonth: [
            {
              $match: {
                $or: [
                  { status: 'approved' },
                  { status: 'repaying' },
                  { status: 'disbursed' },
                ],
                amountRepaid: { $lt: '$totalRepayment' },
                disbursedDate: {
                  $gte: startOfCurrentMonth,
                  $lte: endOfCurrentMonth,
                },
              },
            },
            { $count: 'count' },
          ],
          utilizationStats: [
            {
              $match: {
                status: {
                  $in: ['approved', 'repaying', 'disbursed', 'repaid'],
                },
              },
            },
            {
              $group: {
                _id: '$employee',
                hasAdvance: { $first: 1 },
              },
            },
            {
              $group: {
                _id: null,
                totalEmployeesWithAdvances: { $sum: 1 },
              },
            },
          ],
          lastMonthUtilization: [
            {
              $match: {
                status: {
                  $in: ['approved', 'repaying', 'disbursed', 'repaid'],
                },
                createdAt: { $lte: lastMonth },
              },
            },
            {
              $group: {
                _id: '$employee',
                hasAdvance: { $first: 1 },
              },
            },
            {
              $group: {
                _id: null,
                totalEmployeesLastMonth: { $sum: 1 },
              },
            },
          ],
          atRisk: [
            {
              $match: {
                $or: [
                  { status: 'approved' },
                  { status: 'repaying' },
                  { status: 'disbursed' },
                ],
                disbursedDate: { $lt: lastMonth },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                amountRepaid: 1,
                totalRepayment: 1,
                disbursedDate: 1,
                isNotFullyRepaid: {
                  $cond: {
                    if: { $lt: ['$amountRepaid', '$totalRepayment'] },
                    then: true,
                    else: false,
                  },
                },
              },
            },
            {
              $match: {
                isNotFullyRepaid: true,
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          lastMonthAtRisk: [
            {
              $match: {
                $or: [{ status: 'approved' }, { status: 'repaying' }],
                amountRepaid: { $lt: '$totalRepayment' },
                disbursedDate: {
                  $lte: subMonths(now, 2),
                  $gt: subMonths(now, 1),
                },
              },
            },
            {
              $addFields: {
                expectedRepayment: {
                  $multiply: [
                    '$installmentAmount',
                    {
                      $ceil: {
                        $divide: [
                          { $subtract: [lastMonth, '$disbursedDate'] },
                          1000 * 60 * 60 * 24 * 30,
                        ],
                      },
                    },
                  ],
                },
              },
            },
            {
              $match: {
                $expr: {
                  $lt: ['$amountRepaid', '$expectedRepayment'],
                },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const totals = advanceStats.totals[0] || {
      totalAmount: 0,
      totalRepaid: 0,
      count: 0,
    };
    const active = advanceStats.active[0] || {
      count: 0,
      totalInterestRate: 0,
      totalOutstandingInterest: 0,
    };
    const dueThisMonth = advanceStats.dueThisMonth[0]?.count || 0;
    const utilization =
      advanceStats.utilizationStats[0]?.totalEmployeesWithAdvances || 0;
    const lastMonthUtilization =
      advanceStats.lastMonthUtilization[0]?.totalEmployeesLastMonth || 0;
    const atRisk = advanceStats.atRisk[0]?.count || 0;
    const lastMonthAtRisk = advanceStats.lastMonthAtRisk[0]?.count || 0;

    const outstandingAmount = totals.totalAmount - totals.totalRepaid;
    const repaymentRate =
      totals.totalAmount === 0
        ? 0
        : (totals.totalRepaid / totals.totalAmount) * 100;
    const activeAdvancePercentage =
      totals.count === 0 ? 0 : (active.count / totals.count) * 100;
    const utilizationRate =
      totalEmployees === 0 ? 0 : (utilization / totalEmployees) * 100;
    const utilizationChange =
      lastMonthUtilization === 0
        ? 0
        : ((utilization - lastMonthUtilization) / lastMonthUtilization) * 100;
    const monthlyInterestRate =
      active.count === 0 ? 0 : active.totalInterestRate / active.count;
    const atRiskPercentage =
      totals.count === 0 ? 0 : (atRisk / totals.count) * 100;
    const atRiskDifference = atRisk - lastMonthAtRisk;

    return {
      employees: {
        total: totalEmployees,
        quarterlyGrowth: employeeGrowth.toFixed(1),
        description: 'Across all departments',
      },
      advances: {
        total: {
          amount: Math.round(totals.totalAmount || 0),
          outstanding: Math.round(outstandingAmount || 0),
          repaymentRate: Math.round(repaymentRate),
        },
        active: {
          count: active.count || 0,
          percentageOfTotal: Math.round(activeAdvancePercentage),
          dueThisMonth: dueThisMonth || 0,
        },
        utilization: {
          rate: Math.round(utilizationRate),
          employeesWithAdvances: utilization,
          monthlyChange: Math.round(utilizationChange),
        },
        interest: {
          monthlyRate: Math.round(monthlyInterestRate),
          earned: Math.round(active.totalOutstandingInterest || 0),
        },
        atRisk: {
          count: atRisk,
          percentageOfTotal: Math.round(atRiskPercentage),
          changeFromLastMonth: atRiskDifference,
        },
      },
    };
  }

  async getOverviewCharts() {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Get daily applications for the last 30 days
    const dailyApplications = await this.advanceModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: thirtyDaysAgo,
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          applications: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          applications: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    // Generate all dates in the last 30 days
    const allDates = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(now, 29 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // Merge with actual data, defaulting to 0 for dates with no applications
    const lineChartData = allDates.map((date) => ({
      date,
      applications:
        dailyApplications.find((d) => d.date === date)?.applications || 0,
    }));

    // Get status distribution
    const statusCounts = await this.advanceModel.aggregate([
      {
        $group: {
          _id: '$status',
          value: { $sum: 1 },
        },
      },
    ]);

    // Define all possible statuses
    const allStatuses = [
      'pending',
      'approved',
      'declined',
      'repaying',
      'repaid',
      'disbursed',
    ];

    // Create pie chart data with all statuses, defaulting to 0 for missing ones
    const pieChartData = allStatuses.map((status) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: statusCounts.find((s) => s._id === status)?.value || 0,
    }));

    return {
      lineChart: lineChartData,
      pieChart: pieChartData,
    };
  }

  async getDetailedStats() {
    // Get total amounts
    const [totals] = await this.advanceModel.aggregate([
      {
        $group: {
          _id: null,
          totalAdvanceAmount: { $sum: '$amount' },
          totalRepaidAmount: { $sum: '$amountRepaid' },
        },
      },
    ]);

    // Get payment method distribution
    const paymentMethodCounts = await this.advanceModel.aggregate([
      {
        $match: {
          preferredPaymentMethod: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$preferredPaymentMethod',
          value: { $sum: 1 },
        },
      },
    ]);

    // Define all payment methods with proper display names
    const paymentMethods = [
      { id: 'mpesa', display: 'Mpesa' },
      { id: 'bank', display: 'Bank Transfer' },
      { id: 'wallet', display: 'Wallet' },
    ];

    // Create payment methods data with all methods, defaulting to 0 for missing ones
    const paymentMethodsData = paymentMethods.map((method) => ({
      name: method.display,
      value: paymentMethodCounts.find((p) => p._id === method.id)?.value || 0,
    }));

    return {
      totals: {
        totalAdvanceAmount: Math.round(totals?.totalAdvanceAmount || 0),
        totalRepaidAmount: Math.round(totals?.totalRepaidAmount || 0),
      },
      paymentMethods: paymentMethodsData,
    };
  }

  async getMonthlyTrends(months = 6) {
    const now = new Date();
    const startDate = subMonths(now, months - 1); // -1 because we want to include current month

    // Get monthly stats
    const monthlyStats = await this.advanceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth(startDate) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalRequests: { $sum: 1 },
          approvedRequests: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    ['approved', 'repaying', 'disbursed', 'repaid'],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 8, // Using 8th as in your example
            },
          },
          totalRequests: 1,
          approvedRequests: 1,
          approvalRate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ['$approvedRequests', '$totalRequests'],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
    ]);

    // Generate all months in range
    const allMonths = Array.from({ length: months }, (_, i) => {
      const date = subMonths(now, months - 1 - i);
      return {
        date: format(setDate(date, 8), 'yyyy-MM-dd'),
        totalRequests: 0,
        approvedRequests: 0,
        approvalRate: 0,
      };
    });

    // Merge actual data with all months
    const trendsData = allMonths.map((month) => {
      const monthData = monthlyStats.find(
        (stat) => format(stat.date, 'yyyy-MM-dd') === month.date,
      );
      return monthData || month;
    });

    return trendsData;
  }

  async getRecentAdvanceStatCards() {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const currentMonthName = format(now, 'MMMM yyyy');

    // Get current month stats
    const [monthStats] = await this.advanceModel.aggregate([
      {
        $facet: {
          monthlyStats: [
            {
              $match: {
                createdAt: {
                  $gte: startOfCurrentMonth,
                  $lte: endOfCurrentMonth,
                },
              },
            },
            {
              $group: {
                _id: null,
                totalRequested: { $sum: '$amount' },
                approvedAmount: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          '$status',
                          ['approved', 'repaying', 'disbursed', 'repaid'],
                        ],
                      },
                      '$amount',
                      0,
                    ],
                  },
                },
              },
            },
          ],
          pendingRequests: [
            {
              $match: {
                status: 'pending',
              },
            },
            {
              $count: 'count',
            },
          ],
          uniqueRequesters: [
            {
              $group: {
                _id: '$employee',
              },
            },
            {
              $count: 'count',
            },
          ],
        },
      },
    ]);

    const monthlyStats = monthStats.monthlyStats[0] || {
      totalRequested: 0,
      approvedAmount: 0,
    };
    const pendingCount = monthStats.pendingRequests[0]?.count || 0;
    const uniqueCount = monthStats.uniqueRequesters[0]?.count || 0;

    return {
      totalRequested: {
        amount: Math.round(monthlyStats.totalRequested),
        period: `For ${currentMonthName}`,
      },
      approvedAmount: {
        amount: Math.round(monthlyStats.approvedAmount),
        period: `For ${currentMonthName}`,
      },
      pendingRequests: {
        count: pendingCount,
        description: 'Awaiting approval',
      },
      uniqueRequesters: {
        count: uniqueCount,
        description: 'Unique requesters',
      },
    };
  }
}
