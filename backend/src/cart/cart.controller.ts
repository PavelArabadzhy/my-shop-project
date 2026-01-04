import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}

    @Get()
    getCart() {
        return this.cartService.getCart();
    }

    @Post()
    addToCart(@Body('productId') productId: string) {
        return this.cartService.addToCart(productId);
    }

    @Delete()
    clearCart() {
        return this.cartService.clearCart();
    }
}