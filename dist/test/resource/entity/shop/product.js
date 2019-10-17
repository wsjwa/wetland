"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const category_1 = require("./category");
const user_1 = require("./user");
class Product {
    static setMapping(mapping) {
        mapping.entity({ charset: 'utf8mb4', collate: 'utf8mb4_bin' });
        mapping.field('id', { type: 'integer' }).primary('id').generatedValue('id', 'autoIncrement');
        mapping.field('name', { type: 'string', size: 24 });
        mapping
            .cascade('image', ['persist'])
            .oneToOne('image', { targetEntity: 'Image' })
            .joinColumn('image', { name: 'image_id', referencedColumnName: 'id' });
        mapping
            .manyToOne('author', { targetEntity: user_1.User, inversedBy: 'products' })
            .joinColumn('author', { name: 'author_id', referencedColumnName: 'id' });
        mapping
            .cascade('categories', ['persist'])
            .manyToMany('categories', { targetEntity: category_1.Category, inversedBy: 'products' })
            .joinTable('categories', {
            name: 'product_custom_join_category',
            joinColumns: [{ referencedColumnName: 'id', name: 'product_id' }],
            inverseJoinColumns: [{ referencedColumnName: 'id', name: 'category_id' }],
        });
    }
}
exports.Product = Product;
