export declare class Entity {
    static toObject<T>(source: T): Partial<T> | Partial<T>[];
    toObject(): Partial<this>;
}
