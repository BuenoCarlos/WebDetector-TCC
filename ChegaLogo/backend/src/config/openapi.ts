import swaggerJsdoc from "swagger-jsdoc";

export const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ChegaLogo API",
      version: "1.0.0",
      description: "API local para testes com WebDetector",
    },
    servers: [
      {
        url: "http://127.0.0.1:8000",
      },
    ],
  },
  apis: [
    "./src/routes/*.ts",
  ],
});
