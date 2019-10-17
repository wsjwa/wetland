"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Tag {
    static setMapping(mapping) {
        mapping.field('id', { type: 'integer' }).primary('id').generatedValue('id', 'autoIncrement');
        mapping.field('name', { type: 'string', size: 24 });
        mapping.manyToMany('images', { targetEntity: 'Image', mappedBy: 'tags' });
        mapping.manyToMany('categories', { targetEntity: 'Category', mappedBy: 'tags' });
        mapping
            .cascade('creator', ['persist'])
            .manyToOne('creator', { targetEntity: 'User', inversedBy: 'tags' });
    }
}
exports.Tag = Tag;
