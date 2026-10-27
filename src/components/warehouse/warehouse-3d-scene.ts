import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ScenePlan, Vec3 } from "@/lib/warehouse/geometry";

export type DrawLocation = {
  locator: string;
  position: Vec3;
  size: Vec3;
  color: string;
};

type Callbacks = {
  onSelect?: (locator: string | null) => void;
};

type CameraTween = {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startedAt: number;
  duration: number;
};

const FRAME_COLOR = 0x3d5d82;
const FLOOR_COLOR = 0x0a1523;

function makeLabelSprite(
  text: string,
  accent = "#9fc4ff",
  scale = 1,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(10, 21, 35, 0.82)";
    context.strokeStyle = "rgba(120, 170, 235, 0.45)";
    context.lineWidth = 4;
    const radius = 22;
    context.beginPath();
    context.moveTo(radius, 8);
    context.lineTo(width - radius, 8);
    context.quadraticCurveTo(width - 8, 8, width - 8, radius);
    context.lineTo(width - 8, height - radius);
    context.quadraticCurveTo(width - 8, height - 8, width - radius, height - 8);
    context.lineTo(radius, height - 8);
    context.quadraticCurveTo(8, height - 8, 8, height - radius);
    context.lineTo(8, radius);
    context.quadraticCurveTo(8, 8, radius, 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.font = "bold 46px Arial, Helvetica, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = accent;
    context.fillText(text, width / 2, height / 2 + 2, width - 40);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5 * scale, 1.25 * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * Imperative three.js viewport. React only feeds it data and asks it to focus
 * a location, which keeps the render loop away from component re-renders.
 */
export class WarehouseScene {
  private host: HTMLElement;
  private callbacks: Callbacks;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frameGroup = new THREE.Group();
  private labelGroup = new THREE.Group();
  private locationMesh: THREE.InstancedMesh | null = null;
  private locationLookup: string[] = [];
  private hoverBox: THREE.LineSegments;
  private selectedBox: THREE.LineSegments;
  private grid: THREE.GridHelper | null = null;
  private floor: THREE.Mesh | null = null;
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private disposed = false;
  private pointerDown: { x: number; y: number; time: number } | null = null;
  private hovered: string | null = null;
  private selected: string | null = null;
  private plan: ScenePlan | null = null;
  private cameraTween: CameraTween | null = null;
  private targetPosition = new THREE.Vector3();

  constructor(host: HTMLElement, callbacks: Callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;

    this.scene.background = new THREE.Color(FLOOR_COLOR);
    this.scene.fog = new THREE.FogExp2(FLOOR_COLOR, 0.0012);

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    this.camera.position.set(60, 45, 80);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 650;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.target.copy(this.targetPosition);

    const hemisphere = new THREE.HemisphereLight(0xdcecff, 0x18283a, 1.15);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(40, 90, 30);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fc0ff, 0.5);
    fill.position.set(-60, 40, -30);
    this.scene.add(fill);

    this.scene.add(this.frameGroup);
    this.scene.add(this.labelGroup);

    const outlineGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(1, 1, 1),
    );
    this.hoverBox = new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x9fd0ff,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.hoverBox.visible = false;
    this.selectedBox = new THREE.LineSegments(
      outlineGeometry.clone(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.selectedBox.visible = false;
    this.scene.add(this.hoverBox, this.selectedBox);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );
    this.renderer.domElement.addEventListener(
      "pointerup",
      this.handlePointerUp,
    );
    this.renderer.domElement.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.animate();
  }

  setPlan(plan: ScenePlan, keepCamera = false): void {
    this.plan = plan;
    this.disposeGroup(this.frameGroup);
    this.disposeGroup(this.labelGroup);

    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = null;
    }
    if (this.floor) {
      this.scene.remove(this.floor);
      this.floor.geometry.dispose();
      (this.floor.material as THREE.Material).dispose();
      this.floor = null;
    }

    const width = plan.bounds.max[0] - plan.bounds.min[0];
    const depth = plan.bounds.max[2] - plan.bounds.min[2];

    const floorGeometry = new THREE.PlaneGeometry(
      width * 1.35 + 40,
      depth * 1.25 + 40,
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d1a2b,
      roughness: 0.95,
      metalness: 0.05,
    });
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.02;
    this.scene.add(this.floor);

    const gridSize = Math.max(width, depth) * 1.1 + 20;
    this.grid = new THREE.GridHelper(
      Math.max(60, gridSize),
      Math.max(30, Math.round(gridSize / 4)),
      0x24405f,
      0x16293e,
    );
    this.grid.position.y = 0;
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.65;
    this.scene.add(this.grid);

    if (plan.frames.length) {
      const frameGeometry = new THREE.BoxGeometry(1, 1, 1);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: FRAME_COLOR,
        roughness: 0.7,
        metalness: 0.25,
      });
      const frames = new THREE.InstancedMesh(
        frameGeometry,
        frameMaterial,
        plan.frames.length,
      );
      const matrix = new THREE.Matrix4();
      plan.frames.forEach((frame, index) => {
        matrix.compose(
          new THREE.Vector3(...frame.center),
          new THREE.Quaternion(),
          new THREE.Vector3(...frame.size),
        );
        frames.setMatrixAt(index, matrix);
      });
      frames.instanceMatrix.needsUpdate = true;
      frames.frustumCulled = false;
      this.frameGroup.add(frames);
    }

    plan.labels.forEach((label) => {
      const scale =
        label.kind === "aisle" ? 0.72 : label.kind === "detail" ? 0.42 : 1;
      const sprite = makeLabelSprite(
        label.text,
        label.kind === "area" ? "#cfe6ff" : "#8fb8e8",
        scale,
      );
      sprite.position.set(...label.position);
      this.labelGroup.add(sprite);
    });

    if (!keepCamera) this.resetView(false);
  }

  setLocations(locations: DrawLocation[]): void {
    if (this.locationMesh) {
      this.frameGroup.remove(this.locationMesh);
      this.locationMesh.geometry.dispose();
      const oldMaterial = this.locationMesh.material as
        THREE.Material | THREE.Material[];
      if (Array.isArray(oldMaterial))
        oldMaterial.forEach((entry) => entry.dispose());
      else oldMaterial.dispose();
      this.locationMesh.dispose();
      this.locationMesh = null;
    }
    this.locationLookup = [];
    this.hovered = null;
    this.hoverBox.visible = false;

    if (!locations.length) return;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geometry, material, locations.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    locations.forEach((location, index) => {
      matrix.compose(
        new THREE.Vector3(...location.position),
        new THREE.Quaternion(),
        new THREE.Vector3(...location.size),
      );
      mesh.setMatrixAt(index, matrix);
      color.set(location.color);
      mesh.setColorAt(index, color);
      this.locationLookup.push(location.locator);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.locationMesh = mesh;
    this.frameGroup.add(mesh);

    if (this.selected) this.showSelected(this.selected);
  }

  setSelected(locator: string | null): void {
    this.selected = locator;
    if (!locator) {
      this.selectedBox.visible = false;
      return;
    }
    this.showSelected(locator);
  }

  focus(locator: string): void {
    const plan = this.plan;
    if (!plan) return;
    const location = plan.locations.get(locator);
    if (!location) return;
    const target = new THREE.Vector3(...location.position);
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    const distance = Math.max(
      9,
      Math.min(26, this.plan ? this.plan.radius * 0.22 : 14),
    );
    const toPosition = target.clone().add(direction.multiplyScalar(distance));
    this.controls.autoRotate = false;
    this.startTween(toPosition, target);
  }

  resetView(animated = true): void {
    const plan = this.plan;
    if (!plan) return;
    const radius = Math.max(14, plan.radius);
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = Math.min(650, (radius * 1.15) / Math.tan(fov / 2));
    const target = new THREE.Vector3(...plan.center);
    const toPosition = new THREE.Vector3(
      target.x + distance * 0.62,
      target.y + distance * 0.58,
      target.z + distance * 0.72,
    );
    if (animated) {
      this.startTween(toPosition, target);
    } else {
      this.camera.position.copy(toPosition);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
  }

  topView(): void {
    const plan = this.plan;
    if (!plan) return;
    const radius = Math.max(14, plan.radius);
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = Math.min(650, (radius * 1.3) / Math.tan(fov / 2));
    const target = new THREE.Vector3(...plan.center);
    this.startTween(
      new THREE.Vector3(target.x, target.y + distance, target.z + 0.01),
      target,
    );
  }

  private showSelected(locator: string): void {
    const location = this.plan?.locations.get(locator);
    if (!location) {
      this.selectedBox.visible = false;
      return;
    }
    this.selectedBox.position.set(...location.position);
    this.selectedBox.scale.set(
      location.size[0] * 1.08,
      location.size[1] * 1.1,
      location.size[2] * 1.08,
    );
    this.selectedBox.visible = true;
  }

  private startTween(position: THREE.Vector3, target: THREE.Vector3): void {
    this.cameraTween = {
      fromPosition: this.camera.position.clone(),
      toPosition: position,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      startedAt:
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      duration: 550,
    };
  }

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: Date.now() };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown) return;
    const moved =
      Math.abs(event.clientX - this.pointerDown.x) +
      Math.abs(event.clientY - this.pointerDown.y);
    const elapsed = Date.now() - this.pointerDown.time;
    this.pointerDown = null;
    if (moved > 6 || elapsed > 700) return;
    this.updatePointer(event);
    const locator = this.pick();
    this.callbacks.onSelect?.(locator);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.buttons !== 0) return;
    this.updatePointer(event);
    const locator = this.pick();
    if (locator === this.hovered) return;
    this.hovered = locator;
    const location = locator ? this.plan?.locations.get(locator) : null;
    if (location) {
      this.hoverBox.position.set(...location.position);
      this.hoverBox.scale.set(
        location.size[0] * 1.05,
        location.size[1] * 1.05,
        location.size[2] * 1.05,
      );
      this.hoverBox.visible = true;
      this.renderer.domElement.style.cursor = "pointer";
    } else {
      this.hoverBox.visible = false;
      this.renderer.domElement.style.cursor = "grab";
    }
  };

  private handlePointerLeave = (): void => {
    this.hovered = null;
    this.hoverBox.visible = false;
  };

  private pick(): string | null {
    if (!this.locationMesh) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObject(
      this.locationMesh,
      false,
    );
    const hit = intersections.find(
      (entry) => typeof entry.instanceId === "number",
    );
    if (!hit || hit.instanceId === undefined) return null;
    return this.locationLookup[hit.instanceId] ?? null;
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);

    if (this.cameraTween) {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const progress = Math.min(
        1,
        (now - this.cameraTween.startedAt) / this.cameraTween.duration,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(
        this.cameraTween.fromPosition,
        this.cameraTween.toPosition,
        eased,
      );
      this.controls.target.lerpVectors(
        this.cameraTween.fromTarget,
        this.cameraTween.toTarget,
        eased,
      );
      if (progress >= 1) this.cameraTween = null;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private disposeGroup(group: THREE.Group): void {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as
          THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material))
          material.forEach((entry) => entry.dispose());
        else material?.dispose();
        const sprite = object as THREE.Sprite;
        if (sprite.isSprite) {
          const spriteMaterial = sprite.material as THREE.SpriteMaterial;
          spriteMaterial.map?.dispose();
          spriteMaterial.dispose();
        }
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );
    this.renderer.domElement.removeEventListener(
      "pointerup",
      this.handlePointerUp,
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );
    this.controls.dispose();
    this.disposeGroup(this.frameGroup);
    this.disposeGroup(this.labelGroup);
    this.locationMesh?.dispose();
    this.hoverBox.geometry.dispose();
    (this.hoverBox.material as THREE.Material).dispose();
    this.selectedBox.geometry.dispose();
    (this.selectedBox.material as THREE.Material).dispose();
    if (this.grid) {
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
    }
    if (this.floor) {
      this.floor.geometry.dispose();
      (this.floor.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
