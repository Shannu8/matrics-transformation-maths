import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Text Sprite helper creating crisp text with dark pill background for readability.
 */
function createTextSprite(text, color = '#ffffff', fontSize = 24, width = 280, height = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // Background pill for legibility
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
  ctx.beginPath();
  ctx.roundRect(6, 6, width - 12, height - 12, 12);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.6, 0.38, 1.0);
  sprite.userData = { lastText: text, color };
  return sprite;
}

/**
 * Small integer numeric label for axis ticks.
 */
function createNumericSprite(numStr, color = '#94a3b8') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numStr, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.38, 0.38, 1.0);
  return sprite;
}

export class Viewport3D {
  /** Documented floating-point comparison tolerance */
  static EPSILON = 1e-9;

  constructor(containerElement, onStepChangeCallback, onPlayStateChangeCallback) {
    this.container = containerElement;
    this.onStepChange = onStepChangeCallback;
    this.onPlayStateChange = onPlayStateChangeCallback;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Visual Elements:
    // 1. Single persistent primary vector arrow (solid 3D mesh)
    this.primaryArrowGroup = null;
    this.arrowMeshGroup = null;
    this.primaryShaftMesh = null;
    this.primaryConeMesh = null;
    this.primaryTipMesh = null;
    this.primaryLabelSprite = null;

    // 2. Optional reference vectors group (hidden by default)
    this.referenceGroup = null;
    this.showReferenceVectors = false;

    // 3. Coordinate Guides and Transformed Geometry
    this.geometryGroup = null;
    this.cubeMesh = null;
    this.cubeWireframe = null;
    this.showUnitCube = true;
    this.projectionGroup = null;

    // Dynamic Axis Sizing & Extent State
    this.minAxisExtent = 5.0;
    this.axisMargin = 1.0;
    this.currentCameraScale = 1.0;
    this.axisExtents = {
      x: 5.8,
      y: 5.8,
      z: 5.8,
      posX: 5.8,
      negX: 5.8,
      posY: 5.8,
      negY: 5.8,
      posZ: 5.8,
      negZ: 5.8
    };
    this.axisGroup = null;
    this.gridHelper = null;

    // Animation & Sequence State
    this.pipelineResult = null;
    this.animationSegments = [];
    this.currentStepIndex = 0;
    this.animProgress = 0.0;
    this.animSpeed = 1.0;
    this.isPlaying = false;
    this.lastTimestamp = 0;

    this.initScene();
    this.setupListeners();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 480;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.setCameraPreset('iso');

    // 3. Renderer with preserveDrawingBuffer enabled for high-fidelity report screenshots
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 100;
    this.controls.minDistance = 1;

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(12, 22, 16);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.45);
    dirLight2.position.set(-12, -10, -12);
    this.scene.add(dirLight2);

    // 6. Dynamic Coordinate Axes & Adaptive Grid on XZ plane (y=0)
    this.updateAxes();
    this.updateGrid(this.axisExtents.x, this.axisExtents.z);

    // 8. Unit Cube Reference Object (0..1 in positive octant)
    this.buildCube();

    // 9. Component Projection Guides Group (dashed lines to axes/ground)
    this.projectionGroup = new THREE.Group();
    this.projectionGroup.name = 'projectionGroup';
    this.scene.add(this.projectionGroup);

    // 10. Optional Reference Vectors Group (disabled by default)
    this.referenceGroup = new THREE.Group();
    this.referenceGroup.name = 'referenceGroup';
    this.referenceGroup.visible = false;
    this.scene.add(this.referenceGroup);

    // 11. Persistent Primary Vector 3D Solid Arrow
    this.setupPrimaryArrow();

    // Window and container resize observers
    window.addEventListener('resize', () => this.handleResize());
    if (window.ResizeObserver && this.container) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Conceptually: axisExtent = max(5, abs(vectorCoordinate) + margin)
   * Calculates the required extent for each axis independently based on the vector coordinates.
   */
  static calculateAxisExtent(coord, minExtent = 5.0, margin = 1.0) {
    const absCoord = Math.abs(Number(coord) || 0);
    if (absCoord <= 0.001) return minExtent + 0.8;
    return Math.max(minExtent + 0.8, absCoord + margin);
  }

  calculateRequiredExtents(vectors) {
    let maxAbsX = 0, maxPosX = 0, maxNegX = 0;
    let maxAbsY = 0, maxPosY = 0, maxNegY = 0;
    let maxAbsZ = 0, maxPosZ = 0, maxNegZ = 0;

    if (vectors && vectors.length > 0) {
      vectors.forEach(v => {
        if (!v || v.length < 3) return;
        const x = Number(v[0]) || 0;
        const y = Number(v[1]) || 0;
        const z = Number(v[2]) || 0;

        if (x > maxPosX) maxPosX = x;
        if (-x > maxNegX) maxNegX = -x;
        const absX = Math.abs(x);
        if (absX > maxAbsX) maxAbsX = absX;

        if (y > maxPosY) maxPosY = y;
        if (-y > maxNegY) maxNegY = -y;
        const absY = Math.abs(y);
        if (absY > maxAbsY) maxAbsY = absY;

        if (z > maxPosZ) maxPosZ = z;
        if (-z > maxNegZ) maxNegZ = -z;
        const absZ = Math.abs(z);
        if (absZ > maxAbsZ) maxAbsZ = absZ;
      });
    }

    const calcAxis = (absVal) => {
      if (absVal <= 0.001) return this.minAxisExtent + 0.8;
      return Math.max(this.minAxisExtent + 0.8, absVal + this.axisMargin);
    };

    const extentX = calcAxis(maxAbsX);
    const extentY = calcAxis(maxAbsY);
    const extentZ = calcAxis(maxAbsZ);

    return {
      x: extentX,
      y: extentY,
      z: extentZ,
      posX: extentX,
      negX: extentX,
      posY: extentY,
      negY: extentY,
      posZ: extentZ,
      negZ: extentZ
    };
  }

  getAxisExtent(axis = 'x') {
    const key = String(axis).toLowerCase();
    if (key === 'x') return this.axisExtents.x;
    if (key === 'y') return this.axisExtents.y;
    if (key === 'z') return this.axisExtents.z;
    if (this.axisExtents[axis] !== undefined) return this.axisExtents[axis];
    return this.minAxisExtent;
  }

  getAxisExtents() {
    return { ...this.axisExtents };
  }

  setAxisMargin(margin) {
    this.axisMargin = Math.max(0.2, Number(margin) || 1.0);
    if (this.pipelineResult) {
      this.setPipelineData(this.pipelineResult);
    } else {
      this.updateAxes();
    }
  }

  setMinAxisExtent(minVal) {
    this.minAxisExtent = Math.max(1.0, Number(minVal) || 5.0);
    if (this.pipelineResult) {
      this.setPipelineData(this.pipelineResult);
    } else {
      this.updateAxes();
    }
  }

  updateGrid(extentX, extentZ) {
    const maxExtent = Math.max(extentX, extentZ);
    const gridRadius = Math.max(8, Math.ceil(maxExtent) + 1);
    const gridSize = gridRadius * 2;
    let divisions = gridSize;
    if (gridSize > 60) {
      divisions = Math.round(gridSize / 2);
    }

    if (this.gridHelper) {
      if (this.gridHelper.userData && this.gridHelper.userData.gridSize === gridSize) {
        return;
      }
      this.scene.remove(this.gridHelper);
      if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
      if (this.gridHelper.material) this.gridHelper.material.dispose();
    }

    this.gridHelper = new THREE.GridHelper(gridSize, divisions, 0x334155, 0x1e293b);
    this.gridHelper.position.y = 0;
    this.gridHelper.userData = { gridSize };
    this.scene.add(this.gridHelper);
  }

  updateAxes(extents) {
    if (!extents) {
      extents = this.calculateRequiredExtents([]);
    }

    this.axisExtents = { ...extents };

    const extentX = extents.x || (this.minAxisExtent + 0.8);
    const extentY = extents.y || (this.minAxisExtent + 0.8);
    const extentZ = extents.z || (this.minAxisExtent + 0.8);

    if (!this.axisGroup) {
      this.axisGroup = new THREE.Group();
      this.axisGroup.name = 'coordinateAxes';
      this.scene.add(this.axisGroup);
    } else {
      while (this.axisGroup.children.length > 0) {
        const child = this.axisGroup.children[0];
        this.axisGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    }

    const createAxisLine = (start, end, colorHex, linewidth = 2) => {
      const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
      const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth });
      return new THREE.Line(geom, mat);
    };

    const createAxisCone = (pos, dir, colorHex) => {
      const coneGeom = new THREE.ConeGeometry(0.12, 0.32, 16);
      const coneMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.copy(pos);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      return cone;
    };

    // Shared Origin Marker (fixed at 0, 0, 0)
    const originGeom = new THREE.SphereGeometry(0.06, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const originSphere = new THREE.Mesh(originGeom, originMat);
    originSphere.position.set(0, 0, 0);
    this.axisGroup.add(originSphere);

    // +X Axis (Red)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(extentX, 0, 0), 0xef4444));
    this.axisGroup.add(createAxisCone(new THREE.Vector3(extentX, 0, 0), new THREE.Vector3(1, 0, 0), 0xef4444));
    const labelX = createTextSprite('+X (Red)', '#ef4444', 26, 210, 52);
    labelX.position.set(extentX + 0.65, 0, 0);
    this.axisGroup.add(labelX);

    // -X Axis (Faint Reference Line with -X label)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-extentX, 0, 0), 0x334155, 1));
    const labelNegX = createTextSprite('-X', '#64748b', 22, 100, 48);
    labelNegX.position.set(-extentX - 0.5, 0, 0);
    this.axisGroup.add(labelNegX);

    // +Y Axis (Green, UP)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, extentY, 0), 0x22c55e));
    this.axisGroup.add(createAxisCone(new THREE.Vector3(0, extentY, 0), new THREE.Vector3(0, 1, 0), 0x22c55e));
    const labelY = createTextSprite('+Y (Green, UP)', '#22c55e', 26, 240, 52);
    labelY.position.set(0, extentY + 0.65, 0);
    this.axisGroup.add(labelY);

    // -Y Axis (Faint Reference Line with -Y label)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -extentY, 0), 0x334155, 1));
    const labelNegY = createTextSprite('-Y', '#64748b', 22, 100, 48);
    labelNegY.position.set(0, -extentY - 0.5, 0);
    this.axisGroup.add(labelNegY);

    // +Z Axis (Blue, Depth)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, extentZ), 0x3b82f6));
    this.axisGroup.add(createAxisCone(new THREE.Vector3(0, 0, extentZ), new THREE.Vector3(0, 0, 1), 0x3b82f6));
    const labelZ = createTextSprite('+Z (Blue)', '#3b82f6', 26, 210, 52);
    labelZ.position.set(0, 0, extentZ + 0.65);
    this.axisGroup.add(labelZ);

    // -Z Axis (Faint Reference Line with -Z label)
    this.axisGroup.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -extentZ), 0x334155, 1));
    const labelNegZ = createTextSprite('-Z', '#64748b', 22, 100, 48);
    labelNegZ.position.set(0, 0, -extentZ - 0.5);
    this.axisGroup.add(labelNegZ);

    // Integer Tick Marks on each axis, excluding 0
    const tickMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    const getTickStep = (maxT) => {
      if (maxT <= 12) return 1;
      if (maxT <= 25) return 2;
      if (maxT <= 60) return 5;
      return 10;
    };

    const maxTickX = Math.max(5, Math.floor(extentX - 0.2));
    const stepX = getTickStep(maxTickX);
    for (let i = -maxTickX; i <= maxTickX; i += stepX) {
      if (i === 0) continue;
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -0.08, 0),
        new THREE.Vector3(i, 0.08, 0)
      ]);
      this.axisGroup.add(new THREE.Line(geom, tickMat));
      const sp = createNumericSprite(String(i), '#ef4444');
      sp.position.set(i, 0, 0.28);
      this.axisGroup.add(sp);
    }

    const maxTickY = Math.max(5, Math.floor(extentY - 0.2));
    const stepY = getTickStep(maxTickY);
    for (let i = -maxTickY; i <= maxTickY; i += stepY) {
      if (i === 0) continue;
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.08, i, 0),
        new THREE.Vector3(0.08, i, 0)
      ]);
      this.axisGroup.add(new THREE.Line(geom, tickMat));
      const sp = createNumericSprite(String(i), '#22c55e');
      sp.position.set(0.28, i, 0);
      this.axisGroup.add(sp);
    }

    const maxTickZ = Math.max(5, Math.floor(extentZ - 0.2));
    const stepZ = getTickStep(maxTickZ);
    for (let i = -maxTickZ; i <= maxTickZ; i += stepZ) {
      if (i === 0) continue;
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.08, 0, i),
        new THREE.Vector3(0.08, 0, i)
      ]);
      this.axisGroup.add(new THREE.Line(geom, tickMat));
      const sp = createNumericSprite(String(i), '#3b82f6');
      sp.position.set(0.28, 0, i);
      this.axisGroup.add(sp);
    }
  }

  buildAxes() {
    this.updateAxes();
  }

  setVector(vec3) {
    if (!vec3 || vec3.length < 3) return;
    const v = [Number(vec3[0]) || 0, Number(vec3[1]) || 0, Number(vec3[2]) || 0];
    const extents = this.calculateRequiredExtents([v]);
    this.updateAxes(extents);
    this.updateGrid(extents.x, extents.z);
    
    const maxCoord = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
    this.updateCameraFraming(maxCoord);
    
    const coordStr = `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`;
    this.updatePrimaryArrow(v, `v₀: ${coordStr}`);
    this.updateProjectionLines(v);
  }

  updateVector(vec3) {
    this.setVector(vec3);
  }

  buildCube() {
    this.geometryGroup = new THREE.Group();
    this.geometryGroup.name = 'unitCube';

    // 1x1x1 Unit cube centered in positive octant (0,0,0) to (1,1,1)
    const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
    cubeGeom.translate(0.5, 0.5, 0.5);

    // Subtle neutral slate styling so it does NOT clash with the primary cyan vector
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.06,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.cubeMesh = new THREE.Mesh(cubeGeom, cubeMat);
    this.geometryGroup.add(this.cubeMesh);

    // Subtle wireframe edges
    const edgesGeom = new THREE.EdgesGeometry(cubeGeom);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.4
    });
    this.cubeWireframe = new THREE.LineSegments(edgesGeom, edgeMat);
    this.geometryGroup.add(this.cubeWireframe);

    this.geometryGroup.visible = this.showUnitCube;
    this.scene.add(this.geometryGroup);
  }

  setShowUnitCube(visible) {
    this.showUnitCube = !!visible;
    if (this.geometryGroup) {
      this.geometryGroup.visible = this.showUnitCube;
    }
  }

  setupPrimaryArrow() {
    this.primaryArrowGroup = new THREE.Group();
    this.primaryArrowGroup.name = 'primaryArrow';

    // Solid 3D arrow mesh group (Cylinder shaft + Cone head)
    this.arrowMeshGroup = new THREE.Group();
    this.arrowMeshGroup.name = 'arrowMeshGroup';

    // 1. Shaft (Cylinder geometry aligned along Y from 0 to 1)
    const shaftGeom = new THREE.CylinderGeometry(0.038, 0.038, 1.0, 20);
    shaftGeom.translate(0, 0.5, 0); // Base at 0, top at 1
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.3
    });
    this.primaryShaftMesh = new THREE.Mesh(shaftGeom, arrowMat);
    this.arrowMeshGroup.add(this.primaryShaftMesh);

    // 2. Cone head (base at 0, apex at 1)
    const coneGeom = new THREE.ConeGeometry(0.12, 1.0, 20);
    coneGeom.translate(0, 0.5, 0); // Base at 0, apex at 1
    this.primaryConeMesh = new THREE.Mesh(coneGeom, arrowMat);
    this.arrowMeshGroup.add(this.primaryConeMesh);

    this.primaryArrowGroup.add(this.arrowMeshGroup);

    // 3. Tip marker sphere at the exact vector endpoint
    const tipGeom = new THREE.SphereGeometry(0.065, 20, 20);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.4
    });
    this.primaryTipMesh = new THREE.Mesh(tipGeom, tipMat);
    this.primaryArrowGroup.add(this.primaryTipMesh);

    // 4. Tip coordinate & step badge (Billboard text sprite)
    this.primaryLabelSprite = createTextSprite('v₀: (1.00, 1.00, 1.00)', '#38bdf8', 22, 280, 60);
    this.primaryLabelSprite.visible = true;
    this.primaryArrowGroup.add(this.primaryLabelSprite);

    this.scene.add(this.primaryArrowGroup);
  }

  updateLabelSprite(sprite, text, color = '#38bdf8') {
    if (!sprite || !sprite.material || !sprite.material.map) return;
    if (sprite.userData && sprite.userData.lastText === text && sprite.userData.color === color) {
      return;
    }

    const canvas = sprite.material.map.image;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
    ctx.beginPath();
    ctx.roundRect(6, 6, width - 12, height - 12, 12);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 22px Inter, -apple-system, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    sprite.material.map.needsUpdate = true;
    sprite.userData = { lastText: text, color };
  }

  updatePrimaryArrow(vec3, labelText = '') {
    if (!this.primaryArrowGroup) return;

    const v = new THREE.Vector3(vec3[0], vec3[1], vec3[2]);
    const len = v.length();

    if (len < 0.0001) {
      // Zero vector
      this.arrowMeshGroup.visible = false;
      this.primaryTipMesh.position.set(0, 0, 0);
      this.primaryTipMesh.visible = true;
      if (this.primaryLabelSprite) {
        this.primaryLabelSprite.visible = true;
        this.primaryLabelSprite.position.set(0, 0.35, 0);
        if (labelText) {
          this.updateLabelSprite(this.primaryLabelSprite, labelText, '#38bdf8');
        }
      }
      return;
    }

    this.arrowMeshGroup.visible = true;
    this.primaryTipMesh.visible = true;
    this.primaryTipMesh.position.copy(v);

    const dir = v.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Dynamic head sizing proportional to length
    const headLen = Math.min(0.42, Math.max(0.20, len * 0.24));
    const headRadius = Math.min(0.14, Math.max(0.08, len * 0.10));
    const shaftLen = Math.max(0.001, len - headLen);
    const shaftRadius = Math.min(0.045, Math.max(0.025, len * 0.035));

    // Update shaft scale and position
    this.primaryShaftMesh.scale.set(shaftRadius / 0.038, shaftLen, shaftRadius / 0.038);
    this.primaryShaftMesh.position.set(0, 0, 0);

    // Update cone scale and position (base starts at shaftLen, apex ends at len = v)
    this.primaryConeMesh.scale.set(headRadius / 0.12, headLen, headRadius / 0.12);
    this.primaryConeMesh.position.set(0, shaftLen, 0);

    // Rotate arrow group from +Y up to target direction dir
    this.arrowMeshGroup.quaternion.setFromUnitVectors(up, dir);

    // Position label directly above the arrowhead (NO horizontal X/Z offset!)
    if (this.primaryLabelSprite) {
      this.primaryLabelSprite.visible = true;
      const verticalOffset = v.y < -0.5 ? -0.38 : 0.38;
      this.primaryLabelSprite.position.set(v.x, v.y + verticalOffset, v.z);
      if (labelText) {
        this.updateLabelSprite(this.primaryLabelSprite, labelText, '#38bdf8');
      }
    }
  }

  setShowReferenceVectors(show) {
    this.showReferenceVectors = !!show;
    if (this.referenceGroup) {
      this.referenceGroup.visible = this.showReferenceVectors;
    }
  }

  updateReferenceVectors(result) {
    if (!this.referenceGroup) return;

    // Clear existing reference objects
    while (this.referenceGroup.children.length > 0) {
      const child = this.referenceGroup.children[0];
      this.referenceGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const createMutedArrow = (vec3, colorHex, label) => {
      const v = new THREE.Vector3(vec3[0], vec3[1], vec3[2]);
      const len = v.length();
      if (len < 0.0001) return;

      const group = new THREE.Group();
      const dir = v.clone().normalize();
      const headLen = Math.min(0.35, len * 0.22);
      const headWidth = Math.min(0.16, len * 0.10);

      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), len, colorHex, headLen, headWidth);
      if (arrow.line && arrow.line.material) {
        arrow.line.material.transparent = true;
        arrow.line.material.opacity = 0.45;
      }
      if (arrow.cone && arrow.cone.material) {
        arrow.cone.material.transparent = true;
        arrow.cone.material.opacity = 0.45;
      }
      group.add(arrow);

      const tipGeom = new THREE.SphereGeometry(0.05, 12, 12);
      const tipMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5 });
      const tip = new THREE.Mesh(tipGeom, tipMat);
      tip.position.copy(v);
      group.add(tip);

      const labelSp = createTextSprite(label, colorHex, 20, 180, 52);
      labelSp.material.opacity = 0.65;
      labelSp.scale.set(1.1, 0.32, 1.0);
      labelSp.position.set(v.x, v.y + 0.30, v.z);
      group.add(labelSp);

      this.referenceGroup.add(group);
    };

    // v0: Initial vector (Cyan muted)
    createMutedArrow(result.initialVector, 0x06b6d4, 'v₀');

    // Intermediate transformation steps
    if (result.steps && result.steps.length > 0) {
      const colors = [0xf59e0b, 0x8b5cf6, 0xec4899];
      result.steps.forEach((st, idx) => {
        const c = colors[idx % colors.length];
        createMutedArrow(st.outputVector, c, `v${st.index}`);
      });
    }

    // Composed vector (Emerald)
    createMutedArrow(result.composedVector, 0x10b981, 'Cv');

    // Recovered vector (Slate)
    if (result.recoveredVector && result.vectorRecoverySuccessful) {
      createMutedArrow(result.recoveredVector, 0x94a3b8, 'C⁻¹Cv');
    }

    this.referenceGroup.visible = this.showReferenceVectors;
  }

  updateProjectionLines(vec3) {
    if (!this.projectionGroup) return;

    while (this.projectionGroup.children.length > 0) {
      const child = this.projectionGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.projectionGroup.remove(child);
    }

    const x = vec3[0], y = vec3[1], z = vec3[2];
    const tip = new THREE.Vector3(x, y, z);
    const floor = new THREE.Vector3(x, 0, z);
    const onX = new THREE.Vector3(x, 0, 0);
    const onZ = new THREE.Vector3(0, 0, z);
    const onY = new THREE.Vector3(0, y, 0);

    const makeDashedLine = (p1, p2, colorHex) => {
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineDashedMaterial({
        color: colorHex,
        dashSize: 0.15,
        gapSize: 0.1,
        linewidth: 1.5
      });
      const line = new THREE.Line(geom, mat);
      line.computeLineDistances();
      return line;
    };

    // 1. Vertical drop line from (x, y, z) to ground (x, 0, z) (Green for height Y)
    if (Math.abs(y) > 0.001) {
      this.projectionGroup.add(makeDashedLine(tip, floor, 0x22c55e));
    }

    // 2. Ground lines from (x, 0, z) to X-axis and Z-axis
    if (Math.abs(z) > 0.001) {
      this.projectionGroup.add(makeDashedLine(floor, onX, 0x3b82f6)); // Depth line parallel to Z
    }
    if (Math.abs(x) > 0.001) {
      this.projectionGroup.add(makeDashedLine(floor, onZ, 0xef4444)); // Width line parallel to X
    }

    // Small foot markers on axes
    const footGeom = new THREE.SphereGeometry(0.045, 12, 12);
    const markerX = new THREE.Mesh(footGeom, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    markerX.position.copy(onX);
    this.projectionGroup.add(markerX);

    const markerY = new THREE.Mesh(footGeom, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    markerY.position.copy(onY);
    this.projectionGroup.add(markerY);

    const markerZ = new THREE.Mesh(footGeom, new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
    markerZ.position.copy(onZ);
    this.projectionGroup.add(markerZ);

    if (Math.abs(y) > 0.001) {
      const markerFloor = new THREE.Mesh(footGeom, new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
      markerFloor.position.copy(floor);
      this.projectionGroup.add(markerFloor);
    }
  }

  // Matrix math helpers
  multiplyMat(A, B) {
    const C = new Array(9).fill(0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        C[r * 3 + c] =
          A[r * 3 + 0] * B[0 * 3 + c] +
          A[r * 3 + 1] * B[1 * 3 + c] +
          A[r * 3 + 2] * B[2 * 3 + c];
      }
    }
    return C;
  }

  multiplyVec(A, v) {
    return [
      A[0] * v[0] + A[1] * v[1] + A[2] * v[2],
      A[3] * v[0] + A[4] * v[1] + A[5] * v[2],
      A[6] * v[0] + A[7] * v[1] + A[8] * v[2]
    ];
  }

  transpose(A) {
    return [
      A[0], A[3], A[6],
      A[1], A[4], A[7],
      A[2], A[5], A[8]
    ];
  }

  determinant(A) {
    const a = A[0], b = A[1], c = A[2];
    const d = A[3], e = A[4], f = A[5];
    const g = A[6], h = A[7], i = A[8];
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  }

  /**
   * Identifies whether a 3x3 matrix is a pure rotation in SO(3).
   * If true, extracts unit axis and rotation angle.
   */
  isRotationMatrix(M) {
    if (!M || M.length !== 9) return { isRotation: false };

    // 1. Check determinant ≈ +1.0
    const det = this.determinant(M);
    if (Math.abs(det - 1.0) > 1e-4) {
      return { isRotation: false };
    }

    // 2. Check M^T * M ≈ I
    const MtM = this.multiplyMat(this.transpose(M), M);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const expected = (r === c) ? 1.0 : 0.0;
        if (Math.abs(MtM[r * 3 + c] - expected) > 1e-4) {
          return { isRotation: false };
        }
      }
    }

    // Pure 3D rotation: extract axis and angle via Lie algebra / Rodrigues logarithm
    const tr = M[0] + M[4] + M[8];
    const cosAngle = Math.max(-1.0, Math.min(1.0, (tr - 1.0) / 2.0));
    const angle = Math.acos(cosAngle);

    if (angle < 1e-6) {
      return { isRotation: true, axis: [0, 1, 0], angle: 0.0 };
    }

    if (Math.abs(angle - Math.PI) < 1e-4) {
      // 180 degree rotation: 2 * u * u^T = M + I
      const MplusI = [
        M[0] + 1, M[1],     M[2],
        M[3],     M[4] + 1, M[5],
        M[6],     M[7],     M[8] + 1
      ];
      let bestCol = 0;
      let maxLen = -1;
      for (let c = 0; c < 3; c++) {
        const len = Math.hypot(MplusI[c], MplusI[3 + c], MplusI[6 + c]);
        if (len > maxLen) {
          maxLen = len;
          bestCol = c;
        }
      }
      const axis = [
        MplusI[bestCol] / maxLen,
        MplusI[3 + bestCol] / maxLen,
        MplusI[6 + bestCol] / maxLen
      ];
      return { isRotation: true, axis, angle: Math.PI };
    }

    // General angle: [M[7]-M[5], M[2]-M[6], M[3]-M[1]] is 2 * sin(angle) * axis
    const rawAxis = [
      M[7] - M[5], // row 2 col 1 - row 1 col 2
      M[2] - M[6], // row 0 col 2 - row 2 col 0
      M[3] - M[1]  // row 1 col 0 - row 0 col 1
    ];
    const axisLen = Math.hypot(rawAxis[0], rawAxis[1], rawAxis[2]);
    if (axisLen < 1e-9) {
      return { isRotation: true, axis: [0, 1, 0], angle: 0.0 };
    }
    const axis = [rawAxis[0] / axisLen, rawAxis[1] / axisLen, rawAxis[2] / axisLen];
    return { isRotation: true, axis, angle };
  }

  rotateVectorAroundAxis(v, u, phi) {
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]
    ];
    return [
      v[0] * cosP + cross[0] * sinP + u[0] * dot * (1.0 - cosP),
      v[1] * cosP + cross[1] * sinP + u[1] * dot * (1.0 - cosP),
      v[2] * cosP + cross[2] * sinP + u[2] * dot * (1.0 - cosP)
    ];
  }

  rotationMatrixAroundAxis(u, phi) {
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const omc = 1.0 - c;
    const x = u[0], y = u[1], z = u[2];
    return [
      c + x * x * omc,     x * y * omc - z * s, x * z * omc + y * s,
      y * x * omc + z * s, c + y * y * omc,     y * z * omc - x * s,
      z * x * omc - y * s, z * y * omc + x * s, c + z * z * omc
    ];
  }

  /**
   * Interpolates an intermediate state within an animation segment.
   * For rotations: uses intermediate rotation angle along the exact arc.
   * For general transformations: uses M(t) = (1 - t)I + tT.
   * At completed endpoints (t=0 or t=1), guarantees exact mathematical results.
   */
  interpolateSegment(segment, t) {
    if (t <= 0.0) {
      return {
        vector: [...segment.fromVector],
        matrix: [...segment.fromAccumMatrix]
      };
    }
    if (t >= 1.0) {
      return {
        vector: [...segment.toVector],
        matrix: [...segment.toAccumMatrix]
      };
    }

    if (segment.isRotation) {
      const phi = t * segment.rotationAngle;
      const v = this.rotateVectorAroundAxis(segment.fromVector, segment.rotationAxis, phi);
      const M_step = this.rotationMatrixAroundAxis(segment.rotationAxis, phi);
      const accumM = this.multiplyMat(M_step, segment.fromAccumMatrix);
      return { vector: v, matrix: accumM };
    }

    // General transformation interpolation: M(t) = (1 - t)I + tT
    const M_step = new Array(9);
    for (let i = 0; i < 9; i++) {
      const identityVal = (i === 0 || i === 4 || i === 8) ? 1.0 : 0.0;
      M_step[i] = (1.0 - t) * identityVal + t * segment.stepMatrix[i];
    }
    const v = this.multiplyVec(M_step, segment.fromVector);
    const accumM = this.multiplyMat(M_step, segment.fromAccumMatrix);
    return { vector: v, matrix: accumM };
  }

  /**
   * Loads calculation pipeline results for visualization and animation.
   */
  setPipelineData(result) {
    if (!result || !result.success) return;

    this.pipelineResult = result;
    this.pause();

    // 1. Gather all vector endpoints across pipeline stages to determine required extents
    const allVectors = [];
    if (result.initialVector) allVectors.push(result.initialVector);
    if (result.steps && result.steps.length > 0) {
      result.steps.forEach(st => {
        if (st.outputVector) allVectors.push(st.outputVector);
        // If step is a rotation, vector radius may sweep across axes
        const rotInfo = this.isRotationMatrix(st.matrix);
        if (rotInfo.isRotation && st.outputVector) {
          const norm = Math.hypot(st.outputVector[0], st.outputVector[1], st.outputVector[2]);
          allVectors.push([norm, 0, 0], [-norm, 0, 0]);
          allVectors.push([0, norm, 0], [0, -norm, 0]);
          allVectors.push([0, 0, norm], [0, 0, -norm]);
        }
      });
    }
    if (result.composedVector) allVectors.push(result.composedVector);
    if (result.recoveredVector && result.vectorRecoverySuccessful) {
      allVectors.push(result.recoveredVector);
    }

    // 2. Compute and apply dynamic axis extents and adaptive grid
    const extents = this.calculateRequiredExtents(allVectors);
    this.updateAxes(extents);
    this.updateGrid(extents.x, extents.z);

    // 3. Keep camera framing balanced without unnecessary shrinking
    const maxCoord = Math.max(
      ...allVectors.map(v => Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])))
    );
    this.updateCameraFraming(maxCoord);

    const v0 = [...result.initialVector];
    const segments = [];
    let prevVector = [...v0];
    let prevAccumMat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

    // Forward transformation steps (T1, T2, and optional T3)
    result.steps.forEach((st) => {
      const stepMatrix = [...st.matrix];
      const nextVector = [...st.outputVector];
      const nextAccumMat = this.multiplyMat(stepMatrix, prevAccumMat);
      const rotInfo = this.isRotationMatrix(stepMatrix);

      segments.push({
        stepIndex: st.index,
        name: st.name,
        fromVector: [...prevVector],
        toVector: [...nextVector],
        stepMatrix: stepMatrix,
        fromAccumMatrix: [...prevAccumMat],
        toAccumMatrix: [...nextAccumMat],
        isRotation: rotInfo.isRotation,
        rotationAxis: rotInfo.axis,
        rotationAngle: rotInfo.angle,
        transitionLabel: `Transition: ${st.name} (v${st.index - 1} → v${st.index})`,
        toLabel: `Step ${st.index} Complete: v${st.index} = [${nextVector.map(x => x.toFixed(2)).join(', ')}]ᵀ`
      });

      prevVector = [...nextVector];
      prevAccumMat = [...nextAccumMat];
    });

    // Inverse recovery step (if composed inverse is valid and recovery succeeded)
    if (result.composedInverse && result.composedInverse.success && result.recoveredVector) {
      const invMatrix = [...result.composedInverse.inverse];
      const recVector = [...result.recoveredVector];
      const rotInfo = this.isRotationMatrix(invMatrix);

      segments.push({
        stepIndex: segments.length + 1,
        name: 'C⁻¹',
        fromVector: [...prevVector],
        toVector: [...recVector],
        stepMatrix: invMatrix,
        fromAccumMatrix: [...prevAccumMat],
        toAccumMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], // Returns accumulated matrix back to Identity
        isRotation: rotInfo.isRotation,
        rotationAxis: rotInfo.axis,
        rotationAngle: rotInfo.angle,
        transitionLabel: 'Inverse Recovery: C⁻¹ (Cv → v₀)',
        toLabel: `Recovery Complete: C⁻¹(Cv) → v₀ = [${recVector.map(x => x.toFixed(2)).join(', ')}]ᵀ (Verified ✓)`
      });
    }

    this.animationSegments = segments;
    this.currentStepIndex = 0;
    this.animProgress = 0.0;

    // Update muted reference vectors in background
    this.updateReferenceVectors(result);

    // Render initial state (Step 0)
    this.applyStepState(0, 0.0);
  }

  applyStepState(stepIdx, fraction) {
    if (!this.animationSegments || this.animationSegments.length === 0) return;

    const segIdx = Math.max(0, Math.min(stepIdx, this.animationSegments.length - 1));
    const segment = this.animationSegments[segIdx];
    const t = Math.max(0.0, Math.min(1.0, fraction));

    const state = this.interpolateSegment(segment, t);

    // Formulate clean mathematical labels
    let currentLabel = '';
    let tipBadge = '';
    const v = state.vector;
    const coordStr = `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`;

    const totalSegments = this.animationSegments.length;
    if (segIdx === 0 && t < 0.001) {
      // Initial Vector v0
      tipBadge = `v₀: ${coordStr}`;
      currentLabel = `Step 0 of ${totalSegments}: Initial Vector v₀ = [${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}]ᵀ`;
    } else if (t >= 0.999) {
      // Completed step endpoint
      if (segment.name === 'C⁻¹') {
        tipBadge = `v_rec: ${coordStr}`;
      } else {
        tipBadge = `v${segment.stepIndex}: ${coordStr}`;
      }
      currentLabel = segment.toLabel;
    } else {
      // In-flight interpolation
      const pct = Math.round(t * 100);
      tipBadge = `v(t): ${coordStr}`;
      currentLabel = `${segment.transitionLabel} (${pct}%) → ${coordStr}`;
    }

    // 1. Update the single persistent primary arrow in-place
    this.updatePrimaryArrow(state.vector, tipBadge);

    // Dynamic extent check during animation:
    // If animated vector ever moves beyond existing axis extents, expand dynamically
    const curX = Math.abs(state.vector[0]) + this.axisMargin;
    const curY = Math.abs(state.vector[1]) + this.axisMargin;
    const curZ = Math.abs(state.vector[2]) + this.axisMargin;
    if (curX > this.axisExtents.x + 0.1 || curY > this.axisExtents.y + 0.1 || curZ > this.axisExtents.z + 0.1) {
      const newExtents = {
        x: Math.max(this.axisExtents.x, curX),
        y: Math.max(this.axisExtents.y, curY),
        z: Math.max(this.axisExtents.z, curZ),
        posX: Math.max(this.axisExtents.posX, curX),
        negX: Math.max(this.axisExtents.negX, curX),
        posY: Math.max(this.axisExtents.posY, curY),
        negY: Math.max(this.axisExtents.negY, curY),
        posZ: Math.max(this.axisExtents.posZ, curZ),
        negZ: Math.max(this.axisExtents.negZ, curZ)
      };
      this.updateAxes(newExtents);
      this.updateGrid(newExtents.x, newExtents.z);
    }

    // 2. Update projection drop lines
    this.updateProjectionLines(state.vector);

    // 3. Update transformed unit cube
    if (this.geometryGroup) {
      const m = state.matrix;
      const mat4 = new THREE.Matrix4();
      mat4.set(
        m[0], m[1], m[2], 0,
        m[3], m[4], m[5], 0,
        m[6], m[7], m[8], 0,
        0, 0, 0, 1
      );
      this.geometryGroup.matrixAutoUpdate = false;
      this.geometryGroup.matrix.copy(mat4);
      this.geometryGroup.matrixWorldNeedsUpdate = true;
    }

    // 4. Notify UI listeners of step change & progress
    if (this.onStepChange) {
      const progressPercent = ((segIdx + t) / Math.max(1, totalSegments)) * 100;
      this.onStepChange(segIdx, totalSegments, currentLabel, progressPercent);
    }
  }

  play() {
    this.isPlaying = true;
    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  pause() {
    this.isPlaying = false;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  togglePlay() {
    if (!this.animationSegments || this.animationSegments.length === 0) return false;

    // If currently at the end, restart from beginning
    if (!this.isPlaying && this.currentStepIndex >= this.animationSegments.length - 1 && this.animProgress >= 0.99) {
      this.currentStepIndex = 0;
      this.animProgress = 0.0;
    }

    this.isPlaying = !this.isPlaying;
    if (this.onPlayStateChange) this.onPlayStateChange(this.isPlaying);
    return this.isPlaying;
  }

  stepNext() {
    if (!this.animationSegments || this.animationSegments.length === 0) return;
    this.pause();

    const totalSegs = this.animationSegments.length;
    if (this.animProgress > 0.001) {
      this.animProgress = 1.0;
      this.applyStepState(this.currentStepIndex, 1.0);
      if (this.currentStepIndex < totalSegs - 1) {
        this.currentStepIndex++;
        this.animProgress = 0.0;
      }
    } else if (this.currentStepIndex < totalSegs - 1) {
      this.currentStepIndex++;
      this.animProgress = 0.0;
      this.applyStepState(this.currentStepIndex, 0.0);
    } else {
      this.animProgress = 1.0;
      this.applyStepState(this.currentStepIndex, 1.0);
    }
  }

  stepPrev() {
    if (!this.animationSegments || this.animationSegments.length === 0) return;
    this.pause();

    if (this.animProgress > 0.05) {
      this.animProgress = 0.0;
      this.applyStepState(this.currentStepIndex, 0.0);
    } else if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.animProgress = 0.0;
      this.applyStepState(this.currentStepIndex, 0.0);
    }
  }

  seek(percent) {
    if (!this.animationSegments || this.animationSegments.length === 0) return;
    this.pause();

    const totalSegments = this.animationSegments.length;
    const globalT = (Math.max(0, Math.min(100, percent)) / 100.0) * totalSegments;
    this.currentStepIndex = Math.min(Math.floor(globalT), totalSegments - 1);
    this.animProgress = Math.max(0.0, Math.min(1.0, globalT - this.currentStepIndex));
    this.applyStepState(this.currentStepIndex, this.animProgress);
  }

  setSpeed(speedVal) {
    this.animSpeed = Math.max(0.1, Number(speedVal) || 1.0);
  }

  resetAnimation() {
    this.pause();
    this.currentStepIndex = 0;
    this.animProgress = 0.0;
    this.applyStepState(0, 0.0);
  }

  setCameraPreset(preset) {
    if (!this.camera) return;
    this.camera.up.set(0, 1, 0);
    const s = this.currentCameraScale || 1.0;

    switch (preset) {
      case 'iso':
        // Well-proportioned isometric view ensuring all axes and labels fit completely
        this.camera.position.set(11.0 * s, 9.5 * s, 13.0 * s);
        break;
      case 'front':
        // Front elevation view: XY plane (X=Right, Y=Up, looking along -Z)
        this.camera.position.set(0, 0, 18 * s);
        this.camera.up.set(0, 1, 0);
        break;
      case 'top':
        // Top plan view: XZ plane (X=Right, Z=Depth, looking along -Y)
        this.camera.position.set(0, 18 * s, 0.0001);
        this.camera.up.set(0, 0, -1);
        break;
      case 'side':
        // Side profile view: YZ plane (Z=Right, Y=Up, looking along -X)
        this.camera.position.set(18 * s, 0, 0);
        this.camera.up.set(0, 1, 0);
        break;
      case 'reset':
      default:
        this.camera.position.set(11.0 * s, 9.5 * s, 13.0 * s);
        this.camera.up.set(0, 1, 0);
        break;
    }

    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  updateCameraFraming(maxCoord) {
    if (!this.camera || !this.controls) return;
    
    // Default framing comfortably fits coordinates up to ~7.0
    // Only scale out if vector coordinates genuinely exceed standard viewing range
    const targetScale = maxCoord > 7.0 ? Math.max(1.0, maxCoord / 6.5) : 1.0;
    
    if (Math.abs((this.currentCameraScale || 1.0) - targetScale) < 0.04) {
      return;
    }
    
    const prevScale = this.currentCameraScale || 1.0;
    this.currentCameraScale = targetScale;
    
    // Scale current camera distance from target while preserving line of sight
    const target = this.controls.target || new THREE.Vector3(0, 0, 0);
    const offset = this.camera.position.clone().sub(target);
    const dist = offset.length();
    if (dist > 0.001) {
      const scaleFactor = targetScale / prevScale;
      this.camera.position.copy(target).addScaledVector(offset.normalize(), dist * scaleFactor);
      this.camera.lookAt(target);
      this.controls.update();
    }
  }

  setupListeners() {
    const camButtons = document.querySelectorAll('.cam-btn');
    camButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.getAttribute('data-view');
        this.setCameraPreset(view);
      });
    });
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  /**
   * Captures an authentic high-resolution screenshot of the Three.js scene for a given step/fraction.
   * Restores the user's animation and state after capture.
   */
  captureScreenshot(stepIdx = 0, fraction = 0.0) {
    if (!this.renderer || !this.scene || !this.camera) return null;

    const savedStep = this.currentStepIndex;
    const savedFraction = this.animProgress;
    const savedPlaying = this.isPlaying;

    this.pause();
    this.applyStepState(stepIdx, fraction);

    // Render directly to the preserved WebGL drawing buffer
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.94);

    // Restore original state
    this.currentStepIndex = savedStep;
    this.animProgress = savedFraction;
    this.applyStepState(savedStep, savedFraction);
    if (savedPlaying) this.play();

    return dataUrl;
  }

  /**
   * Captures genuine screenshots for each experiment stage for inclusion in the PDF report.
   */
  captureStageScreenshots() {
    const screenshots = {};
    if (!this.animationSegments || this.animationSegments.length === 0) {
      screenshots.initial = this.captureScreenshot(0, 0.0);
      return screenshots;
    }

    // 1. Initial State (Step 0, t=0.0)
    screenshots.initial = this.captureScreenshot(0, 0.0);

    // 2. Each transformation step endpoint
    this.animationSegments.forEach((seg, idx) => {
      screenshots[`stage_${seg.stepIndex}`] = this.captureScreenshot(idx, 1.0);
    });

    return screenshots;
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleResize);
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const delta = (timestamp - this.lastTimestamp) / 1000.0;
    this.lastTimestamp = timestamp;

    if (this.isPlaying && this.animationSegments && this.animationSegments.length > 0) {
      const stepDuration = 2.0 / this.animSpeed;
      this.animProgress += delta / stepDuration;

      if (this.animProgress >= 1.0) {
        this.animProgress = 0.0;
        this.currentStepIndex++;
        if (this.currentStepIndex >= this.animationSegments.length) {
          // Wrap back to beginning
          this.currentStepIndex = 0;
        }
      }
      this.applyStepState(this.currentStepIndex, this.animProgress);
    }

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
