import { EndpointSpec } from '../spec-types';

export const PAYMENTS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 54,
    method: 'POST',
    path: '/payments',
    moduleNumber: '10',
    moduleName: 'Sandbox Payments',
    summary: 'Create sandbox payment for appointment/order/subscription',
    description: 'Initializes a simulated sandbox payment session linked to an appointment booking hold, medicine store order, or subscription tier.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Strictly sandbox: No real credit card processing or live gateway calls.',
      'Target type must be one of APPOINTMENT, ORDER, or SUBSCRIPTION.',
      'Maintains idempotency and initiates transaction in PENDING status.'
    ],
    requestBody: {
      description: 'Payment target and amount details.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['targetType', 'targetId', 'amount', 'currency'],
        properties: {
          targetType: { type: 'string', enum: ['APPOINTMENT', 'ORDER', 'SUBSCRIPTION'], example: 'APPOINTMENT' },
          targetId: { type: 'string', description: 'ID of hold, order, or plan', example: 'hld_882031a' },
          amount: { type: 'number', minimum: 0.01, example: 75.0 },
          currency: { type: 'string', default: 'USD', example: 'USD' }
        }
      },
      example: {
        targetType: 'APPOINTMENT',
        targetId: 'hld_882031a',
        amount: 75.0,
        currency: 'USD'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Sandbox payment session created.',
        example: {
          success: true,
          data: {
            paymentId: 'pay_sim_448102',
            targetType: 'APPOINTMENT',
            targetId: 'hld_882031a',
            amount: 75.0,
            currency: 'USD',
            status: 'PENDING',
            simulationUrl: '/api/v1/payments/pay_sim_448102/simulate',
            createdAt: '2026-10-15T09:31:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [23, 24, 52, 55, 56, 71]
  },
  {
    id: 55,
    method: 'POST',
    path: '/payments/{id}/simulate',
    moduleNumber: '10',
    moduleName: 'Sandbox Payments',
    summary: 'Server-controlled demo success/failure transition',
    description: 'Executes a server-controlled simulation of payment completion (SUCCESS) or failure (FAILED) to test full end-to-end booking and fulfillment flows.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Simulates sandbox provider callback with strict state transition.',
      'On outcome=SUCCESS: updates linked appointment hold, order status, or subscription plan atomically.',
      'On outcome=FAILED: releases hold or cancels pending order and restores inventory.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Sandbox Payment ID', example: 'pay_sim_448102' }
    ],
    requestBody: {
      description: 'Desired simulated outcome.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['outcome'],
        properties: {
          outcome: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' },
          simulatedCardLast4: { type: 'string', example: '4242' },
          failureReason: { type: 'string', example: 'INSUFFICIENT_FUNDS' }
        }
      },
      example: {
        outcome: 'SUCCESS',
        simulatedCardLast4: '4242'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Simulation outcome processed.',
        example: {
          success: true,
          data: {
            paymentId: 'pay_sim_448102',
            outcome: 'SUCCESS',
            status: 'COMPLETED',
            transactionRef: 'txn_sbx_99812440',
            processedAt: '2026-10-15T09:32:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [54, 56]
  },
  {
    id: 56,
    method: 'GET',
    path: '/payments/{id}',
    moduleNumber: '10',
    moduleName: 'Sandbox Payments',
    summary: 'Retrieve verified payment state',
    description: 'Retrieves the verified transaction state, audit timestamps, and receipt details of a sandbox payment.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must be the payer or an admin.',
      'Exposes safe sandbox transaction metadata.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Payment ID', example: 'pay_sim_448102' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Payment status details.',
        example: {
          success: true,
          data: {
            id: 'pay_sim_448102',
            status: 'COMPLETED',
            amount: 75.0,
            currency: 'USD',
            targetType: 'APPOINTMENT',
            targetId: 'hld_882031a',
            transactionRef: 'txn_sbx_99812440',
            completedAt: '2026-10-15T09:32:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [54, 55]
  }
];

