"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const knex = require("knex");
class Store {
    /**
     * Construct a new store.
     *
     * @param {string} name
     * @param {{}}     [config]
     */
    constructor(name, config) {
        /**
         * @type {string}
         */
        this.mode = Store.MODE_SINGLE;
        /**
         * @type {{}}
         */
        this.connections = {
            [Store.ROLE_MASTER]: [],
            [Store.ROLE_SLAVE]: [],
        };
        /**
         * @type {{}}
         */
        this.pointers = {
            [Store.ROLE_MASTER]: 0,
            [Store.ROLE_SLAVE]: 0,
        };
        this.name = name;
        if (config) {
            this.register(config);
        }
    }
    /**
     * Get the name of the store.
     *
     * @returns {string}
     */
    getName() {
        return this.name;
    }
    /**
     * Register connections.
     *
     * @param {PoolConfig|ReplicationConfig|SingleConfig} config
     *
     * @returns {Store}
     */
    register(config) {
        if (Array.isArray(config.connections)) {
            this.registerPool(config);
        }
        else if (typeof config.connections === 'object') {
            this.registerReplication(config);
        }
        else if (typeof config.connection === 'object') {
            this.registerConnection(config);
        }
        return this;
    }
    /**
     * Register a connection.
     *
     * @param {SingleConfig} config
     * @param {string}       [role]
     *
     * @returns {Store}
     */
    registerConnection(config, role = null) {
        if ([Store.ROLE_MASTER, Store.ROLE_SLAVE, null].indexOf(role) === -1) {
            throw new Error(`Trying to register using invalid role. Expected "${Store.ROLE_MASTER}" or "${Store.ROLE_SLAVE}".`);
        }
        const connection = knex(config);
        if (role === Store.ROLE_MASTER || role === null) {
            this.connections[Store.ROLE_MASTER].push(connection);
        }
        if (role === Store.ROLE_SLAVE || role === null) {
            this.connections[Store.ROLE_SLAVE].push(connection);
        }
        this.client = config.client;
        return this;
    }
    /**
     * Get the name of the client.
     *
     * @returns {string}
     */
    getClient() {
        return this.client;
    }
    /**
     * Get the connections registered on this store.
     *
     * @returns {Object}
     */
    getConnections() {
        return this.connections;
    }
    /**
     * Get a connection for `role`. Uses round robin.
     *
     * @param {string} role
     *
     * @returns {knex}
     */
    getConnection(role = Store.ROLE_SLAVE) {
        if (this.mode === Store.MODE_SINGLE) {
            return this.connections[role][0];
        }
        const connection = this.connections[role][this.pointers[role]++];
        if (this.pointers[role] >= this.connections[role].length) {
            this.pointers[role] = 0;
        }
        return connection;
    }
    /**
     * Register pool of connections. Example config:
     *
     *  // Connection object could look like: {username: '', password: '', database: '', host: ''}
     *  {
     *    client     : 'mysql',
     *    connections: [{}, {}]
     *  }
     *
     * @param {PoolConfig} config
     *
     * @returns Store
     */
    registerPool(config) {
        this.mode = Store.MODE_POOL;
        config.connections.forEach(connection => {
            this.registerConnection(this.makeConnectionConfig(config, connection));
        });
        return this;
    }
    /**
     * Register replication connections. Example config:
     *
     *  // Connection object could look like: {username: '', password: '', database: '', host: ''}
     *  {
     *    client     : 'mysql',
     *    connections: {
     *      master: [{}, {}],
     *      slave : [{}, {}, {}]
     *    }
     *  }
     *
     * @param {ReplicationConfig} config
     *
     * @returns Store
     */
    registerReplication(config) {
        this.mode = Store.MODE_REPLICATION;
        Object.getOwnPropertyNames(config.connections).forEach(role => {
            config.connections[role].forEach(connection => {
                this.registerConnection(this.makeConnectionConfig(config, connection), role);
            });
        });
        return this;
    }
    /**
     * Makes the config needed for knex.
     * This method is needed because (for example) postgres accepts extra arguments such as a searchPath.
     *
     * @param {{}} config
     * @param {{}} connection
     *
     * @returns {SingleConfig}
     */
    makeConnectionConfig(config, connection) {
        const connectionConfig = { connection };
        Object.getOwnPropertyNames(config).forEach(key => {
            if (key === 'connection' || key === 'connections') {
                return;
            }
            connectionConfig[key] = config[key];
        });
        return connectionConfig;
    }
}
exports.Store = Store;
/**
 * @type {string}
 */
Store.MODE_SINGLE = 'single';
/**
 * @type {string}
 */
Store.MODE_POOL = 'pool';
/**
 * @type {string}
 */
Store.MODE_REPLICATION = 'replication';
/**
 * @type {string}
 */
Store.ROLE_MASTER = 'master';
/**
 * @type {string}
 */
Store.ROLE_SLAVE = 'slave';
