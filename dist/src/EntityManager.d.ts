import { Mapping } from './Mapping';
import { Wetland } from './Wetland';
import { Entity, Scope } from './Scope';
import { EntityCtor, EntityInterface } from './EntityInterface';
import { Homefront } from 'homefront';
import { EntityRepository } from './EntityRepository';
import { Store } from './Store';
/**
 * The main entity manager for wetland.
 * This distributes scopes and supplies some core methods.
 */
export declare class EntityManager {
    /**
     * The wetland instance this entity manager belongs to.
     *
     * @type { Wetland }
     */
    private readonly wetland;
    /**
     * Holds the entities registered with the entity manager indexed on name.
     *
     * @type {{}}
     */
    private entities;
    /**
     * Holds instances of repositories that have been instantiated before, as a cache.
     *
     * @type { Map }
     */
    private repositories;
    /**
     * Construct a new core entity manager.
     * @constructor
     *
     * @param {Wetland} wetland
     */
    constructor(wetland: Wetland);
    /**
     * Get the wetland config.
     *
     * @returns {Homefront}
     */
    getConfig(): Homefront;
    /**
     * Create a new entity manager scope.
     *
     * @returns {Scope}
     */
    createScope(): Scope;
    /**
     * Get the reference to an entity constructor by name.
     *
     * @param {string} name
     *
     * @returns {Function}
     */
    getEntity(name: string): EntityCtor<EntityInterface>;
    /**
     * Get a repository instance for the provided Entity reference.
     *
     * @param {string|Entity} entity
     * @param {Scope}         scope
     *
     * @returns {EntityRepository}
     */
    getRepository<T>(entity: string | EntityCtor<T>, scope?: Scope): EntityRepository<T>;
    /**
     * Get store for provided entity.
     *
     * @param {EntityInterface} entity
     *
     * @returns {Store}
     */
    getStore(entity?: EntityInterface | string): Store;
    /**
     * Get all registered entities.
     *
     * @returns {{}}
     */
    getEntities(): {
        [key: string]: {
            entity: EntityCtor<EntityInterface>;
            mapping: Mapping<EntityInterface>;
        };
    };
    /**
     * Register an entity with the entity manager.
     *
     * @param {EntityInterface} entity
     *
     * @returns {EntityManager}
     */
    registerEntity<T>(entity: EntityCtor<T> & EntityInterface): EntityManager;
    /**
     * Get the mapping for provided entity. Can be an instance, constructor or the name of the entity.
     *
     * @param {EntityInterface|string|{}} entity
     *
     * @returns {Mapping}
     */
    getMapping<T>(entity: T): Mapping<T>;
    /**
     * Register multiple entities with the entity manager.
     *
     * @param {EntityInterface[]} entities
     *
     * @returns {EntityManager}
     */
    registerEntities(entities: Array<EntityCtor<EntityInterface>>): EntityManager;
    /**
     * Resolve provided value to an entity reference.
     *
     * @param {EntityInterface|string|{}} hint
     *
     * @returns {EntityInterface|null}
     */
    resolveEntityReference(hint: Entity): EntityCtor<EntityInterface>;
    private getStoreName;
}
