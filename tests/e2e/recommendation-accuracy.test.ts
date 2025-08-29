import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TestDataGenerator } from '../utils/test-data-generator';
import { TestEnvironment } from '../utils/test-environment';
import { RecommendationScenario } from '../scenarios/recommendation-scenario';

describe('Recommendation Accuracy End-to-End Tests', () => {
  let testEnv: TestEnvironment;
  let testData: TestDataGenerator;
  let scenario: RecommendationScenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    testData = new TestDataGenerator();
    scenario = new RecommendationScenario(testEnv, testData);
    
    await testEnv.setup();
    await testEnv.waitForServicesReady();
  }, 60000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testData.resetTestData();
  });

  describe('Product Recommendation Accuracy', () => {
    test('should provide accurate recommendations based on purchase history', async () => {
      // Arrange - Create customer with specific purchase patterns
      const customer = await testData.createTestCustomer();
      const purchaseHistory = await testData.createPurchaseHistory(customer.id, {
        categories: ['electronics', 'books', 'home_garden'],
        brands: ['Apple', 'Samsung', 'Amazon'],
        priceRange: [50, 500],
        frequency: 'weekly'
      });
      
      // Act
      const recommendations = await scenario.getProductRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.products.length).toBeGreaterThan(0);
      
      // Verify relevance to purchase history
      const electronicsRecommendations = recommendations.products.filter(p => p.category === 'electronics');
      expect(electronicsRecommendations.length).toBeGreaterThan(0);
      
      // Verify confidence scores
      recommendations.products.forEach(product => {
        expect(product.confidenceScore).toBeGreaterThan(0.5);
        expect(product.relevanceScore).toBeGreaterThan(0.6);
      });
      
      // Verify personalization factors
      expect(recommendations.personalizationFactors).toContain('purchase_history');
      expect(recommendations.personalizationFactors).toContain('brand_preference');
      expect(recommendations.personalizationFactors).toContain('price_sensitivity');
    });

    test('should adapt recommendations based on seasonal patterns', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createSeasonalPurchaseHistory(customer.id, 'winter_sports');
      
      // Simulate winter season
      await testData.setSeasonalContext('winter');
      
      // Act
      const recommendations = await scenario.getSeasonalRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.seasonallyAdjusted).toBe(true);
      
      const winterProducts = recommendations.products.filter(p => 
        p.tags.includes('winter') || p.category === 'winter_sports'
      );
      expect(winterProducts.length).toBeGreaterThan(0);
      
      // Verify seasonal boost in scores
      winterProducts.forEach(product => {
        expect(product.seasonalBoost).toBeGreaterThan(0);
      });
    });

    test('should provide cross-category recommendations', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createPurchaseHistory(customer.id, {
        categories: ['fitness'],
        items: ['running_shoes', 'fitness_tracker', 'protein_powder']
      });
      
      // Act
      const recommendations = await scenario.getCrossCategoryRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.crossCategory).toBe(true);
      
      // Should recommend related categories like health, nutrition, sports apparel
      const relatedCategories = recommendations.products.map(p => p.category);
      expect(relatedCategories).toContain('health');
      expect(relatedCategories).toContain('sports_apparel');
      
      // Verify cross-category reasoning
      recommendations.products.forEach(product => {
        expect(product.crossCategoryReason).toBeDefined();
      });
    });

    test('should handle collaborative filtering accurately', async () => {
      // Arrange - Create similar customers with overlapping preferences
      const targetCustomer = await testData.createTestCustomer();
      const similarCustomers = await testData.createSimilarCustomers(targetCustomer.id, 10);
      
      // Create purchase patterns for similar customers
      for (const customer of similarCustomers) {
        await testData.createSimilarPurchasePattern(customer.id, targetCustomer.id);
      }
      
      // Act
      const recommendations = await scenario.getCollaborativeRecommendations(targetCustomer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.collaborativeFiltering).toBe(true);
      expect(recommendations.similarCustomersCount).toBe(10);
      
      // Verify recommendations are based on similar customers' purchases
      recommendations.products.forEach(product => {
        expect(product.collaborativeScore).toBeGreaterThan(0.4);
        expect(product.purchasedBySimilarUsers).toBeGreaterThan(0);
      });
    });
  });

  describe('Financial Service Recommendations', () => {
    test('should recommend appropriate financial products based on profile', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const financialProfile = await testData.createFinancialProfile(customer.id, {
        income: 75000,
        savingsGoal: 'retirement',
        riskTolerance: 'moderate',
        currentProducts: ['checking_account']
      });
      
      // Act
      const recommendations = await scenario.getFinancialRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.services.length).toBeGreaterThan(0);
      
      // Should recommend retirement-focused products
      const retirementProducts = recommendations.services.filter(s => 
        s.category === 'retirement' || s.tags.includes('retirement')
      );
      expect(retirementProducts.length).toBeGreaterThan(0);
      
      // Verify risk-appropriate recommendations
      recommendations.services.forEach(service => {
        expect(service.riskLevel).toBeLessThanOrEqual('moderate');
      });
    });

    test('should provide credit product recommendations based on creditworthiness', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const creditProfile = await testData.createCreditProfile(customer.id, {
        score: 750,
        history: 'excellent',
        utilization: 0.15,
        income: 90000
      });
      
      // Act
      const recommendations = await scenario.getCreditRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.creditBased).toBe(true);
      
      // Should recommend premium credit products for excellent credit
      const premiumProducts = recommendations.services.filter(s => s.tier === 'premium');
      expect(premiumProducts.length).toBeGreaterThan(0);
      
      // Verify credit requirements are met
      recommendations.services.forEach(service => {
        expect(service.minimumCreditScore).toBeLessThanOrEqual(750);
      });
    });

    test('should recommend investment products based on risk profile', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const investmentProfile = await testData.createInvestmentProfile(customer.id, {
        riskTolerance: 'aggressive',
        investmentHorizon: 'long_term',
        experience: 'intermediate',
        liquidityNeeds: 'low'
      });
      
      // Act
      const recommendations = await scenario.getInvestmentRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.riskAligned).toBe(true);
      
      // Should recommend aggressive growth investments
      const aggressiveInvestments = recommendations.services.filter(s => 
        s.riskLevel === 'aggressive' || s.category === 'growth'
      );
      expect(aggressiveInvestments.length).toBeGreaterThan(0);
      
      // Verify investment horizon alignment
      recommendations.services.forEach(service => {
        expect(service.recommendedHorizon).toContain('long_term');
      });
    });
  });

  describe('Real-time Context Integration', () => {
    test('should incorporate browsing behavior in real-time', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const browsingSession = await testData.createBrowsingSession(customer.id, {
        categories: ['travel', 'luggage'],
        duration: 1800, // 30 minutes
        pages: ['flights_to_europe', 'travel_insurance', 'luggage_sets']
      });
      
      // Act
      const recommendations = await scenario.getRealTimeRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.realTimeContext).toBe(true);
      
      // Should include travel-related recommendations
      const travelRecommendations = recommendations.products.filter(p => 
        p.category === 'travel' || p.tags.includes('travel')
      );
      expect(travelRecommendations.length).toBeGreaterThan(0);
      
      // Verify real-time factors
      expect(recommendations.contextFactors).toContain('current_browsing');
      expect(recommendations.contextFactors).toContain('session_intent');
    });

    test('should adjust recommendations based on current location', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.setCustomerLocation(customer.id, {
        city: 'New York',
        state: 'NY',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      });
      
      // Act
      const recommendations = await scenario.getLocationBasedRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.locationAware).toBe(true);
      
      // Should include location-specific recommendations
      const localRecommendations = recommendations.products.filter(p => 
        p.localAvailability === true || p.location === 'New York'
      );
      expect(localRecommendations.length).toBeGreaterThan(0);
      
      // Verify location factors
      expect(recommendations.locationFactors).toContain('local_availability');
      expect(recommendations.locationFactors).toContain('regional_preferences');
    });

    test('should consider time-sensitive factors', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Simulate time-sensitive context (e.g., end of month, payday)
      await testData.setTimeContext({
        dayOfMonth: 30,
        isPayday: true,
        timeOfDay: 'evening',
        dayOfWeek: 'friday'
      });
      
      // Act
      const recommendations = await scenario.getTimeSensitiveRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.timeSensitive).toBe(true);
      
      // Should include end-of-month financial products or payday-related offers
      const timeSensitiveProducts = recommendations.products.filter(p => 
        p.timingSensitive === true
      );
      expect(timeSensitiveProducts.length).toBeGreaterThan(0);
      
      // Verify timing factors
      expect(recommendations.timingFactors).toContain('end_of_month');
      expect(recommendations.timingFactors).toContain('payday');
    });
  });

  describe('Multi-source Recommendation Merging', () => {
    test('should intelligently merge recommendations from multiple algorithms', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.setupMultipleRecommendationSources(customer.id);
      
      // Act
      const recommendations = await scenario.getMergedRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.sources.length).toBeGreaterThan(1);
      expect(recommendations.merged).toBe(true);
      
      // Verify merging logic
      expect(recommendations.mergingStrategy).toBeDefined();
      expect(recommendations.products.length).toBeGreaterThan(0);
      
      // Check that products have combined scores
      recommendations.products.forEach(product => {
        expect(product.combinedScore).toBeDefined();
        expect(product.sourceCount).toBeGreaterThan(0);
        if (product.sourceCount > 1) {
          expect(product.consensusScore).toBeDefined();
        }
      });
    });

    test('should handle conflicting recommendations appropriately', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createConflictingRecommendationSources(customer.id);
      
      // Act
      const recommendations = await scenario.resolveConflictingRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.conflictsResolved).toBe(true);
      
      // Verify conflict resolution
      expect(recommendations.conflictResolution).toBeDefined();
      expect(recommendations.conflictResolution.strategy).toBeDefined();
      expect(recommendations.conflictResolution.resolvedConflicts).toBeGreaterThan(0);
      
      // Final recommendations should be coherent
      const categories = recommendations.products.map(p => p.category);
      const uniqueCategories = [...new Set(categories)];
      expect(uniqueCategories.length).toBeLessThan(categories.length * 0.8); // Some consolidation should occur
    });

    test('should prioritize recommendations based on confidence and relevance', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createVariedConfidenceRecommendations(customer.id);
      
      // Act
      const recommendations = await scenario.getPrioritizedRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.prioritized).toBe(true);
      
      // Verify prioritization - higher confidence should come first
      for (let i = 0; i < recommendations.products.length - 1; i++) {
        const current = recommendations.products[i];
        const next = recommendations.products[i + 1];
        expect(current.priorityScore).toBeGreaterThanOrEqual(next.priorityScore);
      }
      
      // Top recommendations should have high confidence
      const topRecommendations = recommendations.products.slice(0, 3);
      topRecommendations.forEach(product => {
        expect(product.confidenceScore).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Recommendation Performance Metrics', () => {
    test('should measure click-through rates accurately', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(50);
      const recommendationSets = [];
      
      for (const customer of customers) {
        const recommendations = await scenario.getProductRecommendations(customer.id);
        recommendationSets.push({ customerId: customer.id, recommendations });
      }
      
      // Simulate user interactions
      const interactions = await testData.simulateUserInteractions(recommendationSets);
      
      // Act
      const metrics = await scenario.calculateClickThroughRates(interactions);
      
      // Assert
      expect(metrics.overallCTR).toBeGreaterThan(0.05); // At least 5% CTR
      expect(metrics.topPositionCTR).toBeGreaterThan(metrics.overallCTR);
      expect(metrics.categoryBreakdown).toBeDefined();
      
      // Verify metrics by position
      expect(metrics.positionAnalysis[0].ctr).toBeGreaterThan(metrics.positionAnalysis[4].ctr);
    });

    test('should measure conversion rates for recommendations', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(100);
      const recommendationCampaign = await testData.createRecommendationCampaign(customers);
      
      // Simulate purchases over time
      const purchases = await testData.simulatePurchasesFromRecommendations(recommendationCampaign, 30); // 30 days
      
      // Act
      const conversionMetrics = await scenario.calculateConversionRates(recommendationCampaign, purchases);
      
      // Assert
      expect(conversionMetrics.overallConversionRate).toBeGreaterThan(0.02); // At least 2% conversion
      expect(conversionMetrics.revenuePerRecommendation).toBeGreaterThan(0);
      expect(conversionMetrics.averageOrderValue).toBeGreaterThan(0);
      
      // Verify conversion by recommendation type
      expect(conversionMetrics.byRecommendationType).toBeDefined();
      expect(conversionMetrics.byRecommendationType.personalized.conversionRate)
        .toBeGreaterThan(conversionMetrics.byRecommendationType.generic.conversionRate);
    });

    test('should track recommendation diversity and coverage', async () => {
      // Arrange
      const customers = await testData.createDiverseCustomerBase(200);
      const allRecommendations = [];
      
      for (const customer of customers) {
        const recommendations = await scenario.getProductRecommendations(customer.id);
        allRecommendations.push(...recommendations.products);
      }
      
      // Act
      const diversityMetrics = await scenario.calculateDiversityMetrics(allRecommendations);
      
      // Assert
      expect(diversityMetrics.categoryDiversity).toBeGreaterThan(0.7); // Good category spread
      expect(diversityMetrics.brandDiversity).toBeGreaterThan(0.6);
      expect(diversityMetrics.priceRangeCoverage).toBeGreaterThan(0.8);
      
      // Verify coverage metrics
      expect(diversityMetrics.catalogCoverage).toBeGreaterThan(0.3); // Covering 30%+ of catalog
      expect(diversityMetrics.longTailCoverage).toBeGreaterThan(0.1); // Some long-tail items
    });
  });

  describe('A/B Testing for Recommendation Algorithms', () => {
    test('should compare different recommendation algorithms', async () => {
      // Arrange
      const testCustomers = await testData.createMultipleCustomers(1000);
      const controlGroup = testCustomers.slice(0, 500);
      const testGroup = testCustomers.slice(500);
      
      // Act - Run A/B test
      const controlResults = await scenario.runRecommendationAlgorithm('collaborative_filtering', controlGroup);
      const testResults = await scenario.runRecommendationAlgorithm('deep_learning', testGroup);
      
      // Simulate user interactions for both groups
      const controlInteractions = await testData.simulateInteractions(controlResults, 30);
      const testInteractions = await testData.simulateInteractions(testResults, 30);
      
      // Assert
      const comparison = await scenario.compareAlgorithmPerformance(controlInteractions, testInteractions);
      
      expect(comparison.statisticalSignificance).toBe(true);
      expect(comparison.pValue).toBeLessThan(0.05);
      expect(comparison.confidenceInterval).toBeDefined();
      
      // One algorithm should perform better
      expect(Math.abs(comparison.performanceDifference)).toBeGreaterThan(0.01);
    });
  });
});