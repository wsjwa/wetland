"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mapping_1 = require("./Mapping");
class Entity {
    static toObject(source) {
        if (Array.isArray(source)) {
            return source.map(target => Entity.toObject(target));
        }
        const mapping = Mapping_1.Mapping.forEntity(source);
        if (!mapping) {
            return source;
        }
        const object = mapping.getFieldNames().reduce((asObject, fieldName) => {
            asObject[fieldName] = source[fieldName];
            return asObject;
        }, {});
        const relations = mapping.getRelations();
        if (relations) {
            Reflect.ownKeys(relations).forEach(fieldName => {
                if (typeof source[fieldName] !== 'undefined') {
                    object[fieldName] = source[fieldName];
                }
            });
        }
        return object;
    }
    toObject() {
        return Entity.toObject(this);
    }
}
exports.Entity = Entity;
