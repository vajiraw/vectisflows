// prisma.config.ts
import { defineConfig } from '@prisma/config';
import { ConfigService } from '@nestjs/config';

export default defineConfig({
  datasource: {
    // The CLI uses this URL for operations like 'prisma migrate'
    //url: "postgresql://dbuser:akinsa@172.25.28.123:5432/verstack?schema=public", 
    // DATABASE_URL : "prisma://accelerate.prisma-data.net/?api_key=your_api_key"
    url: "prisma://accelerate.prisma-data.net/?api_key=your_api_key"
  },
});