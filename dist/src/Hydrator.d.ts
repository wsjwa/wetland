import { Mapping } from './Mapping';
import { ArrayCollection } from './ArrayCollection';
import { EntityCtor, EntityInterface, ProxyInterface } from './EntityInterface';
import { Entity, Scope } from './Scope';
export declare class Hydrator {
    /**
     * A flat object maintaining a mapping between aliases and recipes.
     *
     * @type {{}}
     */
    private recipeIndex;
    /**
     * The recipe for this hydrator.
     *
     * @type {Recipe}
     */
    private recipe;
    /**
     * Maintain list of hydrated entities.
     *
     * @type {IdentityMap}
     */
    private identityMap;
    /**
     * Reference to the unit of work.
     *
     * @type {UnitOfWork}
     */
    private unitOfWork;
    /**
     * Reference to the entityManager scope.
     *
     * @type {Scope}
     */
    private readonly entityManager;
    /**
     * Will the entities that pass through this hydrator be managed by the unit of work?
     *
     * @type { boolean }
     */
    private readonly managed;
    /**
     * Construct a new hydrator.
     *
     * @param {Scope}   entityManager
     * @param {boolean} managed
     */
    constructor(entityManager: Scope, managed?: boolean);
    /**
     * Static method to simply map to entities.
     *
     * @param {{}}       values
     * @param {Function} EntityClass
     *
     * @returns {EntityInterface|Function|EntityCtor<EntityInterface>}
     */
    fromSchema(values: Object, EntityClass: EntityInterface | Function | EntityCtor<EntityInterface>): ProxyInterface;
    /**
     * Get a recipe.
     *
     * @param {string} alias
     * @returns {any}
     */
    getRecipe(alias?: any): Recipe;
    /**
     * Completely remove a recipe.
     *
     * @param {string} alias
     *
     * @returns {void}
     */
    removeRecipe(alias: any): void;
    /**
     * Add a recipe to the hydrator.
     *
     * @param {string|null} parent      String for parent alias, null when root.
     * @param {string}      alias       The alias used for the entity.
     * @param {Mapping}     mapping     Mapping for the entity.
     * @param {string}      [joinType]  Type of join (single, collection)
     * @param {string}      [property]  The name of the property on the parent.
     *
     * @returns {Recipe}
     */
    addRecipe(parent: null | string, alias: string, mapping: Mapping<Entity>, joinType?: string, property?: string): Recipe;
    /**
     * Add columns for hydration to an alias (recipe).
     *
     * @param {string} alias
     * @param {{}}     columns
     *
     * @returns {Hydrator}
     */
    addColumns(alias: string, columns: Object): Hydrator;
    /**
     * Hydrate a collection.
     *
     * @param {[]} rows
     *
     * @returns {ArrayCollection}
     */
    hydrateAll(rows: Array<Object>): ArrayCollection<EntityInterface>;
    /**
     * Hydrate a single result.
     *
     * @param {{}}      row
     * @param {Recipe}  recipe
     *
     * @returns {EntityInterface}
     */
    hydrate(row: Object, recipe: Recipe): ProxyInterface;
    /**
     * Clear a catalogue for `alias`.
     *
     * @param {string} [alias]
     *
     * @returns {Hydrator}
     */
    clearCatalogue(alias?: string): this;
    /**
     * Enable catalogue for alias.
     *
     * @param {string} alias
     *
     * @returns {Catalogue}
     */
    enableCatalogue(alias: string): Catalogue;
    /**
     * Check if catalogue exists for alias.
     *
     * @param {string} alias
     *
     * @returns {boolean}
     */
    hasCatalogue(alias: string): boolean;
    /**
     * Get the catalogue for alias.
     *
     * @param {string} alias
     *
     * @returns {Catalogue}
     */
    getCatalogue(alias: string): Catalogue;
    /**
     * Hydrate the joins for a recipe.
     *
     * @param {Recipe}          recipe
     * @param {{}}              row
     * @param {EntityInterface} entity
     */
    private hydrateJoins;
    /**
     * Add entity to catalogue.
     *
     * @param {Recipe}         recipe
     * @param {ProxyInterface} entity
     *
     * @returns {Hydrator}
     */
    private addToCatalogue;
    /**
     * Apply mapping to a new entity.
     *
     * @param {Recipe} recipe
     * @param {{}}     row
     *
     * @returns {EntityInterface}
     */
    private applyMapping;
}
export interface Catalogue {
    entities: Object;
    primaries: ArrayCollection<string | number>;
}
export interface Recipe {
    hydrate: boolean;
    alias: string;
    entity: EntityCtor<EntityInterface>;
    primaryKey: {
        alias: string;
        property: string;
    };
    columns: {};
    catalogue?: Catalogue;
    parent?: {
        property: string;
        column: string;
        entities: Object;
    };
    parentRecipe?: Recipe;
    joins?: {
        [key: string]: Recipe;
    };
    property?: string;
    type?: string;
}
