import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { getModelToken } from '@nestjs/mongoose';
import { PushToken } from '../schemas/push-token.schema';
import { Model } from 'mongoose';
import { Expo } from 'expo-server-sdk';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPushTokenModel: Model<PushToken>;

  const mockExpoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
  const mockUserId = 'user123';

  beforeEach(async () => {
    mockPushTokenModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(PushToken.name),
          useValue: mockPushTokenModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('savePushToken', () => {
    it('should save a new push token', async () => {
      const mockToken = {
        userId: mockUserId,
        token: mockExpoToken,
        save: jest.fn().mockResolvedValue(true),
      };

      (mockPushTokenModel.findOne as jest.Mock).mockResolvedValue(null);
      (mockPushTokenModel as any).prototype.save = jest.fn().mockResolvedValue(mockToken);

      await service.savePushToken(mockUserId, mockExpoToken);

      expect(mockPushTokenModel.findOne).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should update existing push token', async () => {
      const mockExistingToken = {
        userId: mockUserId,
        token: 'old-token',
        save: jest.fn().mockResolvedValue(true),
      };

      (mockPushTokenModel.findOne as jest.Mock).mockResolvedValue(mockExistingToken);

      await service.savePushToken(mockUserId, mockExpoToken);

      expect(mockExistingToken.token).toBe(mockExpoToken);
      expect(mockExistingToken.save).toHaveBeenCalled();
    });

    it('should throw error for invalid token format', async () => {
      const invalidToken = 'invalid-token';

      await expect(service.savePushToken(mockUserId, invalidToken)).rejects.toThrow();
    });
  });

  describe('getUserPushTokens', () => {
    it('should return active push tokens for given user ids', async () => {
      const mockTokens = [
        { userId: 'user1', token: mockExpoToken, isActive: true },
        { userId: 'user2', token: mockExpoToken, isActive: true },
      ];

      (mockPushTokenModel.find as jest.Mock).mockResolvedValue(mockTokens);

      const result = await service.getUserPushTokens(['user1', 'user2']);

      expect(result).toHaveLength(2);
      expect(mockPushTokenModel.find).toHaveBeenCalledWith({
        userId: { $in: ['user1', 'user2'] },
        isActive: true,
      });
    });
  });

  describe('sendPushNotification', () => {
    it('should send push notification to valid tokens', async () => {
      const mockTokens = [{ userId: mockUserId, token: mockExpoToken }];
      (mockPushTokenModel.find as jest.Mock).mockResolvedValue(mockTokens);

      const result = await service.sendPushNotification(
        [mockUserId],
        'Test Title',
        'Test Body',
        { data: 'test' },
      );

      expect(result).toEqual({
        success: true,
        sentTo: 1,
      });
    });
  });
});
