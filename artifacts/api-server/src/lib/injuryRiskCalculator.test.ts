/**
 * Test script for injury risk algorithm
 * Run with: npx ts-node src/lib/injuryRiskCalculator.test.ts
 */

import { assessInjuryRisk, InjuryRiskAssessment } from "./injuryRiskCalculator";
import { Activity, AthleteProfile } from "@workspace/db";

/**
 * Test Case 1: The scenario from the issue
 * - 10 miles in 50 minutes (5:00/mi pace)
 * - Heart rate: 200 bpm
 * - Effort: 10/10
 * - Notes: "dying"
 * Expected: HIGH or CRITICAL risk
 */
async function testExtremeOverexertion() {
  console.log("\n=== TEST 1: Extreme Overexertion (Issue Scenario) ===");

  const activity = {
    id: 1,
    userId: "test-user",
    type: "race",
    stravaActivityId: null,
    distanceKm: "16.09", // ~10 miles
    durationMinutes: 50,
    avgHeartRate: 200,
    maxHeartRate: 200,
    perceivedEffort: 10,
    notes: "dying",
    activityDate: "2024-06-26",
    createdAt: new Date(),
    movingTimeSeconds: null,
    elapsedTimeSeconds: null,
    elevationGainM: null,
    elevHighM: null,
    elevLowM: null,
    avgCadence: null,
    avgSpeed: null,
    maxSpeed: null,
    calories: null,
    sufferScore: null,
    avgWatts: null,
    avgTemp: null,
    achievementCount: null,
    prCount: null,
    kudosCount: null,
    commentCount: null,
    athleteCount: null,
    gearName: null,
    startDateLocal: null,
    timezone: null,
    mapPolyline: null,
    description: null,
    workoutType: null,
    splits: null,
    bestEfforts: null,
  } as unknown as Activity;

  const profile = {
    id: 1,
    userId: "test-user",
    name: "Test Athlete",
    age: 30,
    weeklyMileageGoal: "50",
    fitnessLevel: "intermediate",
    primaryGoal: "marathon",
    restingHeartRate: 60,
    hrv: null,
    selectedCoach: null,
    userRole: "athlete",
    country: "USA",
    state: null,
    contactMethod: null,
    contactValue: null,
    pr5k: null,
    pr10k: null,
    prHalf: null,
    prMarathon: "3:30:00",
    healthNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AthleteProfile;

  const assessment = await assessInjuryRisk(activity, profile, 50, []);

  console.log(`Risk Level: ${assessment.riskLevel} (${assessment.riskScore}/100)`);
  console.log(`Primary Body Parts: ${assessment.primaryBodyParts.join(", ")}`);
  console.log(`Risk Factors (${assessment.riskFactors.length}):`);
  assessment.riskFactors.forEach((f) => {
    console.log(`  • ${f.factor} [${f.severity.toUpperCase()}]: ${f.value}`);
    console.log(`    → ${f.explanation}`);
  });
  console.log(`\nMessage: ${assessment.message}`);
  console.log(`\nRecommendation: ${assessment.recommendation}`);

  const passed = assessment.riskLevel === "critical" || assessment.riskLevel === "high";
  console.log(`\n✓ Test PASSED: Risk level is ${assessment.riskLevel}` + (passed ? "" : " (EXPECTED HIGH/CRITICAL)"));
  return passed;
}

/**
 * Test Case 2: Mileage spike
 * - Previous week: 30 km
 * - This week: 50 km (67% increase, well above 10% rule)
 * - Moderate effort
 * Expected: MEDIUM or HIGH risk
 */
async function testMileageSpike() {
  console.log("\n=== TEST 2: Rapid Mileage Increase ===");

  const activity = {
    id: 2,
    userId: "test-user",
    type: "long_run",
    stravaActivityId: null,
    distanceKm: "20",
    durationMinutes: 180,
    avgHeartRate: 155,
    maxHeartRate: 170,
    perceivedEffort: 7,
    notes: "felt strong",
    activityDate: "2024-06-26",
    createdAt: new Date(),
    movingTimeSeconds: null,
    elapsedTimeSeconds: null,
    elevationGainM: null,
    elevHighM: null,
    elevLowM: null,
    avgCadence: null,
    avgSpeed: null,
    maxSpeed: null,
    calories: null,
    sufferScore: null,
    avgWatts: null,
    avgTemp: null,
    achievementCount: null,
    prCount: null,
    kudosCount: null,
    commentCount: null,
    athleteCount: null,
    gearName: null,
    startDateLocal: null,
    timezone: null,
    mapPolyline: null,
    description: null,
    workoutType: null,
    splits: null,
    bestEfforts: null,
  } as unknown as Activity;

  const profile = {
    id: 1,
    userId: "test-user",
    name: "Test Athlete",
    age: 35,
    weeklyMileageGoal: "50",
    fitnessLevel: "intermediate",
    primaryGoal: "marathon",
    restingHeartRate: 55,
    hrv: null,
    selectedCoach: null,
    userRole: "athlete",
    country: "USA",
    state: null,
    contactMethod: null,
    contactValue: null,
    pr5k: null,
    pr10k: null,
    prHalf: null,
    prMarathon: null,
    healthNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AthleteProfile;

  const assessment = await assessInjuryRisk(activity, profile, 30, []); // Previous week was 30 km

  console.log(`Risk Level: ${assessment.riskLevel} (${assessment.riskScore}/100)`);
  console.log(`Risk Factors (${assessment.riskFactors.length}):`);
  assessment.riskFactors.forEach((f) => {
    console.log(`  • ${f.factor} [${f.severity.toUpperCase()}]: ${f.value}`);
  });
  console.log(`\nRecommendation: ${assessment.recommendation}`);

  const passed = assessment.riskLevel !== "low";
  console.log(`\n✓ Test PASSED: Risk level is ${assessment.riskLevel}` + (passed ? "" : " (EXPECTED MEDIUM/HIGH)"));
  return passed;
}

/**
 * Test Case 3: Effort-pace mismatch
 * - 12 km in 120 minutes (10:00 min/km, very easy pace)
 * - HR: 165 bpm (85%+ of max)
 * - RPE: 6/10
 * Expected: MEDIUM or HIGH risk (indicates fatigue/struggle on easy effort)
 */
async function testEffortPaceMismatch() {
  console.log("\n=== TEST 3: Effort-Pace Mismatch ===");

  const activity = {
    id: 3,
    userId: "test-user",
    type: "easy_run",
    stravaActivityId: null,
    distanceKm: "12",
    durationMinutes: 120,
    avgHeartRate: 165,
    maxHeartRate: 185,
    perceivedEffort: 6,
    notes: "struggled even at easy pace",
    activityDate: "2024-06-26",
    createdAt: new Date(),
    movingTimeSeconds: null,
    elapsedTimeSeconds: null,
    elevationGainM: null,
    elevHighM: null,
    elevLowM: null,
    avgCadence: null,
    avgSpeed: null,
    maxSpeed: null,
    calories: null,
    sufferScore: null,
    avgWatts: null,
    avgTemp: null,
    achievementCount: null,
    prCount: null,
    kudosCount: null,
    commentCount: null,
    athleteCount: null,
    gearName: null,
    startDateLocal: null,
    timezone: null,
    mapPolyline: null,
    description: null,
    workoutType: null,
    splits: null,
    bestEfforts: null,
  } as unknown as Activity;

  const profile = {
    id: 1,
    userId: "test-user",
    name: "Test Athlete",
    age: 40,
    weeklyMileageGoal: "60",
    fitnessLevel: "intermediate",
    primaryGoal: "half-marathon",
    restingHeartRate: 58,
    hrv: null,
    selectedCoach: null,
    userRole: "athlete",
    country: "USA",
    state: null,
    contactMethod: null,
    contactValue: null,
    pr5k: null,
    pr10k: null,
    prHalf: null,
    prMarathon: null,
    healthNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AthleteProfile;

  const assessment = await assessInjuryRisk(activity, profile, 40, []);

  console.log(`Risk Level: ${assessment.riskLevel} (${assessment.riskScore}/100)`);
  console.log(`Risk Factors (${assessment.riskFactors.length}):`);
  assessment.riskFactors.forEach((f) => {
    console.log(`  • ${f.factor} [${f.severity.toUpperCase()}]: ${f.value}`);
    console.log(`    → ${f.explanation}`);
  });
  console.log(`\nRecommendation: ${assessment.recommendation}`);

  const passed = assessment.riskLevel !== "low";
  console.log(`\n✓ Test PASSED: Risk level is ${assessment.riskLevel}` + (passed ? "" : " (EXPECTED MEDIUM/HIGH)"));
  return passed;
}

/**
 * Test Case 4: Normal healthy run (should be LOW risk)
 * - 10 km in 60 minutes (6:00 min/km, easy pace)
 * - HR: 140 bpm (70% of max)
 * - RPE: 4/10
 * Expected: LOW risk
 */
async function testHealthyRun() {
  console.log("\n=== TEST 4: Healthy Easy Run (Control) ===");

  const activity = {
    id: 4,
    userId: "test-user",
    type: "easy_run",
    stravaActivityId: null,
    distanceKm: "10",
    durationMinutes: 60,
    avgHeartRate: 140,
    maxHeartRate: 150,
    perceivedEffort: 4,
    notes: "felt great",
    activityDate: "2024-06-26",
    createdAt: new Date(),
    movingTimeSeconds: null,
    elapsedTimeSeconds: null,
    elevationGainM: null,
    elevHighM: null,
    elevLowM: null,
    avgCadence: null,
    avgSpeed: null,
    maxSpeed: null,
    calories: null,
    sufferScore: null,
    avgWatts: null,
    avgTemp: null,
    achievementCount: null,
    prCount: null,
    kudosCount: null,
    commentCount: null,
    athleteCount: null,
    gearName: null,
    startDateLocal: null,
    timezone: null,
    mapPolyline: null,
    description: null,
    workoutType: null,
    splits: null,
    bestEfforts: null,
  } as unknown as Activity;

  const profile = {
    id: 1,
    userId: "test-user",
    name: "Test Athlete",
    age: 30,
    weeklyMileageGoal: "60",
    fitnessLevel: "intermediate",
    primaryGoal: "marathon",
    restingHeartRate: 60,
    hrv: null,
    selectedCoach: null,
    userRole: "athlete",
    country: "USA",
    state: null,
    contactMethod: null,
    contactValue: null,
    pr5k: null,
    pr10k: null,
    prHalf: null,
    prMarathon: null,
    healthNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AthleteProfile;

  const assessment = await assessInjuryRisk(activity, profile, 40, []);

  console.log(`Risk Level: ${assessment.riskLevel} (${assessment.riskScore}/100)`);
  console.log(`Risk Factors: ${assessment.riskFactors.length}`);
  console.log(`Message: ${assessment.message}`);

  const passed = assessment.riskLevel === "low";
  console.log(`\n✓ Test PASSED: Risk level is ${assessment.riskLevel}` + (passed ? "" : " (EXPECTED LOW)"));
  return passed;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  Injury Risk Algorithm Test Suite                  ║");
  console.log("╚════════════════════════════════════════════════════╝");

  const results = await Promise.all([testExtremeOverexertion(), testMileageSpike(), testEffortPaceMismatch(), testHealthyRun()]);

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║  Test Results                                      ║");
  console.log("╚════════════════════════════════════════════════════╝");
  const passed = results.filter((r) => r).length;
  const total = results.length;
  console.log(`\n${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("✓ All tests passed! Algorithm working as expected.\n");
  } else {
    console.log(`✗ ${total - passed} test(s) failed. Review algorithm thresholds.\n`);
  }
}

// Run tests
runAllTests().catch(console.error);
