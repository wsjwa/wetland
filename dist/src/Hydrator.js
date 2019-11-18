"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mapping_1 = require("./Mapping");
const ArrayCollection_1 = require("./ArrayCollection");
const EntityProxy_1 = require("./EntityProxy");
class Hydrator {
    /**
     * Construct a new hydrator.
     *
     * @param {Scope}   entityManager
     * @param {boolean} managed
     */
    constructor(entityManager, managed = true) {
        /**
         * A flat object maintaining a mapping between aliases and recipes.
         *
         * @type {{}}
         */
        this.recipeIndex = {};
        /**
         * Will the entities that pass through this hydrator be managed by the unit of work?
         *
         * @type { boolean }
         */
        this.managed = true;
        this.managed = managed;
        this.unitOfWork = entityManager.getUnitOfWork();
        this.entityManager = entityManager;
        this.identityMap = entityManager.getIdentityMap();
    }
    /**
     * Static method to simply map to entities.
     *
     * @param {{}}       values
     * @param {Function} EntityClass
     *
     * @returns {EntityInterface|Function|EntityCtor<EntityInterface>}
     */
    fromSchema(values, EntityClass) {
        const mapping = Mapping_1.Mapping.forEntity(EntityClass);
        let entity = typeof EntityClass === 'function' ? new EntityClass : EntityClass;
        entity = EntityProxy_1.EntityProxy.patchEntity(entity, this.entityManager);
        Object.getOwnPropertyNames(values).forEach(column => {
            const property = mapping.getPropertyName(column);
            if (!property) {
                return;
            }
            entity[property] = { _skipDirty: values[column] };
        });
        return entity;
    }
    /**
     * Get a recipe.
     *
     * @param {string} alias
     * @returns {any}
     */
    getRecipe(alias) {
        if (alias) {
            return this.recipeIndex[alias];
        }
        return this.recipe;
    }
    /**
     * Completely remove a recipe.
     *
     * @param {string} alias
     *
     * @returns {void}
     */
    removeRecipe(alias) {
        const recipe = this.recipeIndex[alias];
        if (recipe && recipe.parentRecipe) {
            delete recipe.parentRecipe.joins[alias];
        }
        delete this.recipeIndex[alias];
    }
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
    addRecipe(parent, alias, mapping, joinType, property) {
        const primaryKey = mapping.getPrimaryKey();
        const primaryKeyAliased = `${alias}.${primaryKey}`;
        const recipe = {
            hydrate: false,
            parent: null,
            entity: mapping.getTarget(),
            primaryKey: { alias: primaryKeyAliased, property: primaryKey },
            type: joinType,
            columns: {},
            property,
            alias,
        };
        this.recipeIndex[alias] = recipe;
        if (parent) {
            const parentRecipe = this.recipeIndex[parent];
            parentRecipe.joins = parentRecipe.joins || {};
            parentRecipe.joins[alias] = recipe;
            recipe.parentRecipe = parentRecipe;
        }
        else {
            this.recipe = recipe;
        }
        return recipe;
    }
    /**
     * Add columns for hydration to an alias (recipe).
     *
     * @param {string} alias
     * @param {{}}     columns
     *
     * @returns {Hydrator}
     */
    addColumns(alias, columns) {
        Object.assign(this.recipeIndex[alias].columns, columns);
        return this;
    }
    /**
     * Hydrate a collection.
     *
     * @param {[]} rows
     *
     * @returns {ArrayCollection}
     */
    hydrateAll(rows) {
        const entities = new ArrayCollection_1.ArrayCollection;
        rows.forEach(row => {
            const hydrated = this.hydrate(row, this.recipe);
            if (hydrated) {
                entities.add(hydrated);
            }
        });
        return entities;
    }
    /**
     * Hydrate a single result.
     *
     * @param {{}}      row
     * @param {Recipe}  recipe
     *
     * @returns {EntityInterface}
     */
    hydrate(row, recipe) {
        if (!recipe.hydrate) {
            return null;
        }
        let entity = this.identityMap.fetch(recipe.entity, row[recipe.primaryKey.alias]);
        if (!entity) {
            entity = this.applyMapping(recipe, row);
            if (!entity) {
                return null;
            }
        }
        if (recipe.parent) {
            // Assign self to parent (only for many).
            recipe.parent.entities[row[recipe.parent.column]][recipe.parent.property].add({ _skipDirty: entity });
        }
        if (recipe.joins) {
            this.hydrateJoins(recipe, row, entity);
        }
        if (this.managed) {
            entity.activateProxying();
        }
        return entity;
    }
    /**
     * Clear a catalogue for `alias`.
     *
     * @param {string} [alias]
     *
     * @returns {Hydrator}
     */
    clearCatalogue(alias) {
        const recipe = this.getRecipe(alias);
        delete recipe.catalogue;
        return this;
    }
    /**
     * Enable catalogue for alias.
     *
     * @param {string} alias
     *
     * @returns {Catalogue}
     */
    enableCatalogue(alias) {
        return this.getCatalogue(alias);
    }
    /**
     * Check if catalogue exists for alias.
     *
     * @param {string} alias
     *
     * @returns {boolean}
     */
    hasCatalogue(alias) {
        return !!this.getRecipe(alias).catalogue;
    }
    /**
     * Get the catalogue for alias.
     *
     * @param {string} alias
     *
     * @returns {Catalogue}
     */
    getCatalogue(alias) {
        const recipe = this.getRecipe(alias);
        recipe.catalogue = recipe.catalogue || { entities: {}, primaries: new ArrayCollection_1.ArrayCollection() };
        return recipe.catalogue;
    }
    /**
     * Hydrate the joins for a recipe.
     *
     * @param {Recipe}          recipe
     * @param {{}}              row
     * @param {EntityInterface} entity
     */
    hydrateJoins(recipe, row, entity) {
        Object.getOwnPropertyNames(recipe.joins).forEach(alias => {
            const joinRecipe = recipe.joins[alias];
            const hydrated = this.hydrate(row, joinRecipe);
            if (!joinRecipe.hydrate) {
                return;
            }
            if (joinRecipe.type === 'single') {
                entity[joinRecipe.property] = { _skipDirty: hydrated };
                return;
            }
            // If not hydrated, at least set null value on property (above)
            if (!hydrated) {
                return;
            }
            entity[joinRecipe.property].add({ _skipDirty: hydrated });
        });
    }
    /**
     * Add entity to catalogue.
     *
     * @param {Recipe}         recipe
     * @param {ProxyInterface} entity
     *
     * @returns {Hydrator}
     */
    addToCatalogue(recipe, entity) {
        const primary = entity[recipe.primaryKey.property];
        const catalogue = this.getCatalogue(recipe.alias);
        catalogue.entities[primary] = entity;
        catalogue.primaries.add(primary);
        return this;
    }
    /**
     * Apply mapping to a new entity.
     *
     * @param {Recipe} recipe
     * @param {{}}     row
     *
     * @returns {EntityInterface}
     */
    applyMapping(recipe, row) {
        if (!row[recipe.primaryKey.alias]) {
            return null;
        }
        const entity = new recipe.entity;
        entity[recipe.primaryKey.property] = row[recipe.primaryKey.alias];
        Object.getOwnPropertyNames(recipe.columns).forEach(alias => {
            entity[recipe.columns[alias]] = row[alias];
        });
        for (let field in row) {
            if (entity[field] === undefined) {
                entity[field] = row[field];
            }
        }
        const workingEntity = this.managed ? EntityProxy_1.EntityProxy.patchEntity(entity, this.entityManager) : entity;
        if (this.managed) {
            this.unitOfWork.registerClean(entity, true);
        }
        this.identityMap.register(entity, workingEntity);
        if (recipe.catalogue) {
            this.addToCatalogue(recipe, workingEntity);
        }
        return workingEntity;
    }
}
exports.Hydrator = Hydrator;
