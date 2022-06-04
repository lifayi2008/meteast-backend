export interface CommonResponse {
  status: number;
  message: string;
  data?: any;
}

export enum UserType {
  Admin,
  User = 2,
  M,
}
