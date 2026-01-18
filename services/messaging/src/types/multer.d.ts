declare module 'multer' {
  import type { Request } from 'express';

  export interface StorageEngine {}

  export interface DiskStorageOptions {
    destination?:
      | string
      | ((req: Request, file: Express.Multer.File, cb: (error: any, destination: string) => void) => void);
    filename?: (req: Request, file: Express.Multer.File, cb: (error: any, filename: string) => void) => void;
  }

  export function diskStorage(options: DiskStorageOptions): StorageEngine;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
      }
    }
  }
}

export {};
