import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as Bluebird from 'bluebird';
import { EntityManager, Mapping, Wetland } from './index';
import { FieldOptions } from './Mapping';

export class SnapshotManager {
  public static SNAPSHOTS_PATH: string = 'snapshots';
  public static DEV_SNAPSHOTS_PATH: string = 'dev_snapshots';
  /**
   * @type {Wetland}
   */
  private wetland: Wetland;
  /**
   * @type {EntityManager}
   */
  private entityManager: EntityManager;
  /**
   * @type {{}}
   */
  private config: { snapshotDirectory: string, devSnapshotDirectory: string };

  /**
   * Construct a new SnapshotManager manager.
   *
   * @param {Wetland} wetland
   */
  public constructor(wetland: Wetland) {
    this.wetland = wetland;
    this.entityManager = wetland.getEntityManager();

    const config = wetland.getConfig();
    this.config = {
      snapshotDirectory: path.join(config.fetch('dataDirectory'), SnapshotManager.SNAPSHOTS_PATH),
      devSnapshotDirectory: path.join(config.fetch('dataDirectory'), SnapshotManager.DEV_SNAPSHOTS_PATH),
    };

    this.ensureSnapshotDirectory();
  }

  /**
   * Create a new snapshot.
   *
   * @param {string}  name
   * @param {boolean} devSnapshot
   *
   * @returns {Bluebird}
   */
  public create(name: string = 'latest', devSnapshot: boolean = true): Bluebird<any> {
    const fileLocation = this.fileLocation(name, devSnapshot);

    return new Bluebird((resolve, reject) => {
      fs.writeFile(fileLocation, this.serializeMappings(), 'utf8', error => {
        if (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  /**
   * Remove an existing snapshot.
   *
   * @param {string}  name
   * @param {boolean} devSnapshot
   *
   * @returns {Bluebird}
   */
  public remove(name: string = 'latest', devSnapshot: boolean = true): Bluebird<any> {
    const fileLocation = this.fileLocation(name, devSnapshot);

    return new Bluebird((resolve, reject) => {
      fs.unlink(fileLocation, error => {
        if (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  /**
   * Fetch a snapshot's contents.
   *
   * @param {string}  name
   * @param {boolean} devSnapshot
   *
   * @returns {Bluebird}
   */
  public fetch(name: string = 'latest', devSnapshot: boolean = true): Bluebird<any> {
    const fileLocation = this.fileLocation(name, devSnapshot);

    return new Bluebird((resolve, reject) => {
      fs.readFile(fileLocation, 'utf8', (error, data) => {
        if (!error) {
          return resolve(JSON.parse(data));
        }

        if (error.code === 'ENOENT') {
          return resolve(null);
        }

        reject(error);
      });
    });
  }

  /**
   * Serialize and return the mappings.
   *
   * @returns {string}
   */
  public serializeMappings(): string {
    return JSON.stringify(this.getSerializable());
  }

  /**
   * Get the current mappings in serializable format.
   *
   * @returns {{}}
   */
  public getSerializable(): Object {
    const entities = this.entityManager.getEntities();
    const serializable = {};

    for (const entity in entities) {
      serializable[entity] = entities[entity].mapping.serializable();
    }

    return serializable;
  }

  /**
   * Diff two mappings.
   *
   * @param {{}} oldMapping
   * @param {{}} newMapping
   *
   * @returns {Object}
   */
  public diff(oldMapping: Object, newMapping: Object): Object {
    const instructions = {};
    const diff = diffObjectKeys(oldMapping, newMapping);
    const getInstructions = store => {
      store = store || this.entityManager.getConfig().fetch('defaultStore');

      if (!instructions[store]) {
        instructions[store] = { alter: {}, drop: [], create: {}, rename: [], foreign: { create: {}, drop: {} } };
      }

      return instructions[store];
    };

    diff.remain.forEach(entity => {
      const instructions = getInstructions(oldMapping[entity].store);
      const previous = Mapping.restore(oldMapping[entity]);
      const current = Mapping.restore(newMapping[entity]);
      const tableName = current.getTableName();
      const indexDiff = diffObjectKeys(oldMapping[entity].index, newMapping[entity].index);
      const fieldDiff = diffObjectKeys(oldMapping[entity].fields, newMapping[entity].fields);
      const uniqueDiff = diffObjectKeys(oldMapping[entity].unique, newMapping[entity].unique);
      const relationDiff = diffObjectKeys(oldMapping[entity].relations, newMapping[entity].relations);

      if (tableName !== oldMapping[entity].entity.tableName) {
        instructions.rename.push({ from: previous.getTableName(), to: tableName });
      }

      fieldDiff.drop.forEach(property => {
        if (oldMapping[entity].fields[property].relationship) {
          return;
        }

        getAlterInstructions(instructions.alter, tableName).dropColumn.push(previous.getColumnName(property));
      });

      fieldDiff.create.forEach((property: string) => {
        const field = current.getField(property);

        if (field.relationship) {
          return;
        }

        const alter = instructions.alter[tableName] || { dropColumn: [], column: [] };

        // Was removed, don't do that. Column rename.
        if (alter.dropColumn.includes(field.name)) {
          const dropped = alter.dropColumn.splice(alter.dropColumn.indexOf(field.name), 1);
          const previousField = oldMapping[entity].fields[oldMapping[entity].columns[dropped]];

          if (fieldChanged(previousField, field)) {
            getAlterInstructions(instructions.alter, tableName).fields.push(field);
          } else if (!alter.dropColumn.length && !alter.fields.length) {
            delete instructions.alter[tableName];
          }
        } else {
          getAlterInstructions(instructions.alter, tableName).fields.push(field);
        }
      });

      fieldDiff.remain.forEach(property => {
        const previousField = oldMapping[entity].fields[property];
        const field = newMapping[entity].fields[property];

        if (field.relationship) {
          const previousJoinColumn = previousField.joinColumn;
          const joinColumn = field.joinColumn;

          if (fieldChanged(previousJoinColumn, joinColumn)) {
            const relation = newMapping[entity].relations[field.name];
            const alter = getAlterInstructions(instructions.alter, tableName);

            getForeignCreateInstructions(instructions.foreign, tableName).push(createForeign(newMapping[entity], field.name, newMapping[relation.targetEntity]));
            getForeignDropInstructions(instructions.foreign, tableName).push(previousJoinColumn.name);
          }

          return;
        }

        if (previousField.name !== field.name) {
          getAlterInstructions(instructions.alter, tableName).dropColumn.push(previousField.name);
          getAlterInstructions(instructions.alter, tableName).fields.push(field);

          return;
        }

        if (fieldChanged(previousField, field)) {
          getAlterInstructions(instructions.alter, tableName).dropColumn.push(previousField.name);
          getAlterInstructions(instructions.alter, tableName).fields.push(field);
        }
      });

      indexDiff.create.forEach(index => {
        const alter = getAlterInstructions(instructions.alter, tableName);
        alter.index[index] = newMapping[entity].index[index];
      });

      indexDiff.drop.forEach(index => {
        return getAlterInstructions(instructions.alter, tableName).dropIndex.push({
          index,
          fields: oldMapping[entity].index[index],
        });
      });

      indexDiff.remain.forEach(index => {
        if (oldMapping[entity].index[index].join() !== newMapping[entity].index[index].join()) {
          const alter = getAlterInstructions(instructions.alter, tableName);
          alter.index[index] = newMapping[entity].index[index];

          alter.dropIndex.push({
            index,
            fields: oldMapping[entity].index[index],
          });
        }
      });

      uniqueDiff.create.forEach(unique => {
        const alter = getAlterInstructions(instructions.alter, tableName);
        alter.unique[unique] = newMapping[entity].unique[unique];
      });

      uniqueDiff.drop.forEach(unique => getAlterInstructions(instructions.alter, tableName).dropUnique.push({
        unique,
        fields: oldMapping[entity].unique[unique],
      }));

      uniqueDiff.remain.forEach(unique => {
        if (oldMapping[entity].unique[unique].join() !== newMapping[entity].unique[unique].join()) {
          const alter = getAlterInstructions(instructions.alter, tableName);
          alter.unique[unique] = newMapping[entity].unique[unique];

          alter.dropUnique.push({
            unique,
            fields: oldMapping[entity].unique[unique],
          });
        }
      });

      relationDiff.drop.forEach(property => {
        const relation = oldMapping[entity].relations[property];

        if ((relation.type === Mapping.RELATION_MANY_TO_ONE) || (relation.type === Mapping.RELATION_ONE_TO_ONE && !relation.mappedBy)) {
          // We own the fk.
          const joinColumn = oldMapping[entity].fields[property].joinColumn;

          removeRelation(oldMapping[entity], property);
          getAlterInstructions(instructions.alter, tableName).dropColumn.push(joinColumn.name);

          return;
        }

        // Nothing to do for other side.
        if (relation.type === Mapping.RELATION_ONE_TO_MANY || !relation.inversedBy) {
          return;
        }

        // Many to many and owning, drop join table.
        instructions.drop.push(oldMapping[entity].fields[property].joinTable.name);
      });

      relationDiff.create.forEach(property => {
        const relation = newMapping[entity].relations[property];

        createRelation(newMapping[entity], property, newMapping[relation.targetEntity]);
      });

      relationDiff.remain.forEach(property => {
        const newRelation = newMapping[entity].relations[property];

        if ((newRelation.type === Mapping.RELATION_MANY_TO_ONE) || (newRelation.type === Mapping.RELATION_ONE_TO_ONE && !newRelation.mappedBy)) {
          return;
        }

        // Nothing to do for other side.
        if (!newRelation.inversedBy) {
          return;
        }

        const oldJoinTable = JSON.stringify(oldMapping[entity].fields[property].joinTable);
        const newJoinTable = JSON.stringify(newMapping[entity].fields[property].joinTable);

        if (oldJoinTable !== newJoinTable) {
          removeRelation(oldMapping[entity], property);
          createRelation(newMapping[entity], property, newMapping[newRelation.targetEntity]);
        }
      });
    });

    diff.create.forEach((entity: string) => {
      const toCreate = newMapping[entity];
      const instructions = getInstructions(toCreate.store);
      const create = getCreateInstructions(instructions.create, toCreate.entity.tableName);
      create.index = toCreate.index;
      create.unique = toCreate.unique;
      create.meta = {};
      create.fields = Reflect.ownKeys(toCreate.fields)
        .filter(field => !toCreate.fields[field].relationship)
        .map(field => {
          toCreate.fields[field].name = toCreate.fields[field].name || field;

          return toCreate.fields[field];
        });

      if (toCreate.entity.charset) {
        create.meta.charset = toCreate.entity.charset;
      }

      if (toCreate.entity.collate) {
        create.meta.collate = toCreate.entity.collate;
      }

      if (!toCreate.relations) {
        return;
      }

     //adds fields that are already added. unnecessary
     /* Reflect.ownKeys(toCreate.relations).forEach(property => {
        const relation = toCreate.relations[property];

        if (newMapping[relation.targetEntity] === undefined) {
          throw new Error(
            `Unable to find "${relation.targetEntity}" on "${entity}". ` +
            `Check the targetEntity name, and class name for typos and make sure you don't have a circular dependency.`,
          );
        }

        const prepared = createRelation(newMapping[entity], property, newMapping[relation.targetEntity], true);

        if (!prepared) {
          return;
        }

        create.fields.push(prepared.field);

        getForeignCreateInstructions(instructions.foreign, toCreate.entity.tableName).push(prepared.foreign);
      });*/
    });

    // Make sure all tables to drop are staged as instructions
    diff.drop.forEach(entity => {
      const instructions = getInstructions(oldMapping[entity].store);

      instructions.drop.push(oldMapping[entity].entity.tableName);
    });

    diff.drop.forEach(entity => {
      const instructions = getInstructions(oldMapping[entity].store);
      const relations = oldMapping[entity].relations;

      if (!relations) {
        return;
      }

      Reflect.ownKeys(relations).forEach(property => {
        const relation = relations[property];
        const oldFields = oldMapping[entity].fields;

        if ((relation.type === Mapping.RELATION_MANY_TO_ONE) || (relation.type === Mapping.RELATION_ONE_TO_ONE && !relation.mappedBy)) {
          return getForeignDropInstructions(instructions.foreign, oldMapping[entity].entity.tableName).push(oldFields[property].joinColumn.name);
        }

        // Inversed side. Perform check and return.
        if (relation.mappedBy) {
          return;
        }

        // Many to many and owning
        instructions.drop.push(oldFields[property].joinTable.name);
      });
    });

    function getForeignCreateInstructions (foreign, table) {
      foreign.create[table] = foreign.create[table] || [];

      return foreign.create[table];
    }

    function getForeignDropInstructions (foreign, table) {
      foreign.drop[table] = foreign.drop[table] || [];

      return foreign.drop[table];
    }

    function getAlterInstructions (alter, table) {
      if (!alter[table]) {
        alter[table] = {
          dropIndex: [],
          dropUnique: [],
          dropColumn: [],
          index: {},
          unique: {},
          fields: [],
          alterFields: [],
        };
      }

      return alter[table];
    }

    function getCreateInstructions (create, table) {
      if (!create[table]) {
        create[table] = {
          meta: {},
          index: {},
          unique: {},
          fields: [],
        };
      }

      return create[table];
    }

    function removeRelation (mapping, property) {
      const relation = mapping.relations[property];
      const tableName = mapping.entity.tableName;
      const instructions = getInstructions(mapping.store);

      if ((relation.type === Mapping.RELATION_MANY_TO_ONE) || (relation.type === Mapping.RELATION_ONE_TO_ONE && !relation.mappedBy)) {
        return getForeignDropInstructions(instructions.foreign, tableName).push(mapping.fields[property].joinColumn.name);
      }

      // Nothing to do for other side.
      if (relation.type === Mapping.RELATION_ONE_TO_MANY || !relation.inversedBy) {
        return;
      }

      instructions.drop.push(mapping.fields[property].joinTable.name);
    }

    function createForeign (mapping, property, targetMapping) {
      const joinColumn = mapping.fields[property].joinColumn;
      return {
        inTable: targetMapping.entity.tableName,
        references: joinColumn.referencedColumnName,
        columns: joinColumn.name,
        onDelete: joinColumn.onDelete,
        onUpdate: joinColumn.onUpdate,
      };
    }

    function createRelation (mapping, property, targetMapping, create?) {
      const relation = mapping.relations[property];
      const tableName = mapping.entity.tableName;
      const instructions = getInstructions(mapping.store);

      if ((relation.type === Mapping.RELATION_MANY_TO_ONE) || (relation.type === Mapping.RELATION_ONE_TO_ONE && !relation.mappedBy)) {
        // We own the fk.
        const joinColumn = mapping.fields[property].joinColumn;
        const changes = {
          field: {
            name: joinColumn.name,
            type: 'integer',
            unsigned: true,
            nullable: (typeof joinColumn.nullable === 'boolean' ? joinColumn.nullable : true),
          },
          foreign: createForeign(mapping, property, targetMapping),
        };

        if (!targetMapping.columns[joinColumn.referencedColumnName]) {
          throw new Error(
            `Cannot create foreign key for '${tableName}', ` +
            `column '${joinColumn.referencedColumnName}' not found on target entity '${targetMapping.entity.tableName}'.`,
          );
        }

        if (create) {
          return changes;
        }

        const alterOrCreate = getAlterInstructions(instructions[create ? 'create' : 'alter'], tableName);

        alterOrCreate.fields.push(changes.field);

        getForeignCreateInstructions(instructions.foreign, tableName).push(changes.foreign);

        return;
      }

      // Nothing to do for other side.
      if (relation.type === Mapping.RELATION_ONE_TO_MANY || !relation.inversedBy) {
        return;
      }

      buildJoinTable(
        mapping.fields[property].joinTable,
        tableName,
        targetMapping.entity.tableName,
        instructions.create,
        instructions.foreign,
      );
    }

    function buildJoinTable (joinTable, tableName, targetTableName, instructions, foreignInstructions) {
      const foreignColumns = [];
      const referenceColumns = [];
      const foreignColumnsInverse = [];
      const referenceColumnsInverse = [];
      const joinTableIndexes = {};
      const joinTableFields: Array<FieldOptions> = [ {
        name: 'id',
        primary: true,
        type: 'integer',
        generatedValue: 'autoIncrement',
      } ];

      const processTableColumns = (side, foreign, reference) => {
        joinTableFields.push({
          name: side.name,
          type: side.type || 'integer',
          size: side.size || null,
          unsigned: true,
          nullable: true,
        });

        joinTableIndexes['idx_' + joinTable.name + '_' + side.name] = side.name;
        foreign.push(side.referencedColumnName);
        reference.push(side.name);
      };

      joinTable.joinColumns.forEach(column => processTableColumns(column, foreignColumns, referenceColumns));
      joinTable.inverseJoinColumns.forEach(column => processTableColumns(column, referenceColumnsInverse, foreignColumnsInverse));

      getForeignCreateInstructions(foreignInstructions, joinTable.name).push(
        {
          columns: foreignColumnsInverse,
          references: referenceColumnsInverse,
          inTable: targetTableName,
          onDelete: 'cascade',
        },
        {
          columns: referenceColumns,
          references: foreignColumns,
          inTable: tableName,
          onDelete: 'cascade',
        },
      );

      instructions[joinTable.name] = { fields: joinTableFields, index: joinTableIndexes };
    }

    function diffObjectKeys (from, to) {
      if (typeof from !== 'object' && typeof to !== 'object') {
        return { drop: [], create: [], remain: [] };
      }

      from = from || {};
      to = to || {};
      const oldKeys = new Set(Reflect.ownKeys(from));
      const newKeys = new Set(Reflect.ownKeys(to));
      const drop = new Set([ ...oldKeys ].filter(key => !newKeys.has(key))); // Old keys
      const create = new Set([ ...newKeys ].filter(key => !oldKeys.has(key))); // New keys
      const covered = new Set([ ...drop, ...create ]);                          // Created or dropped
      const remain = new Set([ ...newKeys ].filter(key => !covered.has(key)));

      return { drop: [ ...drop ], create: [ ...create ], remain: [ ...remain ] };
    }

    function fieldChanged (oldField, newField) {
      return JSON.stringify(oldField) !== JSON.stringify(newField);
    }

    return this.postDiffingOperations(instructions);
  }

  /**
   * Resolve to file location.
   *
   * @param {string}  name
   * @param {boolean} devSnapshot
   *
   * @returns {string}
   */
  private fileLocation(name: string, devSnapshot: boolean): string {
    const directory = this.config[devSnapshot ? 'devSnapshotDirectory' : 'snapshotDirectory'];

    return path.resolve(directory, `${name}.json`);
  }

  /**
   * Do some post-diffing operations on drafted instructions.
   *
   * @param {{}} instructions
   *
   * @returns {{}}}
   */
  private postDiffingOperations(instructions: Object): Object {
    Reflect.ownKeys(instructions).forEach(store => {
      const tableNames = Reflect.ownKeys(instructions[store].create);

      instructions[store].create = tableNames.map(tableName => {
        return { tableName, info: instructions[store].create[tableName] };
      });

      instructions[store].alter = Reflect.ownKeys(instructions[store].alter).map(tableName => {
        const alter = instructions[store].alter[tableName];
        const dropIndexes = alter.dropIndex;
        const dropUniques = alter.dropUnique;
        const dropColumns = alter.dropColumn;

        if (Array.isArray(dropColumns) && dropColumns.length) {
          alter.dropIndex = dropIndexes.filter(drop => drop.fields.filter(field => !dropColumns.includes(field)).length);
          alter.dropUnique = dropUniques.filter(drop => drop.fields.filter(field => !dropColumns.includes(field)).length);
        }

        return { tableName, info: instructions[store].alter[tableName] };
      });
    });

    return instructions;
  }

  /**
   * Make sure the snapshot directory exists.
   */
  private ensureSnapshotDirectory(): void {
    try {
      fs.statSync(this.config.snapshotDirectory);
    } catch (error) {
      mkdirp.sync(this.config.snapshotDirectory);
    }

    try {
      fs.statSync(this.config.devSnapshotDirectory);
    } catch (error) {
      mkdirp.sync(this.config.devSnapshotDirectory);
    }
  }
}
