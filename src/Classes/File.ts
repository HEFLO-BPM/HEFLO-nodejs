import { Context } from '../Context';
import { BaseModel } from '../BaseModel';
import { IDictionary } from '../Types';


/**
* A File is an attachment in a work item or process.
*/
export class File extends BaseModel {
    private static ClassOid = "0f5b9a57-3968-4e5f-b719-5ee21a5510eb";

    protected filename: string = "";
    protected url: string = "";

    /**
     * Create a new instance of the type File. This constructor is used by the library's code and should not be used by API users.
     * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
     */
    constructor (context: Context) {
        super(context);
        this.classOid = File.ClassOid;
    }

    /**
    * Load the object's content from JSON data.
    * @param {Context} context - Context information of the call. In most of the cases you can build the context using the request object.
    * @param {Array<any>} data - An array of key-value pairs (JSON data).
    * @returns Object instance initialized.
    */
    public static Parse(context: Context, data: Array<any>): File {
        let obj = new File(context);
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
            this.filename = data["Filename"];
            this.url = data["Url"];
        }
    }

    /**
    * Get the url of the file
    */
    public get Url() {
        return this.url;
    }

    /**
    * Get the filename of the file
    */
    public get Filename() {
        return this.filename;
    }

}