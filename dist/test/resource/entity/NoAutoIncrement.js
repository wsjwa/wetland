"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NoAutoIncrement {
    static setMapping(mapping) {
        mapping.field('id', { type: 'integer' }).primary('id');
        mapping.field('foo', { type: 'string' });
    }
}
exports.NoAutoIncrement = NoAutoIncrement;
