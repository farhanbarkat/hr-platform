// src/config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HR Platform Core — Super Admin & Tenant API',
      version: '1.0.0',
      description: 'Production API specification for multi-tenant HR and Super-Admin operations',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your Super-Admin JWT token here (without the Bearer prefix)',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Automatically scan all route files for documentation comments
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);