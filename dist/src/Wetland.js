"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EntityManager_1 = require("./EntityManager");
const Store_1 = require("./Store");
const homefront_1 = require("homefront");
const Migrator_1 = require("./Migrator/Migrator");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const SnapshotManager_1 = require("./SnapshotManager");
const SchemaManager_1 = require("./SchemaManager");
const Populate_1 = require("./Populate");
const Seeder_1 = require("./Seeder");
const Cleaner_1 = require("./Cleaner");
exports.entityFilterRegexp = /^(?!.*index\.(js|ts)$).*(^.?|\.[^d]|[^.]d|[^.][^d])\.(js|ts)$/;
exports.entityExtensionRegexp = /\.(js|ts)$/;
class Wetland {
    /**
     * Construct a new wetland instance.
     *
     * @param {{}} [config]
     */
    constructor(config) {
        /**
         * @type {EntityManager}
         */
        this.entityManager = new EntityManager_1.EntityManager(this);
        /**
         * @type {Homefront}
         */
        this.config = new homefront_1.Homefront({
            debug: false,
            useForeignKeys: true,
            dataDirectory: path.resolve(process.cwd(), '.data'),
            defaultStore: 'defaultStore',
            mapping: {
                defaultNamesToUnderscore: false,
                defaults: { cascades: [] },
            },
            entityManager: {
                refreshCreated: true,
                refreshUpdated: true,
            },
        });
        /**
         * @type {{}}
         */
        this.stores = {};
        this.ensureDataDirectory(this.config.fetch('dataDirectory'));
        this.setupExitListeners();
        this.initializeConfig(config);
    }
    /**
     * Get the wetland config.
     *
     * @returns {Homefront}
     */
    getConfig() {
        return this.config;
    }
    /**
     * Register an entity with the entity manager.
     *
     * @param {EntityInterface} entity
     *
     * @returns {Wetland}
     */
    registerEntity(entity) {
        this.entityManager.registerEntity(entity);
        return this;
    }
    /**
     * Register multiple entities with the entity manager.
     *
     * @param {EntityInterface[]} entities
     *
     * @returns {Wetland}
     */
    registerEntities(entities) {
        this.entityManager.registerEntities(entities);
        return this;
    }
    /**
     * Register stores with wetland.
     *
     * @param {Object} stores
     *
     * @returns {Wetland}
     */
    registerStores(stores) {
        for (const store in stores) {
            this.registerStore(store, stores[store]);
        }
        return this;
    }
    /**
     * Register a store with wetland.
     *
     * @param {string} store
     * @param {{}}     config
     *
     * @returns {Wetland}
     */
    registerStore(store, config) {
        if (this.config.fetch('debug')) {
            config.debug = true;
        }
        this.stores[store] = new Store_1.Store(store, config);
        // The first registered store is the default store.
        this.config.fetchOrPut('defaultStore', store);
        return this;
    }
    /**
     * Get a store by name.
     *
     * @param {string} storeName
     *
     * @returns {Store}
     */
    getStore(storeName) {
        storeName = storeName || this.config.fetch('defaultStore');
        if (!storeName) {
            throw new Error('No store name supplied, and no default store found.');
        }
        const store = this.stores[storeName];
        if (!store) {
            throw new Error(`No store called "${storeName}" found.`);
        }
        return store;
    }
    /**
     * Get a seeder.
     *
     * @return {Seeder}
     */
    getSeeder() {
        return new Seeder_1.Seeder(this);
    }
    /**
     * Get a cleaner.
     *
     * @return {Cleaner}
     */
    getCleaner() {
        return new Cleaner_1.Cleaner(this);
    }
    /**
     * Get a scoped entityManager. Example:
     *
     *  const wet = new Wetland();
     *  wet.getManager();
     *
     * @returns {Scope}
     */
    getManager() {
        return this.entityManager.createScope();
    }
    /**
     * Get the root entity manager.
     *
     * @returns {EntityManager}
     */
    getEntityManager() {
        return this.entityManager;
    }
    /**
     * Get the migrator.
     *
     * @returns {Migrator}
     */
    getMigrator() {
        if (!this.migrator) {
            this.migrator = new Migrator_1.Migrator(this);
        }
        return this.migrator;
    }
    /**
     * Get the schema.
     *
     * @returns {SchemaManager}
     */
    getSchemaManager() {
        if (!this.schema) {
            this.schema = new SchemaManager_1.SchemaManager(this);
        }
        return this.schema;
    }
    /**
     * Get the snapshot engine.
     *
     * @returns {SnapshotManager}
     */
    getSnapshotManager() {
        if (!this.snapshotManager) {
            this.snapshotManager = new SnapshotManager_1.SnapshotManager(this);
        }
        return this.snapshotManager;
    }
    /**
     * @returns {Populate}
     */
    getPopulator(scope) {
        return new Populate_1.Populate(scope);
    }
    /**
     * Destroy all active connections.
     *
     * @returns {Promise<any>}
     */
    destroyConnections() {
        const destroys = [];
        Object.getOwnPropertyNames(this.stores).forEach(storeName => {
            const connections = this.stores[storeName].getConnections();
            connections[Store_1.Store.ROLE_SLAVE].forEach(connection => {
                destroys.push(connection.destroy().then());
            });
            connections[Store_1.Store.ROLE_MASTER].forEach(connection => {
                destroys.push(connection.destroy().then());
            });
        });
        return Promise.all(destroys);
    }
    /**
     * Initialize the config.
     *
     * @param {{}} config
     */
    initializeConfig(config) {
        if (config) {
            this.config.merge(config);
        }
        const stores = this.config.fetch('stores');
        const entities = this.config.fetch('entities');
        const entityPaths = this.config.fetch('entityPaths', []);
        const entityPath = this.config.fetch('entityPath');
        if (stores) {
            this.registerStores(stores);
        }
        else {
            this.registerDefaultStore();
        }
        if (entities) {
            this.registerEntities(entities);
        }
        if (entityPath) {
            entityPaths.push(entityPath);
        }
        if (!entityPaths.length) {
            return;
        }
        entityPaths.forEach(entityPath => {
            fs.readdirSync(entityPath)
                .filter(match => match.search(exports.entityFilterRegexp) > -1)
                .map(entity => entity.replace(exports.entityExtensionRegexp, ''))
                .forEach(entity => {
                const filePath = path.resolve(entityPath, entity);
                const entityModule = require(filePath);
                let ToRegister = entityModule;
                if (typeof ToRegister !== 'function') {
                    ToRegister = entityModule.default;
                }
                if (typeof ToRegister !== 'function') {
                    ToRegister = entityModule[entity];
                }
                if (typeof ToRegister !== 'function') {
                    throw new Error(`Error loading entity '${entity}'. No constructor exported.`);
                }
                this.registerEntity(ToRegister);
            });
        });
    }
    /**
     * set of listeners for the exit event.
     */
    setupExitListeners() {
        process.on('beforeExit', () => this.destroyConnections());
    }
    /**
     * Register a default (fallback) store (sqlite3).
     */
    registerDefaultStore() {
        try {
            require('sqlite3');
        }
        catch (error) {
            throw new Error('No stores configured and sqlite3 not found as dependency. ' +
                'Configure a store, or run `npm i --save sqlite3`.');
        }
        this.registerStore(this.config.fetch('defaultStore'), {
            client: 'sqlite3',
            useNullAsDefault: true,
            connection: { filename: `${this.config.fetch('dataDirectory')}/wetland.sqlite` },
        });
    }
    /**
     * Ensure that the data directory exists.
     *
     * @param {string} dataDirectory
     */
    ensureDataDirectory(dataDirectory) {
        try {
            fs.statSync(dataDirectory);
        }
        catch (error) {
            try {
                mkdirp.sync(dataDirectory);
            }
            catch (error) {
                throw new Error(`Unable to create data directory at '${dataDirectory}'`);
            }
        }
    }
}
exports.Wetland = Wetland;
