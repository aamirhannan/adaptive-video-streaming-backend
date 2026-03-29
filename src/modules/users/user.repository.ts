import { UserModel, type UserDocument } from './user.model.js';

type CreateUserInput = {
  email: string;
  password: string;
  role?: 'admin' | 'editor' | 'viewer';
};

export class UserRepository {
  async create(input: CreateUserInput): Promise<UserDocument> {
    const user = new UserModel(input);
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).select('+password').exec();
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ userId }).exec();
  }
}
