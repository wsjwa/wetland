import { Mapping } from './Mapping';
import { QueryBuilder } from './QueryBuilder';
import * as knex from 'knex';
import { EntityCtor } from './EntityInterface';
import { EntityManager } from './EntityManager';
import { Scope } from './Scope';
export declare class EntityRepository<T> {
    /**
     * @type {EntityManager|Scope}
     */
    protected entityManager: EntityManager | Scope;
    /**
     * @type {{}}
     */
    protected entity: EntityCtor<T>;
    /**
     * @type {Mapping}
     */
    protected mapping: Mapping<T>;
    /**
     * Holds the query options.
     *
     * @type { string[] }
     */
    protected queryOptions: Array<string>;
    /**
     * Construct a new EntityRepository.
     *
     * @param {EntityManager|Scope} entityManager
     * @param {{}}                  entity
     */
    constructor(entityManager: EntityManager | Scope, entity: EntityCtor<T>);
    /**
     * Get mapping for the entity this repository is responsible for.
     *
     * @returns {Mapping}
     */
    getMapping(): Mapping<T>;
    /**
     * Get a new query builder.
     *
     * @param {string}            [alias]
     * @param {knex.QueryBuilder} [statement]
     * @param {boolean}           [managed]
     *
     * @returns {QueryBuilder}
     */
    getQueryBuilder(alias?: string, statement?: knex.QueryBuilder, managed?: boolean): QueryBuilder<T>;
    /**
     * Resolve to an alias. If none was supplied the table name is used.
     *
     * @param {string} [alias]
     */
    protected getAlias(alias?: string): string;
    /**
     * Resolve to a statement. If none was supplied a new one is created.
     *
     * @param {string}            alias
     * @param {knex.QueryBuilder} [statement]
     *
     * @returns {knex.QueryBuilder}
     */
    protected getStatement(alias: string, statement?: knex.QueryBuilder): knex.QueryBuilder<any, any[]>;
    /**
     * Get a new query builder that will be applied on the derived table (query builder).
     *
     * e.g. `select count(*) from (select * from user) as user0;`
     *
     * @param {QueryBuilder} derivedFrom
     * @param {string}       [alias]
     *
     * @returns {QueryBuilder}
     */
    getDerivedQueryBuilder(derivedFrom: QueryBuilder<T>, alias?: string): QueryBuilder<T>;
    /**
     * Get a raw knex connection
     *
     * @param {string} [role] Defaults to slave
     *
     * @returns {knex}
     */
    getConnection(role?: string): knex;
    /**
     * Build a QueryBuilder to find entities based on provided criteria.
     *
     * @param {{}}          [criteria]
     * @param {FindOptions} [options]
     *
     * @returns {QueryBuilder}
     */
    prepareFindQuery(criteria?: {} | number | string, options?: FindOptions): QueryBuilder<T>;
    /**
     * Find entities based on provided criteria.
     *
     * @param {{}}          [criteria]
     * @param {FindOptions} [options]
     *
     * @returns {Promise<Array>}
     */
    find(criteria?: {} | number | string, options?: FindOptions): Promise<Array<T>>;
    /**
     * Find a single entity.
     *
     * @param {{}|number|string}  [criteria]
     * @param {FindOptions}       [options]
     *
     * @returns {Promise<Object>}
     */
    findOne(criteria?: {} | number | string, options?: FindOptions): Promise<T>;
    /**
     * Apply options to queryBuilder
     *
     * @param {QueryBuilder<T>} queryBuilder
     * @param {FindOptions}     options
     *
     * @returns {QueryBuilder}
     */
    applyOptions(queryBuilder: QueryBuilder<T>, options: any): QueryBuilder<T>;
    /**
     * Get a reference to the entity manager.
     *
     * @returns {EntityManager | Scope}
     */
    protected getEntityManager(): EntityManager | Scope;
    /**
     * Get a scope. If this repository was constructed within a scope, you get said scope.
     *
     * @returns {Scope}
     */
    protected getScope(): Scope;
}
export interface FindOptions {
    select?: Array<string>;
    orderBy?: any;
    groupBy?: any;
    alias?: string;
    page?: number;
    limit?: number;
    offset?: number;
    debug?: boolean;
    populate?: string | boolean | {} | Array<string | {}>;
}
