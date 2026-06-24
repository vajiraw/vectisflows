/**
 * DQMessaging - Shared messaging module for RabbitMQ integration
 *
 * This module provides a complete RabbitMQ messaging solution for the DQ AI processing pipeline.
 * It handles message publishing, consuming, connection management, and error handling.
 *
 * Key components:
 * - MessagingModule: Dynamic NestJS module for easy registration
 * - MessagingService: Public API for publishing and subscribing to messages
 * - AmqpConnectionProvider: Manages RabbitMQ connection lifecycle and auto-recovery
 * - ConsumerExplorer: Discovers and manages message consumers
 */

export * from './messaging.module';
export * from './messaging.service';
export * from './messaging.constants';
export * from './interfaces';
export * from './core';
