# A2A Communication Hub

The Agent-to-Agent (A2A) Communication Hub provides a centralized messaging platform for AI agents to communicate, collaborate, and share insights in real-time. It implements publish-subscribe messaging patterns with intelligent routing, message persistence, and comprehensive observability.

## Features

- **Real-time Messaging**: WebSocket-based communication with HTTP fallback
- **Publish-Subscribe**: Topic-based message routing with flexible subscriptions
- **Agent Registration**: Dynamic agent discovery and capability management
- **Message Persistence**: Configurable message retention and replay
- **Intelligent Routing**: Rule-based message transformation and filtering
- **Observability**: Comprehensive metrics, logging, and health monitoring
- **Scalability**: Horizontal scaling with Redis clustering support

## Quick Start

### Development Mode

```bash
# Start with development configuration
npm run hub:dev
```

### Production Mode

```bash
# Copy and configure environment file
cp .env.a2a-hub.example .env

# Edit .env with your configuration
# Then start the hub
npm run hub
```

## Configuration

The hub can be configured via environment variables:

```bash
# Server Settings
A2A_HUB_PORT=8081

# Connection Settings
A2A_MAX_CONNECTIONS=1000
A2A_HEARTBEAT_INTERVAL=30000

# Message Settings
A2A_MESSAGE_RETENTION=86400000

# Feature Flags
A2A_ENABLE_PERSISTENCE=true
A2A_ENABLE_METRICS=true

# Redis Configuration (optional)
A2A_REDIS_URL=redis://localhost:6379
```

## API Endpoints

### Health Check

```
GET /health
```

Returns hub health status and basic statistics.

### Agent Management

#### Register Agent

```
POST /agents/register
```

Register a new agent with the hub.

Request body:

```json
{
  "agentId": "fraud-agent-001",
  "agentType": "fraud-detection",
  "capabilities": ["fraud-analysis", "risk-scoring"],
  "subscriptions": [
    {
      "topic": "fraud-detection",
      "messageTypes": ["transaction.created"],
      "priority": "high",
      "handler": "handleTransaction"
    }
  ],
  "endpoint": "http://fraud-agent:8080",
  "heartbeatInterval": 30000
}
```

#### List Agents

```
GET /agents
```

Returns list of registered agents and their status.

#### Unregister Agent

```
DELETE /agents/:agentId
```

Unregister an agent from the hub.

### Topic Management

#### List Topics

```
GET /topics
```

Returns all available topics and their definitions.

#### Get Topic Definition

```
GET /topics/:topicName/definition
```

Returns detailed information about a specific topic.

#### Create Topic

```
POST /topics
```

Create a new topic with message types and retention policy.

### Message Operations

#### Publish Message (HTTP)

```
POST /messages
```

Publish a message to a topic via HTTP.

Request body:

```json
{
  "id": "msg-12345",
  "timestamp": "2025-01-21T10:30:00Z",
  "sourceAgent": "fraud-agent-001",
  "topic": "fraud-detection",
  "messageType": "fraud.alert",
  "priority": "high",
  "payload": {
    "transactionId": "txn_67890",
    "riskScore": 0.95,
    "reason": "Suspicious pattern detected"
  },
  "metadata": {
    "correlationId": "corr-123",
    "ttl": 300000,
    "retryCount": 0,
    "deliveryAttempts": 0
  }
}
```

#### Get Message History

```
GET /topics/:topicName/messages?limit=100&offset=0
```

Retrieve message history for a topic with pagination.

### Subscription Management

#### Add Subscription

```
POST /subscriptions
```

Add a subscription for an agent.

#### Remove Subscription

```
DELETE /subscriptions/:topic?agentId=:agentId
```

Remove a subscription for an agent.

### Statistics

```
GET /stats
```

Returns comprehensive hub statistics including connected agents, message counts, and performance metrics.

## WebSocket Communication

Agents can connect via WebSocket for real-time messaging:

```javascript
const ws = new WebSocket('ws://localhost:8081', {
  headers: {
    'X-Agent-ID': 'my-agent-001'
  }
});

ws.on('open', () => {
  // Send message
  const message = {
    id: 'msg-001',
    timestamp: new Date(),
    sourceAgent: 'my-agent-001',
    topic: 'fraud-detection',
    messageType: 'fraud.alert',
    priority: 'high',
    payload: { alert: 'Suspicious activity' },
    metadata: {
      correlationId: 'corr-001',
      ttl: 300000,
      retryCount: 0,
      deliveryAttempts: 0
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  
  if (response.type === 'delivery_receipt') {
    console.log('Message delivered:', response.receipt);
  } else if (response.type === 'error') {
    console.error('Error:', response.message);
  } else {
    // Incoming message from another agent
    console.log('Received message:', response);
  }
});
```

## Default Topics

The hub comes with predefined topics:

### fraud-detection

- **Description**: Fraud detection and alerts
- **Message Types**:
  - `fraud.alert` (high priority)
  - `fraud.risk_score` (normal priority)
- **Retention**: 10,000 messages, 24 hours

### recommendations

- **Description**: Product and service recommendations
- **Message Types**:
  - `recommendation.request` (normal priority)
  - `recommendation.response` (normal priority)
- **Retention**: 5,000 messages, 1 hour

### chat-support

- **Description**: Chat support and customer interactions
- **Message Types**:
  - `chat.context_update` (normal priority)
  - `chat.escalation` (high priority)
- **Retention**: 1,000 messages, 30 minutes

### system-events

- **Description**: System-wide events and notifications
- **Message Types**:
  - `system.alert` (high priority)
  - `agent.status_update` (low priority)
- **Retention**: 1,000 messages, 1 hour

## Message Format

All messages follow the A2A message format:

```typescript
interface A2AMessage {
  id: string;                    // Unique message identifier
  timestamp: Date;               // Message creation time
  sourceAgent: string;           // Sending agent ID
  targetAgent?: string;          // Optional specific target
  topic: string;                 // Topic name
  messageType: string;           // Message type (category.action)
  priority: 'low' | 'normal' | 'high';
  payload: Record<string, any>;  // Message content
  metadata: {
    correlationId: string;       // Request correlation
    ttl: number;                 // Time to live (ms)
    retryCount: number;          // Retry attempts
    deliveryAttempts: number;    // Delivery attempts
    routingKey?: string;         // Optional routing key
    replyTo?: string;            // Optional reply address
  };
}
```

## Message Routing

The hub supports intelligent message routing with configurable rules:

### Routing Actions

- **Forward**: Route to specific agents
- **Transform**: Modify message content
- **Filter**: Block messages based on conditions
- **Duplicate**: Create message copies
- **Delay**: Delay message delivery

### Example Routing Rule

```javascript
const rule = {
  id: 'high-priority-fraud',
  name: 'Route high priority fraud alerts',
  condition: (message) => 
    message.topic === 'fraud-detection' && 
    message.priority === 'high',
  action: {
    type: 'forward',
    parameters: {
      targetAgents: ['security-agent', 'notification-agent']
    }
  },
  priority: 100,
  enabled: true
};
```

## Error Handling

The hub provides comprehensive error handling:

- **Validation Errors**: Invalid message format or content
- **Delivery Errors**: Failed message delivery to agents
- **Connection Errors**: WebSocket connection issues
- **Timeout Errors**: Message or connection timeouts

All errors include:

- Error code and message
- Timestamp
- Correlation ID (when available)
- Additional context details

## Monitoring & Observability

### Health Monitoring

- Agent connection status
- Message delivery rates
- Error rates and types
- System resource usage

### Metrics

- Messages published/delivered per second
- Agent registration/unregistration events
- Topic subscription counts
- Message retention statistics

### Logging

- Structured JSON logging
- Correlation ID tracking
- Agent activity logging
- Error and warning logs

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm test -- --testPathPattern=a2a

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

EXPOSE 8081
CMD ["node", "dist/integration/a2a/hub-cli.js"]
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: a2a-hub
spec:
  replicas: 3
  selector:
    matchLabels:
      app: a2a-hub
  template:
    metadata:
      labels:
        app: a2a-hub
    spec:
      containers:
      - name: a2a-hub
        image: a2a-hub:latest
        ports:
        - containerPort: 8081
        env:
        - name: A2A_HUB_PORT
          value: "8081"
        - name: A2A_REDIS_URL
          value: "redis://redis-service:6379"
        envFrom:
        - configMapRef:
            name: a2a-hub-config
        - secretRef:
            name: a2a-hub-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: a2a-hub-service
spec:
  selector:
    app: a2a-hub
  ports:
  - port: 80
    targetPort: 8081
  type: LoadBalancer
```

## Performance Tuning

### Connection Limits

- Adjust `A2A_MAX_CONNECTIONS` based on expected agent count
- Monitor connection pool usage

### Message Retention

- Configure `A2A_MESSAGE_RETENTION` based on storage capacity
- Use compression for large message volumes

### Heartbeat Interval

- Balance between responsiveness and network overhead
- Typical range: 15-60 seconds

### Redis Clustering

- Enable Redis for horizontal scaling
- Configure Redis cluster for high availability

## Security Considerations

- Use TLS/SSL for production deployments
- Implement agent authentication and authorization
- Validate all incoming messages
- Monitor for suspicious activity patterns
- Implement rate limiting per agent
- Use secure WebSocket connections (WSS)
