# CDN and File Uploads

This document describes the process for uploading files to the application's CDN.

## Overview

Instead of routing file uploads through the server, we use presigned URLs to allow clients to upload files directly to our S3-compatible object storage. This approach is more scalable and performant, as it offloads the work of handling file uploads from the server to the client and the storage provider.

## Process

1. The client makes a `POST` request to the `/assets/generate-presigned-url` endpoint with the filename and content type of the file to be uploaded.
2. The server generates a presigned URL and returns it to the client.
3. The client uses the presigned URL to upload the file directly to the S3 bucket.

## Endpoints

### `POST /assets/generate-presigned-url`

This endpoint generates a presigned URL for uploading a file to the CDN.

**Request Body**

| Field         | Type     | Description                             |
| ------------- | -------- | --------------------------------------- |
| `filename`    | `string` | The name of the file to upload.         |
| `contentType` | `string` | The content type of the file to upload. |

**Example Request**

```json
{
  "filename": "my-image.jpg",
  "contentType": "image/jpeg"
}
```

**Example Response**

```json
{
  "uploadUrl": "https://my-bucket.s3.amazonaws.com/uploads/1234-5678/my-image.jpg?X-Amz-Algorithm=...",
  "key": "uploads/1234-5678/my-image.jpg"
}
```

## Uploading the File

Once you have the presigned URL, you can use it to upload the file directly to the S3 bucket. The following is an example of how to do this using `curl`:

```bash
curl -X PUT -T /path/to/my-image.jpg "<presigned-url>"
```

Replace `/path/to/my-image.jpg` with the path to the file you want to upload and `<presigned-url>` with the URL you received from the `/assets/generate-presigned-url` endpoint.
