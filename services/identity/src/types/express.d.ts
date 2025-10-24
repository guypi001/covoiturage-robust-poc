// Étend les types Express pour ajouter "user" sur la requête
import "express";

declare global {
  namespace Express {
    interface User {
      sub: string;
      email?: string;
      roles?: string[];
    }
  }
}
