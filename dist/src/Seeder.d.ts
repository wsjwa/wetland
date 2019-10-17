import { Wetland } from './Wetland';
import { Homefront } from 'homefront';
export declare class Seeder {
    config: Homefront;
    wetland: Wetland;
    constructor(wetland: Wetland);
    /**
     * Seed files contained in the fixtures directory.
     *
     * @return {Promise}
     */
    seed(): Promise<any>;
    /**
     * Bulk features insertion.
     *
     * @param {string} entityName
     * @param {Array<Object>} features
     * @param {boolean} bypassLifecyclehooks
     * @return {Promise<any>}
     */
    private cleanlyInsertFeatures;
    /**
     * Safe (no duplicate) features insertion going through the lifecylehooks.
     *
     * @param {string} entityName
     * @param {Array<Object>} features
     * @param {boolean} bypassLifecyclehooks
     * @return {Promise<any>}
     */
    private safelyInsertFeatures;
    /**
     * Seed features according to options.
     *
     * @param {string} entityName
     * @param {Array<Object>} features
     * @param {boolean} clean
     * @param {boolean} bypassLifecyclehooks
     * @return {Promise<any>}
     */
    private seedFeatures;
    /**
     * Seed from file.
     *
     * @param {string} src
     * @param {string} file
     * @param {boolean} clean
     * @param {boolean} bypassLifecyclehooks
     * @return {Promise<any>}
     */
    private seedFile;
}
