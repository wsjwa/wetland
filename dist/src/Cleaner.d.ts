import { Wetland } from './Wetland';
export declare class Cleaner {
    wetland: Wetland;
    /**
     * Construct a cleaner instance.
     *
     * @param {Wetland} wetland
     */
    constructor(wetland: Wetland);
    /**
     * Clean wetland's related tables and wetland's dev snapshots'.
     *
     * @return {Promise<any>}
     */
    clean(): Promise<any>;
    /**
     * Clean the dev snapshots in the data directory.
     *
     * @return {Promise<any>}
     */
    private cleanDataDirectory;
    /**
     * Drop all tables' entities.
     *
     * @return {Promise<any>}
     */
    private dropTables;
}
