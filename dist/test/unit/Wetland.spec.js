"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Wetland_1 = require("../../src/Wetland");
describe('Wetland', () => {
    describe('.initializeConfig()', () => {
        it('load the entities we expect using the regex used.', () => {
            const testFiles = [
                'some-entity.js',
                'some-entity.garbage',
                'some-entity.d.js',
                'some.entity.js',
                'some.other-entity.js',
                'some.other-entity.model.thing.js',
                '-some.other-entity.model.thing.js',
                'some-entity.ts',
                'some-entity.d.ts',
                'some.entity.ts',
                'some.other-entity.ts',
                'some.other-entity.model.thing.ts',
                '-some.other-entity.model.thing.ts',
            ];
            const expected = [
                'some-entity',
                'some.entity',
                'some.other-entity',
                'some.other-entity.model.thing',
                '-some.other-entity.model.thing',
                'some-entity',
                'some.entity',
                'some.other-entity',
                'some.other-entity.model.thing',
                '-some.other-entity.model.thing',
            ];
            const result = testFiles
                .filter(match => match.search(Wetland_1.entityFilterRegexp) > -1)
                .map(entity => entity.replace(Wetland_1.entityExtensionRegexp, ''));
            chai_1.assert.deepEqual(result, expected);
        });
    });
});
