"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mapping_1 = require("./Mapping");
const QueryBuilder_1 = require("./QueryBuilder");
const Store_1 = require("./Store");
const Scope_1 = require("./Scope");
class EntityRepository {
    /**
     * Construct a new EntityRepository.
     *
     * @param {EntityManager|Scope} entityManager
     * @param {{}}                  entity
     */
    constructor(entityManager, entity) {
        /**
         * Holds the query options.
         *
         * @type { string[] }
         */
        this.queryOptions = ['orderBy', 'limit', 'offset', 'groupBy', 'select'];
        this.entityManager = entityManager;
        this.entity = entity;
        this.mapping = Mapping_1.Mapping.forEntity(entity);
    }
    /**
     * Get mapping for the entity this repository is responsible for.
     *
     * @returns {Mapping}
     */
    getMapping() {
        return this.mapping;
    }
    /**
     * Get a new query builder.
     *
     * @param {string}            [alias]
     * @param {knex.QueryBuilder} [statement]
     * @param {boolean}           [managed]
     *
     * @returns {QueryBuilder}
     */
    getQueryBuilder(alias, statement, managed = true) {
        const builderAlias = this.getAlias(alias);
        // Create a new QueryBuilder, pass in a scoped entity manager.
        return new QueryBuilder_1.QueryBuilder(this.getScope(), this.getStatement(builderAlias, statement), this.mapping, builderAlias, managed, this.getConnection());
    }
    /**
     * Resolve to an alias. If none was supplied the table name is used.
     *
     * @param {string} [alias]
     */
    getAlias(alias) {
        return alias || this.mapping.getTableName();
    }
    /**
     * Resolve to a statement. If none was supplied a new one is created.
     *
     * @param {string}            alias
     * @param {knex.QueryBuilder} [statement]
     *
     * @returns {knex.QueryBuilder}
     */
    getStatement(alias, statement) {
        if (statement) {
            return statement;
        }
        const connection = this.getConnection();
        return connection(`${this.mapping.getTableName()} as ${alias}`);
    }
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
    getDerivedQueryBuilder(derivedFrom, alias) {
        return this.getQueryBuilder().from(derivedFrom, alias);
    }
    /**
     * Get a raw knex connection
     *
     * @param {string} [role] Defaults to slave
     *
     * @returns {knex}
     */
    getConnection(role = Store_1.Store.ROLE_SLAVE) {
        return this.entityManager.getStore(this.entity).getConnection(role);
    }
    /**
     * Build a QueryBuilder to find entities based on provided criteria.
     *
     * @param {{}}          [criteria]
     * @param {FindOptions} [options]
     *
     * @returns {QueryBuilder}
     */
    prepareFindQuery(criteria, options = {}) {
        options.alias = options.alias || this.mapping.getTableName();
        const queryBuilder = this.getQueryBuilder(options.alias);
        if (!options.select) {
            queryBuilder.select(options.alias);
        }
        if (criteria) {
            queryBuilder.where(criteria);
        }
        // Calculate offset if paging is being used.
        if (options.page && options.limit) {
            options.offset = (options.page - 1) * options.limit;
        }
        // Apply limit, offset etc.
        this.applyOptions(queryBuilder, options);
        if (!options.populate) {
            return queryBuilder;
        }
        if (options.populate === true) {
            const relations = this.mapping.getRelations();
            if (typeof relations === 'object' && relations !== null) {
                options.populate = Reflect.ownKeys(relations);
            }
        }
        else if (typeof options.populate === 'string') {
            options.populate = [options.populate];
        }
        if (Array.isArray(options.populate) && options.populate.length) {
            options.populate.forEach(join => {
                let column = join;
                let alias = join;
                if (typeof join === 'object') {
                    column = Object.keys(join)[0];
                    alias = join[column];
                    //@ts-ignore
                }
                else if (join.indexOf('.') > -1) {
                    //@ts-ignore
                    alias = join.split('.')[1];
                }
                const targetBuilder = queryBuilder.quickJoin(column, alias);
                if (!options.select) {
                    targetBuilder.select(alias);
                }
            });
        }
        else if (options.populate && !Array.isArray(options.populate)) {
            Object.getOwnPropertyNames(options.populate).forEach(column => {
                const targetBuilder = queryBuilder.quickJoin(column, options.populate[column]);
                if (!options.select) {
                    targetBuilder.select(options.populate[column]);
                }
            });
        }
        return queryBuilder;
    }
    /**
     * Find entities based on provided criteria.
     *
     * @param {{}}          [criteria]
     * @param {FindOptions} [options]
     *
     * @returns {Promise<Array>}
     */
    find(criteria, options = {}) {
        return this.prepareFindQuery(criteria, options).getQuery(this.getConnection()).getResult(this.mapping.getTableName(), options);
    }
    /**
     * Find a single entity.
     *
     * @param {{}|number|string}  [criteria]
     * @param {FindOptions}       [options]
     *
     * @returns {Promise<Object>}
     */
    findOne(criteria, options = {}) {
        options.alias = options.alias || this.mapping.getTableName();
        if (typeof criteria === 'number' || typeof criteria === 'string') {
            criteria = { [options.alias + '.' + this.mapping.getPrimaryKeyField()]: criteria };
        }
        options.limit = 1;
        return this.find(criteria, options).then(result => result ? result[0] : null);
    }
    /**
     * Apply options to queryBuilder
     *
     * @param {QueryBuilder<T>} queryBuilder
     * @param {FindOptions}     options
     *
     * @returns {QueryBuilder}
     */
    applyOptions(queryBuilder, options) {
        this.queryOptions.forEach(clause => {
            if (options[clause]) {
                queryBuilder[clause](options[clause]);
            }
        });
        return queryBuilder;
    }
    /**
     * Get a reference to the entity manager.
     *
     * @returns {EntityManager | Scope}
     */
    getEntityManager() {
        return this.entityManager;
    }
    /**
     * Get a scope. If this repository was constructed within a scope, you get said scope.
     *
     * @returns {Scope}
     */
    getScope() {
        if (this.entityManager instanceof Scope_1.Scope) {
            return this.entityManager;
        }
        return this.entityManager.createScope();
    }
}
exports.EntityRepository = EntityRepository;
