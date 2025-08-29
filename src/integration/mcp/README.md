# MCP Gateway

The Model Context Protocol (MCP) Gateway provides a standardized API integration layer between AI agents and existing microservices. It acts as a reverse proxy with built-in resilience patterns, authentication management, and observability features.

## Features

- **Service Discovery**: Automatic registration and discovery of microservices
- **Authentication**: Support for Bearer tokens, API keys, and OAuth2
- **Rate Limiting**: Token bucket algorithm with burst capacity
- **Circuit Breaker**: Prevents cascading failures with configurable thresholds
- **Retry Logic**: Exponential backoff with jitter
- **Observability**: Health checks, metrics, and request tracing
- **CORS Support**: Cross-origin resource sharing for web clients

## Quick Start

### Development Mode

```bash
# Start with development configuration
npm run gateway:dev
```

### Production Mode

```bash
# Copy and configure environment file
cp .env.mcp-gateway.example .env

# Edit .env with your service configurations
# Then start the gateway
npm run gateway
```

## Configuration

The gateway can be configured via environment variables or programmatically.

### Environment Variables

See `.env.mcp-gateway.example` for a complete list of configuration options.

Key variables:

- `MCP_GATEWAY_URL`: Gateway base URL
- `PORT`: Port to listen on (default: 8080)
- `MCP_SERVICES`: Comma-separated list of services to configure
- `MCP_SERVICE_<NAME>_*`: Service-specific configuration

### Programmatic Configuration

```typescript
import { MCPGateway, GatewayConfigManager } from './integration/mcp';

// Create development config
const config = GatewayConfigManager.createDevelopmentConfig();

// Or create custom config
const customConfig = {
  gatewayUrl: 'http://localhost:8080',
  defaultTimeout: 30000,
  retryPolicy: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    jitter: true
  },
  services: {
    'my-service': {
      endpoint: 'http://my-service:8080',
      auth: {
        type: 'bearer',
        credentials: { token: 'my-token' }
      },
      rateLimit: {
        requestsPerMinute: 100,
        burstLimit: 20
      },
      timeout: 30000,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        halfOpenMaxCalls: 3
      }
    }
  }
};

const gateway = new MCPGateway(customConfig);
await gateway.start(8080);
```

## API Endpoints

### Health Check

```
GET /mcp/health
```

Returns gateway and service health status.

### Service Discovery

```
GET /mcp/services
```

Lists all configured services and their status.

### Service Definition

```
GET /mcp/services/:serviceName/definition
```

Returns the API definition for a specific service.

### MCP Request

```
POST /mcp/request
```

Main endpoint for making requests to backend services.

Request body:

```json
{
  "id": "request-123",
  "timestamp": "2025-01-21T10:30:00Z",
  "service": "user-service",
  "operation": "getUser",
  "parameters": {
    "userId": "123"
  },
  "metadata": {
    "correlationId": "corr-123",
    "timeout": 30000,
    "priority": "normal",
    "agentId": "chatbot-agent"
  }
}
```

### Service Metrics

```
GET /mcp/services/:serviceName/metrics
```

Returns circuit breaker and rate limiter metrics for a service.

## Authentication

The gateway supports multiple authentication methods:

### Bearer Token

```bash
MCP_SERVICE_MY_SERVICE_AUTH_TYPE=bearer
MCP_SERVICE_MY_SERVICE_TOKEN=your-bearer-token
```

### API Key

```bash
MCP_SERVICE_MY_SERVICE_AUTH_TYPE=api-key
MCP_SERVICE_MY_SERVICE_API_KEY=your-api-key
```

### OAuth2

```bash
MCP_SERVICE_MY_SERVICE_AUTH_TYPE=oauth2
MCP_SERVICE_MY_SERVICE_ACCESS_TOKEN=your-access-token
MCP_SERVICE_MY_SERVICE_REFRESH_TOKEN=your-refresh-token
```

## Resilience Patterns

### Circuit Breaker

The circuit breaker prevents cascading failures by monitoring service health:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests are blocked
- **HALF_OPEN**: Testing if service has recovered

Configuration:

- `failureThreshold`: Number of failures before opening circuit
- `recoveryTimeout`: Time to wait before testing recovery
- `halfOpenMaxCalls`: Max calls to allow in half-open state

### Rate Limiting

Token bucket algorithm with configurable rates:

- `requestsPerMinute`: Sustained request rate
- `burstLimit`: Maximum burst capacity

### Retry Logic

Exponential backoff with jitter:

- `maxAttempts`: Maximum retry attempts
- `backoffStrategy`: 'linear' or 'exponential'
- `initialDelay`: Initial delay between retries
- `maxDelay`: Maximum delay between retries
- `jitter`: Add randomness to prevent thundering herd

## Monitoring

The gateway provides comprehensive observability:

- Request/response logging with correlation IDs
- Circuit breaker state monitoring
- Rate limiter token tracking
- Processing time metrics
- Error tracking and categorization

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm test -- --testPathPattern=mcp

# Run with coverage
npm test -- --coverage
```

## Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY .env ./

EXPOSE 8080
CMD ["node", "dist/integration/mcp/gateway-cli.js"]
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-gateway
  template:
    metadata:
      labels:
        app: mcp-gateway
    spec:
      containers:
      - name: mcp-gateway
        image: mcp-gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        - name: NODE_ENV
          value: "production"
        envFrom:
        - configMapRef:
            name: mcp-gateway-config
        - secretRef:
            name: mcp-gateway-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-gateway-service
spec:
  selector:
    app: mcp-gateway
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```
