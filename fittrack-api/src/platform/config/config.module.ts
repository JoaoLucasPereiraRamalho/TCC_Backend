import { Global, Module, type DynamicModule } from '@nestjs/common';
import 'dotenv/config';
import { APP_CONFIG, loadConfig, type AppConfig } from './app-config.js';

@Global()
@Module({})
export class ConfigModule {
  /** Lê e valida as variáveis uma única vez. `role` força o papel do processo (api ou worker). */
  static forRoot(role: AppConfig['processRole']): DynamicModule {
    const config: AppConfig = { ...loadConfig(process.env), processRole: role };
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
