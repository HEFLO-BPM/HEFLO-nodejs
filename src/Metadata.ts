import { Context } from './Context';
import { Class } from './Classes/Class';
import { IDictionary } from './Types';

/**
 * A helper class used to manage metadata information.
 */
export class Metadata {

    /**
     * Add the type information to the metadata.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the type. 
     * @param {string} dataJSON - JSon content of the metadata.
     */
    public static Add(context: Context, className: string, dataJSON: string) {
        if (dataJSON) {
            let cacheKey = this.buildClassCacheKey(context, className);
            context.Cache.set(cacheKey, dataJSON, context.CacheTTL);
        }
    }

    /**
     * Create a cache key for a type.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the type. 
     * @returns The cache key for the type.
     */
    private static buildClassCacheKey(context: Context, className: string): string {
        return `Class-${context.Domain}-${className}`;
    }

    /**
     * Verify if the metadata has already been loaded.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the type.
     */
    public static async CheckAsync(context: Context, className: string): Promise<void> {
        await this.GetClassMetadata(context, className);
    }

    /**
     * Obtain the metadata of a entity used to store a record list.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the record list entity.
     * @returns The identifier of the entity type.
     */
    public static GetListEntity(context: Context, className: string, propertyName: string): string | undefined {
        let cacheKey = this.buildClassCacheKey(context, className);
        let classJSON = context.Cache.get(cacheKey);
        if (classJSON) {
            let metaClass = JSON.parse(<string>classJSON);
            if (metaClass) {
                let metaProp = (<Array<IDictionary>>metaClass["Properties"]).filter(item => item["Name"] === propertyName || item["CustomAlias"] === propertyName);
                if (metaProp && metaProp.length) {
                    return metaProp[0]["ListEntityName"];
                }
            }
        }

        return undefined;
    }

    /**
     * Retrieve the actual field name corresponding to an alias.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the record list entity.
     * @param {string} alias - The alias of the property, which is a user-friendly name created in the field configuration dialog.
     * @returns The property name, prefixed with 'cp_'.
     */
    public static GetPropertyName(context: Context, className: string, alias: string): string | undefined {
        let cacheKey = this.buildClassCacheKey(context, className);
        let classJSON = context.Cache.get(cacheKey);
        if (classJSON && alias) {
            let metaClass = JSON.parse(<string>classJSON);
            if (metaClass) {
                let aliasSearch = (alias || "").toLowerCase();
                let metaProp = (<Array<IDictionary>>metaClass["Properties"]).filter(item => {
                    if (item["Name"] && item["Name"].toString().toLowerCase() === aliasSearch)
                        return true;
                    else if (item["CustomAlias"] && item["CustomAlias"].toString().toLowerCase() === aliasSearch)
                        return true;
                    return false;
                });
                if (metaProp && metaProp.length)
                    return metaProp[0]["Name"];
                else
                    // The metadata cache can be stale/incomplete (e.g. a property created after the
                    // class metadata was cached, or a delete-protocol pseudo-field such as "Deleted").
                    // Fall back to the supplied name instead of returning undefined so callers do not
                    // throw "Field <name> not found" for fields that actually exist. This mirrors the
                    // no-metadata branch below, which already returns the alias as-is.
                    return alias;
            }
        }
        return alias;
    }

    /**
     * Retrieve the complete field metadata corresponding to an alias or field name.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the record list entity.
     * @param {string} alias - The alias of the property, which is a user-friendly name created in the field configuration dialog.
     * @returns The property metadata.
     */
    public static GetPropertyMetadata(context: Context, className: string, alias: string): IDictionary | undefined {
        let cacheKey = this.buildClassCacheKey(context, className);
        let classJSON = context.Cache.get(cacheKey);
        if (classJSON) {
            let metaClass = JSON.parse(<string>classJSON);
            if (metaClass) {
                let metaProp = (<Array<IDictionary>>metaClass["Properties"]).filter(item => item["Name"] === alias || item["CustomAlias"] === alias);
                if (metaProp && metaProp.length)
                    return metaProp[0];
                else 
                    return undefined;
            }
        }
        return [];
    }

    /**
     * Retrieve the complete type metadata.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     * @param {string} className - Name of the record list entity.
     * @returns The type metadata.
     */
    private static async GetClassMetadata(context: Context, className: string): Promise<Class | undefined> {
        // Guard against an undefined/empty class name (e.g. when a record-list field's
        // ListEntityName could not be resolved from incomplete metadata). Without this guard
        // the className.startsWith(...) call below throws a TypeError instead of failing softly.
        if (!className)
            return undefined;

        let cacheKey = this.buildClassCacheKey(context, className);
        let metaClass: Class;
        if (context.Cache.get(cacheKey) && !context.IsTest) {
            let metaJSON: string | undefined = context.Cache.get(cacheKey);
            if (metaJSON) {
                metaClass = new Class(context);
                metaClass.Parse(JSON.parse(metaJSON));
                metaClass.Context = context;
            }
            if (metaJSON && metaJSON !== "")
                context.Cache.set(cacheKey, metaJSON, context.CacheTTL);
        } else {
            let metaJSON: string = "";
            let classOid = className.startsWith("ce_") ? className.substring(3) : className;
            metaClass = <Class>(await context.FindAsync(`${context.CacheNoSQL}odata/Class('${classOid}')/DataServiceControllers.GetClassByOid?$select=Name&$expand=Properties($select=Name,Type,ListEntityName,CustomAlias)`,
                Class.ClassOid, (data: Array<any>) => {
                    metaJSON = JSON.stringify(data);
                    return Class.Parse(context, data);
                }
            ));
            if (metaJSON && metaJSON !== "")
                context.Cache.set(cacheKey, metaJSON, context.CacheTTL);
        }
        return undefined;
    }

}