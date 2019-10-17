"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Wetland_1 = require("../../src/Wetland");
const UnitOfWork_1 = require("../../src/UnitOfWork");
const Simple_1 = require("../resource/entity/Simple");
const EntityRepository_1 = require("../../src/EntityRepository");
const WithCustomRepository_1 = require("../resource/entity/WithCustomRepository");
const CustomRepository_1 = require("../resource/repository/CustomRepository");
const NoAutoIncrement_1 = require("../resource/entity/NoAutoIncrement");
const Schema_1 = require("../resource/Schema");
function entityManager(entities) {
    let wetland = new Wetland_1.Wetland({});
    if (entities) {
        wetland.registerEntities(entities);
    }
    return wetland.getManager();
}
describe('Scope', () => {
    describe('.getRepository()', () => {
        it('should return a default repository', () => {
            let scope = entityManager([Simple_1.Simple]);
            chai_1.assert.instanceOf(scope.getRepository(Simple_1.Simple), EntityRepository_1.EntityRepository);
        });
        it('should return a custom repository', () => {
            let scope = entityManager([WithCustomRepository_1.WithCustomRepository]);
            chai_1.assert.instanceOf(scope.getRepository(WithCustomRepository_1.WithCustomRepository), EntityRepository_1.EntityRepository);
            chai_1.assert.instanceOf(scope.getRepository(WithCustomRepository_1.WithCustomRepository), CustomRepository_1.CustomRepository);
        });
    });
    describe('.getUnitOfWork()', () => {
        it('should return the UnitOfWork', () => {
            let scope = entityManager();
            chai_1.assert.instanceOf(scope.getUnitOfWork(), UnitOfWork_1.UnitOfWork);
        });
    });
    describe('.persist()', () => {
        it('should add the entity to the unitOfWork', () => {
            let scope = entityManager([Simple_1.Simple]);
            let simple = new Simple_1.Simple;
            scope.persist(simple);
            chai_1.assert.strictEqual(UnitOfWork_1.UnitOfWork.getObjectState(simple), UnitOfWork_1.UnitOfWork.STATE_NEW);
        });
        it('should return Scope', () => {
            let scope = entityManager([Simple_1.Simple]);
            chai_1.assert.strictEqual(scope.persist(new Simple_1.Simple), scope);
        });
    });
    describe('.remove()', () => {
        it('should add the entity to the unitOfWork as "deleted"', () => {
            let scope = entityManager([Simple_1.Simple]);
            let simple = new Simple_1.Simple;
            scope.remove(simple);
            chai_1.assert.strictEqual(UnitOfWork_1.UnitOfWork.getObjectState(simple), UnitOfWork_1.UnitOfWork.STATE_DELETED);
        });
        it('should return Scope', () => {
            let scope = entityManager([Simple_1.Simple]);
            chai_1.assert.strictEqual(scope.remove(new Simple_1.Simple), scope);
        });
    });
    describe('.getReference()', () => {
        it('should return a reference', () => {
            // @todo test if delete works like this:
            // entityManager.remove(entityManager.getReference('Foo', 6));
        });
    });
    describe('.refresh()', () => {
        const wetland = new Wetland_1.Wetland({
            stores: {
                defaultStore: {
                    client: 'mysql',
                    connection: {
                        user: 'root',
                        host: '127.0.0.1',
                        database: 'wetland_test',
                    },
                },
            },
            entities: [NoAutoIncrement_1.NoAutoIncrement],
        });
        before((done) => {
            Schema_1.Schema.resetDatabase(() => wetland.getSchemaManager().create().then(() => done()));
        });
        it('should throw an error on refresh without AI if refresh is enabled.', done => {
            const scope = wetland.getManager();
            scope.persist(Object.assign(new NoAutoIncrement_1.NoAutoIncrement, { id: 123, foo: 'foo' }));
            // Flush with default (refresh enabled).
            scope.flush(false, false)
                .then(() => done('flush should have failed.'))
                .catch(error => {
                chai_1.assert.strictEqual(error.message, 'Cannot refresh entity without a PK value.');
                done();
            });
        });
        it('should not throw an error on refresh without PK if refresh is disabled', done => {
            const scope = wetland.getManager();
            scope.persist(Object.assign(new NoAutoIncrement_1.NoAutoIncrement, { id: 456, foo: 'foo' }));
            // Flush with refresh disabled.
            scope.flush(false, false, { refreshCreated: false })
                .then(() => done())
                .catch(() => done('Flush should have succeeded.'));
        });
    });
    describe('.clear()', () => {
        it('should reset the unit of work', () => {
            let scope = entityManager([Simple_1.Simple]);
            let simple = new Simple_1.Simple;
            scope.remove(simple);
            chai_1.assert.strictEqual(UnitOfWork_1.UnitOfWork.getObjectState(simple), UnitOfWork_1.UnitOfWork.STATE_DELETED);
            scope.clear();
            chai_1.assert.strictEqual(UnitOfWork_1.UnitOfWork.getObjectState(simple), UnitOfWork_1.UnitOfWork.STATE_UNKNOWN);
        });
    });
});
