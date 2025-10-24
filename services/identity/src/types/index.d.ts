import "express";

declare global {
  namespace Express {
    interface User {
      sub: string;
      email?: string;
      roles?: string[];
    }
    interface Request {
      user?: User;
    }
  }
}
