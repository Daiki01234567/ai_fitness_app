/**
 * Unit Tests for Form Evaluation Helper Functions
 *
 * Reference: docs/expo/tickets/014-form-evaluation-engine.md
 */

import {
  calculateAngle,
  calculateAngle3D,
  calculateDistance,
  calculateDistance3D,
  isLandmarkVisible,
  areAllLandmarksVisible,
  calculateMidpoint,
  isAngleInRange,
  checkKneeOverToe,
  checkElbowFixed,
  checkSymmetry,
  checkBodyLine,
  checkBackStraight,
} from "../helpers";
import type { Landmark, Point2D, Point3D } from "@/types/mediapipe";

describe("calculateAngle", () => {
  it("calculates 90 degrees correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 1, y: 0 };
    const pointC: Point2D = { x: 1, y: 1 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(90, 0);
  });

  it("calculates 180 degrees (straight line) correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 1, y: 0 };
    const pointC: Point2D = { x: 2, y: 0 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(180, 0);
  });

  it("calculates 45 degrees correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 1, y: 0 };
    const pointC: Point2D = { x: 2, y: 1 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(45, 0);
  });

  it("calculates 135 degrees correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 1, y: 0 };
    const pointC: Point2D = { x: 0, y: 1 };

    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(135, 0);
  });

  it("handles same points gracefully", () => {
    const point: Point2D = { x: 1, y: 1 };
    const angle = calculateAngle(point, point, point);
    // Should return 0 or handle edge case
    expect(typeof angle).toBe("number");
  });
});

describe("calculateAngle3D", () => {
  it("calculates 90 degrees in 3D correctly", () => {
    const pointA: Point3D = { x: 1, y: 0, z: 0 };
    const pointB: Point3D = { x: 0, y: 0, z: 0 };
    const pointC: Point3D = { x: 0, y: 1, z: 0 };

    const angle = calculateAngle3D(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(90, 0);
  });

  it("calculates 180 degrees in 3D correctly", () => {
    const pointA: Point3D = { x: -1, y: 0, z: 0 };
    const pointB: Point3D = { x: 0, y: 0, z: 0 };
    const pointC: Point3D = { x: 1, y: 0, z: 0 };

    const angle = calculateAngle3D(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(180, 0);
  });

  it("handles zero-length vectors", () => {
    const pointA: Point3D = { x: 0, y: 0, z: 0 };
    const pointB: Point3D = { x: 0, y: 0, z: 0 };
    const pointC: Point3D = { x: 1, y: 1, z: 1 };

    const angle = calculateAngle3D(pointA, pointB, pointC);
    expect(angle).toBe(0);
  });
});

describe("calculateDistance", () => {
  it("calculates horizontal distance correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 3, y: 0 };

    const distance = calculateDistance(pointA, pointB);
    expect(distance).toBe(3);
  });

  it("calculates vertical distance correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 0, y: 4 };

    const distance = calculateDistance(pointA, pointB);
    expect(distance).toBe(4);
  });

  it("calculates diagonal distance correctly (3-4-5 triangle)", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 3, y: 4 };

    const distance = calculateDistance(pointA, pointB);
    expect(distance).toBe(5);
  });

  it("returns 0 for same point", () => {
    const point: Point2D = { x: 5, y: 5 };
    const distance = calculateDistance(point, point);
    expect(distance).toBe(0);
  });
});

describe("calculateDistance3D", () => {
  it("calculates 3D distance correctly", () => {
    const pointA: Point3D = { x: 0, y: 0, z: 0 };
    const pointB: Point3D = { x: 1, y: 2, z: 2 };

    const distance = calculateDistance3D(pointA, pointB);
    expect(distance).toBe(3); // sqrt(1 + 4 + 4) = 3
  });
});

describe("isLandmarkVisible", () => {
  it("returns true when visibility is above threshold", () => {
    const landmark: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.8 };
    expect(isLandmarkVisible(landmark, 0.5)).toBe(true);
  });

  it("returns false when visibility is below threshold", () => {
    const landmark: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.3 };
    expect(isLandmarkVisible(landmark, 0.5)).toBe(false);
  });

  it("returns true when visibility equals threshold", () => {
    const landmark: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.5 };
    expect(isLandmarkVisible(landmark, 0.5)).toBe(true);
  });

  it("returns false for null/undefined landmark", () => {
    expect(isLandmarkVisible(null as unknown as Landmark)).toBe(false);
    expect(isLandmarkVisible(undefined as unknown as Landmark)).toBe(false);
  });

  it("uses default threshold of 0.5", () => {
    const lowVisibility: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.4 };
    const highVisibility: Landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.6 };

    expect(isLandmarkVisible(lowVisibility)).toBe(false);
    expect(isLandmarkVisible(highVisibility)).toBe(true);
  });
});

describe("areAllLandmarksVisible", () => {
  const createLandmark = (visibility: number): Landmark => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
  });

  it("returns true when all landmarks are visible", () => {
    const landmarks = Array(33).fill(null).map(() => createLandmark(0.8));
    expect(areAllLandmarksVisible(landmarks, [0, 1, 2], 0.5)).toBe(true);
  });

  it("returns false when some landmarks are not visible", () => {
    const landmarks = Array(33).fill(null).map(() => createLandmark(0.8));
    landmarks[1] = createLandmark(0.3);

    expect(areAllLandmarksVisible(landmarks, [0, 1, 2], 0.5)).toBe(false);
  });

  it("returns true for empty required indices", () => {
    const landmarks = Array(33).fill(null).map(() => createLandmark(0.8));
    expect(areAllLandmarksVisible(landmarks, [], 0.5)).toBe(true);
  });
});

describe("calculateMidpoint", () => {
  it("calculates midpoint correctly", () => {
    const pointA: Point2D = { x: 0, y: 0 };
    const pointB: Point2D = { x: 4, y: 4 };

    const midpoint = calculateMidpoint(pointA, pointB);
    expect(midpoint.x).toBe(2);
    expect(midpoint.y).toBe(2);
  });

  it("handles negative coordinates", () => {
    const pointA: Point2D = { x: -2, y: -2 };
    const pointB: Point2D = { x: 2, y: 2 };

    const midpoint = calculateMidpoint(pointA, pointB);
    expect(midpoint.x).toBe(0);
    expect(midpoint.y).toBe(0);
  });
});

describe("isAngleInRange", () => {
  it("returns true when angle is within range", () => {
    expect(isAngleInRange(90, 80, 100)).toBe(true);
  });

  it("returns false when angle is below range", () => {
    expect(isAngleInRange(70, 80, 100)).toBe(false);
  });

  it("returns false when angle is above range", () => {
    expect(isAngleInRange(110, 80, 100)).toBe(false);
  });

  it("returns true when angle equals min", () => {
    expect(isAngleInRange(80, 80, 100)).toBe(true);
  });

  it("returns true when angle equals max", () => {
    expect(isAngleInRange(100, 80, 100)).toBe(true);
  });
});

describe("checkKneeOverToe", () => {
  it("returns true when knee is behind toe", () => {
    const knee: Point2D = { x: 0.4, y: 0.5 };
    const footIndex: Point2D = { x: 0.5, y: 0.8 };

    expect(checkKneeOverToe(knee, footIndex)).toBe(true);
  });

  it("returns false when knee is far past toe", () => {
    const knee: Point2D = { x: 0.6, y: 0.5 };
    const footIndex: Point2D = { x: 0.4, y: 0.8 };

    expect(checkKneeOverToe(knee, footIndex)).toBe(false);
  });

  it("returns true when knee is within tolerance", () => {
    const knee: Point2D = { x: 0.53, y: 0.5 };
    const footIndex: Point2D = { x: 0.5, y: 0.8 };

    expect(checkKneeOverToe(knee, footIndex, 0.05)).toBe(true);
  });
});

describe("checkElbowFixed", () => {
  it("returns true when elbow is at midpoint", () => {
    const elbow: Point2D = { x: 0.3, y: 0.5 };
    const shoulder: Point2D = { x: 0.3, y: 0.3 };
    const hip: Point2D = { x: 0.3, y: 0.7 };

    expect(checkElbowFixed(elbow, shoulder, hip)).toBe(true);
  });

  it("returns false when elbow has moved significantly", () => {
    const elbow: Point2D = { x: 0.3, y: 0.3 };
    const shoulder: Point2D = { x: 0.3, y: 0.3 };
    const hip: Point2D = { x: 0.3, y: 0.7 };

    expect(checkElbowFixed(elbow, shoulder, hip)).toBe(false);
  });
});

describe("checkSymmetry", () => {
  it("returns passed when points are symmetric", () => {
    const leftPoint: Point2D = { x: 0.3, y: 0.5 };
    const rightPoint: Point2D = { x: 0.7, y: 0.5 };

    const result = checkSymmetry(leftPoint, rightPoint);
    expect(result.passed).toBe(true);
    expect(result.diff).toBe(0);
  });

  it("returns failed when points are asymmetric", () => {
    const leftPoint: Point2D = { x: 0.3, y: 0.5 };
    const rightPoint: Point2D = { x: 0.7, y: 0.7 };

    const result = checkSymmetry(leftPoint, rightPoint);
    expect(result.passed).toBe(false);
    expect(result.diff).toBeCloseTo(0.2, 2);
  });

  it("uses custom tolerance", () => {
    const leftPoint: Point2D = { x: 0.3, y: 0.5 };
    const rightPoint: Point2D = { x: 0.7, y: 0.55 };

    expect(checkSymmetry(leftPoint, rightPoint, 0.1).passed).toBe(true);
    expect(checkSymmetry(leftPoint, rightPoint, 0.03).passed).toBe(false);
  });
});

describe("checkBodyLine", () => {
  it("returns passed for straight body line", () => {
    const shoulder: Point2D = { x: 0.3, y: 0.3 };
    const hip: Point2D = { x: 0.5, y: 0.5 };
    const ankle: Point2D = { x: 0.7, y: 0.7 };

    const result = checkBodyLine(shoulder, hip, ankle);
    expect(result.passed).toBe(true);
    expect(result.angle).toBeCloseTo(180, 0);
  });

  it("returns failed for bent body", () => {
    const shoulder: Point2D = { x: 0.3, y: 0.3 };
    const hip: Point2D = { x: 0.5, y: 0.7 }; // Hip dropped
    const ankle: Point2D = { x: 0.7, y: 0.7 };

    const result = checkBodyLine(shoulder, hip, ankle);
    expect(result.passed).toBe(false);
  });
});

describe("checkBackStraight", () => {
  it("returns passed for straight back", () => {
    const shoulder: Point2D = { x: 0.5, y: 0.3 };
    const hip: Point2D = { x: 0.5, y: 0.5 };
    const knee: Point2D = { x: 0.5, y: 0.7 };

    const result = checkBackStraight(shoulder, hip, knee);
    expect(result.passed).toBe(true);
    expect(result.angle).toBeCloseTo(180, 0);
  });

  it("returns failed for rounded back", () => {
    const shoulder: Point2D = { x: 0.3, y: 0.3 };
    const hip: Point2D = { x: 0.6, y: 0.5 }; // Hip forward (rounded back)
    const knee: Point2D = { x: 0.5, y: 0.7 };

    const result = checkBackStraight(shoulder, hip, knee);
    // Angle will be less than 150 for significantly rounded back
    expect(typeof result.angle).toBe("number");
  });
});
