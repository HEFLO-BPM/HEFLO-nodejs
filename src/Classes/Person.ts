import { Context } from '../Context';
import { Metadata } from '../Metadata';
import { Account } from './Account';
import { IDictionary } from '../Types';

/**
* A Person is an individual involved in executing or publishing a business process. Examples include the user responsible for a request, the requester, the process owner, and others.
*/
export class Person extends Account {
    public static ClassOid = "8c6f3260-c030-40a7-8d60-60142fdef2a5";
    public static ClassName = "Venki.Organization.Person";

    protected departmentOid: number | undefined;

    /**
     * Create a new instance of the type Person. In case of a new record use the method NewAsync instead of this constructor.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     */
    constructor (context: Context) {
        super(context);
        this.classOid = Person.ClassOid;
    }

    /**
    * Set the value of a custom field.
    * @param {string} fieldName - Name or alias of the field. (click the script icon in the edition dialog)
    * @param {any} value - Current value of the custom field.
    */
    public Set(fieldName: string, value: any) {
        this.LogChange(Person.ClassOid, fieldName, this.oid, value);
    }

    /**
    * Get the identifier of the account department
    */
    public get DepartmentOid(): number | undefined {
        return this.departmentOid;
    }

    /**
    * Set the identifier of the account department
    */
    public set DepartmentOid(value: number | undefined) {
        this.departmentOid = value;
        this.context.addChange(Person.ClassOid, "DepartmentOid", this.oid, value);
    }

    /**
    * Get whether the person's account is enabled
    */
    public get Enabled(): boolean | undefined {
        return this.fields["Enabled"];
    }

    /**
    * Enable or disable the person's account
    */
    public set Enabled(value: boolean | undefined) {
        this.fields["Enabled"] = value;
        this.context.addChange(this.classOid, "Enabled", this.oid, value);
    }
    
    /**
    * Find a person by an identifier
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @param {number} id - Identifier of the instance.
    * @returns Object instance of a person.
    */
    public static async FindAsync(context: Context, id: number): Promise<Person> {
        return <Person>(await context.FindAsync(`${context.StorageRelational}odata/Person(${id})?$select=Oid,Name,Email,DepartmentOid,Enabled&$selectCustom=true`, 
            Person.ClassOid, (data: Array<any>) => { return Person.Parse(context, data); } ));
    }

    /**
    * Search for objects using filter criteria. To create the filter, use a condition that follows the OData filter syntax and includes the available fields fields in the environment.
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @param {string} filter - A filter expression following the OData filter syntax.
    * @param {boolean} useCache - It stores the content in a local cache for later reuse. The cache lifespan is approximately 600 seconds.
    * @returns A list of objects retrieved from the backend based on the search criteria. Note: the retrieval is limited to a maximum of 1,000 records.
    */
    public static async WhereAsync(context: Context, filter: string, useCache: boolean = true): Promise<Array<Person>> {
        return <Array<Person>> await context.WhereAsync(Person.ClassOid, 
            `${context.StorageRelational}odata/Person?$select=Oid,Name,Email,DepartmentOid,Enabled&$filter=(${filter})&$selectCustom=true`, filter, 
            (data: Array<any>) => { return Person.Parse(context, data); }, useCache);
    }

    /**
    * Load the object's content from JSON data.
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @param {Array<any>} data - An array of key-value pairs (JSON data).
    * @returns Object instance initialized.
    */
    public static Parse(context: Context,data: Array<any>): Person {
        let obj = new Person(context);
        obj.Parse(data);
        return obj;
    }

    /**
    * Populate the object's fields with data from the record.
    * @param {IDictionary} data - A dictionary holding the record's data.
    */
    public Parse(data: IDictionary) {
        super.Parse(data);
        if (data) {
            this.departmentOid = data["DepartmentOid"];
            this.fields["Enabled"] = data["Enabled"];
        }
    }

    /**
    * Save all pending changes of the person.
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @returns Identifier of the saved record.
    */
    public async SaveAsync(context: Context): Promise<number> {

        if (this.isNew) {
            let payload = {
                Oid: this.Oid,
                Name: this.Name,
                Email: this.Email,
                DepartmentOid: this.DepartmentOid,
                Enabled: this.Enabled,
                RecordKind: "Person",
            }

            this.Parse(await context.PostAsync(this.GetStorageEndPoint(), payload, this.fields));
        } else {
            await context.PatchAsync(this.context.StorageRelational, this.classOid, this.GetKey(), [`Person(${this.oid})`]);
        }

        return this.Oid;
    }

    protected GetStorageEndPoint(id?: number): string {
        if (id)
            return `${this.context.StorageRelational}odata/Person(${this.oid})`;
        else
            return `${this.context.StorageRelational}odata/Person`;
    } 

    /**
    * Create a new instance of a person and initialize all fields.
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @returns Object instance of a person
    */
    public static async NewAsync(context: Context): Promise<Person> {
        await Metadata.CheckAsync(context, Person.ClassOid);
        let person = new Person(context);
        person.isNew = true;
        return person;
    }
}
