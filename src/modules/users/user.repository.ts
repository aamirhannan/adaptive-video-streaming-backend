import { UserModel, type UserDocument, type UserRole } from "./user.model.js";

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

  async findAll(): Promise<UserDocument[]> {
    return UserModel.find().sort({ createdAt: -1 }).exec();
  }

  async updateRole(userId: string, role: UserRole): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate({ userId }, { role }, { new: true }).exec();
  }
}
