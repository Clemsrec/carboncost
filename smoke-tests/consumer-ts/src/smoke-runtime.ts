/**
 * Runtime smoke test for carbone packages
 * This file executes the packages at runtime to ensure they work correctly
 */

import { trackPageview, trackAIUsage, aggregateEvents, explain } from 'carbone-cost';
import { createCarbonBrowserSdk } from '@clemsrec/browser';
import { createNextCarbon } from '@clemsrec/next';

/**
 * Test carbone-cost core functionality
 */
const testCore = () => {
  console.log('📊 Testing carbone-cost core...');

  // Test trackPageview
  const pageEvent = trackPageview({
    bytesTransferred: 1500,
    route: '/test',
  });

  if (!pageEvent || !pageEvent.type || !pageEvent.result || !pageEvent.result.gramsCO2e) {
    throw new Error('❌ trackPageview did not return expected shape');
  }

  console.log(`  ✅ trackPageview: ${pageEvent.type} → ${pageEvent.result.gramsCO2e.toFixed(8)} g CO2e`);

  // Test trackAIUsage
  const aiEvent = trackAIUsage({
    provider: 'openai',
    model: 'gpt-4',
    promptTokens: 500,
    completionTokens: 200,
  });

  if (!aiEvent || !aiEvent.type || !aiEvent.result || !aiEvent.result.gramsCO2e) {
    throw new Error('❌ trackAIUsage did not return expected shape');
  }

  console.log(`  ✅ trackAIUsage: ${aiEvent.type} → ${aiEvent.result.gramsCO2e.toFixed(8)} g CO2e`);

  // Test aggregateEvents
  const aggregate = aggregateEvents([pageEvent, aiEvent]);
  if (!aggregate || aggregate.totalEvents !== 2) {
    throw new Error('❌ aggregateEvents did not aggregate correctly');
  }
  console.log(`  ✅ aggregateEvents: aggregated ${aggregate.totalEvents} events`);

  // Test explain
  const explanation = explain(pageEvent.result.methodology);
  if (!explanation || !explanation.assumptions || !Array.isArray(explanation.assumptions)) {
    throw new Error('❌ explain did not return expected shape');
  }
  console.log(`  ✅ explain: generated explanation`);
};

/**
 * Test browser SDK
 */
const testBrowser = () => {
  console.log('🌐 Testing @clemsrec/browser...');

  const sdk = createCarbonBrowserSdk({});
  if (!sdk || typeof sdk.trackPageview !== 'function') {
    throw new Error('❌ Browser SDK did not export trackPageview');
  }
  console.log('  ✅ Browser SDK created and methods available');
};

/**
 * Test Next.js adapter
 */
const testNext = () => {
  console.log('⚙️  Testing @clemsrec/next...');

  const nextCarbon = createNextCarbon();
  if (!nextCarbon || typeof nextCarbon.trackRouteBytes !== 'function') {
    throw new Error('❌ Next adapter did not export trackRouteBytes');
  }
  console.log('  ✅ Next adapter created and methods available');
};

/**
 * Run all runtime tests
 */
export const runSmokeTests = () => {
  console.log('\n⚡ Running runtime smoke tests...\n');

  try {
    testCore();
    testBrowser();
    testNext();
    console.log('\n✅ All runtime tests passed!\n');
  } catch (error) {
    console.error('\n❌ Runtime test failed:', error);
    process.exit(1);
  }
};

// Execute when run as script
runSmokeTests();
