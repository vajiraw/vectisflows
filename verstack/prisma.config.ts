import { defineConfig } from '@prisma/config';
import 'dotenv/config'; // 👈 Must be the very first line



export default defineConfig({
  datasource: {
    // The CLI uses this URL for operations like 'prisma migrate'    
    url: process.env.DATABASE_URL
    // DATABASE_URL : "prisma://accelerate.prisma-data.net/?api_key=your_api_key"
    //url: "prisma://accelerate.prisma-data.net/?api_key=your_api_key"
  },
});