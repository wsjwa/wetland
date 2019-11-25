import * as knex from 'knex';
import { Hydrator } from './Hydrator';
import { QueryBuilder } from './QueryBuilder';
export declare class Query {
    /**
     * @type {Hydrator}
     */
    private hydrator;
    /**
     * @type {{}}
     */
    private statement;
    /**
     * The parent of this Query.
     *
     * @type {{}}
     */
    private parent;
    /**
     * The child queries.
     *
     * @type {Array}
     */
    private children;
    knex: any;
    /**
     * Construct a new Query.
     *
     * @param {knex.QueryBuilder} statement
     * @param {Hydrator}          hydrator
     * @param {[]}                children
     */
    constructor(statement: knex.QueryBuilder, hydrator: Hydrator, children?: Array<QueryBuilder<{
        new (): any;
    }>>);
    /**
     * Set the parent for this query.
     *
     * @param parent
     * @returns {Query}
     */
    setParent(parent: {
        column: string;
        primaries: Array<number | string>;
    }): this;
    /**
     * Execute the query.
     *
     * @returns {Promise<[]>}
     */
    execute(): Promise<Array<Object>>;
    /**
     * Get a single scalar result (for instance for count, sum or max).
     *
     * @returns {Promise<number>}
     */
    getSingleScalarResult(): Promise<number>;
    /**
     *
     * @param result
     * @param tableName
     * @param populate
     */
    removeDuplicatePopulateValues(result: any, tableName: any, populate: any): any;
    /**
     * Get the result for the query.
     *
     * @returns {Promise<{}[]>}
     */
    getResult(tableName?: any, queryOptions?: any): Promise<any>;
    /**
     * Get the SQL query for current query.
     *
     * @returns {string}
     */
    getSQL(): string;
    /**
     * Get the statement for this query.
     *
     * @returns {knex.QueryBuilder}
     */
    getStatement(): knex.QueryBuilder;
    /**
     * Restrict this query to parents.
     *
     * @returns {any}
     */
    private restrictToParent;
}
