-- Preserve existing fulfillment history while adopting the required status name.
ALTER TYPE "order_status" RENAME VALUE 'SHIPPED' TO 'OUT_FOR_DELIVERY';

-- PACKED is the required intermediate stage between processing and delivery.
ALTER TYPE "order_status" ADD VALUE 'PACKED' AFTER 'PROCESSING';
