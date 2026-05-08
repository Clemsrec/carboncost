/**
 * Type and import validation for carbone packages
 * This file verifies that all packages can be imported and types resolve correctly
 */

import { trackPageview, trackAIUsage, aggregateEvents, explain, WEB_METHODOLOGY, AI_METHODOLOGY, type WebPageviewInput, type AIUsageInput, type CarbonEvent } from 'carbone-cost';
import { createCarbonBrowserSdk } from '@clemsrec/browser';
import { createNextCarbon } from '@clemsrec/next';

/**
 * Type validation: ensure types are properly exported and resolve
 */
const pageInput: WebPageviewInput = {
  bytesTransferred: 1000,
  route: '/',
};

const aiInput: AIUsageInput = {
  provider: 'openai',
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50,
};

/**
 * Function validation: ensure all exports are functions
 */
const validateFunctions = () => {
  const validators = [
    { name: 'trackPageview', fn: trackPageview },
    { name: 'trackAIUsage', fn: trackAIUsage },
    { name: 'aggregateEvents', fn: aggregateEvents },
    { name: 'explain', fn: explain },
    { name: 'createCarbonBrowserSdk', fn: createCarbonBrowserSdk },
    { name: 'createNextCarbon', fn: createNextCarbon },
  ];

  validators.forEach(({ name, fn }) => {
    if (typeof fn !== 'function') {
      throw new Error(`❌ ${name} is not a function`);
    }
  });

  console.log('✅ All functions exported correctly');
};

/**
 * Methodology validation: ensure constants are objects
 */
const validateMethodologies = () => {
  if (!WEB_METHODOLOGY || typeof WEB_METHODOLOGY !== 'object') {
    throw new Error('❌ WEB_METHODOLOGY is not an object');
  }
  if (!AI_METHODOLOGY || typeof AI_METHODOLOGY !== 'object') {
    throw new Error('❌ AI_METHODOLOGY is not an object');
  }
  console.log('✅ Methodologies exported correctly');
};

/**
 * Run all validations
 */
export const runTypeValidation = () => {
  console.log('\n📘 Running type and import validation...\n');
  validateFunctions();
  validateMethodologies();
  console.log('\n✅ Type validation complete\n');
};
