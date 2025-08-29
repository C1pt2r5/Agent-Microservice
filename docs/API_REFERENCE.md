# Agentic Microservices API Reference

## Overview

This document provides comprehensive API reference for all components of the Agentic Microservices system, including agents, integration services, and infrastructure components.

## Table of Contents

1. [Agent APIs](#agent-apis)
   - [Chatbot Agent](#chatbot-agent)
   - [Fraud Detection Agent](#fraud-detection-agent)
   - [Recommendation Agent](#recommendation-agent)
2. [Integration APIs](#integration-apis)
   - [MCP Gateway](#mcp-gateway)
   - [A2A Hub](#a2a-hub)
3. [Infrastructure APIs](#infrastructure-apis)
   - [Monitoring](#monitoring)
   - [Configuration](#configuration)
4. [Common Data Types](#common-data-types)
5. [Error Handling](#error-handling)

## Agent APIs

### Chatbot Agent

#### Process Chat Message

**Endpoint:** `POST /api/chatbot/process`

**Request:**
```json
{
  "sessionId": "session_123",
  "userId": "user_456",
  "message": "I need help with my account",
  "channel": "web",
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "sessionId": "session_123",
  "message": "I'd be happy to help you with your account. What specific information do you need?",
  "intent": "account_inquiry",
  "confidence": 0.89,
  "suggestedActions": [
    "View Account Details",
    "Update Profile",
    "Check Balance"
  ],
  "requiresEscalation": false,
  "context": {
    "currentTopic": "account",
    "userIntent": "account_inquiry",
    "entities": {},
    "escalationLevel": 0,
    "requiresHumanHandoff": false,
    "confidenceScore": 0.89
  },
  "processingTime": 245
}
```

#### Get Session

**Endpoint:** `GET /api/chatbot/session/{sessionId}`

**Response:**
```json
{
  "sessionId": "session_123",
  "userId": "user_456",
  "startTime": "2024-01-15T10:30:00Z",
  "lastActivity": "2024-01-15T10:35:00Z",
  "context": {
    "currentTopic": "account",
    "userIntent": "account_inquiry",
    "entities": {},
    "escalationLevel": 0,
    "requiresHumanHandoff": false,
    "confidenceScore": 0.89
  },
  "history": [
    {
      "id": "turn_1",
      "timestamp": "2024-01-15T10:30:00Z",
      "role": "user",
      "message": "I need help with my account",
      "intent": "account_inquiry",
      "confidence": 0.89
    },
    {
      "id": "turn_2",
      "timestamp": "2024-01-15T10:30:15Z",
      "role": "assistant",
      "message": "I'd be happy to help you with your account...",
      "intent": "account_inquiry",
      "confidence": 0.89
    }
  ],
  "metadata": {}
}
```

#### End Session

**Endpoint:** `DELETE /api/chatbot/session/{sessionId}`

**Response:**
```json
{
  "success": true,
  "message": "Session ended successfully"
}
```

### Fraud Detection Agent

#### Analyze Transaction

**Endpoint:** `POST /api/fraud-detection/analyze`

**Request:**
```json
{
  "transactionId": "txn_789",
  "userId": "user_456",
  "amount": 1250.00,
  "currency": "USD",
  "merchant": "Amazon",
  "timestamp": "2024-01-15T10:30:00Z",
  "location": {
    "country": "US",
    "city": "New York",
    "ip": "192.168.1.1"
  },
  "device": {
    "userAgent": "Mozilla/5.0...",
    "fingerprint": "device_hash_123"
  }
}
```

**Response:**
```json
{
  "transactionId": "txn_789",
  "riskLevel": "low",
  "riskScore": 0.15,
  "recommendation": "approve",
  "riskFactors": [
    {
      "type": "location_anomaly",
      "severity": "low",
      "description": "Transaction from unusual location",
      "confidence": 0.7
    }
  ],
  "processingTime": 180,
  "analysis": {
    "patterns": ["normal_spending", "trusted_merchant"],
    "anomalies": ["location_change"],
    "confidence": 0.92
  }
}
```

#### Get Risk Assessment

**Endpoint:** `GET /api/fraud-detection/risk/{transactionId}`

**Response:**
```json
{
  "transactionId": "txn_789",
  "assessment": {
    "riskLevel": "low",
    "riskScore": 0.15,
    "recommendation": "approve",
    "timestamp": "2024-01-15T10:30:05Z"
  },
  "details": {
    "userHistory": {
      "totalTransactions": 45,
      "averageAmount": 89.50,
      "lastTransaction": "2024-01-14T15:20:00Z"
    },
    "merchantAnalysis": {
      "trustScore": 0.95,
      "category": "e-commerce",
      "riskLevel": "low"
    }
  }
}
```

### Recommendation Agent

#### Generate Recommendations

**Endpoint:** `POST /api/recommendation/generate`

**Request:**
```json
{
  "userId": "user_456",
  "context": "product_browsing",
  "filters": {
    "category": "electronics",
    "priceRange": {
      "min": 100,
      "max": 500
    },
    "brands": ["Apple", "Samsung"]
  },
  "excludeProducts": ["prod_123", "prod_456"],
  "limit": 5,
  "algorithm": "hybrid"
}
```

**Response:**
```json
{
  "userId": "user_456",
  "recommendations": [
    {
      "productId": "prod_789",
      "name": "iPhone 15 Pro",
      "category": "electronics",
      "price": 999.00,
      "score": 0.89,
      "reasoning": "Based on your interest in Apple products and recent browsing history",
      "algorithm": "collaborative",
      "confidence": 0.92
    },
    {
      "productId": "prod_101",
      "name": "Samsung Galaxy Watch",
      "category": "electronics",
      "price": 299.00,
      "score": 0.76,
      "reasoning": "Similar users who bought Apple products also purchased Samsung wearables",
      "algorithm": "content-based",
      "confidence": 0.85
    }
  ],
  "cacheHit": false,
  "processingTime": 320,
  "algorithms": ["collaborative", "content-based"],
  "totalAvailable": 25
}
```

#### Get User Profile

**Endpoint:** `GET /api/recommendation/profile/{userId}`

**Response:**
```json
{
  "userId": "user_456",
  "demographics": {
    "age": 32,
    "gender": "male",
    "location": "New York, US",
    "income": "75000-100000"
  },
  "preferences": {
    "categories": ["electronics", "books", "sports"],
    "brands": ["Apple", "Nike", "Amazon"],
    "priceRange": {
      "min": 50,
      "max": 1000
    },
    "features": ["wireless", "high-quality", "durable"]
  },
  "behavior": {
    "purchaseHistory": [
      {
        "productId": "prod_123",
        "category": "electronics",
        "price": 299.00,
        "timestamp": "2024-01-10T14:30:00Z"
      }
    ],
    "browsingHistory": [
      {
        "productId": "prod_456",
        "category": "electronics",
        "timestamp": "2024-01-15T10:00:00Z",
        "duration": 180
      }
    ]
  },
  "profile": {
    "riskTolerance": "medium",
    "investmentGoals": ["growth", "diversification"],
    "lifestage": "professional",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

## Integration APIs

### MCP Gateway

#### Service Discovery

**Endpoint:** `GET /api/mcp/services`

**Response:**
```json
{
  "services": [
    {
      "name": "user-service",
      "endpoint": "http://user-service:8080",
      "status": "healthy",
      "lastHealthCheck": "2024-01-15T10:30:00Z"
    },
    {
      "name": "transaction-service",
      "endpoint": "http://transaction-service:8080",
      "status": "healthy",
      "lastHealthCheck": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Execute Service Request

**Endpoint:** `POST /api/mcp/request`

**Request:**
```json
{
  "service": "user-service",
  "operation": "getUserProfile",
  "parameters": {
    "userId": "user_456"
  },
  "timeout": 30000
}
```

**Response:**
```json
{
  "requestId": "req_123",
  "service": "user-service",
  "operation": "getUserProfile",
  "success": true,
  "data": {
    "userId": "user_456",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "accountStatus": "active"
  },
  "processingTime": 45
}
```

### A2A Hub

#### Register Agent

**Endpoint:** `POST /api/a2a/register`

**Request:**
```json
{
  "agentId": "chatbot-agent-001",
  "agentType": "chatbot",
  "capabilities": ["natural-language-processing", "conversation-management"],
  "endpoint": "http://chatbot-agent:8080",
  "subscriptions": [
    {
      "topic": "fraud-alerts",
      "messageType": "fraud.detected"
    }
  ],
  "heartbeatInterval": 30000
}
```

**Response:**
```json
{
  "agentId": "chatbot-agent-001",
  "registrationId": "reg_456",
  "status": "registered",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Send Message

**Endpoint:** `POST /api/a2a/message`

**Request:**
```json
{
  "id": "msg_123",
  "sourceAgent": "chatbot-agent-001",
  "targetAgent": "fraud-detection-agent-001",
  "topic": "fraud-alerts",
  "messageType": "fraud.detected",
  "priority": "high",
  "payload": {
    "transactionId": "txn_789",
    "riskLevel": "high",
    "amount": 2500.00
  },
  "metadata": {
    "correlationId": "corr_123",
    "ttl": 300000,
    "retryCount": 0
  }
}
```

**Response:**
```json
{
  "messageId": "msg_123",
  "status": "delivered",
  "timestamp": "2024-01-15T10:30:05Z",
  "targetAgent": "fraud-detection-agent-001"
}
```

## Infrastructure APIs

### Monitoring

#### Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600000,
  "checks": [
    {
      "name": "database",
      "status": "pass",
      "message": "Database connection healthy",
      "duration": 15
    },
    {
      "name": "redis",
      "status": "pass",
      "message": "Redis connection healthy",
      "duration": 8
    },
    {
      "name": "gemini-api",
      "status": "pass",
      "message": "Gemini API accessible",
      "duration": 45
    }
  ]
}
```

#### Metrics

**Endpoint:** `GET /api/metrics`

**Response:**
```json
{
  "agentId": "chatbot-agent-001",
  "agentType": "chatbot",
  "metrics": {
    "requestsTotal": 1250,
    "requestsSuccessful": 1225,
    "requestsFailed": 25,
    "averageResponseTime": 245,
    "currentConnections": 5,
    "uptime": 3600000,
    "memoryUsage": 89.5,
    "cpuUsage": 15.2,
    "errorRate": 0.02,
    "throughput": 12.5
  },
  "customMetrics": {
    "activeSessions": 23,
    "averageSessionDuration": 450000,
    "intentDistribution": {
      "greeting": 0.25,
      "account_inquiry": 0.35,
      "transaction_inquiry": 0.20,
      "general_support": 0.20
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Configuration

#### Get Configuration

**Endpoint:** `GET /api/config`

**Response:**
```json
{
  "agentId": "chatbot-agent-001",
  "environment": "production",
  "version": "1.0.0",
  "mcpEndpoint": {
    "url": "http://mcp-gateway:8080",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "a2aEndpoint": {
    "url": "http://a2a-hub:8081",
    "timeout": 15000,
    "retryAttempts": 3
  },
  "geminiConfig": {
    "model": "gemini-pro",
    "maxTokens": 2048,
    "temperature": 0.7,
    "rateLimitPerMinute": 300
  },
  "capabilities": [
    {
      "name": "natural-language-processing",
      "description": "Process and understand natural language queries",
      "inputSchema": { "type": "string" },
      "outputSchema": { "type": "string" }
    }
  ]
}
```

#### Update Configuration

**Endpoint:** `PUT /api/config`

**Request:**
```json
{
  "geminiConfig": {
    "temperature": 0.8,
    "rateLimitPerMinute": 250
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "changes": {
    "geminiConfig.temperature": {
      "oldValue": 0.7,
      "newValue": 0.8
    },
    "geminiConfig.rateLimitPerMinute": {
      "oldValue": 300,
      "newValue": 250
    }
  }
}
```

## Common Data Types

### SystemError

```typescript
interface SystemError {
  code: string;           // Error code (e.g., "AGENT_ERROR", "VALIDATION_ERROR")
  message: string;        // Human-readable error message
  timestamp: Date;        // When the error occurred
  correlationId?: string; // Request correlation ID
  details?: any;          // Additional error details
}
```

### AgentRequest

```typescript
interface AgentRequest {
  id: string;                    // Unique request identifier
  timestamp: Date;               // Request timestamp
  correlationId: string;         // Correlation ID for tracing
  payload: any;                  // Request payload
  metadata?: Record<string, any>; // Additional metadata
}
```

### AgentResponse

```typescript
interface AgentResponse {
  id: string;                    // Response identifier
  requestId: string;             // Original request ID
  timestamp: Date;               // Response timestamp
  success: boolean;              // Whether the request was successful
  payload?: any;                 // Response payload
  error?: SystemError;           // Error details (if success is false)
  processingTime: number;        // Processing time in milliseconds
}
```

## Error Handling

### HTTP Status Codes

- **200 OK**: Request successful
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Service temporarily unavailable

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "timestamp": "2024-01-15T10:30:00Z",
    "correlationId": "corr_123",
    "details": {
      "field": "userId",
      "reason": "User ID is required"
    }
  },
  "processingTime": 15
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND_ERROR` | Resource not found |
| `RATE_LIMIT_ERROR` | Rate limit exceeded |
| `SERVICE_ERROR` | External service error |
| `INTERNAL_ERROR` | Internal server error |
| `NETWORK_ERROR` | Network communication error |
| `TIMEOUT_ERROR` | Request timeout |

---

**API Reference Complete** 📚

This comprehensive API reference covers all endpoints, request/response formats, and error handling for the Agentic Microservices system.