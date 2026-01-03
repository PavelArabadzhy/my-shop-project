import { Injectable } from '@nestjs/common';

export interface CartItem {
    productId: string;
    quantity: number;
}

@Injectable()
export class CartService {
    private items: CartItem[] = [];

    getCart(): CartItem[] {
        return this.items;
    }

    addToCart(productId: string): CartItem[] {
        const existingItem = this.items.find(
            (item) => item.productId === productId,
        );

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.items.push({
                productId,
                quantity: 1,
            });
        }

        return this.items;
    }

    clearCart(): CartItem[] {
        this.items = [];
        return this.items;
    }
}