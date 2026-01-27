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
      z: voxelInstance.group.rotation.z
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
              object.material.forEach(material => material.dispose());
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
  const digits = counter.toString(2).padStart(256, "0");

  // 3. Create Voxels
  // Arrange them in a 6x6x7 block (252 voxels)
  const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ffcc,
    emissive: 0x004433,
    shininess: 100,
  });

  const group = new THREE.Group();
  let bitIndex = 4; // STARTING AT 4 to skip the color bits - for trsting only

  for (let z = 0; z < 7; z++) {
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
  }

  // Restore previous rotation
  group.rotation.x = previousRotation.x;
  group.rotation.y = previousRotation.y;
  group.rotation.z = previousRotation.z;

  scene.add(group);

  // 4. Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5).normalize();
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  camera.position.z = 12;

  // 5. Animation
  let animationId;
  function animate() {
    animationId = requestAnimationFrame(animate);
    group.rotation.y += 0.001;
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
    group  // Store the group to access rotation later
  };
}

export { renderVoxel };
