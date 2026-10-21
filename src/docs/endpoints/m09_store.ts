import type { EndpointSpec } from '../spec-types.js';

export const STORE_ENDPOINTS: EndpointSpec[] = [
  {
    id: 45,
    method: 'GET',
    path: '/store/medicines',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Catalog search and filters',
    description: 'Searches and filters the fictional dermatological medicine catalog by keyword, prescription requirement, category, and price range.',
    roles: ['PUBLIC', 'PATIENT'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Catalog items indicate requiresPrescription boolean.',
      'Supports ?search=..., ?requiresPrescription=true|false, and ?category=... filters.'
    ],
    parameters: [
      { name: 'search', in: 'query', required: false, type: 'string', description: 'Medicine name or active ingredient', example: 'hydrocortisone' },
      { name: 'requiresPrescription', in: 'query', required: false, type: 'boolean', description: 'Filter by Rx requirement', example: true },
      { name: 'category', in: 'query', required: false, type: 'string', description: 'Category (TOPICAL_STEROID, MOISTURIZER, ANTIBIOTIC, etc.)', example: 'TOPICAL_STEROID' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 12 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Medicine catalog results.',
        example: {
          success: true,
          data: {
            medicines: [
              {
                id: 'med_hc10',
                name: 'CortiCare 1% Cream',
                genericName: 'Hydrocortisone',
                strength: '1%',
                dosageForm: 'Topical Cream',
                category: 'TOPICAL_STEROID',
                price: 14.5,
                currency: 'USD',
                requiresPrescription: true,
                inStock: true,
                stockQuantity: 120
              }
            ],
            pagination: { page: 1, limit: 12, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [46, 47, 49]
  },
  {
    id: 46,
    method: 'GET',
    path: '/store/medicines/{id}',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Medicine detail and prescription requirement',
    description: 'Retrieves comprehensive medicine details including active ingredient, strength, usage warnings, stock status, and prescription requirement.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Indicates whether a finalized prescription is mandatory to add to cart and purchase.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Medicine ID', example: 'med_hc10' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Medicine specification details.',
        example: {
          success: true,
          data: {
            id: 'med_hc10',
            name: 'CortiCare 1% Cream',
            genericName: 'Hydrocortisone',
            strength: '1%',
            dosageForm: 'Topical Cream',
            packSize: '30g Tube',
            price: 14.5,
            requiresPrescription: true,
            contraindications: ['Viral skin infections', 'Open ulcerated wounds'],
            storageInstructions: 'Store below 25°C',
            manufacturer: 'DermaHealth Pharmaceuticals',
            inStock: true
          }
        }
      },
      {
        statusCode: 404,
        description: 'Medicine not found.',
        example: {
          success: false,
          error: { code: 'MEDICINE_NOT_FOUND', message: 'Item does not exist in catalog.' }
        }
      }
    ],
    relatedEndpointIds: [45, 47, 48]
  },
  {
    id: 47,
    method: 'GET',
    path: '/store/medicines/{id}/alternatives',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Match generic, strength and dosage form',
    description: 'Finds verified therapeutic generic alternatives matching the exact same generic active ingredient, strength, and dosage form.',
    roles: ['PUBLIC', 'PATIENT'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Alternative matching rule: Must match generic active ingredient, chemical strength, and dosage form identically.',
      'Helps patients find cost-effective or in-stock substitutes.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Reference medicine ID', example: 'med_hc10' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of matching generic alternatives.',
        example: {
          success: true,
          data: {
            referenceMedicine: { name: 'CortiCare 1% Cream', genericName: 'Hydrocortisone', strength: '1%', form: 'Topical Cream' },
            alternatives: [
              {
                id: 'med_gen_hc10',
                name: 'Generic Hydrocortisone 1% Cream',
                genericName: 'Hydrocortisone',
                strength: '1%',
                dosageForm: 'Topical Cream',
                price: 8.99,
                savingsPercentage: 38,
                inStock: true
              }
            ]
          }
        }
      }
    ],
    relatedEndpointIds: [45, 46]
  },
  {
    id: 48,
    method: 'GET',
    path: '/cart',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Retrieve own cart',
    description: 'Retrieves the authenticated patient cart, including items, quantities, pricing totals, and prescription verification status.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Cart is isolated per authenticated patient.',
      'Flags any items that require prescription verification before checkout.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Patient cart contents and totals.',
        example: {
          success: true,
          data: {
            cartId: 'crt_091823',
            items: [
              {
                id: 'crt_item_01',
                medicineId: 'med_hc10',
                name: 'CortiCare 1% Cream',
                quantity: 1,
                unitPrice: 14.5,
                lineTotal: 14.5,
                requiresPrescription: true,
                prescriptionId: 'rx_77810',
                prescriptionVerified: true
              }
            ],
            subtotal: 14.5,
            shipping: 5.0,
            total: 19.5,
            eligibleForCheckout: true
          }
        }
      }
    ],
    relatedEndpointIds: [49, 50, 51, 52]
  },
  {
    id: 49,
    method: 'POST',
    path: '/cart/items',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Add item with Rx eligibility validation',
    description: 'Adds a medicine to the cart. If the medicine requires a prescription, validates that the user provides a valid, finalized prescription covering this medication.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Prescription validation: If medicine requires a prescription, user MUST provide prescriptionId.',
      'The prescription MUST be in FINALIZED status and owned by the caller.',
      'Validates available inventory stock.'
    ],
    requestBody: {
      description: 'Medicine ID, quantity, and optional prescription ID.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['medicineId', 'quantity'],
        properties: {
          medicineId: { type: 'string', description: 'Medicine ID to add', example: 'med_hc10' },
          quantity: { type: 'integer', minimum: 1, maximum: 5, example: 1 },
          prescriptionId: { type: 'string', description: 'Mandatory if medicine requires Rx', example: 'rx_77810' }
        }
      },
      example: {
        medicineId: 'med_hc10',
        quantity: 1,
        prescriptionId: 'rx_77810'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Item added to cart.',
        example: {
          success: true,
          message: 'Item added to cart with verified prescription.',
          data: {
            cartItemId: 'crt_item_01',
            medicineId: 'med_hc10',
            quantity: 1,
            prescriptionVerified: true
          }
        }
      },
      {
        statusCode: 400,
        description: 'Prescription missing or invalid for Rx-required medicine.',
        example: {
          success: false,
          error: { code: 'PRESCRIPTION_REQUIRED', message: 'This medication requires a valid finalized doctor prescription.' }
        }
      }
    ],
    relatedEndpointIds: [40, 48, 50]
  },
  {
    id: 50,
    method: 'PATCH',
    path: '/cart/items/{id}',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Change quantity with validation',
    description: 'Modifies the quantity of an item in the cart, verifying against available warehouse stock and maximum prescription course limits.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Patient must own the cart item.',
      'Quantity must be between 1 and available stock limit.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Cart Item ID', example: 'crt_item_01' }
    ],
    requestBody: {
      description: 'New quantity.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer', minimum: 1, maximum: 10, example: 2 }
        }
      },
      example: {
        quantity: 2
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Cart item quantity updated.',
        example: {
          success: true,
          data: {
            cartItemId: 'crt_item_01',
            quantity: 2,
            lineTotal: 29.0
          }
        }
      }
    ],
    relatedEndpointIds: [48, 51]
  },
  {
    id: 51,
    method: 'DELETE',
    path: '/cart/items/{id}',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Remove cart item',
    description: 'Removes an item from the authenticated patient active shopping cart.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Patient must own the cart item.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Cart Item ID', example: 'crt_item_01' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Item removed from cart.',
        example: {
          success: true,
          message: 'Item removed from cart.'
        }
      }
    ],
    relatedEndpointIds: [48, 50]
  },
  {
    id: 52,
    method: 'POST',
    path: '/orders',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'Create fictional order; recheck prescription and price',
    description: 'Converts cart into a fictional order. Rechecks live catalog pricing, stock availability, and prescription validity within an atomic database transaction.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Atomic transaction: decrements warehouse inventory and transitions cart to ORDER_PLACED.',
      'Re-validates prescription validity at the exact time of order placement.',
      'Generates sandbox payment intent link for Module 10.'
    ],
    requestBody: {
      description: 'Shipping address and order details.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['shippingAddress'],
        properties: {
          shippingAddress: {
            type: 'object',
            required: ['street', 'city', 'state', 'postalCode', 'country'],
            properties: {
              street: { type: 'string', example: '123 Health Ave, Apt 4B' },
              city: { type: 'string', example: 'San Francisco' },
              state: { type: 'string', example: 'CA' },
              postalCode: { type: 'string', example: '94107' },
              country: { type: 'string', example: 'USA' }
            }
          },
          deliveryInstructions: { type: 'string', example: 'Leave at front desk' }
        }
      },
      example: {
        shippingAddress: {
          street: '123 Health Ave, Apt 4B',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94107',
          country: 'USA'
        },
        deliveryInstructions: 'Leave at front desk'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Order created; pending sandbox payment.',
        example: {
          success: true,
          data: {
            orderId: 'ord_990182',
            status: 'PENDING_PAYMENT',
            totalAmount: 19.5,
            currency: 'USD',
            itemCount: 1,
            paymentId: 'pay_sim_990182',
            createdAt: '2026-10-15T11:00:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [48, 53, 54]
  },
  {
    id: 53,
    method: 'GET',
    path: '/orders',
    moduleNumber: '09',
    moduleName: 'Store & Orders',
    summary: 'List orders; ?id= returns authorized order details',
    description: 'Retrieves patient orders list. When query parameter `?id=...` is provided, acts as detail retrieval for that specific authorized order.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Contract design: Combines list and detail retrieval under a single endpoint (?id=...).',
      'Patients can only view orders authored by themselves.',
      'Supports ?status=... filter for list mode.'
    ],
    parameters: [
      { name: 'id', in: 'query', required: false, type: 'string', description: 'Order ID to retrieve single order detail', example: 'ord_990182' },
      { name: 'status', in: 'query', required: false, type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'], example: 'PROCESSING' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 10 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Order details or order list.',
        example: {
          success: true,
          data: {
            orders: [
              {
                id: 'ord_990182',
                status: 'PROCESSING',
                totalAmount: 19.5,
                currency: 'USD',
                items: [
                  { medicineName: 'CortiCare 1% Cream', quantity: 1, unitPrice: 14.5 }
                ],
                shippingAddress: { city: 'San Francisco', state: 'CA' },
                createdAt: '2026-10-15T11:00:00Z'
              }
            ],
            pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [52, 64]
  }
];

