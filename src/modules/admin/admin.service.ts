import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class AdminService {
  getAnalytics(): never {
    throw new NotImplementedException(
      'Admin analytics are not implemented yet',
    );
  }
}
