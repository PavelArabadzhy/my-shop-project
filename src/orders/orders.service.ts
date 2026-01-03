import { Injectable, BadRequestException } from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
    constructor(
        private readonly cartService: CartService,
        private readonly productsService: ProductsService,
    ) {}

    createOrder() {
        const cartItems = this.cartService.getCart();

        if (cartItems.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        let total = 0;

        const items = cartItems.map((item) => {
            const product = this.productsService.getById(item.productId);

            const itemTotal = product.price * item.quantity;
            total += itemTotal;

            return {
                productId: product.id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                quantity: item.quantity,
            };
        });

        const order = {
            orderId: `order_${Date.now()}`,
            items,
            total,
            currency: items[0].currency,
        };

        this.cartService.clearCart();

        return order;
    }
}