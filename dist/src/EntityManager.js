"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mapping_1 = require("./Mapping");
const Scope_1 = require("./Scope");
/**
 * The main entity manager for wetland.
 * This distributes scopes and supplies some core methods.
 */
class EntityManager {
    /**
     * Construct a new core entity manager.
     * @constructor
     *
     * @param {Wetland} wetland
     */
    constructor(wetland) {
        /**
         * The wetland instance this entity manager belongs to.
         *
         * @type { Wetland }
         */
        this.wetland = null;
        /**
         * Holds the entities registered with the entity manager indexed on name.
         *
         * @type {{}}
         */
        this.entities = {};
        /**
         * Holds instances of repositories that have been instantiated before, as a cache.
         *
         * @type { Map }
         */
        this.repositories = new Map();
        this.wetland = wetland;
    }
    /**
     * Get the wetland config.
     *
     * @returns {Homefront}
     */
    getConfig() {
        return this.wetland.getConfig();
    }
    /**
     * Create a new entity manager scope.
     *
     * @returns {Scope}
     */
    createScope() {
        return new Scope_1.Scope(this, this.wetland);
    }
    /**
     * Get the reference to an entity constructor by name.
     *
     * @param {string} name
     *
     * @returns {Function}
     */
    getEntity(name) {
        const entity = this.entities[name];
        if (!entity) {
            throw new Error(`No entity found for "${name}".`);
        }
        return entity.entity;
    }
    /**
     * Get a repository instance for the provided Entity reference.
     *
     * @param {string|Entity} entity
     * @param {Scope}         scope
     *
     * @returns {EntityRepository}
     */
    getRepository(entity, scope) {
        const entityReference = this.resolveEntityReference(entity);
        if (!this.repositories.has(entityReference) || scope) {
            const entityMapping = Mapping_1.Mapping.forEntity(entityReference);
            const Repository = entityMapping.getRepository();
            if (!Repository) {
                throw new Error([
                    `Unable to find Repository for entity "${entityMapping.getEntityName() || entityReference.name}".`,
                    `Did you forget to register your entity or set entityPath(s)?`,
                ].join(' '));
            }
            if (scope) {
                return new Repository(scope, entityReference);
            }
            this.repositories.set(entityReference, new Repository(this, entityReference));
        }
        return this.repositories.get(entityReference);
    }
    /**
     * Get store for provided entity.
     *
     * @param {EntityInterface} entity
     *
     * @returns {Store}
     */
    getStore(entity) {
        return this.wetland.getStore(this.getStoreName(entity));
    }
    /**
     * Get all registered entities.
     *
     * @returns {{}}
     */
    getEntities() {
        return this.entities;
    }
    /**
     * Register an entity with the entity manager.
     *
     * @param {EntityInterface} entity
     *
     * @returns {EntityManager}
     */
    registerEntity(entity) {
        const mapping = this.getMapping(entity).setEntityManager(this);
        if (typeof entity.setMapping === 'function') {
            entity.setMapping(mapping);
        }
        this.entities[mapping.getEntityName()] = { entity, mapping };
        return this;
    }
    /**
     * Get the mapping for provided entity. Can be an instance, constructor or the name of the entity.
     *
     * @param {EntityInterface|string|{}} entity
     *
     * @returns {Mapping}
     */
    getMapping(entity) {
        return Mapping_1.Mapping.forEntity(this.resolveEntityReference(entity));
    }
    /**
     * Register multiple entities with the entity manager.
     *
     * @param {EntityInterface[]} entities
     *
     * @returns {EntityManager}
     */
    registerEntities(entities) {
        entities.forEach(entity => {
            this.registerEntity(entity);
        });
        return this;
    }
    /**
     * Resolve provided value to an entity reference.
     *
     * @param {EntityInterface|string|{}} hint
     *
     * @returns {EntityInterface|null}
     */
    resolveEntityReference(hint) {
        if (typeof hint === 'string') {
            return this.getEntity(hint);
        }
        if (typeof hint === 'object') {
            return hint;
        }
        return typeof hint === 'function' ? hint : null;
    }
    getStoreName(entity) {
        if (typeof entity === 'string') {
            return entity;
        }
        if (entity) {
            return this.getMapping(entity).getStoreName();
        }
        return null;
    }
}
exports.EntityManager = EntityManager;
