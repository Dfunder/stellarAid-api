The `Cache` decorator allows you to apply a `Cache-Control` header to any endpoint. This decorator takes a single argument, which is a string that will be used as the value of the `Cache-Control` header.

**Example:**

```typescript
import { Controller, Get } from '@nestjs/common';
import { Cache } from '../common/http/cache.decorator';

@Controller('my-resource')
export class MyResourceController {
  @Get()
  @Cache('public, max-age=3600')
  findAll() {
    return 'This response will be cached for 1 hour.';
  }
}
```
