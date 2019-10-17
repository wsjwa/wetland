"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UnitOfWork_1 = require("./UnitOfWork");
const ArrayCollection_1 = require("./ArrayCollection");
const Mapping_1 = require("./Mapping");
const MetaData_1 = require("./MetaData");
class EntityProxy {
    /**
     * Patch provided entity with a proxy to track changes.
     *
     * @param {EntityInterface} entity
     * @param {Scope}           entityManager
     * @param {boolean}         active
     *
     * @returns {Object}
     */
    static patchEntity(entity, entityManager, active = false) {
        // Don't re-patch an entity.
        if (entity['isEntityProxy']) {
            return entity;
        }
        const metaData = MetaData_1.MetaData.forInstance(entity);
        const mapping = Mapping_1.Mapping.forEntity(entity);
        const unitOfWork = entityManager.getUnitOfWork();
        const relations = mapping.getRelations();
        const expected = {};
        let proxyActive = active;
        let entityProxy;
        // Create collection observers
        if (relations) {
            Object.getOwnPropertyNames(relations).forEach(property => {
                const type = relations[property].type;
                if (type === Mapping_1.Mapping.RELATION_ONE_TO_MANY || type === Mapping_1.Mapping.RELATION_MANY_TO_MANY) {
                    proxyCollection(property);
                }
            });
        }
        /**
         * @returns {boolean}
         */
        function isProxyActive() {
            return proxyActive && metaData.fetch('entityState.state') !== UnitOfWork_1.UnitOfWork.STATE_UNKNOWN;
        }
        /**
         * Allow lazy loading and caching expected relations.
         *
         * @param {string} property
         *
         * @returns {any}
         */
        function getExpected(property) {
            if (!expected[property]) {
                expected[property] = entityManager.resolveEntityReference(relations[property].targetEntity);
            }
            return expected[property];
        }
        /**
         * Check if provided values for {property} are different. Performs special checks for all Date types.
         *
         * @param {string} property
         * @param {Date}   current
         * @param {Date}   next
         *
         * @returns {boolean}
         */
        function areDifferent(property, current, next) {
            const isDate = ['date', 'dateTime', 'datetime', 'time'].indexOf(mapping.getType(property)) > -1;
            if (!isDate) {
                return current !== next;
            }
            return (new Date(current)).toString() !== (new Date(next)).toString();
        }
        /**
         * Check if value is a setDirty value.
         *
         * @param {{}}      target
         * @param {string}  property
         * @param {*}       value
         *
         * @returns {boolean}
         */
        function setDirty(target, property, value) {
            if (typeof value === 'object' && value !== null && '_skipDirty' in value) {
                target[property] = value._skipDirty;
                return true;
            }
            return false;
        }
        /**
         * Proxy a collection.
         *
         * @param {string}  property   Where does this collection live?
         * @param {boolean} [forceNew] Replace whatever is set with new collection. defaults to false.
         *
         * @returns {void}
         */
        function proxyCollection(property, forceNew = false) {
            // Define what this collection consists out of.
            const ExpectedEntity = getExpected(property);
            const collection = (forceNew || !entity[property]) ? new ArrayCollection_1.ArrayCollection : entity[property];
            // Create a new proxy, and ensure there's an existing collection.
            entity[property] = new Proxy(collection, {
                set: (collection, key, relationEntity) => {
                    // Check if this is a set _skipDirty, if so return.
                    if (setDirty(collection, key, relationEntity)) {
                        return true;
                    }
                    // If it's not a number, or we're not observing, just return.
                    if (isNaN(parseInt(key, 10)) || !isProxyActive()) {
                        collection[key] = relationEntity;
                        return true;
                    }
                    const entityIndex = collection.indexOf(relationEntity);
                    const previousValue = collection[key];
                    collection[key] = relationEntity;
                    // Unique removed. Mark as removed.
                    if (typeof previousValue !== 'undefined' && collection.indexOf(previousValue) === -1) {
                        unitOfWork.registerCollectionChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_REMOVED, entityProxy, property, previousValue);
                    }
                    // Added relation already existed. No need to mark as a relation change (we're probably in a splice).
                    if (entityIndex > -1) {
                        return true;
                    }
                    if (typeof relationEntity !== 'object' || !(relationEntity instanceof ExpectedEntity)) {
                        throw new TypeError(`Can't add to '${entity.constructor.name}.${property}'. Expected instance of '${ExpectedEntity.name}'.`);
                    }
                    // Alright, let's stage this as a new relationship change.
                    unitOfWork.registerCollectionChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_ADDED, entityProxy, property, relationEntity);
                    return true;
                },
                get: (target, property) => {
                    if (property === 'isCollectionProxy') {
                        return true;
                    }
                    return target[property];
                },
                deleteProperty: (collection, key) => {
                    if (!isProxyActive()) {
                        collection.splice(parseInt(key, 10), 1);
                        return true;
                    }
                    const previousValue = collection[key];
                    collection.splice(parseInt(key, 10), 1);
                    if (collection.indexOf(previousValue) > -1) {
                        return true;
                    }
                    unitOfWork.registerCollectionChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_REMOVED, entityProxy, property, previousValue);
                    return true;
                },
            });
        }
        const proxyMethods = {
            isEntityProxy: true,
            activateProxying: () => {
                proxyActive = true;
                return entityProxy;
            },
            deactivateProxying: () => {
                proxyActive = false;
                return entityProxy;
            },
            getTarget: () => {
                return entity;
            },
            isProxyingActive: () => {
                return isProxyActive();
            },
        };
        // Return the actual proxy for the entity.
        entityProxy = new Proxy(entity, {
            set: (target, property, value) => {
                if (typeof value === 'undefined') {
                    value = null;
                }
                // Allow all dirty checks to be skipped.
                if (setDirty(target, property, value)) {
                    return true;
                }
                // If there's no relation, set the value.
                if (!relations || !relations[property]) {
                    // We're proxying and the value changed. Register as dirty.
                    if (isProxyActive() && areDifferent(property, target[property], value)) {
                        unitOfWork.registerDirty(target, property);
                    }
                    target[property] = value;
                    return true;
                }
                // To many? Only allowed if collection is empty. Also, ensure this new collection is proxied.
                if (entity[property] instanceof Array) {
                    if (entity[property].length > 0 && entity[property] === target[property]) {
                        return true;
                    }
                    if (entity[property].length > 0) {
                        throw new Error(`Can't assign to '${target.constructor.name}.${property}'. Collection is not empty.`);
                    }
                    proxyCollection(property, true);
                    target[property].add(...value);
                    return true;
                }
                // Ensure provided value is of the type we expect for the relationship.
                const ExpectedEntity = getExpected(property);
                if (!(value instanceof ExpectedEntity)) {
                    throw new TypeError(`Can't assign to '${target.constructor.name}.${property}'. Expected instance of '${ExpectedEntity.name}'.`);
                }
                if (target[property] === value) {
                    return true;
                }
                // If we already hold a value, stage its removal it.
                if (target[property]) {
                    unitOfWork.registerRelationChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_REMOVED, entityProxy, property, target[property]);
                }
                // Now set provided entity as new.
                unitOfWork.registerRelationChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_ADDED, entityProxy, property, value);
                // Ensure that new relation is also being watched for changes, and set.
                target[property] = EntityProxy.patchEntity(value, entityManager);
                return true;
            },
            get: (target, property) => {
                if (proxyMethods[property]) {
                    return proxyMethods[property];
                }
                return target[property];
            },
            deleteProperty: (target, property) => {
                const relation = relations[property];
                if (relation && (relation.type === Mapping_1.Mapping.RELATION_MANY_TO_MANY || relation.type === Mapping_1.Mapping.RELATION_ONE_TO_MANY)) {
                    throw new Error(`It is not allowed to delete a collection; trying to delete '${target.constructor.name}.${property}'.`);
                }
                unitOfWork.registerRelationChange(UnitOfWork_1.UnitOfWork.RELATIONSHIP_REMOVED, entityProxy, property, target[property]);
                delete target[property];
                return true;
            },
        });
        return entityProxy;
    }
}
exports.EntityProxy = EntityProxy;
