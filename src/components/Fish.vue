<template>
  <div class="optics-simulator">
    <h1>Archer Fish Optics Simulation</h1>

    <div class="canvas-container">
      <canvas
        ref="canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
      ></canvas>
    </div>

    <div class="controls-container">
      <div class="inputs-row">
        <div class="control-group">
          <label for="refractiveIndex">Refractive Index of Water:</label>
          <input
            type="number"
            id="refractiveIndex"
            v-model.number="refractiveIndex"
            min="1"
            max="2"
            step="0.01"
          />
        </div>

        <div class="control-group">
          <label for="leftAngle">Left Incident Angle (degrees):</label>
          <input
            type="number"
            id="leftAngle"
            v-model.number="leftAngleDeg"
            min="0"
            :max="criticalAngle"
            step="0.1"
          />
        </div>

        <div class="control-group">
          <label for="rightAngle">Right Incident Angle (degrees):</label>
          <input
            type="number"
            id="rightAngle"
            v-model.number="rightAngleDeg"
            min="0"
            :max="criticalAngle"
            step="0.1"
          />
        </div>
      </div>

      <div class="info">
        <div class="info-columns">
          <div class="info-column">
            <p>Critical Angle: {{ criticalAngle.toFixed(2) }}°</p>
            <p>Left Refracted Angle: {{ leftRefractedAngle.toFixed(2) }}°</p>
            <p>Right Refracted Angle: {{ rightRefractedAngle.toFixed(2) }}°</p>
          </div>
          <div class="info-column">
            <p>
              Distance between refraction points:
              {{ distanceBetweenPoints.toFixed(2) }}px
            </p>
            <p v-if="leftAngleDeg > criticalAngle">
              Left: Total internal reflection
            </p>
            <p v-if="rightAngleDeg > criticalAngle">
              Right: Total internal reflection
            </p>
          </div>
          <div class="info-column">
            <p class="tip">Tip: Drag empty space to pan the view</p>
            <label class="mode-toggle">
              <input type="checkbox" v-model="lockRealPosition" />
              Update I' (Apparent) position when changing angles
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

// Canvas references
const canvas = ref(null);
let ctx = null;

// Configuration
const refractiveIndex = ref(1.33);
const waterLevelY = 450; // Moved water level down
const airIndex = 1.0;

// Interactive elements
const leftPoint = ref({ x: 250, y: waterLevelY });
const rightPoint = ref({ x: 550, y: waterLevelY });
const apparentPosition = ref({ x: 400, y: 200 });

// Option to lock the real position when changing angles
const lockRealPosition = ref(true);

// Angles in degrees (measured from normal/vertical)
const leftAngleDeg = ref(30);
const rightAngleDeg = ref(30);

// Viewport translation for dragging/panning
const viewportOffset = ref({ x: 0, y: 0 });

// Dragging state
const dragging = ref(null);
const dragStart = ref({ x: 0, y: 0 });
const updatingFromDrag = ref(false); // Prevent circular updates
const updatingFromAngleChange = ref(false); // Prevent circular updates

// Critical angle
const criticalAngle = computed(() => {
  return (Math.asin(airIndex / refractiveIndex.value) * 180) / Math.PI;
});

// Distance between refraction points
const distanceBetweenPoints = computed(() => {
  return Math.abs(rightPoint.value.x - leftPoint.value.x);
});

// Check if angles exceed critical angle
const leftExceedsCritical = computed(() => {
  return leftAngleDeg.value >= criticalAngle.value;
});

const rightExceedsCritical = computed(() => {
  return rightAngleDeg.value >= criticalAngle.value;
});

// Calculate refracted angles using Snell's law
const leftRefractedAngle = computed(() => {
  if (leftExceedsCritical.value) return NaN;

  const incidentRad = (leftAngleDeg.value * Math.PI) / 180;
  // Snell's law: n₁sin(θ₁) = n₂sin(θ₂) → θ₂ = arcsin((n₁/n₂) * sin(θ₁))
  const refractedRad = Math.asin(
    (refractiveIndex.value / airIndex) * Math.sin(incidentRad)
  );
  return (refractedRad * 180) / Math.PI;
});

const rightRefractedAngle = computed(() => {
  if (rightExceedsCritical.value) return NaN;

  const incidentRad = (rightAngleDeg.value * Math.PI) / 180;
  // Snell's law for water→air
  const refractedRad = Math.asin(
    (refractiveIndex.value / airIndex) * Math.sin(incidentRad)
  );
  return (refractedRad * 180) / Math.PI;
});

// Calculate the endpoint of a ray with given angle from normal
function calculateRayPoint(startPoint, angleDeg, length, isLeft) {
  // Convert to radians
  const angleRad = (angleDeg * Math.PI) / 180;

  // Determine the correct quadrant based on which side the ray is on
  // If the ray is on the left side of the normal, we need to negate the x-component
  const xDirection = isLeft ? -1 : 1;

  // Calculate endpoint coordinates
  const endX = startPoint.x + length * Math.sin(angleRad) * xDirection;
  const endY = startPoint.y - length * Math.cos(angleRad); // Negative y goes up

  return { x: endX, y: endY };
}

// Real position calculation
const realPosition = computed(() => {
  // If either angle exceeds critical, return null
  if (leftExceedsCritical.value || rightExceedsCritical.value) {
    return null;
  }

  const leftIsLeft = apparentPosition.value.x < leftPoint.value.x;
  const rightIsLeft = apparentPosition.value.x < rightPoint.value.x;

  // Calculate points on the refracted rays
  const leftRayPoint = calculateRayPoint(
    leftPoint.value,
    leftRefractedAngle.value,
    1000,
    leftIsLeft
  );
  const rightRayPoint = calculateRayPoint(
    rightPoint.value,
    rightRefractedAngle.value,
    1000,
    rightIsLeft
  );

  // Calculate line equations for the two rays
  // Line equation: (y-y1) = m(x-x1) → y = m(x-x1) + y1
  const leftSlope =
    (leftRayPoint.y - leftPoint.value.y) / (leftRayPoint.x - leftPoint.value.x);
  const rightSlope =
    (rightRayPoint.y - rightPoint.value.y) /
    (rightRayPoint.x - rightPoint.value.x);

  // Solve the system of equations to find the intersection
  // y = m1(x-x1) + y1 and y = m2(x-x2) + y2
  // This gives: m1(x-x1) + y1 = m2(x-x2) + y2
  // Solving for x: x = ((m1*x1 - y1) - (m2*x2 - y2)) / (m1 - m2)
  const x =
    (leftSlope * leftPoint.value.x -
      leftPoint.value.y -
      (rightSlope * rightPoint.value.x - rightPoint.value.y)) /
    (leftSlope - rightSlope);

  // Substitute back to find y
  const y = leftSlope * (x - leftPoint.value.x) + leftPoint.value.y;

  return { x, y };
});

// Calculate apparent position based on real position and angles
function updateApparentFromReal() {
  if (!lockRealPosition.value) return;

  const realPos = realPosition.value;
  if (
    !realPos ||
    realPos.y >= waterLevelY ||
    leftExceedsCritical.value ||
    rightExceedsCritical.value
  ) {
    return; // Can't calculate if real position is invalid
  }

  // Calculate direction vectors for incident rays from refraction points
  const leftDx = realPos.x - leftPoint.value.x;
  const leftDy = realPos.y - leftPoint.value.y;
  const rightDx = realPos.x - rightPoint.value.x;
  const rightDy = realPos.y - rightPoint.value.y;

  // Calculate incident angles from normal (in radians)
  const leftIncidentRad = Math.atan2(Math.abs(leftDx), Math.abs(leftDy));
  const rightIncidentRad = Math.atan2(Math.abs(rightDx), Math.abs(rightDy));

  // Use Snell's law for air→water (reversed) to get the angles in water
  // n₁sin(θ₁) = n₂sin(θ₂) → θ₂ = arcsin((n₁/n₂) * sin(θ₁))
  const leftWaterRad = Math.asin(
    (airIndex / refractiveIndex.value) * Math.sin(leftIncidentRad)
  );
  const rightWaterRad = Math.asin(
    (airIndex / refractiveIndex.value) * Math.sin(rightIncidentRad)
  );

  // Calculate the refracted ray directions in water
  const leftIsLeft = leftDx < 0;
  const rightIsLeft = rightDx < 0;

  // Calculate points along the refracted rays
  const leftWaterPoint = calculateRayPoint(
    leftPoint.value,
    (leftWaterRad * 180) / Math.PI,
    1000,
    leftIsLeft
  );
  const rightWaterPoint = calculateRayPoint(
    rightPoint.value,
    (rightWaterRad * 180) / Math.PI,
    1000,
    rightIsLeft
  );

  // Calculate line equations for the refracted rays in water
  const leftSlope =
    (leftWaterPoint.y - leftPoint.value.y) /
    (leftWaterPoint.x - leftPoint.value.x);
  const rightSlope =
    (rightWaterPoint.y - rightPoint.value.y) /
    (rightWaterPoint.x - rightPoint.value.x);

  // Find intersection point of these rays (apparent position)
  const x =
    (leftSlope * leftPoint.value.x -
      leftPoint.value.y -
      (rightSlope * rightPoint.value.x - rightPoint.value.y)) /
    (leftSlope - rightSlope);
  const y = leftSlope * (x - leftPoint.value.x) + leftPoint.value.y;

  // Update apparent position
  apparentPosition.value = { x, y };
}

// Convert screen coordinates to world coordinates
function screenToWorld(screenX, screenY) {
  return {
    x: screenX - viewportOffset.value.x,
    y: screenY - viewportOffset.value.y
  };
}

// Convert world coordinates to screen coordinates
function worldToScreen(worldX, worldY) {
  return {
    x: worldX + viewportOffset.value.x,
    y: worldY + viewportOffset.value.y
  };
}

// Mouse event handlers
function handleMouseDown(e) {
  const rect = canvas.value.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  // Convert to world coordinates
  const { x, y } = screenToWorld(screenX, screenY);

  // Save the start position for dragging
  dragStart.value = { x: screenX, y: screenY };

  // Check if mouse is near any draggable point
  const isNearPoint = (point, threshold = 15) => {
    const screenPoint = worldToScreen(point.x, point.y);
    return (
      Math.sqrt(
        (screenX - screenPoint.x) ** 2 + (screenY - screenPoint.y) ** 2
      ) < threshold
    );
  };

  if (isNearPoint(leftPoint.value)) {
    dragging.value = 'leftPoint';
  } else if (isNearPoint(rightPoint.value)) {
    dragging.value = 'rightPoint';
  } else if (isNearPoint(apparentPosition.value)) {
    dragging.value = 'apparentPosition';
  } else if (realPosition.value && isNearPoint(realPosition.value)) {
    dragging.value = 'realPosition';
  } else {
    // If not dragging a specific point, drag the viewport
    dragging.value = 'viewport';
  }
}

function handleMouseMove(e) {
  if (!dragging.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  if (dragging.value === 'viewport') {
    // Pan the viewport
    viewportOffset.value.x += screenX - dragStart.value.x;
    viewportOffset.value.y += screenY - dragStart.value.y;
    dragStart.value = { x: screenX, y: screenY };
  } else {
    // Convert to world coordinates
    const { x, y } = screenToWorld(screenX, screenY);

    if (dragging.value === 'leftPoint') {
      leftPoint.value = { x, y: waterLevelY };
      updatingFromDrag.value = true;
      updateAnglesFromPositions();
      updatingFromDrag.value = false;
    } else if (dragging.value === 'rightPoint') {
      rightPoint.value = { x, y: waterLevelY };
      updatingFromDrag.value = true;
      updateAnglesFromPositions();
      updatingFromDrag.value = false;
    } else if (dragging.value === 'apparentPosition') {
      // Ensure apparent position stays above water
      if (y < waterLevelY) {
        apparentPosition.value = { x, y };
        updatingFromDrag.value = true;
        updateAnglesFromPositions();
        updatingFromDrag.value = false;
      }
    } else if (dragging.value === 'realPosition') {
      // Allow dragging the real position when lockRealPosition is true
      if (y < waterLevelY && lockRealPosition.value) {
        // Store the current real position to use for angle calculations
        const realPos = { x, y };

        // Calculate and update the angles based on this new real position
        updatingFromDrag.value = true;
        updateAnglesFromRealPosition(realPos);
        // Then update the apparent position based on the new angles
        updateApparentFromReal();
        updatingFromDrag.value = false;
      }
    }
  }

  drawScene();
}

function handleMouseUp() {
  dragging.value = null;
}

// Update angles based on apparent position
function updateAnglesFromPositions() {
  // Vector from refraction point to apparent position
  const leftDx = apparentPosition.value.x - leftPoint.value.x;
  const leftDy = apparentPosition.value.y - leftPoint.value.y;
  const rightDx = apparentPosition.value.x - rightPoint.value.x;
  const rightDy = apparentPosition.value.y - rightPoint.value.y;

  // Calculate angle from vertical (normal)
  // atan2 gives us the angle in the correct quadrant
  const leftAngle = Math.abs(Math.atan2(leftDx, -leftDy));
  const rightAngle = Math.abs(Math.atan2(rightDx, -rightDy));

  // Convert to degrees
  leftAngleDeg.value = parseFloat(((leftAngle * 180) / Math.PI).toFixed(1));
  rightAngleDeg.value = parseFloat(((rightAngle * 180) / Math.PI).toFixed(1));
}

// Update angles based on real position
function updateAnglesFromRealPosition(realPos) {
  // Vector from refraction point to real position
  const leftDx = realPos.x - leftPoint.value.x;
  const leftDy = realPos.y - leftPoint.value.y;
  const rightDx = realPos.x - rightPoint.value.x;
  const rightDy = realPos.y - rightPoint.value.y;

  // Calculate angle from vertical (normal)
  const leftIncidentAngle = Math.abs(Math.atan2(leftDx, -leftDy));
  const rightIncidentAngle = Math.abs(Math.atan2(rightDx, -rightDy));

  // Apply inverse Snell's law to find the angle in water
  // n₁sin(θ₁) = n₂sin(θ₂) → θ₁ = arcsin((n₂/n₁) * sin(θ₂))
  const leftWaterAngle = Math.asin(
    (airIndex / refractiveIndex.value) * Math.sin(leftIncidentAngle)
  );
  const rightWaterAngle = Math.asin(
    (airIndex / refractiveIndex.value) * Math.sin(rightIncidentAngle)
  );

  // Convert to degrees
  leftAngleDeg.value = parseFloat(
    ((leftWaterAngle * 180) / Math.PI).toFixed(1)
  );
  rightAngleDeg.value = parseFloat(
    ((rightWaterAngle * 180) / Math.PI).toFixed(1)
  );
}

// Drawing functions
function drawScene() {
  if (!ctx) return;

  const width = canvas.value.width;
  const height = canvas.value.height;

  // Clear canvas
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  // Apply viewport transformation
  ctx.save();
  ctx.translate(viewportOffset.value.x, viewportOffset.value.y);

  // Draw grid
  drawGrid(width, height);

  // Draw water surface
  ctx.strokeStyle = '#0088ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1000 - viewportOffset.value.x, waterLevelY);
  ctx.lineTo(width + 1000 - viewportOffset.value.x, waterLevelY);
  ctx.stroke();

  // Draw apparent position
  ctx.fillStyle = '#ff4488';
  ctx.beginPath();
  ctx.arc(
    apparentPosition.value.x,
    apparentPosition.value.y,
    8,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';
  ctx.fillText(
    "I' (Apparent)",
    apparentPosition.value.x + 15,
    apparentPosition.value.y
  );

  // Draw refraction points
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.arc(leftPoint.value.x, leftPoint.value.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(rightPoint.value.x, rightPoint.value.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw normal lines (vertical)
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  // Left normal
  ctx.beginPath();
  ctx.moveTo(leftPoint.value.x, waterLevelY - 50);
  ctx.lineTo(leftPoint.value.x, waterLevelY + 50);
  ctx.stroke();

  // Right normal
  ctx.beginPath();
  ctx.moveTo(rightPoint.value.x, waterLevelY - 50);
  ctx.lineTo(rightPoint.value.x, waterLevelY + 50);
  ctx.stroke();

  ctx.setLineDash([]);

  // Draw rays from apparent position to refraction points
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  // Left ray
  ctx.beginPath();
  ctx.moveTo(apparentPosition.value.x, apparentPosition.value.y);
  ctx.lineTo(leftPoint.value.x, leftPoint.value.y);
  ctx.stroke();

  // Right ray
  ctx.beginPath();
  ctx.moveTo(apparentPosition.value.x, apparentPosition.value.y);
  ctx.lineTo(rightPoint.value.x, rightPoint.value.y);
  ctx.stroke();

  // Draw angles (between normal and ray)
  const leftIsLeft = apparentPosition.value.x < leftPoint.value.x;
  const rightIsLeft = apparentPosition.value.x < rightPoint.value.x;

  // Draw incident angles
  drawAngle(
    leftPoint.value,
    Math.min(leftAngleDeg.value, criticalAngle.value),
    '#ffffff',
    leftIsLeft
  );
  drawAngle(
    rightPoint.value,
    Math.min(rightAngleDeg.value, criticalAngle.value),
    '#ffffff',
    rightIsLeft
  );

  // If an angle exceeds critical, draw the critical angle in red
  if (leftExceedsCritical.value) {
    drawAngle(leftPoint.value, criticalAngle.value, '#ff0000', leftIsLeft);
  }

  if (rightExceedsCritical.value) {
    drawAngle(rightPoint.value, criticalAngle.value, '#ff0000', rightIsLeft);
  }

  // Draw reflected rays for angles exceeding critical angle
  if (leftExceedsCritical.value) {
    // Draw total internal reflection
    drawReflectedRay(leftPoint.value, leftAngleDeg.value, leftIsLeft);
  }

  if (rightExceedsCritical.value) {
    // Draw total internal reflection
    drawReflectedRay(rightPoint.value, rightAngleDeg.value, rightIsLeft);
  }

  // Draw real position and refracted rays
  const realPos = realPosition.value;
  if (realPos && !isNaN(realPos.x) && !isNaN(realPos.y)) {
    // Only draw if real position is above water and both angles are below critical
    if (
      realPos.y < waterLevelY &&
      !leftExceedsCritical.value &&
      !rightExceedsCritical.value
    ) {
      // Draw rays from refraction points to real position
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1.5;

      // Left refracted ray
      ctx.beginPath();
      ctx.moveTo(leftPoint.value.x, leftPoint.value.y);
      ctx.lineTo(realPos.x, realPos.y);
      ctx.stroke();

      // Right refracted ray
      ctx.beginPath();
      ctx.moveTo(rightPoint.value.x, rightPoint.value.y);
      ctx.lineTo(realPos.x, realPos.y);
      ctx.stroke();

      // Draw real position point
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(realPos.x, realPos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('I (Real)', realPos.x + 15, realPos.y);

      // Display refracted angles
      if (
        !isNaN(leftRefractedAngle.value) &&
        !isNaN(rightRefractedAngle.value)
      ) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px Arial';
        ctx.fillText(
          `${leftRefractedAngle.value.toFixed(1)}°`,
          leftPoint.value.x - 40,
          leftPoint.value.y - 15
        );
        ctx.fillText(
          `${rightRefractedAngle.value.toFixed(1)}°`,
          rightPoint.value.x + 30,
          rightPoint.value.y - 15
        );
      }
    }
  }

  // Restore canvas state
  ctx.restore();
}

function drawReflectedRay(point, incidentAngleDeg, isLeft) {
  // Draw reflected ray (angle of reflection equals angle of incidence)
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1.5;

  const incidentRad = (incidentAngleDeg * Math.PI) / 180;

  // Reflection: angle out equals angle in, but on the opposite side of normal
  const reflectedRad = isLeft ? -incidentRad : incidentRad;

  const length = 100;
  const endX = point.x + length * Math.sin(reflectedRad) * (isLeft ? -1 : 1);
  const endY = point.y + length * Math.cos(reflectedRad);

  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

function drawGrid(width, height) {
  const gridSize = 50;
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 0.5;

  // Calculate grid bounds based on viewport
  const startX = (-viewportOffset.value.x % gridSize) - gridSize;
  const startY = (-viewportOffset.value.y % gridSize) - gridSize;
  const endX = width - viewportOffset.value.x + gridSize;
  const endY = height - viewportOffset.value.y + gridSize;

  // Draw vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

function drawAngle(center, angleDeg, color, isLeft) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  const radius = 30;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Draw arc for angle (from normal)
  ctx.beginPath();

  // Start from vertical (normal)
  const startAngle = -Math.PI / 2; // top
  // End at the incident angle from normal
  const endAngle = isLeft ? -Math.PI / 2 - angleRad : -Math.PI / 2 + angleRad;

  ctx.moveTo(center.x, center.y);
  ctx.arc(center.x, center.y, radius, startAngle, endAngle, isLeft);
  ctx.stroke();

  // Display angle value
  ctx.fillStyle = color;
  ctx.font = '12px Arial';
  const textAngle = (startAngle + endAngle) / 2;
  const textX = center.x + radius * 1.3 * Math.cos(textAngle);
  const textY = center.y + radius * 1.3 * Math.sin(textAngle);
  ctx.fillText(`${angleDeg.toFixed(1)}°`, textX, textY);
}

// Watch for angle changes
watch([leftAngleDeg, rightAngleDeg], () => {
  if (updatingFromDrag.value) return; // Prevent circular updates

  // Ensure angles are within bounds (allow exceeding critical for demonstration)
  leftAngleDeg.value = Math.max(0, Math.min(89.9, leftAngleDeg.value));
  rightAngleDeg.value = Math.max(0, Math.min(89.9, rightAngleDeg.value));

  // Update apparent position when angles change
  updateApparentFromReal();

  drawScene();
});

// Watch for refractive index changes
watch(refractiveIndex, () => {
  // Update apparent position when refractive index changes
  if (lockRealPosition.value) {
    updateApparentFromReal();
  }
  drawScene();
});

// Watch for lock mode changes
watch(lockRealPosition, () => {
  // When changing modes, recalculate positions
  updateApparentFromReal();
  drawScene();
});

// Initialize on mount
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = 800;
    canvas.value.height = 600;
    ctx = canvas.value.getContext('2d');

    // Center the viewport
    viewportOffset.value = { x: 0, y: 0 };

    // Initialize angles based on positions
    updateAnglesFromPositions();
    drawScene();
  }
});
</script>

<style scoped>
.optics-simulator {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #121212;
  padding: 20px;
  min-height: 100vh;
  color: white;
  font-family: Arial, sans-serif;
}

h1 {
  color: #00aaff;
  margin-bottom: 20px;
}

.canvas-container {
  margin-bottom: 20px;
}

canvas {
  border: 1px solid #333;
  background-color: #181818;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.controls-container {
  width: 100%;
  max-width: 800px;
}

.inputs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
}

.control-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

label {
  font-size: 14px;
  color: #ccc;
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 15px;
  font-size: 14px;
  color: #00aaff;
}

input {
  background-color: #2a2a2a;
  color: white;
  border: 1px solid #444;
  padding: 8px;
  border-radius: 4px;
  width: 100%;
}

input[type='checkbox'] {
  width: auto;
}

.info {
  background-color: #1e1e1e;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  border-top: 3px solid #00aaff;
}

.info-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
}

.info-column {
  flex: 1;
  min-width: 200px;
}

.info p {
  margin: 8px 0;
  font-size: 14px;
}

.tip {
  margin-top: 16px;
  font-style: italic;
  color: #00aaff;
}
</style>
