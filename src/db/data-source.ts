import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv   from 'dotenv';
import * as path     from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * DataSource для TypeORM CLI.
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:generate -- --name=AddTable
 */
export const AppDataSource = new DataSource({
  type:        'postgres',
  url:         process.env.DATABASE_URL,
  ssl:         process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  entities:    ['src/**/*.entity.ts'],
  migrations:  ['src/db/migrations/*.ts'],
  synchronize: false,
  logging:     process.env.NODE_ENV !== 'production',
});
