import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // `credentials: true` is required so the visitor_id cookie can be sent
  // back to the browser; it also forces us to specify an explicit origin
  // instead of '*', which the Fetch spec forbids when credentials are used.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'https://www.stapesite.com',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();