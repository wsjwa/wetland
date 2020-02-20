"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Query {
    /**
     * Construct a new Query.
     *
     * @param {knex.QueryBuilder} statement
     * @param {Hydrator}          hydrator
     * @param {[]}                children
     */
    constructor(statement, hydrator, children = []) {
        /**
         * The child queries.
         *
         * @type {Array}
         */
        this.children = [];
        this.statement = statement;
        this.hydrator = hydrator;
        this.children = children;
    }
    /**
     * Set the parent for this query.
     *
     * @param parent
     * @returns {Query}
     */
    setParent(parent) {
        this.parent = parent;
        return this;
    }
    /**
     * Execute the query.
     *
     * @returns {Promise<[]>}
     */
    execute() {
        const query = this.restrictToParent();
        if (process.env.LOG_QUERIES) {
            console.log('Executing query:', query.toString());
        }
        return Promise.resolve(query.then());
    }
    /**
     * Get a single scalar result (for instance for count, sum or max).
     *
     * @returns {Promise<number>}
     */
    getSingleScalarResult() {
        return this.execute().then(result => {
            if (!result || typeof result[0] !== 'object') {
                return null;
            }
            return result[0][Object.keys(result[0])[0]];
        });
    }
    /**
     *
     * @param result
     * @param tableName
     * @param populate
     */
    removeDuplicatePopulateValues(result, tableName, populate) {
        if (populate !== undefined) {
            if (!Array.isArray(populate)) {
                populate = [populate];
            }
            var currentPops;
            for (var i = 0; i < populate.length; i++) {
                if (populate[i].indexOf('.') != -1) {
                    currentPops = populate[i].split('.');
                    for (var c = 0; c < currentPops.length; c++) {
                        populate.push(currentPops[c]);
                    }
                }
            }
        }
        if (tableName === undefined) {
            tableName = '';
        }
        var currentSplitVal;
        if (Array.isArray(result) && result.length > 0) {
            for (let i = 0; i < result.length; i++) {
                for (var field in result[i]) {
                    if (field.indexOf('.') != -1) {
                        currentSplitVal = field.split('.');
                        if (currentSplitVal[0] == tableName) {
                            delete result[i][field];
                        }
                        else if (populate !== undefined && populate.indexOf(currentSplitVal[0]) != -1) {
                            delete result[i][field];
                        }
                    }
                    if (typeof result[i][field] == 'object') {
                        result[i][field] = this.removeDuplicatePopulateValues(result[i][field], tableName, populate);
                    }
                }
            }
        }
        else if (typeof result == 'object' && Object.keys(result).length > 0) {
            for (var field in result) {
                if (field.indexOf('.') != -1) {
                    currentSplitVal = field.split('.');
                    if (currentSplitVal[0] == tableName) {
                        delete result[field];
                    }
                    else if (populate !== undefined && populate.indexOf(currentSplitVal[0]) != -1) {
                        delete result[field];
                    }
                }
                if (typeof result[field] == 'object') {
                    result[field] = this.removeDuplicatePopulateValues(result[field], tableName, populate);
                }
            }
        }
        return result;
    }
    /**
     * Get the result for the query.
     *
     * @returns {Promise<{}[]>}
     */
    getResult(tableName, queryOptions) {
        let currentKnex = this.knex;
        let currentThis = this;
        return this.execute().then(result => {
            if (!result || !result.length) {
                return null;
            }
            const hydrated = this.hydrator.hydrateAll(result);
            return Promise.all(this.children.map(child => {
                return child.getQuery(currentKnex).getResult();
            })).then(function () {
                //throws error if activated: Can't get metadata, provided instance isn't of type Object
                /*if(typeof queryOptions == 'object' && Array.isArray(queryOptions.select) && queryOptions.select.length > 0) {
                    try {
                        return currentThis.removeDuplicatePopulateValues(hydrated, tableName, queryOptions.populate);
                    } catch(err) {
                        return hydrated;
                    }
                }*/
                return hydrated;
            });
        });
    }
    /**
     * Get the SQL query for current query.
     *
     * @returns {string}
     */
    getSQL() {
        return this.statement.toString();
    }
    /**
     * Get the statement for this query.
     *
     * @returns {knex.QueryBuilder}
     */
    getStatement() {
        return this.statement;
    }
    /**
     * Restrict this query to parents.
     *
     * @returns {any}
     */
    restrictToParent() {
        const statement = this.statement;
        if (!this.parent || !this.parent.primaries.length) {
            return statement;
        }
        const parent = this.parent;
        if (parent.primaries.length === 1) {
            statement.where(parent.column, parent.primaries[0]);
            return statement;
        }
        const client = statement['client'];
        const unionized = client.queryBuilder();
        parent.primaries.forEach(primary => {
            const toUnion = statement.clone().where(parent.column, primary);
            if (client.config.client === 'sqlite3' || client.config.client === 'sqlite') {
                unionized.union(client.queryBuilder().select('*').from(client.raw(toUnion).wrap('(', ')')));
                return unionized;
            }
            unionized.union(toUnion, true);
        });
        return unionized;
    }
}
exports.Query = Query;
