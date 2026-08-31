import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import fs from 'fs';

// Mock browser globals for FBXLoader if needed, or just run it via the actual browser...
// Actually, FBXLoader requires browser APIs (document, window, etc.)
// It's easier to just add a console.log in the actual game code and check the console.
