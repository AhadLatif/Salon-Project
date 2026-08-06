import type { UserEntity, UserProps } from '../../domain/entities/user.entity.js';

export type NewUserPayload = Omit<UserProps, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: 'active' | 'suspended' | 'deleted';
};

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  createWithEmailAuth(userData: NewUserPayload, passwordHash: string): Promise<UserEntity>;
  findUserPassword(userId: string): Promise<string | null>;
  findEmailAuthProvider(userId: string): Promise<string | null>;
}
