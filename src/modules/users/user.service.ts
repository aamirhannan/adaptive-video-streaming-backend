import bcrypt from "bcryptjs";
import { HttpError } from "../../utils/http-error.js";
import { signAuthToken } from "../../utils/jwt.js";
import type { UserRole } from "./user.model.js";
import { UserRepository } from "./user.repository.js";

type RegisterInput = {
  email: string;
  password: string;
  role?: 'admin' | 'editor' | 'viewer';
};

type LoginInput = {
  email: string;
  password: string;
};

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(input: RegisterInput): Promise<{
    token: string;
    user: { userId: string; email: string; role: 'admin' | 'editor' | 'viewer' };
  }> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new HttpError(409, 'Email already exists');
    }

    const createUserInput =
      input.role !== undefined
        ? { email: input.email, password: input.password, role: input.role }
        : { email: input.email, password: input.password };

    const createdUser = await this.userRepository.create(createUserInput);

    const token = signAuthToken({
      userId: createdUser.userId,
      email: createdUser.email,
      role: createdUser.role,
    });

    return {
      token,
      user: {
        userId: createdUser.userId,
        email: createdUser.email,
        role: createdUser.role,
      },
    };
  }

  async login(input: LoginInput): Promise<{
    token: string;
    user: { userId: string; email: string; role: 'admin' | 'editor' | 'viewer' };
  }> {
    const user = await this.userRepository.findByEmailWithPassword(input.email);
    if (!user) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const token = signAuthToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getUserByUserId(userId: string): Promise<{
    userId: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
  }> {
    const user = await this.userRepository.findByUserId(userId);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };
  }

  async listUsersForAdmin(): Promise<
    Array<{
      userId: string;
      email: string;
      role: UserRole;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const users = await this.userRepository.findAll();
    return users.map((u) => ({
      userId: u.userId,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async updateUserRoleByUserId(targetUserId: string, role: UserRole): Promise<{
    userId: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const updated = await this.userRepository.updateRole(targetUserId, role);
    if (!updated) {
      throw new HttpError(404, "User not found");
    }

    return {
      userId: updated.userId,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
