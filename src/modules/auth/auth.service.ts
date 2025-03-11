import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/user.dto';
import { LoginUserDto } from './dto/login.dto';
import { ResetPinDto } from './dto/reset-password.dto';
import {
  JwtPayload,
  AuthResponse,
  TokenPayload,
} from './interfaces/auth.interface';
import { User, UserDocument } from './schemas/user.schema';
import { SystemLogsService } from '../system-logs/services/system-logs.service';
import { LogSeverity } from '../system-logs/schemas/system-log.schema';
import { Request } from 'express';
import { NotificationService } from '../notifications/services/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly systemLogsService: SystemLogsService,
    private readonly notificationService: NotificationService,
  ) {}

  async register(
    createUserDto: CreateUserDto,
    req?: Request,
  ): Promise<AuthResponse> {
    try {
      // Check if user exists using the UserService's register method which already checks for duplicates
      const user = await this.userService.register(createUserDto);

      // Generate token
      const token = await this.generateToken(user);

      // Log successful registration
      await this.systemLogsService.createLog(
        'User Registration',
        `New user registered: ${user.firstName} ${user.lastName} (${user.email})`,
        LogSeverity.INFO,
        user.employeeId.toString(),
        req,
      );

      // Return user data (excluding sensitive information) and token
      return {
        user: this.sanitizeUser(user),
        token: token.token,
      };
    } catch (error) {
      // Log registration failure
      await this.systemLogsService.createLog(
        'Registration Failed',
        `Registration failed for email ${createUserDto.email}: ${error.message}`,
        LogSeverity.ERROR,
        undefined,
        req,
      );

      // Re-throw BadRequestException for duplicate users
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Handle other errors
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async login(
    loginUserDto: LoginUserDto,
    req?: Request,
  ): Promise<AuthResponse> {
    try {
      // Find user by national ID
      const user = await this.userService.findByNationalId(
        loginUserDto.nationalId,
      );

      if (!user) {
        await this.systemLogsService.createLog(
          'Login Failed',
          `Failed login attempt with National ID: ${loginUserDto.nationalId}`,
          LogSeverity.WARNING,
          undefined,
          req,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (user.status !== 'active') {
        await this.systemLogsService.createLog(
          'Inactive Account Login',
          `Login attempt on inactive account: ${user.firstName} ${user.lastName}`,
          LogSeverity.WARNING,
          user.employeeId.toString(),
          req,
        );
        throw new UnauthorizedException('Account is not active');
      }

      // Verify PIN
      const isValidPin = await this.verifyPin(loginUserDto.pin, user.pin);
      if (!isValidPin) {
        await this.systemLogsService.createLog(
          'Invalid PIN',
          `Invalid PIN entered for user: ${user.firstName} ${user.lastName}`,
          LogSeverity.WARNING,
          user.employeeId.toString(),
          req,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate token
      const token = await this.generateToken(user);

      // Log successful login
      await this.systemLogsService.createLog(
        'User Login',
        `User ${user.firstName} ${user.lastName} logged in successfully`,
        LogSeverity.INFO,
        user.employeeId.toString(),
        req,
      );

      // Return user data and token
      return {
        user: this.sanitizeUser(user),
        token: token.token,
      };
    } catch (error) {
      // If error wasn't already logged (from above), log it
      if (!(error instanceof UnauthorizedException)) {
        await this.systemLogsService.createLog(
          'Login Error',
          `Unexpected error during login: ${error.message}`,
          LogSeverity.ERROR,
          undefined,
          req,
        );
      }
      throw error;
    }
  }

  async resetPin(
    resetPinDto: ResetPinDto,
    req?: Request,
  ): Promise<{ message: string }> {
    try {
      // Find user by national ID
      const user = await this.userService.findByNationalId(
        resetPinDto.nationalId,
      );

      if (!user) {
        throw new NotFoundException('User not found with this National ID');
      }

      const newPin = this.generatePin();
      const hashedPin = await bcrypt.hash(newPin, 10);

      await this.userService.updatePin(user.nationalId, hashedPin);

      if (user.phoneNumber) {
        await this.notificationService.sendRegistrationPin(
          user.phoneNumber,
          user.email,
          `Your new Innova App login PIN is: ${newPin}. Please keep this PIN secure and do not share it with anyone.`,
        );

        // Log PIN reset
        await this.systemLogsService.createLog(
          'PIN Reset',
          `PIN reset completed for user: ${user.firstName} ${user.lastName}`,
          LogSeverity.INFO,
          user.employeeId.toString(),
          req,
        );

        return {
          message: 'PIN has been reset and sent to your phone number',
        };
      } else {
        throw new BadRequestException('No phone number found for this user');
      }
    } catch (error) {
      // Log reset failure
      await this.systemLogsService.createLog(
        'PIN Reset Failed',
        `PIN reset failed for National ID ${resetPinDto.nationalId}: ${error.message}`,
        LogSeverity.ERROR,
        undefined,
        req,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`PIN reset failed: ${error.message}`);
    }
  }

  private generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async generateToken(user: User): Promise<TokenPayload> {
    const payload: JwtPayload = {
      sub: (user as UserDocument)._id.toString(),
      email: user.email,
      roles: user.roles,
    };

    // For 1 year: 365 days * 24 hours * 60 minutes * 60 seconds
    const token = this.jwtService.sign(payload, {
      expiresIn: 365 * 24 * 60 * 60,
    });

    return {
      token,
      expiresIn: 365 * 24 * 60 * 60,
    };
  }

  /**
   * Verify PIN
   */
  private async verifyPin(
    plainPin: string,
    hashedPin: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPin, hashedPin);
  }

  /**
   * Remove sensitive information from user object
   */
  sanitizeUser(user: User | UserDocument): Partial<User> {
    const userObj = 'toObject' in user ? user.toObject() : user;
    const { pin, ...sanitizedUser } = userObj;
    return sanitizedUser;
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }
}
