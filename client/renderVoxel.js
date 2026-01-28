import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let voxelInstance = null; // Store the current instance

function renderVoxel(containerId, counter) {
  const container = document.getElementById(containerId);

  // Store previous camera and controls state if it exists
  let previousState = {
    rotation: { x: 0, y: 0, z: 0 },
    cameraPosition: { x: 0, y: 0, z: 10 },
    controlsTarget: { x: 0, y: 0, z: 0 },
    controlsRotation: { theta: 0, phi: 0 },
  };

  if (voxelInstance) {
    if (voxelInstance.group) {
      previousState.rotation = {
        x: voxelInstance.group.rotation.x,
        y: voxelInstance.group.rotation.y,
        z: voxelInstance.group.rotation.z,
      };
    }
    if (voxelInstance.camera) {
      previousState.cameraPosition = {
        x: voxelInstance.camera.position.x,
        y: voxelInstance.camera.position.y,
        z: voxelInstance.camera.position.z,
      };
    }
    if (voxelInstance.controls) {
      previousState.controlsTarget = {
        x: voxelInstance.controls.target.x,
        y: voxelInstance.controls.target.y,
        z: voxelInstance.controls.target.z,
      };
      // Store spherical coordinates (theta and phi) for orbit rotation
      previousState.controlsRotation = {
        theta: voxelInstance.controls.getAzimuthalAngle(),
        phi: voxelInstance.controls.getPolarAngle(),
      };
    }
  }

  // Clean up previous instance
  if (voxelInstance) {
    if (voxelInstance.animationId) {
      cancelAnimationFrame(voxelInstance.animationId);
    }
    if (voxelInstance.renderer) {
      // Dispose of geometries and materials from the scene
      if (voxelInstance.scene) {
        voxelInstance.scene.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }

      // Dispose renderer and context
      voxelInstance.renderer.dispose();
      voxelInstance.renderer.forceContextLoss();

      // Remove canvas from DOM
      if (voxelInstance.renderer.domElement.parentNode) {
        voxelInstance.renderer.domElement.parentNode.removeChild(
          voxelInstance.renderer.domElement
        );
      }
    }
  }

  // 1. Setup scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 480 / 480, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(480, 480);
  container.appendChild(renderer.domElement);

  // Restore camera position
  camera.position.set(
    previousState.cameraPosition.x,
    previousState.cameraPosition.y,
    previousState.cameraPosition.z
  );

  // Add orbit control
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true; // Adds weight and smoothness
  controls.dampingFactor = 0.05;
  controls.autoRotate = true; // Keeps it spinning when you aren't touching it
  controls.autoRotateSpeed = 2.0;

  // Restore controls target and rotation
  controls.target.set(
    previousState.controlsTarget.x,
    previousState.controlsTarget.y,
    previousState.controlsTarget.z
  );

  // Update controls to apply the restored state
  controls.update();

  // 2. Convert to binary strings
  const totalVoxels = 252;
  const digits = counter.toString(2).padStart(totalVoxels, "0");

  // 3. Create Voxels
  // Arrange them in a 7x7x7 block (but not more than 256 voxels)
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  //const geometry = new THREE.SphereGeometry(0.6, 32, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x00000,
    /* specular: 0xffffff,
    shininess: 50, */
    metalness: 0,
    roughness: 0,
    /* transparent: true,
    opacity: 0.2,
    depthWrite: false, */
  });

  const group = new THREE.Group();
  const dimX = 6;
  const dimY = 6;
  const dimZ = 7;
  const order = distanceOrder3D(dimX, dimY, dimZ, totalVoxels); // limit to 256 voxels
  let bitIndex = 0;

  order.forEach((pos) => {
    if (bitIndex < totalVoxels && digits[bitIndex] === "1") {
      const voxel = new THREE.Mesh(geometry, material);
      const offsetX = (dimX - 1) / 2;
      const offsetY = (dimY - 1) / 2;
      const offsetZ = (dimZ - 1) / 2;
      voxel.position.set(pos.x - offsetX, pos.y - offsetY, pos.z - offsetZ); // center at 7x7x7 cube

      // add border for each voxels
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        depthTest: true,
        depthWrite: true,
      });
      const borderLine = new THREE.LineSegments(edges, lineMaterial);

      // Slightly scale up the edges to prevent z-fighting
      borderLine.scale.multiplyScalar(1.001);

      voxel.add(borderLine);

      group.add(voxel);
    }
    bitIndex++;
  });

  // Restore previous rotation
  group.rotation.x = previousState.rotation.x;
  group.rotation.y = previousState.rotation.y;
  group.rotation.z = previousState.rotation.z;

  scene.add(group);

  // Add wireframe border
  /* const borderGeometry = new THREE.BoxGeometry(dimX, dimY, dimZ);
  const borderEdges = new THREE.EdgesGeometry(borderGeometry);
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0xe5e5e5 });
  const borderCube = new THREE.LineSegments(borderEdges, borderMaterial);
  // Center the border at same position as voxels
  borderCube.position.set(0, 0, 0);
  group.add(borderCube); */

  // 4. Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  //light.position.set(5, 5, 5).normalize();
  const HemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  scene.add(light);
  //scene.add(new THREE.AmbientLight(0xffffff, 1));

  // 5. Animation
  let animationId;
  function animate() {
    animationId = requestAnimationFrame(animate);
    //group.rotation.y += 0.001;
    //group.rotation.x += 0.001;

    // Required if enableDamping or autoRotate is on
    controls.update();

    renderer.render(scene, camera);
  }
  animate();

  // Store instance for cleanup
  voxelInstance = {
    renderer,
    animationId,
    scene,
    camera,
    group, // Store the group to access rotation later
    controls, // Store controls to access state later
  };
}

// 3D distance order for sphere - from center outward
function distanceOrder3D(cols, rows, depth, totalVoxels) {
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const centerZ = (depth - 1) / 2;
  const order = [];
  let voxelCount = 0;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (voxelCount < totalVoxels) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dz = z - centerZ;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz); // 3D Euclidean distance

          order.push({ x, y, z, d });
        }
        voxelCount++;
      }
    }
  }

  // Sort by distance from center (innermost to outermost)
  // For sphere rendering, we want [0] to be center, so ascending order
  order.sort((b, a) => a.d - b.d || a.z - b.z || a.y - b.y || a.x - b.x);
  return order;
}

export { renderVoxel, distanceOrder3D };
