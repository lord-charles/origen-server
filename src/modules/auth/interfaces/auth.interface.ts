import { User } from '../schemas/user.schema';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface AuthResponse {
  user: Partial<User>;
  token: string;
}

export interface TokenPayload {
  token: string;
  expiresIn: number;
}
