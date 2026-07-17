import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { VisitorModule } from './visitor/visitor.module';
import { VisitorMiddleware } from './visitor/visitor.middleware';

@Module({
  imports: [ProductsModule, CartModule, OrdersModule, VisitorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // POST /visitor-id/recover manages cookie creation/restoration itself,
    // so it is excluded to avoid the middleware pre-assigning a random UUID
    // before the recovery logic gets a chance to use the client's value.
    consumer
      .apply(VisitorMiddleware)
      .exclude('visitor-id/recover')
      .forRoutes('*');
  }
}
