import { IdentityMap } from './IdentityMap';
import { Mapping } from './Mapping';
import { ArrayCollection } from './ArrayCollection';
import { EntityProxy } from './EntityProxy';
import { UnitOfWork } from './UnitOfWork';
import { EntityCtor, EntityInterface, ProxyInterface } from './EntityInterface';
import { Entity, Scope } from './Scope';

export class Hydrator {
  /**
   * A flat object maintaining a mapping between aliases and recipes.
   *
   * @type {{}}
   */
  private recipeIndex: { [key: string]: Recipe } = {};

  /**
   * The recipe for this hydrator.
   *
   * @type {Recipe}
   */
  private recipe: Recipe;

  /**
   * Maintain list of hydrated entities.
   *
   * @type {IdentityMap}
   */
  private identityMap: IdentityMap;

  /**
   * Reference to the unit of work.
   *
   * @type {UnitOfWork}
   */
  private unitOfWork: UnitOfWork;

  /**
   * Reference to the entityManager scope.
   *
   * @type {Scope}
   */
  private readonly entityManager: Scope;

  /**
   * Will the entities that pass through this hydrator be managed by the unit of work?
   *
   * @type { boolean }
   */
  private readonly managed: boolean = true;

  /**
   * Construct a new hydrator.
   *
   * @param {Scope}   entityManager
   * @param {boolean} managed
   */
  public constructor(entityManager: Scope, managed: boolean = true) {
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
  public fromSchema(values: Object, EntityClass: EntityInterface | Function | EntityCtor<EntityInterface>): ProxyInterface {
    const mapping = Mapping.forEntity(EntityClass);
    let entity = typeof EntityClass === 'function' ? new (EntityClass as EntityCtor<EntityInterface>) : EntityClass;
    entity = EntityProxy.patchEntity(entity as EntityInterface, this.entityManager);

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
  public getRecipe(alias?): Recipe {
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
  public removeRecipe(alias): void {
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
  public addRecipe(parent: null | string, alias: string, mapping: Mapping<Entity>, joinType?: string, property?: string): Recipe {
    const primaryKey = mapping.getPrimaryKey();
    const primaryKeyAliased = `${alias}.${primaryKey}`;
    const recipe: Recipe = {
      hydrate: false,
      parent: null,
      entity: mapping.getTarget() as EntityCtor<EntityInterface>,
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
    } else {
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
  public addColumns(alias: string, columns: Object): Hydrator {
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
  public hydrateAll(rows: Array<Object>): ArrayCollection<EntityInterface> {
    const entities = new ArrayCollection;

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
  public hydrate(row: Object, recipe: Recipe): ProxyInterface {
    if (!recipe.hydrate) {
      return null;
    }

    let entity = this.identityMap.fetch(recipe.entity, row[recipe.primaryKey.alias]) as ProxyInterface;

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
  public clearCatalogue(alias?: string): this {
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
  public enableCatalogue(alias: string): Catalogue {
    return this.getCatalogue(alias);
  }

  /**
   * Check if catalogue exists for alias.
   *
   * @param {string} alias
   *
   * @returns {boolean}
   */
  public hasCatalogue(alias: string): boolean {
    return !!this.getRecipe(alias).catalogue;
  }

  /**
   * Get the catalogue for alias.
   *
   * @param {string} alias
   *
   * @returns {Catalogue}
   */
  public getCatalogue(alias: string): Catalogue {
    const recipe = this.getRecipe(alias);
    recipe.catalogue = recipe.catalogue || { entities: {}, primaries: new ArrayCollection() };

    return recipe.catalogue;
  }

  /**
   * Hydrate the joins for a recipe.
   *
   * @param {Recipe}          recipe
   * @param {{}}              row
   * @param {EntityInterface} entity
   */
  private hydrateJoins(recipe: Recipe, row: Object, entity: ProxyInterface): void {
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
  private addToCatalogue(recipe: Recipe, entity: ProxyInterface): this {
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
  private applyMapping(recipe: Recipe, row: Object): ProxyInterface {
    if (!row[recipe.primaryKey.alias]) {
      return null;
    }

    const entity = new recipe.entity;
    entity[recipe.primaryKey.property] = row[recipe.primaryKey.alias];

    Object.getOwnPropertyNames(recipe.columns).forEach(alias => {
      entity[recipe.columns[alias]] = row[alias];
    });
    for(let field in row) {
      if(entity[field] === undefined) {
          entity[field] = row[field];
      }
    }

    const workingEntity = this.managed ? EntityProxy.patchEntity(entity, this.entityManager) : entity;

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

export interface Catalogue {
  entities: Object;
  primaries: ArrayCollection<string | number>;
}

export interface Recipe {
  hydrate: boolean;
  alias: string;
  entity: EntityCtor<EntityInterface>;
  primaryKey: { alias: string, property: string };
  columns: {};
  catalogue?: Catalogue;
  parent?: { property: string, column: string, entities: Object };
  parentRecipe?: Recipe;
  joins?: { [key: string]: Recipe };
  property?: string;
  type?: string;
}
