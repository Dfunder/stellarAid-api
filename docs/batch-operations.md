# Batch Operations

The batch endpoint allows you to perform multiple operations in a single request. This can be useful for improving performance and reducing the number of API calls.

## Endpoint

`POST /batch`

## Request Body

The request body should be a JSON object with an `operations` array. Each object in the array represents a single operation and should have the following properties:

- `id`: A client-generated UUID for the operation.
- `type`: The type of operation to perform. Supported types are `insert`, `update`, and `delete`.
- `data`: The data for the operation. The structure of this property depends on the `type` of operation.

## Operations

### Insert

The `insert` operation allows you to create multiple new services in a single request. The `data` property should be an array of objects, where each object represents a new service to be created.

**Example:**

```json
{
  "operations": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "type": "insert",
      "data": [
        {
          "name": "Service 1",
          "description": "This is the first service."
        },
        {
          "name": "Service 2",
          "description": "This is the second service."
        }
      ]
    }
  ]
}
```

### Update

The `update` operation allows you to update multiple existing services in a single request. The `data` property should be an array of objects, where each object represents a service to be updated. Each object must have an `id` property that corresponds to the ID of the service to be updated.

**Example:**

```json
{
  "operations": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "type": "update",
      "data": [
        {
          "id": "c47ac10b-58cc-4372-a567-0e02b2c3d479",
          "name": "Updated Service 1"
        },
        {
          "id": "d47ac10b-58cc-4372-a567-0e02b2c3d479",
          "description": "This is the updated second service."
        }
      ]
    }
  ]
}
```

### Delete

The `delete` operation allows you to delete multiple existing services in a single request. The `data` property should be an array of objects, where each object represents a service to be deleted. Each object must have an `id` property that corresponds to the ID of the service to be deleted.

**Example:**

```json
{
  "operations": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "type": "delete",
      "data": [
        {
          "id": "c47ac10b-58cc-4372-a567-0e02b2c3d479"
        },
        {
          "id": "d47ac10b-58cc-4372-a567-0e02b2c3d479"
        }
      ]
    }
  ]
}
```
