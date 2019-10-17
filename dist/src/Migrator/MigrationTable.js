"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Migrator_1 = require("./Migrator");
class MigrationTable {
    /**
     * Construct migrationTable.
     *
     * @param {Knex}   connection
     * @param {string} tableName
     * @param {string} lockTableName
     */
    constructor(connection, tableName, lockTableName) {
        this.connection = connection;
        this.tableName = tableName;
        this.lockTableName = lockTableName;
    }
    /**
     * Obtain a lock.
     *
     * @returns {Promise<any>}
     */
    getLock() {
        return this.ensureMigrationTables().then(() => {
            return this.connection.transaction(transaction => {
                return this.isLocked(transaction)
                    .then(isLocked => {
                    if (isLocked) {
                        throw new Error('Migration table is already locked');
                    }
                })
                    .then(() => this.lockMigrations(transaction));
            });
        });
    }
    /**
     * Free a lock.
     *
     * @returns {QueryBuilder}
     */
    freeLock() {
        return Promise.resolve(this.connection(this.lockTableName).update({ locked: 0 }));
    }
    /**
     * Get the ID of the last run.
     *
     * @returns {Promise<number|null>}
     */
    getLastRunId() {
        const lastRunId = this.connection(this.tableName)
            .select('run')
            .limit(1)
            .orderBy('run', 'desc')
            .then(result => result[0] ? result[0].run : null);
        return Promise.resolve(lastRunId);
    }
    /**
     * Get the name of the last run migration.
     *
     * @returns {Promise<string|null>}
     */
    getLastMigrationName() {
        return this.ensureMigrationTables().then(() => {
            return this.connection(this.tableName)
                .select('name')
                .limit(1)
                .orderBy('id', 'desc')
                .then(result => result[0] ? result[0].name : null);
        });
    }
    /**
     * Get the names of the migrations that were part of the last run.
     *
     * @returns {Promise<Array<string>|null>}
     */
    getLastRun() {
        return this.getLastRunId().then(lastRun => {
            if (lastRun === null) {
                return null;
            }
            const connection = this.connection(this.tableName)
                .select('name')
                .where('run', lastRun)
                .orderBy('id', 'desc');
            return connection.then(results => results.map(result => result.name));
        });
    }
    /**
     * Get the names of the migrations that were run.
     *
     * @returns {Promise<Array<string>|null>}
     */
    getAllRun() {
        return this.ensureMigrationTables().then(() => {
            return this.connection(this.tableName)
                .orderBy('id', 'desc');
        });
    }
    /**
     * Save the last run.
     *
     * @param {string}   direction
     * @param {string[]} migrations
     *
     * @returns {Promise}
     */
    saveRun(direction, migrations) {
        if (direction === Migrator_1.Migrator.DIRECTION_DOWN) {
            return Promise.resolve(this.connection(this.tableName).whereIn('name', migrations).del());
        }
        return this.getLastRunId().then(lastRun => {
            return this.connection(this.tableName).insert(migrations.map(name => {
                return { name, run: (lastRun + 1) };
            }));
        });
    }
    /**
     * Check if migrations is locked.
     *
     * @param {Knex.Transaction} transaction
     *
     * @returns {Promise<boolean>}
     */
    isLocked(transaction) {
        const isLocked = this.connection(this.lockTableName)
            .transacting(transaction)
            .forUpdate()
            .select('*')
            .then(data => !!data[0] && !!data[0].locked);
        return Promise.resolve(isLocked);
    }
    /**
     * Lock migrations.
     *
     * @param {Knex.Transaction} transaction
     *
     * @returns {QueryBuilder}
     */
    lockMigrations(transaction) {
        return Promise.resolve(this.connection(this.lockTableName).transacting(transaction).update({ locked: 1 }));
    }
    /**
     * Ensure the migration tables exist.
     *
     * @returns {Promise<any>}
     */
    ensureMigrationTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = this.connection;
            const migrationTableExists = yield connection.schema.hasTable(this.tableName);
            if (migrationTableExists) {
                return;
            }
            yield connection.schema.createTable(this.tableName, t => {
                t.increments();
                t.string('name');
                t.integer('run');
                t.timestamp('migration_time').defaultTo(connection.fn.now());
                t.index(['run']);
                t.index(['migration_time']);
            });
            const lockTableExists = yield connection.schema.hasTable(this.lockTableName);
            if (lockTableExists) {
                return;
            }
            yield connection.schema.createTable(this.lockTableName, t => t.boolean('locked'));
            return connection.schema;
        });
    }
}
exports.MigrationTable = MigrationTable;
