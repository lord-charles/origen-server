import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/user.dto';
import { LoginUserDto } from './dto/login.dto';
import {
  JwtPayload,
  AuthResponse,
  TokenPayload,
} from './interfaces/auth.interface';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await this.userService.findByNationalId(
      createUserDto.nationalId,
    );
    if (existingUser) {
      throw new ConflictException('User with this National ID already exists');
    }

    // Create user with the provided DTO (let UserService handle PIN hashing)
    const user = await this.userService.register(createUserDto);

    // Generate token
    const token = await this.generateToken(user);

    // Return user data (excluding sensitive information) and token
    return {
      user: this.sanitizeUser(user),
      token: token.token,
    };
  }

  async login(loginUserDto: LoginUserDto): Promise<AuthResponse> {
    // Find user by national ID
    const user = await this.userService.findByNationalId(
      loginUserDto.nationalId,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify PIN
    const isValidPin = await this.verifyPin(loginUserDto.pin, user.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate token
    const token = await this.generateToken(user);

    // Return user data and token
    return {
      user: this.sanitizeUser(user),
      token: token.token,
    };
  }

  /**
   * Generate JWT token
   * @param user User object
   * @returns Token and expiration
   */
  private async generateToken(user: User): Promise<TokenPayload> {
    const payload: JwtPayload = {
      sub: (user as UserDocument)._id.toString(),
      email: user.email,
      roles: user.roles,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  /**
   * Verify PIN
   * @param plainPin Plain text PIN
   * @param hashedPin Hashed PIN
   * @returns boolean
   */
  private async verifyPin(
    plainPin: string,
    hashedPin: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPin, hashedPin);
  }

  /**
   * Remove sensitive information from user object
   * @param user User object
   * @returns Sanitized user object
   */
  sanitizeUser(user: User | UserDocument): Partial<User> {
    const userObj = 'toObject' in user ? user.toObject() : user;
    const { pin, ...sanitizedUser } = userObj;
    return sanitizedUser;
  }

  /**
   * Get user profile by ID
   * @param userId User ID
   * @returns Sanitized user profile
   */
  async getUserProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }
}
