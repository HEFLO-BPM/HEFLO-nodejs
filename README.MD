# HEFLO API

API (Application Programming Interface) to handle customizations on HEFLO BPM using Node.js and TypeScript.

Use it to react to process events (field changes, sequence flows, button clicks, record lists, file uploads), read and write form fields, query the export database with SQL, create records, send emails, and show messages to the end user.

## Installing

Using npm:

```bash
$ npm install heflo-api
```

## Concepts

Every customization is an HTTP endpoint that HEFLO calls when an event happens. The pattern is always the same:

1. Build an **event context** from the incoming request. The context class you pick depends on the event (`OnChanged`, `OnExecuteSequenceFlow`, `OnTrigger`, ...).
2. Read data with `Get(...)` and the context accessors (`WorkItem`, `Token`, `Record`, `Person`, ...).
3. Change data with `Set(...)`, or run side effects (queries, records, emails).
4. Return `context.GetModifiedData()` so HEFLO applies the changes to the instance.

```ts
import * as HEFLOApi from 'heflo-api'

exports.onChanged = async (req: any, resp: any) => {
  try {
    // 1. Build the event context from the request
    const context = new HEFLOApi.Events.WorkItem.OnChanged(req)

    // 2. Read a field
    const total = context.WorkItem.Get('total')

    // 3. Change another field
    context.WorkItem.Set('totalWithTax', total * 1.1)

    // 4. Return the delta so HEFLO persists it
    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing the request, details: ' + err)
  }
}
```

## Setting up an Express server

A minimal server that wires event handlers to routes.

```ts
// server.ts
const express = require('express')
const dotenv = require('dotenv')
dotenv.config()

const app = express()
app.use(express.json())

const workItemEvents = require('./events/workItem')

app.post('/on-changed', workItemEvents.onChanged)
app.post('/on-execute', workItemEvents.onExecute)
app.post('/on-resource-calculation', workItemEvents.onResourceCalculation)

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`)
})
```

Environment variables (`.env`) used by the examples below:

```bash
PORT=3000
DOMAIN=your-environment-identifier
CLIENT_ID=your-api-key
CLIENT_SECRET=your-secret-key
```

## Event contexts

The `Events` namespace groups every context by the entity it belongs to.

| Namespace | Use it for |
| --- | --- |
| `Events.WorkItem` | Business process instances (forms, tasks, transitions). |
| `Events.Custom` | Custom entities. |
| `Events.Person` | People records. |
| `Events.Department` | Department records. |

Available events per namespace: `OnChanged`, `OnTrigger`, `OnInitRecordList`, `OnAddedRecord`, `OnRecordChanged`, `OnRemovedRecord`. `Events.WorkItem` additionally exposes `OnExecuteSequenceFlow`, `OnResourceCalculation`, `OnAddedFile`, `OnRemovedFile` and `BeforeInit`.

## Examples

### Reacting to a field change (OnChanged)

Fired whenever the user changes a form field. Read the changed value, compute a derived value, and mirror it back.

```ts
exports.onChanged = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnChanged(req)

    const quantity = context.WorkItem.Get('quantity')
    const unitPrice = context.WorkItem.Get('unitPrice')

    context.WorkItem.Set('lineTotal', (quantity || 0) * (unitPrice || 0))

    // Pass { refresh: true } to force the front-end to reload the form fields
    resp.json(context.GetModifiedData({ refresh: true }))
  } catch (err) {
    resp.status(500).send('Error executing OnChanged, details: ' + err)
  }
}
```

### Validating on a button click (OnTrigger)

`OnTrigger` runs when the user clicks a form button. Use it to validate input and give feedback with `ShowWarning` / `ShowError` / `ShowInformation` / `ShowSuccess`.

```ts
exports.validatePeriod = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnTrigger(req)

    const startDate = context.WorkItem.Get('startDate')
    const totalDays = context.WorkItem.Get('totalDays')

    if (!startDate) {
      context.ShowWarning('Please select a start date before continuing.')
    } else if (totalDays <= 0) {
      context.ShowWarning('The total number of days must be greater than zero.')
    } else {
      context.ShowSuccess('Period validated successfully.')
    }

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing validatePeriod, details: ' + err)
  }
}
```

### Acting on a sequence flow (OnExecuteSequenceFlow)

Fired when the instance transitions to the next task. `Source` and `Target` describe the flow elements involved.

```ts
exports.onExecute = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnExecuteSequenceFlow(req)

    const sourceLabel = context.Source ? context.Source.Label : undefined
    const targetLabel = context.Target ? context.Target.Label : undefined

    context.WorkItem.Set('previousTask', sourceLabel)
    context.WorkItem.Set('nextTask', targetLabel)

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing OnExecuteSequenceFlow, details: ' + err)
  }
}
```

### Calculating who performs a task (OnResourceCalculation)

Return a flat list of recipients. Each item is either an email address or an array holding a department/group name.

```ts
exports.onResourceCalculation = async (req: any, resp: any) => {
  try {
    new HEFLOApi.Events.WorkItem.OnResourceCalculation(req)

    resp.json([
      'approver@example.com',
      'manager@example.com',
      ['finance-department']
    ])
  } catch (err) {
    resp.status(500).send('Error executing OnResourceCalculation, details: ' + err)
  }
}
```

### Deciding whether an instance should be created (BeforeInit)

`BeforeInit` gives access to the initialization `Payload` before the instance exists.

```ts
exports.beforeInit = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.BeforeInit(req)

    resp.json({ payload: context.Payload })
  } catch (err) {
    resp.status(500).send('Error executing BeforeInit, details: ' + err)
  }
}
```

## Working with record lists

Record lists are the grids inside a form. Read the changed row through `context.Record`, and manage the whole list through `context.WorkItem`.

### Reading and writing the current row

`OnInitRecordList`, `OnAddedRecord` and `OnRecordChanged` all expose the affected row via `context.Record`.

```ts
exports.onAddedRecord = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnAddedRecord(req)

    const amount = context.Record.Get('amount')
    context.Record.Set('amountFormatted', amount.toFixed(2))

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing OnAddedRecord, details: ' + err)
  }
}
```

### Reading, adding and removing rows

```ts
exports.rebuildList = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnTrigger(req)

    // Read every row currently in the list
    const items = await context.WorkItem.GetListAsync('orderItems')

    if (Array.isArray(items) && items.length > 0) {
      // Clear the list
      const oids = items.map((item: any) => item.oid)
      await context.WorkItem.DeleteRecordsAsync('orderItems', oids)
    }

    // Add a fresh row
    await context.WorkItem.AddRecordAsync('orderItems', {
      product: 'Sample product',
      quantity: 1,
      amount: 100
    })

    resp.json(context.GetModifiedData({ refresh: true }))
  } catch (err) {
    resp.status(500).send('Error executing rebuildList, details: ' + err)
  }
}
```

## Handling files

```ts
exports.onAddedFile = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnAddedFile(req)

    context.WorkItem.Set('lastUploadedFileName', context.File.Filename)
    context.WorkItem.Set('lastUploadedFileUrl', context.File.Url)

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing OnAddedFile, details: ' + err)
  }
}
```

## Events on other entities

The same programming model applies to custom entities, people and departments.

```ts
// Custom entity: use context.Entity to reach the record's fields
exports.customOnChanged = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.Custom.OnChanged(req)

    context.Entity.Set('nameUpper', (context.Entity.Get('name') || '').toUpperCase())

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing Custom.OnChanged, details: ' + err)
  }
}

// Person: context.Person exposes typed fields such as Email
exports.personOnChanged = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.Person.OnChanged(req)

    context.Person.Set('emailMirror', context.Person.Email)

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing Person.OnChanged, details: ' + err)
  }
}

// Department: context.Department exposes typed fields such as Code
exports.departmentOnChanged = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.Department.OnChanged(req)

    context.Department.Set('codeMirror', context.Department.Code)

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing Department.OnChanged, details: ' + err)
  }
}
```

## Creating and saving records

Create a new record with `NewAsync`, populate it, then persist it with `SaveAsync`. When the record is not derived from the current form there is no delta to return.

```ts
exports.createPerson = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnExecuteSequenceFlow(req)

    const person = await HEFLOApi.Person.NewAsync(context)
    person.Name = context.WorkItem.Get('applicantName')   // typed field
    person.Email = context.WorkItem.Get('applicantEmail') // typed field
    person.Set('customField', context.WorkItem.Get('extraInfo')) // custom field

    await person.SaveAsync(context)

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing createPerson, details: ' + err)
  }
}
```

### Looking up existing records

```ts
exports.loadRequester = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnExecuteSequenceFlow(req)

    // The requester of the current instance
    const requester = await context.WorkItem.GetRequesterAsync(context)

    if (requester && requester.DepartmentOid) {
      const department = await HEFLOApi.Department.FindAsync(context, requester.DepartmentOid)
      const manager = await department.GetManagerAsync(context)

      context.WorkItem.Set('managerOid', manager ? manager.Oid : 0)
    }

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing loadRequester, details: ' + err)
  }
}
```

## Querying the export database (SQL)

Run a read-only `SELECT` against the environment export database. Page size must be 100 or less. Always parameterize user-provided values.

### With an event context

When you already have a context, use its `QueryAsync` — it reuses the authenticated session.

```ts
exports.listRecentInstances = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnExecuteSequenceFlow(req)

    const page = req.body['page'] || 1
    const itemsPerPage = req.body['itemsPerPage'] || 10

    const sql = 'select oid, number from vWorkItem order by oid desc'
    const rows = await context.QueryAsync(sql, page, itemsPerPage, [])

    resp.json(rows)
  } catch (err) {
    resp.status(500).send('Error executing listRecentInstances, details: ' + err)
  }
}
```

### Without a context (standalone), using parameters

The static `Context.QueryAsync` authenticates on demand from environment/API/secret keys. Prefer named parameters over string interpolation to avoid SQL injection.

```ts
exports.searchPeople = async (req: any, resp: any) => {
  try {
    const searchTerm = req.body['search'] || ''
    const page = req.body['page'] || 1
    const itemsPerPage = req.body['itemsPerPage'] || 10

    const sql = 'select oid, name from vPerson where name like @name'
    const parameters = [{ name: '@name', value: `%${searchTerm}%` }]

    const people = await HEFLOApi.Context.QueryAsync(
      String(process.env.DOMAIN),
      String(process.env.CLIENT_ID),
      String(process.env.CLIENT_SECRET),
      sql,
      page,
      itemsPerPage,
      parameters
    )

    resp.json(people.map((item: any) => ({ id: item.oid, name: item.name })))
  } catch (err) {
    resp.status(500).send('Error executing searchPeople, details: ' + err)
  }
}
```

A reusable helper that returns a single row or a list:

```ts
async function queryDatabase(sql: string, page = 1, itemsPerPage = 10, singleRow = true) {
  const rows = await HEFLOApi.Context.QueryAsync(
    String(process.env.DOMAIN),
    String(process.env.CLIENT_ID),
    String(process.env.CLIENT_SECRET),
    sql,
    page,
    itemsPerPage,
    []
  )

  if (!rows) return singleRow ? null : []
  return singleRow ? rows[0] ?? null : rows
}
```

## Sending email

```ts
exports.notifyApprover = async (req: any, resp: any) => {
  try {
    const context = new HEFLOApi.Events.WorkItem.OnExecuteSequenceFlow(req)

    await context.SendMailAsync(
      ['approver@example.com'],
      'Approval required',
      '<p>A new request is waiting for your approval.</p>',
      [],                       // attachment URLs
      context.Token.Oid         // link the email to the instance conversation tab
    )

    resp.json(context.GetModifiedData())
  } catch (err) {
    resp.status(500).send('Error executing notifyApprover, details: ' + err)
  }
}
```

## Showing messages to the user

Available on any event context. Messages are returned to the front-end together with the delta.

```ts
context.ShowInformation('Data loaded from the integration.')
context.ShowWarning('The selected date falls on a holiday.')
context.ShowError('The requester could not be identified.')
context.ShowSuccess('Request submitted successfully.')
context.ShowDialog('<b>Attention:</b> this action cannot be undone.')
```

## Calling an external HEFLO web service

Open a new instance (or trigger a web service) from outside a process event.

```ts
import axios from 'axios'

exports.openWorkItem = async (req: any, resp: any) => {
  try {
    const url = req.body['webserviceUrl'] || process.env.OPEN_WORKITEM_URL

    const headers: any = { 'Content-Type': 'application/json' }
    if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS) {
      const encoded = Buffer
        .from(`${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASS}`)
        .toString('base64')
      headers.Authorization = `Basic ${encoded}`
    }

    const response = await axios.post(url, { name: req.body['name'] }, { headers, timeout: 30000 })

    resp.json({ success: true, status: response.status, data: response.data })
  } catch (err) {
    resp.status(500).send('Error opening work item, details: ' + err)
  }
}
```

## Deploying to AWS Lambda (Serverless Framework)

The library is HTTP-transport agnostic, so the same handlers run on AWS Lambda. Lambda delivers the request body as a string, so parse it and wrap it in a `body` object before building the context.

```ts
import * as HEFLOApi from 'heflo-api'

exports.onChanged = async (event: any) => {
  try {
    const body = JSON.parse(event.body)
    const context = new HEFLOApi.Events.WorkItem.OnChanged({ body })

    context.WorkItem.Set('processed', true)

    return {
      statusCode: 200,
      body: JSON.stringify(context.GetModifiedData({ refresh: true }))
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 500, message: `Something went wrong: ${error}` })
    }
  }
}
```

```yaml
# serverless.yml
service: my-heflo-customizations
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  timeout: 30

functions:
  onChanged:
    handler: events/workItem.onChanged
    events:
      - http:
          path: /on-changed
          method: post
```

## API reference

Full generated documentation is available under [`docs/`](./docs/index.html).

## License

[MIT](./LICENSE)
