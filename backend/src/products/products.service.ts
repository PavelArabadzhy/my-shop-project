import { Injectable, NotFoundException } from '@nestjs/common';
import {Product} from "./product.interface";

@Injectable()
export class ProductsService {
    private products: Product[] = [
        {id: 'p1', name: 'T-shirt', price: 25, currency: 'EUR'},
        {id: 'p2', name: 'Hoodie', price: 60, currency: 'EUR'},
        {id: 'p3', name: 'Cap', price: 15, currency: 'EUR'},
    ];

    getAll(): Product[] {
        return this.products;
    }

    getById(id: string): Product {
        const product = this.products.find(product => product.id === id);
        if (!product) {
            throw new NotFoundException(`Product with ID "${id}" not found`);
        }
        return product;
    }
}
