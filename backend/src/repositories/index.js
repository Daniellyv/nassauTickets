import { env } from '../config/env.js';
import { criarMemoryRepository } from './memoryRepository.js';
import { criarMysqlRepository } from './mysqlRepository.js';

/** Cria o repositório conforme DB_DRIVER ('mysql' ou 'memory'). */
export function criarRepositorio(driver = env.driverBanco) {
  if (driver === 'memory') return criarMemoryRepository();
  if (driver === 'mysql') return criarMysqlRepository();
  throw new Error(`DB_DRIVER inválido: "${driver}" (use "mysql" ou "memory").`);
}
