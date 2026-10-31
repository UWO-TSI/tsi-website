import { DefaultLoadingManager } from "three";
import { assetUrl } from "@/lib/assetUrl";

// Every three loader (useGLTF, useTexture, GLTFLoader, TextureLoader) asks its manager for the URL it fetches: the
// default one now hands back the versioned URL (lib/assetUrl.ts). Import this first in a scene's root module, before
// anything that loads at import time (useGLTF.preload).
DefaultLoadingManager.setURLModifier(assetUrl);
