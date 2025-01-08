import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import {
  LoginUserDto,
  EmailDto,
  ResetPasswordDto,
  UpdatePasswordDto,
} from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './schemas/user.schema';
import { NotificationService } from '../notifications/services/notification.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}

  private generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async register(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: createUserDto.email },
        { phoneNumber: createUserDto.phoneNumber },
        { nationalId: createUserDto.nationalId },
      ],
    });

    if (existingUser) {
      throw new BadRequestException(
        'User with provided details already exists',
      );
    }

    // Generate a 4-digit PIN
    const generatedPin = this.generatePin();
    const hashedPin = await bcrypt.hash(generatedPin, 10);

    // Create a new user object without the roles
    const { roles, pin, ...userData } = createUserDto;

    // Create the new user with explicit roles assignment
    const newUser = new this.userModel({
      ...userData,
      pin: hashedPin,
      roles: Array.isArray(roles) && roles.length > 0 ? roles : ['employee'],
    });

    // Save the user
    const savedUser = await newUser.save();

    // Send PIN via SMS
    const message = `Your Innova App login PIN is: ${generatedPin}. Please keep this PIN secure and do not share it with anyone.`;
    await this.notificationService.sendSMS(savedUser.phoneNumber, message);

    return savedUser;
  }

  async login(
    loginUserDto: LoginUserDto,
  ): Promise<{ token: string; user: User }> {
    const user = await this.userModel.findOne({
      nationalId: loginUserDto.nationalId,
    });

    if (!user || !(await bcrypt.compare(loginUserDto.pin, user.pin))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  /**
   * @description Logout the current employee
   */
  async logout(): Promise<{ message: string }> {
    // Handle JWT invalidation here if required
    return { message: 'Logged out successfully' };
  }

  /**
   * @description Request PIN reset
   * @param emailDto
   */
  async requestPasswordReset(emailDto: EmailDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: emailDto.email });
    if (!user) throw new NotFoundException('Email not found');

    // Logic for generating and sending reset token to email
    return { message: 'Password reset instructions sent to email' };
  }

  /**
   * @description Reset PIN
   * @param resetPasswordDto
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    // Implement token validation logic here
    const hashedPin = await bcrypt.hash(resetPasswordDto.newPin, 10);
    await this.userModel.updateOne(
      { email: resetPasswordDto.token },
      { pin: hashedPin },
    );

    return { message: 'Password reset successfully' };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  /**
   * @description List all employees with optional filters
   * @param filters
   * @returns Paginated list of employees
   */
  async findAll(filters: any): Promise<{ data: User[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      department,
      employmentType,
    } = filters;

    // Build query object with only defined filters
    const query: any = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (employmentType) query.employmentType = employmentType;

    // Execute query with pagination
    const data = await this.userModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }); // Sort by newest first

    const total = await this.userModel.countDocuments(query);
    return { data, total };
  }

  /**
   * @description Update an employee's details
   * @param id
   * @param updateUserDto
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id,
      updateUserDto,
      { new: true },
    );
    if (!updatedUser) throw new NotFoundException('User not found');

    return updatedUser;
  }

  /**
   * @description Delete an employee by ID
   * @param id
   */
  async remove(id: string): Promise<void> {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundException('User not found');
  }

  /**
   * @description Update an employee's PIN
   * @param updatePasswordDto
   */
  async updatePassword(
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(updatePasswordDto.userId);

    if (
      !user ||
      !(await bcrypt.compare(updatePasswordDto.currentPin, user.pin))
    ) {
      throw new BadRequestException('Invalid current PIN');
    }

    const hashedPin = await bcrypt.hash(updatePasswordDto.newPin, 10);
    user.pin = hashedPin;
    await user.save();

    return { message: 'Password updated successfully' };
  }

  /**
   * Find a user by National ID
   * @param nationalId National ID
   * @returns User
   */
  async findByNationalId(nationalId: string): Promise<User> {
    const user = await this.userModel.findOne({ nationalId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
