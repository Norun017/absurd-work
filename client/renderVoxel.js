import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js";

let voxelInstance = null; // Store the current instance

function renderVoxel(containerId, counter) {
  const container = document.getElementById(containerId);

  // Store previous rotation if it exists
  let previousRotation = { x: 0, y: 0, z: 0 };
  if (voxelInstance && voxelInstance.group) {
    previousRotation = {
      x: voxelInstance.group.rotation.x,
      y: voxelInstance.group.rotation.y,
      z: voxelInstance.group.rotation.z,
    };
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

  // 2. Convert to binary strings
  const totalVoxels = 252;
  const digits = counter.toString(2).padStart(totalVoxels, "0");

  // 3. Create Voxels
  // Arrange them in a 7x7x7 block (but not more than 256 voxels)
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x000000,
    emissive: 0x000000,
    specular: 0xffffff,
    shininess: 100,
  });

  const group = new THREE.Group();
  const dimX = 6;
  const dimY = 6;
  const dimZ = 7;
  const order = distanceOrder3D(dimX, dimY, dimZ, totalVoxels); // limit to 256 voxels
  console.log(order);
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
      });
      const borderLine = new THREE.LineSegments(edges, lineMaterial);
      voxel.add(borderLine);

      group.add(voxel);
    }
    bitIndex++;
  });

  /* for (let z = 0; z < 7; z++) {
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        if (bitIndex < 256 && digits[bitIndex] === "1") {
          const voxel = new THREE.Mesh(geometry, material);
          voxel.position.set(x - 2.5, y - 2.5, z - 3);
          group.add(voxel);
        }
        bitIndex++;
      }
    }
  } */

  // Restore previous rotation
  group.rotation.x = previousRotation.x;
  group.rotation.y = previousRotation.y;
  group.rotation.z = previousRotation.z;

  scene.add(group);

  // Add wireframe border
  const borderGeometry = new THREE.BoxGeometry(dimX, dimY, dimZ);
  const borderEdges = new THREE.EdgesGeometry(borderGeometry);
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
  const borderCube = new THREE.LineSegments(borderEdges, borderMaterial);
  // Center the border at same position as voxels
  borderCube.position.set(0, 0, 0);
  group.add(borderCube);

  // 4. Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5).normalize();
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  // Position camera further back to see all voxels
  camera.position.z = 10;

  // 5. Animation
  let animationId;
  function animate() {
    animationId = requestAnimationFrame(animate);
    group.rotation.y += 0.01;
    //group.rotation.x += 0.001;
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
